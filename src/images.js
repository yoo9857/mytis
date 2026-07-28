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
 *
 * ---
 *
 * 후지필름 계열을 넣으려면 **필터만으로는 부족하다.**
 *
 * 필름 톤의 정체는 채도·콘트라스트가 아니라 **들린 블랙(faded black)** 이다.
 * 가장 어두운 부분이 완전한 검정으로 떨어지지 않고 회색·청록에서 멈춘다.
 * CSS `filter` 에는 커브도 채널별 조정도 없어서 이걸 만들 수 없다 —
 * `brightness` 를 올리면 어두운 곳만이 아니라 **사진 전체가 밝아진다.**
 *
 * 그래서 룩은 세 겹으로 쓴다:
 *   · `filter`  — 채도·콘트라스트·색온도 (기존과 동일)
 *   · `overlay` — 위에 얹는 반투명 레이어. `mix-blend-mode:screen` 은
 *                 **어두운 픽셀만 밀어 올린다**(밝은 곳은 거의 안 변한다).
 *                 이게 블랙을 들어 올려 필름처럼 보이게 하는 실제 장치다.
 *   · `glow`    — **사진을 한 겹 더 깔아 흐리게 만든 뒤 `screen` 으로 얹는다.**
 *                 밝은 부분이 은은하게 번진다. 보정 앱이 "예쁘게" 만들 때 쓰는
 *                 소프트 글로우가 이것이고, **색 조정만으로는 절대 안 나온다.**
 *
 * 오버레이·글로우는 **본문 사진 전용**이다. 카드(대표 이미지)에는 스크림·글자가
 * 이미 얹혀 있어 한 겹 더 깔면 글자 대비가 무너진다. 카드에는 `filter` 만 간다.
 */
const LOOKS = {
  none: { filter: '' },
  // 기존 기본값. 밋밋하지만 원본을 가장 덜 건드린다
  neutral: { filter: 'contrast(1.06) saturate(1.08)' },
  // 캐논 느낌 — 따뜻하고 채도가 살아 있으며 그림자가 부드럽다
  canon: { filter: 'brightness(1.02) contrast(1.04) saturate(1.16) sepia(0.10) hue-rotate(-8deg)' },
  // 필름 느낌 — 채도를 살짝 낮추고 콘트라스트를 올린다
  film: { filter: 'contrast(1.12) saturate(0.94) sepia(0.06) hue-rotate(-4deg)' },

  /* 후지필름 클래식크롬 — 채도를 **낮추고** 콘트라스트를 올린다. 캐논의 반대편이다.
   * 다큐멘터리 톤이라 정보 전달에 강하고 촌스러워지지 않는다.
   * 그림자에 청록을 살짝 섞는 게 클래식크롬의 지문이다. */
  fuji: {
    filter: 'contrast(1.14) saturate(0.86) brightness(1.01) sepia(0.04) hue-rotate(6deg)',
    overlay: 'background:rgba(24,42,52,0.10);mix-blend-mode:screen;',
  },
  /* 후지 감성 (에어리·파스텔) — 여행 감성글에서 쓰는 그 톤.
   * 콘트라스트를 **내리고** 블랙을 크게 들어 올려 뽀얗게 만든다.
   * 채도는 거의 그대로 둔다 — 낮추면 감성이 아니라 그냥 흐린 사진이 된다. */
  fujiSoft: {
    filter: 'contrast(0.93) saturate(1.04) brightness(1.03) sepia(0.05) hue-rotate(-3deg)',
    overlay: 'background:rgba(255,241,232,0.14);mix-blend-mode:screen;',
  },
  /* 후지 벨비아 — 풍경용 고채도. 야경·조명·수영장 물색이 살아난다.
   * 인물에는 쓰지 않는다 (피부가 붉게 뜬다). */
  velvia: {
    filter: 'contrast(1.16) saturate(1.34) brightness(0.99) sepia(0.03) hue-rotate(-5deg)',
  },
  /* 후지 에테르나 — 시네마 톤. 채도·콘트라스트 모두 낮은 평탄한 화면.
   * 사진 여러 장을 한 흐름으로 묶을 때 가장 안정적이다. */
  eterna: {
    filter: 'contrast(0.96) saturate(0.88) brightness(1.02)',
    overlay: 'background:rgba(30,38,46,0.12);mix-blend-mode:screen;',
  },

  /* ── 인스타 감성 (여성 독자 타깃) ─────────────────────────────
   * 이 톤들의 정체는 색이 아니라 **소프트 글로우**다. 밝은 부분이 은은하게
   * 번져 화면이 부드러워지는 것 — 보정 앱이 "예쁘게" 만들 때 쓰는 그 장치다.
   * `glow` 는 사진을 한 겹 더 깔아 흐리게(blur) 만든 뒤 `screen` 으로 얹는다.
   * 색만 만지면 절대 이 느낌이 안 난다. */

  /* 로지 파스텔 — 살구·핑크를 얹어 뽀얗게. 조명·수증기가 예쁘게 뜬다.
   * 야간 조명이 있는 장면에서 가장 강하다. */
  instaRosy: {
    filter: 'contrast(0.96) saturate(1.06) brightness(1.00) sepia(0.07) hue-rotate(-8deg)',
    overlay: 'background:linear-gradient(160deg,rgba(255,214,224,0.10),rgba(255,236,214,0.06));mix-blend-mode:screen;',
    glow: { blur: 18, opacity: 0.16 },
  },
  /* 청량 글로우 — 민트·블루를 살짝. 물·유리·야경이 시원하게 빠진다.
   * 수영장·노천탕 사진에 맞고, 실내 목재 톤에는 차갑게 나온다. */
  instaAiry: {
    filter: 'contrast(0.97) saturate(1.10) brightness(1.00) hue-rotate(4deg)',
    overlay: 'background:linear-gradient(200deg,rgba(214,240,255,0.10),rgba(255,255,255,0.05));mix-blend-mode:screen;',
    glow: { blur: 22, opacity: 0.16 },
  },
  /* 골든아워 — 해질녘 금빛. 창가·석양·조명등 사진을 가장 예쁘게 만든다.
   * 흐린 날 사진에 쓰면 누렇게 뜬다. */
  goldenHour: {
    filter: 'contrast(0.98) saturate(1.14) brightness(1.00) sepia(0.12) hue-rotate(-12deg)',
    overlay: 'background:linear-gradient(180deg,rgba(255,206,150,0.10),rgba(255,170,120,0.05));mix-blend-mode:screen;',
    glow: { blur: 16, opacity: 0.15 },
  },
};

