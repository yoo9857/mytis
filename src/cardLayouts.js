import { esc } from './html.js';
import { TRENDY_LAYOUTS, TRENDY_NAMES, TRENDY_PALETTES } from './cardStyles.js';

export { TRENDY_PALETTES };

/**
 * 이미지 카드 레이아웃 모음.
 *
 * 같은 틀을 반복하면 티가 나므로, 글 제목과 슬롯 번호로 연출을 골라
 * 글마다·이미지마다 다른 구도가 나오게 한다.
 * 각 레이아웃은 사진 위 스크림(어둡게 덮기) 방향과 텍스트 배치가 서로 다르다.
 */

/** 결정적 해시 — 같은 글은 항상 같은 연출 조합을 재현한다. */
export function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < String(text).length; i++) {
    h ^= String(text).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** 글자 수에 따라 헤드라인 크기를 정한다. */
function fitTitle(text, base) {
  const n = [...String(text)].length;
  if (n > 28) return Math.round(base * 0.62);
  if (n > 22) return Math.round(base * 0.72);
  if (n > 16) return Math.round(base * 0.85);
  return base;
}

const FONT = `'Pretendard','Malgun Gothic','Apple SD Gothic Neo',sans-serif`;

/** 공통 기본 스타일 */
function baseCss(width, height) {
  return `
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${width}px;height:${height}px;overflow:hidden;}
  body{font-family:${FONT};color:#fff;position:relative;
       -webkit-font-smoothing:antialiased;}
  /* 레이어 순서: 사진(0) → 듀오톤(1) → 스크림(2) → 그레인/장식(3~4) → 내용(5) → 배지(6) */
  .photo{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat;z-index:0;}
  .scrim{position:absolute;inset:0;z-index:2;}
  .content{position:absolute;z-index:5;}
  .eyebrow{display:inline-flex;align-items:center;gap:9px;font-weight:700;
           letter-spacing:.14em;text-transform:uppercase;}
  .dot{width:8px;height:8px;border-radius:50%;flex:none;}
  h1{font-weight:800;letter-spacing:-.025em;word-break:keep-all;}
  .sub{font-weight:400;word-break:keep-all;opacity:.9;}
  .credit{position:absolute;z-index:4;font-size:13px;letter-spacing:.02em;
          color:rgba(255,255,255,.45);text-shadow:0 1px 4px rgba(0,0,0,.9);}
  .brandmark{position:absolute;z-index:4;font-size:19px;font-weight:700;
             letter-spacing:.06em;color:rgba(255,255,255,.85);
             text-shadow:0 2px 10px rgba(0,0,0,.8);}
  .stat-v{font-weight:800;letter-spacing:-.03em;line-height:1;}
  .stat-l{font-weight:600;opacity:.75;}
  `;
}

/**
 * 레이아웃 정의.
 * 각 함수는 { css, html, bgPosition } 를 돌려준다.
 * ctx: { headline, subline, eyebrow, brand, statValue, statLabel, accent, deep, width, height, isThumb, hasPhoto }
 */
const LAYOUTS = {
  /** 하단 좌측 정렬. 잡지 표지 느낌. 가장 안전하고 읽기 쉽다. */
  editorial(ctx) {
    const { width, height, accent, isThumb } = ctx;
    const pad = isThumb ? 76 : 58;
    const size = fitTitle(ctx.headline, isThumb ? 78 : 58);
    return {
      bgPosition: 'center 35%',
      css: `
      .scrim{background:
        linear-gradient(0deg, rgba(0,0,0,.90) 0%, rgba(0,0,0,.72) 32%, rgba(0,0,0,.20) 62%, rgba(0,0,0,.30) 100%),
        linear-gradient(90deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 55%);}
      .content{left:${pad}px;right:${pad}px;bottom:${pad}px;}
      .eyebrow{font-size:${isThumb ? 20 : 17}px;color:${accent};margin-bottom:${isThumb ? 18 : 14}px;}
      .rule{width:56px;height:4px;background:${accent};border-radius:2px;
            margin-bottom:${isThumb ? 22 : 16}px;}
      h1{font-size:${size}px;line-height:1.2;max-width:${Math.round(width * 0.84)}px;
         text-shadow:0 3px 22px rgba(0,0,0,.65);}
      .sub{font-size:${isThumb ? 29 : 24}px;line-height:1.5;margin-top:${isThumb ? 20 : 15}px;
           max-width:${Math.round(width * 0.72)}px;text-shadow:0 2px 12px rgba(0,0,0,.7);}
      .badge{position:absolute;z-index:3;right:${pad}px;top:${pad}px;text-align:right;}
      .stat-v{font-size:${isThumb ? 60 : 46}px;color:${accent};
              text-shadow:0 3px 18px rgba(0,0,0,.8);}
      .stat-l{font-size:${isThumb ? 19 : 16}px;margin-top:6px;}`,
      html: `
      <div class="content">
        <div class="rule"></div>
        ${ctx.eyebrow ? `<div class="eyebrow"><span class="dot" style="background:${accent}"></span>${esc(ctx.eyebrow)}</div>` : ''}
        <h1>${esc(ctx.headline)}</h1>
        ${ctx.subline ? `<div class="sub">${esc(ctx.subline)}</div>` : ''}
      </div>
      ${
        ctx.statValue
          ? `<div class="badge"><div class="stat-v">${esc(ctx.statValue)}</div>
             ${ctx.statLabel ? `<div class="stat-l">${esc(ctx.statLabel)}</div>` : ''}</div>`
          : ''
      }`,
    };
  },

  /** 좌측 컬러 패널 + 우측 사진. 사진 피사체가 오른쪽에 살아난다. */
  panel(ctx) {
    const { width, height, accent, deep, isThumb } = ctx;
    const pad = isThumb ? 66 : 52;
    const panelW = Math.round(width * 0.55);
    const size = fitTitle(ctx.headline, isThumb ? 66 : 50);
    return {
      bgPosition: 'right center',
      css: `
      .scrim{background:
        linear-gradient(90deg, ${deep} 0%, ${deep}F2 ${panelW - 120}px,
                        ${deep}D9 ${panelW - 40}px, rgba(0,0,0,.35) ${panelW + 120}px,
                        rgba(0,0,0,.28) 100%);}
      .content{left:${pad}px;top:50%;transform:translateY(-50%);
               width:${panelW - pad * 2 + 40}px;}
      .eyebrow{font-size:${isThumb ? 19 : 16}px;color:${accent};margin-bottom:${isThumb ? 16 : 12}px;}
      h1{font-size:${size}px;line-height:1.24;text-shadow:0 2px 14px rgba(0,0,0,.5);}
      .sub{font-size:${isThumb ? 26 : 22}px;line-height:1.55;margin-top:${isThumb ? 18 : 13}px;}
      .statline{display:flex;align-items:baseline;gap:12px;margin-top:${isThumb ? 30 : 22}px;
                padding-top:${isThumb ? 22 : 16}px;border-top:2px solid ${accent}66;}
      .stat-v{font-size:${isThumb ? 52 : 40}px;color:${accent};}
      .stat-l{font-size:${isThumb ? 19 : 16}px;}`,
      html: `
      <div class="content">
        ${ctx.eyebrow ? `<div class="eyebrow"><span class="dot" style="background:${accent}"></span>${esc(ctx.eyebrow)}</div>` : ''}
        <h1>${esc(ctx.headline)}</h1>
        ${ctx.subline ? `<div class="sub">${esc(ctx.subline)}</div>` : ''}
        ${
          ctx.statValue
            ? `<div class="statline"><span class="stat-v">${esc(ctx.statValue)}</span>
               ${ctx.statLabel ? `<span class="stat-l">${esc(ctx.statLabel)}</span>` : ''}</div>`
            : ''
        }
      </div>`,
    };
  },

  /** 중앙 정렬 + 비네트. 한 줄짜리 강한 카피에 어울린다. */
  spotlight(ctx) {
    const { width, accent, isThumb } = ctx;
    const size = fitTitle(ctx.headline, isThumb ? 80 : 60);
    return {
      bgPosition: 'center center',
      css: `
      .scrim{background:
        radial-gradient(ellipse 78% 68% at 50% 50%, rgba(0,0,0,.42) 0%, rgba(0,0,0,.72) 62%, rgba(0,0,0,.88) 100%),
        linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,.15) 40%, rgba(0,0,0,.55) 100%);}
      .content{inset:0;display:flex;flex-direction:column;align-items:center;
               justify-content:center;text-align:center;padding:0 ${isThumb ? 100 : 80}px;}
      .eyebrow{font-size:${isThumb ? 19 : 16}px;color:${accent};margin-bottom:${isThumb ? 22 : 16}px;
               padding:8px 18px;border:1px solid ${accent}80;border-radius:999px;
               background:rgba(0,0,0,.35);}
      h1{font-size:${size}px;line-height:1.22;max-width:${Math.round(width * 0.82)}px;
         text-shadow:0 4px 26px rgba(0,0,0,.75);}
      .uline{width:${isThumb ? 88 : 68}px;height:3px;background:${accent};border-radius:2px;
             margin-top:${isThumb ? 26 : 18}px;}
      .sub{font-size:${isThumb ? 28 : 23}px;line-height:1.5;margin-top:${isThumb ? 22 : 16}px;
           max-width:${Math.round(width * 0.66)}px;text-shadow:0 2px 14px rgba(0,0,0,.8);}
      .badge{position:absolute;z-index:3;left:50%;transform:translateX(-50%);
             bottom:${isThumb ? 44 : 34}px;text-align:center;}
      .stat-v{font-size:${isThumb ? 42 : 34}px;color:${accent};text-shadow:0 3px 16px rgba(0,0,0,.8);}
      .stat-l{font-size:${isThumb ? 17 : 15}px;margin-top:4px;}`,
      html: `
      <div class="content">
        ${ctx.eyebrow ? `<div class="eyebrow">${esc(ctx.eyebrow)}</div>` : ''}
        <h1>${esc(ctx.headline)}</h1>
        <div class="uline"></div>
        ${ctx.subline ? `<div class="sub">${esc(ctx.subline)}</div>` : ''}
      </div>
      ${
        ctx.statValue
          ? `<div class="badge"><div class="stat-v">${esc(ctx.statValue)}</div>
             ${ctx.statLabel ? `<div class="stat-l">${esc(ctx.statLabel)}</div>` : ''}</div>`
          : ''
      }`,
    };
  },

  /** 수치를 주인공으로. 강조할 숫자가 있을 때만 고른다. */
  figure(ctx) {
    const { width, accent, isThumb } = ctx;
    const pad = isThumb ? 74 : 56;
    const size = fitTitle(ctx.headline, isThumb ? 52 : 42);
    const statSize = isThumb ? 132 : 100;
    return {
      bgPosition: 'right 40%',
      // 헤드라인이 좌상단이므로 브랜드 표기는 우상단으로 뺀다
      brandPos: 'right',
      css: `
      .scrim{background:
        linear-gradient(75deg, rgba(0,0,0,.92) 0%, rgba(0,0,0,.80) 42%, rgba(0,0,0,.35) 78%, rgba(0,0,0,.30) 100%);}
      .content{left:${pad}px;top:${pad}px;right:${pad}px;}
      .eyebrow{font-size:${isThumb ? 19 : 16}px;color:${accent};margin-bottom:${isThumb ? 14 : 11}px;}
      h1{font-size:${size}px;line-height:1.3;max-width:${Math.round(width * 0.62)}px;
         text-shadow:0 2px 16px rgba(0,0,0,.7);}
      .hero{position:absolute;z-index:3;left:${pad}px;bottom:${pad}px;}
      .stat-v{font-size:${statSize}px;color:${accent};
              text-shadow:0 6px 34px rgba(0,0,0,.7);}
      .stat-l{font-size:${isThumb ? 24 : 20}px;margin-top:${isThumb ? 10 : 7}px;
              letter-spacing:.02em;opacity:.85;}
      .sub{position:absolute;z-index:3;right:${pad}px;bottom:${pad}px;
           font-size:${isThumb ? 24 : 20}px;line-height:1.5;text-align:right;
           max-width:${Math.round(width * 0.34)}px;text-shadow:0 2px 12px rgba(0,0,0,.85);}`,
      html: `
      <div class="content">
        ${ctx.eyebrow ? `<div class="eyebrow"><span class="dot" style="background:${accent}"></span>${esc(ctx.eyebrow)}</div>` : ''}
        <h1>${esc(ctx.headline)}</h1>
      </div>
      ${
        ctx.statValue
          ? `<div class="hero">
               <div class="stat-v">${esc(ctx.statValue)}</div>
               ${ctx.statLabel ? `<div class="stat-l">${esc(ctx.statLabel)}</div>` : ''}
             </div>`
          : ''
      }
      ${ctx.subline ? `<div class="sub">${esc(ctx.subline)}</div>` : ''}`,
    };
  },

  /** 사진은 위쪽, 아래는 짙은 띠. 뉴스 카드 느낌으로 가독성이 가장 높다. */
  band(ctx) {
    const { width, height, accent, deep, isThumb } = ctx;
    const pad = isThumb ? 64 : 50;
    const bandH = Math.round(height * (isThumb ? 0.42 : 0.48));
    const size = fitTitle(ctx.headline, isThumb ? 60 : 46);
    return {
      bgPosition: 'center 30%',
      css: `
      .scrim{background:
        linear-gradient(180deg, rgba(0,0,0,.42) 0%, rgba(0,0,0,.12) 30%,
                        rgba(0,0,0,.55) ${100 - (bandH / height) * 100 - 6}%,
                        ${deep}F7 ${100 - (bandH / height) * 100 + 2}%, ${deep} 100%);}
      .content{left:${pad}px;right:${pad}px;bottom:${pad}px;}
      .eyebrow{font-size:${isThumb ? 18 : 15}px;color:${accent};margin-bottom:${isThumb ? 14 : 11}px;}
      h1{font-size:${size}px;line-height:1.24;max-width:${Math.round(width * 0.78)}px;}
      .sub{font-size:${isThumb ? 25 : 21}px;line-height:1.5;margin-top:${isThumb ? 16 : 12}px;
           max-width:${Math.round(width * 0.7)}px;}
      .badge{position:absolute;z-index:3;right:${pad}px;bottom:${pad + 4}px;text-align:right;}
      .stat-v{font-size:${isThumb ? 54 : 42}px;color:${accent};}
      .stat-l{font-size:${isThumb ? 17 : 15}px;margin-top:4px;}
      .topline{position:absolute;z-index:3;left:0;right:0;
               bottom:${bandH}px;height:3px;background:${accent};opacity:.9;}`,
      html: `
      <div class="topline"></div>
      <div class="content">
        ${ctx.eyebrow ? `<div class="eyebrow"><span class="dot" style="background:${accent}"></span>${esc(ctx.eyebrow)}</div>` : ''}
        <h1>${esc(ctx.headline)}</h1>
        ${ctx.subline ? `<div class="sub">${esc(ctx.subline)}</div>` : ''}
      </div>
      ${
        ctx.statValue
          ? `<div class="badge"><div class="stat-v">${esc(ctx.statValue)}</div>
             ${ctx.statLabel ? `<div class="stat-l">${esc(ctx.statLabel)}</div>` : ''}</div>`
          : ''
      }`,
    };
  },
};

/** 신문 사설 톤 연출 (정보성 글에 어울림) */
export const EDITORIAL_NAMES = Object.keys(LAYOUTS);

/** 전체 연출 = 사설 톤 + 트렌디 톤 */
const ALL = { ...LAYOUTS, ...TRENDY_LAYOUTS };
export const LAYOUT_NAMES = Object.keys(ALL);
export { TRENDY_NAMES };

/** 인물 사진 위에 글자를 얹어도 얼굴을 가리지 않는 연출들 */
const FACE_SAFE = ['panel', 'band', 'editorial', 'figure'];

/**
 * 글·슬롯별로 연출을 고른다.
 * - 같은 글 안에서는 이미지마다 서로 다른 연출
 * - 글이 바뀌면 시작 연출도 바뀜
 * - 강조할 수치가 없으면 수치 중심 연출(figure)은 제외
 * - 인물 사진이면 화면 한가운데를 텍스트로 덮는 spotlight 는 제외 (얼굴을 가린다)
 */
export function pickLayout({ title, slot, hasStat, forced, isPerson = false, style = 'trendy' }) {
  if (forced && ALL[forced]) return forced;

  let pool;
  if (style === 'editorial') pool = [...EDITORIAL_NAMES];
  else if (style === 'mixed') pool = [...TRENDY_NAMES, ...EDITORIAL_NAMES];
  else pool = [...TRENDY_NAMES]; // 기본은 트렌디

  pool = pool.filter((n) => (n === 'figure' ? hasStat : true));
  if (isPerson) {
    const safe = pool.filter((n) => FACE_SAFE.includes(n) || TRENDY_NAMES.includes(n));
    if (safe.length) pool = safe;
  }
  if (!pool.length) pool = [...TRENDY_NAMES];

  const start = hash(title) % pool.length;
  return pool[(start + slot) % pool.length];
}

/**
 * 인물 사진은 얼굴이 위쪽·중앙에 오는 경우가 많아 기본 크롭이 얼굴을 자른다.
 * 레이아웃별 텍스트 위치를 피해 피사체가 살아나는 위치로 바꾼다.
 */
export function personBgPosition(layout, portrait) {
  switch (layout) {
    case 'panel':
      return portrait ? 'right top' : 'right 25%';
    case 'figure':
      return portrait ? 'right top' : 'right 22%';
    case 'band':
      return 'center 22%';
    case 'editorial':
      return 'center 20%';
    default:
      return 'center 25%';
  }
}

/**
 * 최종 카드 HTML 을 만든다.
 * 사진이 없으면 팔레트 그라디언트를 배경으로 깔고 같은 레이아웃을 그대로 쓴다.
 */
export function renderCard(ctx) {
  const { width, height, palette, bgDataUri, credit, brand, layout } = ctx;
  const [c1, c2, c3] = palette;
  const accent = c3;
  const deep = c1;
  const hasPhoto = !!bgDataUri;

  const build = ALL[layout] || ALL.neon || LAYOUTS.editorial;
  const {
    css,
    html,
    bgPosition: layoutBgPosition,
    brandPos = 'left',
    photoFilter = '',
    extraLayers = '',
    hideBrand = false,
  } = build({ ...ctx, accent, deep, hasPhoto });
  const bgPosition = ctx.bgPosition || layoutBgPosition;

  /* 전역 룩(후지·캐논…)을 레이아웃 자기 필터 **뒤에** 붙인다 — 레이아웃 의도가 먼저다.
   *
   * 단, **흑백으로 간 레이아웃은 건드리지 않는다.** `grayscale(1)` 뒤에 `sepia` 를
   * 붙이면 색이 되살아나 갈색으로 물든다 (실측: neon 레이아웃이
   * `grayscale(1) contrast(1.25) brightness(0.72)` + fujiSoft 로 갈변했다).
   * 흑백은 연출 의도가 분명한 선택이라 톤을 얹을 대상이 아니다. */
  const monochrome = /grayscale|invert/.test(photoFilter);
  const cardFilter = [photoFilter, monochrome ? '' : ctx.photoLook].filter(Boolean).join(' ');
  const photoLayer = hasPhoto
    ? `<div class="photo" style="background-image:url('${bgDataUri}');background-position:${bgPosition};${
        cardFilter ? `filter:${cardFilter};` : ''
      }"></div>`
    : `<div class="photo" style="background:linear-gradient(135deg, ${c1} 0%, ${c2} 55%, ${c3} 100%);"></div>
       <div class="photo" style="opacity:.08;background-image:
            linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);
            background-size:54px 54px;"></div>`;

  // 사진이 없으면 스크림을 약하게 (그라디언트가 이미 어둡다)
  const scrimOpacity = hasPhoto ? 1 : 0.45;

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" /><style>
${baseCss(width, height)}
${css}
.scrim{opacity:${scrimOpacity};}
</style></head><body>
${photoLayer}
${hasPhoto ? extraLayers : ''}
<div class="scrim"></div>
${html}
${
  hideBrand
    ? ''
    : `<div class="brandmark" style="${brandPos === 'right' ? 'right' : 'left'}:${
        ctx.isThumb ? 76 : 58
      }px;top:${ctx.isThumb ? 44 : 34}px;">${esc(brand)}</div>`
}
${credit ? `<div class="credit" style="right:20px;bottom:14px;">Photo: ${esc(credit)}</div>` : ''}
</body></html>`;
}
