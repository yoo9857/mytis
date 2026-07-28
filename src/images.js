import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { DIRS, stamp, safeSlug } from './paths.js';
import { log } from './log.js';
import { fetchBackgrounds } from './photo.js';
import { renderCard, pickLayout, personBgPosition, hash } from './cardLayouts.js';

/** 본문 사진의 가로세로 비율 후보 — 세로 사진도 섞이도록 한다. */
const ASPECTS = {
  '3:2': [1200, 800],
  '4:3': [1200, 900],
  '1:1': [1080, 1080],
  '3:4': [900, 1200],
  '2:3': [800, 1200],
  '16:9': [1200, 675],
};

/** 크롭으로 잘려나가도 괜찮은 한계. 이걸 넘으면 원본 비율을 그대로 쓴다. */
const MAX_CROP = 0.2;

/** 원본 비율을 그대로 쓰되 긴 변을 1200 에 맞춘다 (clampToSource 가 다시 줄인다). */
function nativeAspect(srcFile) {
  const { w, h } = imageSize(srcFile);
  if (!w || !h) return [1200, 800];
  const r = w / h;
  return r >= 1
    ? [1200, Math.max(1, Math.round(1200 / r))]
    : [Math.max(1, Math.round(1200 * r)), 1200];
}

/**
 * 글·슬롯별로 본문 사진의 비율을 고른다 (같은 글은 늘 같은 결과).
 *
 * **원본 사진의 방향을 반드시 먼저 본다.** 예전에는 `bodyAspects` 에서 해시로
 * 아무 비율이나 골랐는데, 가로 사진에 세로 프레임(`3:4`·`2:3`)이 걸리면
 * `background-size: cover` 가 양옆을 잘라내 인물 얼굴과 자막이 토막났다.
 *
 * > 2026-07-28 실측 — 고준희 글 3번째 이미지:
 * > 544x339 가로 캡처 → 292x390 세로 프레임. 얼굴이 왼쪽 끝에서 반쯤 잘리고
 * > 오른쪽 인물과 자막 글자가 사라졌다. 짧은 변 기준 축소 탓에 292px 로 작아지기까지 했다.
 *
 * 그래서 ① 원본과 방향이 같은 후보만 남기고 ② 그중에서도 잘려나가는 비율이
 * MAX_CROP 을 넘으면 버린다. 남는 게 없으면 **원본 비율을 그대로** 쓴다.
 * 연출 다양성보다 사진이 안 잘리는 쪽이 우선이다.
 */
function pickAspect(title, slot, allowed, srcFile) {
  const list = (allowed || []).filter((a) => ASPECTS[a]);
  const pool = list.length ? list : ['3:2', '4:3', '3:4'];

  const { w: sw, h: sh } = srcFile ? imageSize(srcFile) : { w: 0, h: 0 };
  if (!sw || !sh) return ASPECTS[pool[(hash(title) + slot * 7) % pool.length]];

  const srcRatio = sw / sh;
  // cover 로 채울 때 짧은 쪽이 얼마나 잘려나가는지 (0 = 손실 없음)
  const cropLoss = (a) => {
    const r = ASPECTS[a][0] / ASPECTS[a][1];
    return 1 - Math.min(srcRatio, r) / Math.max(srcRatio, r);
  };
  const sameOrientation = (a) => {
    const r = ASPECTS[a][0] / ASPECTS[a][1];
    return (r >= 1 && srcRatio >= 1) || (r <= 1 && srcRatio <= 1);
  };

  const safe = pool.filter((a) => sameOrientation(a) && cropLoss(a) <= MAX_CROP);
  if (safe.length) return ASPECTS[safe[(hash(title) + slot * 7) % safe.length]];

  // 쓸 만한 후보가 없다 — 원본 비율을 그대로 살린다.
  // 긴 변을 1200 으로 맞춰 두면 clampToSource 가 원본 크기까지만 줄여 준다.
  log.debug(`원본 비율 유지: ${sw}x${sh} (안전한 후보 없음 · 후보 ${pool.join(',')})`);
  return srcRatio >= 1
    ? [1200, Math.max(1, Math.round(1200 / srcRatio))]
    : [Math.max(1, Math.round(1200 * srcRatio)), 1200];
}

