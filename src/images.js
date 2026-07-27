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

/** 글·슬롯별로 비율을 고른다 (같은 글은 늘 같은 결과). */
function pickAspect(title, slot, allowed) {
  const list = (allowed || []).filter((a) => ASPECTS[a]);
  const pool = list.length ? list : ['3:2', '4:3', '3:4'];
  return ASPECTS[pool[(hash(title) + slot * 7) % pool.length]];
}

/**
 * 텍스트 없이 사진만 잘라서 내보낸다.
 * 본문 사진은 카드보다 "그냥 현장 사진"처럼 보이는 편이 자연스럽다.
 */
async function renderPlainPhoto(browser, bgDataUri, [w, h], focus) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>
      *{margin:0;padding:0}
      html,body{width:${w}px;height:${h}px;overflow:hidden;background:#000}
      .p{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat;
         background-position:${focus};filter:contrast(1.06) saturate(1.08);}
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
  const bodies = briefs
    .filter((b) => b.placement === 'body')
    .slice(0, Math.max(0, cfg.images.bodyImages));
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
        // 원본보다 크게 그리면 뭉개진다 — 원본 크기로 상한을 건다
        const [bw, bh] = clampToSource(
          ...pickAspect(article.title, i, cfg.images.bodyAspects),
          bg.file
        );
        const focus = bg.isPerson ? 'center 25%' : 'center center';
        const p = await renderPlainPhoto(browser, bgDataUri, [bw, bh], focus);
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

      // 대표 이미지는 정사각. 티스토리 목록·공유 카드가 정사각으로 잘린다.
      // 원본보다 크게 그리면 사진이 뭉개지므로 원본 크기로 상한을 건다.
      const [width, height] = clampToSource(
        isThumb ? cfg.images.thumbSize || 1200 : cfg.images.width,
        isThumb ? cfg.images.thumbSize || 1200 : Math.round(cfg.images.height * 0.75),
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
      // 대표 이미지는 정보를 최소화한 clean 연출을 기본으로 쓴다
      const layout = isThumb
        ? cfg.images.layout || cfg.images.thumbLayout || 'clean'
        : pickLayout({
            title: article.title,
            slot: i,
            hasStat: !!statValue,
            forced: cfg.images.layout,
            isPerson,
            style: cfg.images.style || 'trendy',
          });
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