/** 룩 이름 → { filter, overlay, glow }. 없는 이름은 neutral 로 떨어진다 */
export function resolveLook(name) {
  const look = LOOKS[name] || LOOKS.neutral;
  return { filter: look.filter || '', overlay: look.overlay || '', glow: look.glow || null };
}

export const LOOK_NAMES = Object.keys(LOOKS);

export function photoLook(cfg) {
  const { filter } = resolveLook(cfg?.images?.look || 'neutral');
  return filter ? `filter:${filter};` : '';
}

/**
 * 텍스트 없이 사진만 잘라서 내보낸다.
 * 본문 사진은 카드보다 "그냥 현장 사진"처럼 보이는 편이 자연스럽다.
 */
async function renderPlainPhoto(browser, bgDataUri, [w, h], focus, look = LOOKS.neutral) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(photoHtml(bgDataUri, w, h, focus, look), { waitUntil: 'load' });
  await page.waitForTimeout(400);
  return page;
}

/**
 * 사진 한 장을 룩과 함께 그리는 HTML. **비교 도구(`scripts/look-compare.mjs`)가
 * 같은 함수를 쓴다** — 비교 화면과 실제 결과가 어긋나면 비교가 의미를 잃는다.
 *
 * 레이어 순서: 사진 → 글로우(흐린 사진 복사본) → 색 오버레이.
 *
 * 글로우 레이어는 **일부러 사진보다 크게** 잡는다 — `blur(n)` 의 번짐이 대략 `3n` 까지
 * 퍼지므로 여백을 `3n` 으로 준다. 같은 크기로 흐리면 가장자리가 투명과 섞여
 * **테두리에 띠가 생긴다**(액자처럼 보인다). 퍼센트로 주면 작은 사진에서 여백이
 * 모자라므로 픽셀로 준다.
 */