/**
 * 사진 색보정(룩) — **새 의존성 없이 CSS 필터로 한다.**
 *
 * 이미지는 Playwright 로 HTML 을 렌더해 스크린샷으로 뽑는다. 그래서 sharp·canvas
 * 같은 이미지 처리 라이브러리를 들이지 않고 `filter` 한 줄로 톤을 통일할 수 있다.
 *
 * `canon` — 캐논 색감. 특징은 **따뜻한 색온도 + 높은 채도 + 부드러운 콘트라스트**다.
 *   · `sepia` 를 아주 살짝 섞고 `hue-rotate` 로 되돌리면 **색온도만 따뜻해진다**
 *     (sepia 만 쓰면 누렇게 죽는다. 되돌리는 각도가 핵심이다)
 *   · 채도는 올리되 콘트라스트는 과하게 올리지 않는다 — 온천·실내처럼 어두운
 *     장면에서 콘트라스트를 올리면 그림자가 뭉개진다
 *
 * 여러 출처(원문 사진·스톡·위키미디어)에서 온 사진이 섞이면 톤이 제각각이라
 * 글이 산만해 보인다. 같은 룩을 씌우면 한 사람이 같은 카메라로 찍은 것처럼 묶인다.
 */
const LOOKS = {
  none: '',
  // 기존 기본값. 밋밋하지만 원본을 가장 덜 건드린다
  neutral: 'contrast(1.06) saturate(1.08)',
  // 캐논 느낌 — 따뜻하고 채도가 살아 있으며 그림자가 부드럽다
  canon: 'brightness(1.02) contrast(1.04) saturate(1.16) sepia(0.10) hue-rotate(-8deg)',
  // 필름 느낌 — 채도를 살짝 낮추고 콘트라스트를 올린다
  film: 'contrast(1.12) saturate(0.94) sepia(0.06) hue-rotate(-4deg)',
};

export function photoLook(cfg) {
  const name = cfg?.images?.look || 'neutral';
  const filter = LOOKS[name] ?? LOOKS.neutral;
  return filter ? `filter:${filter};` : '';
}

/**
 * 텍스트 없이 사진만 잘라서 내보낸다.
 * 본문 사진은 카드보다 "그냥 현장 사진"처럼 보이는 편이 자연스럽다.
 */