export function photoHtml(bgDataUri, w, h, focus, look) {
  const { filter, overlay, glow } =
    typeof look === 'string' ? { filter: look, overlay: '', glow: null } : look || {};
  return `<!doctype html><html><head><meta charset="utf-8"><style>
      *{margin:0;padding:0}
      html,body{width:${w}px;height:${h}px;overflow:hidden;background:#000}
      .w{position:absolute;inset:0;overflow:hidden}
      .p{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat;
         background-position:${focus};${filter ? `filter:${filter};` : ''}}
      .g{position:absolute;inset:${glow ? -glow.blur * 3 : 0}px;background-size:cover;
         background-repeat:no-repeat;background-position:${focus};pointer-events:none;
         ${glow ? `filter:blur(${glow.blur}px) brightness(1.06);opacity:${glow.opacity};mix-blend-mode:screen;` : ''}}
      .o{position:absolute;inset:0;pointer-events:none;${overlay}}
    </style></head><body><div class="w">
      <div class="p" style="background-image:url('${bgDataUri}')"></div>
      ${glow ? `<div class="g" style="background-image:url('${bgDataUri}')"></div>` : ''}
      ${overlay ? '<div class="o"></div>' : ''}
    </div></body></html>`;
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
        /* 눈으로 골라 둔 로컬 사진도 원본 비율로 둔다.
         * 여행 글의 사진은 **간판·안내판이 장소를 증명하는 컷**이라(라쿠아 실측:
         * `東京ドーム天然温泉 Spa LaQua` 금색 간판, `OTONA Beach` 나무 간판)
         * 비율을 바꿔 자르면 증거가 프레임 밖으로 나간다. */
        const keepNative =
          bg.source === 'clip-shot' || bg.source === 'source-article' || bg.source === 'local-photo';
        const [bw, bh] = clampToSource(
          ...(keepNative
            ? nativeAspect(bg.file)
            : pickAspect(article.title, i, cfg.images.bodyAspects, bg.file)),
          bg.file
        );
        const focus = bg.isPerson ? 'center 25%' : 'center center';
        const p = await renderPlainPhoto(browser, bgDataUri, [bw, bh], focus, resolveLook(cfg.images.look));
        const file = path.join(DIRS.images, `${prefix}-body${i}.png`);
        await p.screenshot({ path: file, type: 'png' });
        await p.close();

        result.body.push({
          file,
          placement: 'body',
          alt: brief.alt || brief.headline || article.title,
          caption: brief.caption || '',
          afterSection: brief.afterSection || i,
          afterParagraph: brief.afterParagraph ?? null,
          group: brief.group || '',
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
      /* 눈으로 골라 둔 로컬 사진도 정사각으로 자르지 않는다.
       * 세로 4:5 컷(인스타 기본 비율)을 정사각으로 담으면 위아래가 20% 날아가
       * 간판이나 하늘·수면이 잘려 "무엇을 찍은 사진인지" 가 흐려진다.
       * → 원본 비율을 유지하고 폭만 thumbSize 로 맞춘다. */
      const thumbIsClip = isThumb && bg?.source === 'clip-shot';
      const thumbNative = isThumb && bg?.source === 'local-photo';
      const thumbBase = cfg.images.thumbSize || 1200;
      const [width, height] = clampToSource(
        isThumb ? thumbBase : cfg.images.width,
        isThumb
          ? thumbIsClip
            ? Math.round((thumbBase * 9) / 16)
            : thumbNative
              ? Math.round(thumbBase * (nativeAspect(bg.file)[1] / nativeAspect(bg.file)[0]))
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
      const printedOn =
        bg?.source === 'clip-shot' || bg?.source === 'source-article' || bg?.source === 'local-photo';
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
          // 전역 룩 — 레이아웃 자기 필터 뒤에 붙는다 (레이아웃 의도가 먼저다)
          photoLook: resolveLook(cfg.images.look).filter,
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
        // 아티클이 지정한 배치 — 어느 문단 뒤에 놓을지, 어느 사진과 묶을지
        afterParagraph: brief.afterParagraph ?? null,
        group: brief.group || '',
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