async function renderPlainPhoto(browser, bgDataUri, [w, h], focus, look = LOOKS.neutral) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>
      *{margin:0;padding:0}
      html,body{width:${w}px;height:${h}px;overflow:hidden;background:#000}
      .p{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat;
         background-position:${focus};${look ? `filter:${look};` : ''}}
    </style></head><body><div class="p" style="background-image:url('${bgDataUri}')"></div></body></html>`,
    { waitUntil: 'load' }
  );
  await page.waitForTimeout(400);
  return page;
}

const MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

/**
 * 이미지 파일의 실제 픽셀 크기를 헤더에서 읽는다 (JPEG · PNG · WebP).
 *
 * 왜 필요한가: 언론사 사진은 660~780px 인 경우가 흔한데, 카드를 1200px 로
 * 렌더링하면 CSS 가 `background-size: cover` 로 늘려 눈에 띄게 뭉개진다.
 * 원본보다 크게 만들지 않으려면 원본 크기를 알아야 한다.
 */
export function imageSize(file) {
  try {
    const b = fs.readFileSync(file);
    // PNG
    if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
      return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    }
    // JPEG — SOFn 마커에서 크기를 읽는다
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    // WebP
    const v = b.indexOf('VP8');
    if (v > 0) {
      const tag = b.slice(v, v + 4).toString();
      if (tag === 'VP8X') {
        return { w: (b.readUIntLE(v + 8, 3) & 0xffffff) + 1, h: (b.readUIntLE(v + 11, 3) & 0xffffff) + 1 };
      }
      if (tag === 'VP8L') {
        const bits = b.readUInt32LE(v + 9);
        return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
      }
      return { w: b.readUInt16LE(v + 14) & 0x3fff, h: b.readUInt16LE(v + 16) & 0x3fff };
    }
  } catch (err) {
    log.debug(`이미지 크기 확인 실패 (${file}): ${err.message}`);
  }
  return { w: 0, h: 0 };
}

/**
 * 원본보다 크게 렌더링하지 않도록 출력 크기를 줄인다.
 * 비율은 그대로 두고 짧은 변을 기준으로 축소한다.
 * 약간(15%)의 업스케일은 허용한다 — 그 정도는 눈에 안 띄고, 너무 작게
 * 내보내면 티스토리 목록·공유 카드에서 되레 흐려진다.
 */
function clampToSource(w, h, srcFile) {
  if (!srcFile) return [w, h];
  const { w: sw, h: sh } = imageSize(srcFile);
  if (!sw || !sh) return [w, h];
  const scale = Math.min((sw * 1.15) / w, (sh * 1.15) / h, 1);
  if (scale >= 1) return [w, h];
  const out = [Math.round(w * scale), Math.round(h * scale)];
  log.debug(`업스케일 방지: ${w}x${h} → ${out[0]}x${out[1]} (원본 ${sw}x${sh})`);
  return out;
}

/** 로컬 이미지 파일을 data URI 로 변환한다 (setContent 는 로컬 경로를 못 읽는다). */
function toDataUri(file) {
  try {
    const ext = path.extname(file).slice(1).toLowerCase();
    const mime = MIME[ext] || 'image/jpeg';
    return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
  } catch (err) {
    log.debug(`data URI 변환 실패 (${file}): ${err.message}`);
    return null;
  }
}

/**
 * 배경 사진의 평균 밝기(0~255)를 잰다.
 * 카드 페이지 안에서 캔버스로 축소 렌더링해 픽셀을 훑는다.
 */
async function measureLuma(page, dataUri) {
  try {
    return await page.evaluate(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            try {
              const w = 64;
              const h = Math.max(1, Math.round((img.height / img.width) * w));
              const c = document.createElement('canvas');
              c.width = w;
              c.height = h;
              const ctx = c.getContext('2d', { willReadFrequently: true });
              ctx.drawImage(img, 0, 0, w, h);
              const { data } = ctx.getImageData(0, 0, w, h);
              let sum = 0;
              const n = data.length / 4;
              for (let i = 0; i < data.length; i += 4) {
                sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
              }
              resolve(sum / n);
            } catch {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = src;
        }),
      dataUri
    );
  } catch {
    return null;
  }
}

/** 본문에서 카드에 쓸 만한 핵심 수치를 찾아낸다 (codex 가 안 준 경우의 보조 수단). */
function guessStat(article, sectionIndex) {
  const sec = article.sections?.[Math.max(0, sectionIndex - 1)];
  const pool = [
    ...(sec?.paragraphs || []),
    ...(sec?.bullets || []),
    ...(article.keyTakeaways || []),
  ];
  for (const text of pool) {
    const m = String(text).match(
      /(\d[\d,]*(?:\.\d+)?\s*(?:%|퍼센트|만\s*원|억\s*원|천\s*원|원|만|년|개월|일|배|위|명|건))/
    );
    if (m) return m[1].replace(/\s+/g, '');
  }
  return '';
}

/**
 * imageBriefs 를 PNG 카드로 렌더링한다.
 *
 * - cfg.images.background 가 'photo' 면 실사 사진을 배경으로 깐다
 * - 레이아웃은 글 제목 해시 + 슬롯 번호로 골라서 글마다·이미지마다 다르게 나온다
 * - 본문의 핵심 수치를 카드에 반영한다
 *
 * @returns {Promise<{thumbnail: object|null, body: object[]}>}
 */
export async function renderImages(article, cfg) {
  const result = { thumbnail: null, body: [] };
  if (!cfg.images.enabled) {
    log.info('이미지 생성이 비활성화되어 있습니다 (images.enabled=false).');
    return result;
  }

  const briefs = [...(article.imageBriefs || [])];

  // 대표 이미지가 없으면 제목으로 하나 만든다
  if (cfg.images.thumbnail && !briefs.some((b) => b.placement === 'thumbnail')) {
    briefs.unshift({
      placement: 'thumbnail',
      headline: article.title.slice(0, 30),
      subline: article.metaDescription.slice(0, 42),
      eyebrow: '',
      caption: '',
      alt: article.title,
      afterSection: 0,
      photoQuery: '',
      statValue: '',
      statLabel: '',
    });
  }

  const thumbs = briefs.filter((b) => b.placement === 'thumbnail').slice(0, 1);
  // 글별 지정(article.bodyImageCount)이 있으면 그걸 쓴다 — cfg 를 고치면
  // 큐 모드에서 다음 글까지 값이 새어 나간다 (run.js 의 applyClipShotLayout 참고)
  const bodyCount = article.bodyImageCount ?? cfg.images.bodyImages;
  const bodies = briefs
    .filter((b) => b.placement === 'body')
    .slice(0, Math.max(0, bodyCount));
  const targets = [...(cfg.images.thumbnail ? thumbs : []), ...bodies];

  if (!targets.length) return result;

  // 실사 배경 확보 (실패한 슬롯은 null → 그라디언트로 폴백)
  let backgrounds = new Array(targets.length).fill(null);
  try {
    backgrounds = await fetchBackgrounds(article, cfg, targets.length);
  } catch (err) {
    log.warn(`배경 사진 확보 실패: ${err.message} — 그라디언트로 진행합니다.`);
  }

  fs.mkdirSync(DIRS.images, { recursive: true });
  const palettes = cfg.images.palettes?.length
    ? cfg.images.palettes
    : [['#1e1b4b', '#4c1d95', '#7c3aed']];
  const basePalette = hash(article.title) % palettes.length;
  const prefix = `${stamp()}-${safeSlug(article.title, 'img')}`;

  log.step(`이미지 카드 ${targets.length}장 렌더링`);
  const browser = await chromium.launch({ headless: true });
  const usedLayouts = [];

  try {
    for (let i = 0; i < targets.length; i++) {
      const brief = targets[i];
      const palette = palettes[(basePalette + i) % palettes.length];
      const isThumb = brief.placement === 'thumbnail';

      const bg = backgrounds[i];
      const bgDataUri = bg ? toDataUri(bg.file) : null;

      // 본문 사진은 텍스트 없이 원본 사진만 쓰고, 비율도 글마다 다르게 섞는다
      if (!isThumb && cfg.images.bodyStyle === 'photo' && bgDataUri) {
        /* 장면 캡처와 보도사진은 **원본 비율 그대로** 둔다.
         *
         * 이 사진들에는 글자가 박혀 있다 — 방송 화면에는 자막이, 보도사진에는
         * 포스터 제목이나 그래픽이 들어간다. 조금만 잘라도 글자가 끊긴다.
         * 연출을 위해 비율을 섞을 대상이 아니다.
         *
         * > 2026-07-28 실측:
         * >   1920x1080 캡처를 3:2 로 담으니 좌우 15.6% 가 날아가 자막이 토막났다.
         * >   김부장 포스터(1.78)를 1.50 으로 담으니 제목 "AGENT KIM" 이
         * >   양쪽에서 잘려 "GENT KI" 만 남았다.
         *
         * 비율을 섞는 연출은 **스톡 사진에만** 쓴다. 스톡은 잘려도 손실이 없다. */
        const keepNative = bg.source === 'clip-shot' || bg.source === 'source-article';
        const [bw, bh] = clampToSource(
          ...(keepNative
            ? nativeAspect(bg.file)
            : pickAspect(article.title, i, cfg.images.bodyAspects, bg.file)),
          bg.file
        );
        const focus = bg.isPerson ? 'center 25%' : 'center center';
        const p = await renderPlainPhoto(browser, bgDataUri, [bw, bh], focus, LOOKS[cfg.images.look] ?? LOOKS.neutral);
        const file = path.join(DIRS.images, `${prefix}-body${i}.png`);
        await p.screenshot({ path: file, type: 'png' });
        await p.close();

        result.body.push({
          file,
          placement: 'body',
          alt: brief.alt || brief.headline || article.title,
          caption: brief.caption || '',
          afterSection: brief.afterSection || i,
          layout: 'photo',
          background: {
            credit: bg.credit,
            photographer: bg.photographer || '',
            license: bg.license || '',
            source: bg.source || '',
            pageUrl: bg.pageUrl || '',
            isPerson: !!bg.isPerson,
          },
        });
        usedLayouts.push(`photo${bw > bh ? '↔' : bw < bh ? '↕' : '□'}`);
        log.debug(`본문 사진: ${path.basename(file)} (${bw}x${bh}, 텍스트 없음)`);
        continue;
      }

      /* 대표 이미지는 정사각. 티스토리 목록·공유 카드가 정사각으로 잘린다.
       * 원본보다 크게 그리면 사진이 뭉개지므로 원본 크기로 상한을 건다.
       *
       * 다만 **영상 장면 캡처는 16:9 로 둔다.** 방송 화면에는 자막이 박혀 있어
       * 정사각으로 자르면 좌우 44% 가 날아가며 자막이 글자 중간에서 잘린다.
       *
       * > 2026-07-28 실측 — 나는솔로 캡처를 1200x1200 으로 자른 대표 이미지:
       * > "그래도 데이트할 때 / 여행 갔을 때 여자친구…" 가 양옆에서 토막나
       * > 무슨 말인지 알 수 없게 됐다. */
      const thumbIsClip = isThumb && bg?.source === 'clip-shot';
      const thumbBase = cfg.images.thumbSize || 1200;
      const [width, height] = clampToSource(
        isThumb ? thumbBase : cfg.images.width,
        isThumb
          ? thumbIsClip
            ? Math.round((thumbBase * 9) / 16)
            : thumbBase
          : Math.round(cfg.images.height * 0.75),
        bg?.file
      );

      // 강조 수치: codex 가 준 값 우선, 없으면 본문에서 찾아본다
      let statValue = brief.statValue || '';
      let statLabel = brief.statLabel || '';
      if (!statValue && !isThumb && cfg.images.useStats !== false) {
        statValue = guessStat(article, brief.afterSection || i);
        if (statValue && !statLabel) statLabel = '';
      }

      const isPerson = !!bg?.isPerson;
      /* 연출은 **사진 종류에 따라** 고른다.
       *
       * 방송 캡처와 보도사진에는 이미 글자가 박혀 있다 — 자막, 포스터 제목,
       * 방송사 로고. 그 위에 컬러 패널이나 짙은 띠를 얹는 연출을 쓰면
       * **글자 위에 글자가 겹쳐** 둘 다 못 읽는다. 그래서 사진을 최대한
       * 살리고 제목만 얹는 `clean` 을 쓴다.
       *
       * 반대로 스톡 사진(Pexels·Unsplash·Openverse)은 배경이 깨끗해서
       * editorial·band·panel 같은 연출이 잘 어울린다. 예전에는 `images.style`
       * 설정으로만 도달할 수 있어 사실상 쓰이지 않던 연출들이다.
       *
       * `images.layout` 으로 강제하면 그 값이 우선한다. */
      const printedOn = bg?.source === 'clip-shot' || bg?.source === 'source-article';
      const layout =
        cfg.images.layout ||
        (printedOn
          ? cfg.images.thumbLayout || 'clean'
          : isThumb
            ? cfg.images.thumbLayout || 'clean'
            : pickLayout({
                title: article.title,
                slot: i,
                hasStat: !!statValue,
                isPerson,
                style: cfg.images.style || 'trendy',
              }));
      usedLayouts.push(layout);

      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      await page.setContent(
        renderCard({
          headline: brief.headline || article.title,
          subline: brief.subline || '',
          eyebrow: brief.eyebrow || '',
          statValue,
          statLabel,
          brand: cfg.images.brand,
          palette,
          width,
          height,
          isThumb,
          layout,
          bgDataUri,
          // 인물 사진은 얼굴이 잘리지 않도록 크롭 위치를 바꾼다
          bgPosition: isPerson ? personBgPosition(layout, bg.portrait) : '',
          credit: bgDataUri && cfg.images.showCredit ? bg.credit : '',
        }),
        { waitUntil: 'load' }
      );
      await page.waitForTimeout(bgDataUri ? 450 : 180); // 배경 디코딩 대기

      // 사진 밝기에 맞춰 스크림 세기를 자동 조절한다.
      // 어두운 사진에 기본 스크림을 그대로 얹으면 탁해지고, 밝은 사진은 글자가 묻힌다.
      if (bgDataUri) {
        const luma = await measureLuma(page, bgDataUri);
        if (luma !== null) {
          const opacity = Math.min(1, Math.max(0.35, 0.35 + (luma / 255) * 0.9));
          await page.evaluate((o) => {
            const el = document.querySelector('.scrim');
            if (el) el.style.opacity = String(o);
          }, opacity);
          await page.waitForTimeout(120);
          log.debug(`  배경 밝기 ${Math.round(luma)} → 스크림 ${opacity.toFixed(2)}`);
        }
      }

      const file = path.join(DIRS.images, `${prefix}-${isThumb ? 'thumb' : `body${i}`}.png`);
      await page.screenshot({ path: file, type: 'png' });
      await page.close();

      const entry = {
        file,
        placement: brief.placement,
        alt: brief.alt || brief.headline || article.title,
        caption: isThumb ? '' : brief.caption || '',
        afterSection: isThumb ? 0 : brief.afterSection || i,
        layout,
        background: bg
          ? {
              credit: bg.credit,
              photographer: bg.photographer || '',
              license: bg.license || '',
              source: bg.source || '',
              pageUrl: bg.pageUrl || '',
              isPerson,
            }
          : null,
      };
      if (isThumb) result.thumbnail = entry;
      else result.body.push(entry);

      log.debug(
        `이미지 생성: ${path.basename(file)} (${width}x${height}, ${layout}` +
          `${bgDataUri ? ', 실사 배경' : ', 그라디언트'}${statValue ? `, 수치 ${statValue}` : ''})`
      );
    }
  } finally {
    await browser.close();
  }

  const photoCount = backgrounds.filter(Boolean).length;
  log.ok(
    `이미지 ${targets.length}장 생성 (대표 ${result.thumbnail ? 1 : 0} · 본문 ${result.body.length}` +
      ` · 실사 배경 ${photoCount}장 · 연출 ${usedLayouts.join('/')})`
  );
  return result;
}
