/**
 * 트렌디한 팬 콘텐츠 감성의 카드 연출.
 *
 * 기존 editorial 계열은 신문 사설 톤이라 연예·팬 콘텐츠에는 어울리지 않는다.
 * 여기 있는 연출들은 듀오톤·네온·스티커처럼 SNS 썸네일에서 통하는 문법을 쓴다.
 */

import { esc } from './html.js';

/** 화면 전체에 얇게 깔아 사진의 디지털 느낌을 죽이는 그레인 */
export const GRAIN_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.42'/%3E%3C/svg%3E";

/** 글자 수에 맞춰 헤드라인 크기를 정한다. */
function fit(text, base) {
  const n = [...String(text)].length;
  if (n > 26) return Math.round(base * 0.6);
  if (n > 20) return Math.round(base * 0.7);
  if (n > 14) return Math.round(base * 0.84);
  return base;
}

/**
 * 각 연출은 { css, html, bgPosition, brandPos, photoFilter, extraLayers } 를 돌려준다.
 * ctx: { headline, subline, eyebrow, statValue, statLabel, brand, palette, width, height, isThumb }
 */
export const TRENDY_LAYOUTS = {
  /** 듀오톤 + 네온 글로우. 가장 K팝 썸네일다운 연출. */
  neon(ctx) {
    const { width, isThumb, palette } = ctx;
    const [deep, mid, hot] = palette;
    const pad = isThumb ? 74 : 56;
    const size = fit(ctx.headline, isThumb ? 92 : 66);

    return {
      bgPosition: 'center 28%',
      photoFilter: 'grayscale(1) contrast(1.25) brightness(0.72)',
      extraLayers: `
        <div class="duo"></div>
        <div class="grain"></div>
        <div class="glowbar"></div>`,
      css: `
      .duo{position:absolute;inset:0;z-index:1;mix-blend-mode:color;
           background:linear-gradient(135deg, ${deep} 0%, ${mid} 55%, ${hot} 100%);}
      .grain{position:absolute;inset:0;z-index:3;opacity:.16;pointer-events:none;
             background-image:url("${GRAIN_SVG}");}
      .scrim{background:
        linear-gradient(0deg, rgba(0,0,0,.82) 0%, rgba(0,0,0,.42) 42%, rgba(0,0,0,.12) 75%);}
      .glowbar{position:absolute;left:0;right:0;bottom:0;height:7px;z-index:4;
               background:linear-gradient(90deg, ${hot}, #fff 55%, ${mid});
               box-shadow:0 0 26px ${hot}, 0 0 60px ${hot}88;}
      .content{left:${pad}px;right:${pad}px;bottom:${pad}px;}
      .eyebrow{display:inline-block;font-size:${isThumb ? 20 : 17}px;font-weight:800;
               letter-spacing:.18em;padding:9px 20px;border-radius:999px;
               background:${hot};color:#fff;margin-bottom:${isThumb ? 22 : 16}px;
               box-shadow:0 0 22px ${hot}aa;}
      h1{font-size:${size}px;font-weight:900;line-height:1.14;letter-spacing:-.035em;
         max-width:${Math.round(width * 0.9)}px;
         text-shadow:0 0 34px ${hot}77, 0 4px 20px rgba(0,0,0,.85);}
      .sub{font-size:${isThumb ? 30 : 24}px;font-weight:600;margin-top:${isThumb ? 18 : 13}px;
           color:#fff;opacity:.94;text-shadow:0 2px 14px rgba(0,0,0,.9);}
      .badge{position:absolute;z-index:5;right:${pad}px;top:${pad}px;text-align:right;}
      .stat-v{font-size:${isThumb ? 66 : 48}px;font-weight:900;color:#fff;letter-spacing:-.04em;
              text-shadow:0 0 30px ${hot}, 0 3px 16px rgba(0,0,0,.8);}
      .stat-l{font-size:${isThumb ? 18 : 15}px;font-weight:700;color:rgba(255,255,255,.9);
              letter-spacing:.1em;margin-top:4px;text-shadow:0 2px 10px rgba(0,0,0,.9);}`,
      html: `
      <div class="content">
        ${ctx.eyebrow ? `<div class="eyebrow">${esc(ctx.eyebrow)}</div>` : ''}
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

  /** 대각선 컬러 블록 + 스티커. 밝고 통통 튀는 느낌. */
  pop(ctx) {
    const { width, height, isThumb, palette } = ctx;
    const [deep, mid, hot] = palette;
    const pad = isThumb ? 70 : 54;
    const size = fit(ctx.headline, isThumb ? 82 : 60);

    return {
      bgPosition: 'right 25%',
      photoFilter: 'contrast(1.12) saturate(1.25)',
      extraLayers: `
        <div class="slab"></div>
        <div class="slabEdge"></div>
        <div class="grain"></div>
        ${ctx.statValue ? `<div class="sticker"><b>${esc(ctx.statValue)}</b>${ctx.statLabel ? `<i>${esc(ctx.statLabel)}</i>` : ''}</div>` : ''}`,
      css: `
      .scrim{background:linear-gradient(90deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.15) 60%, rgba(0,0,0,.35) 100%);}
      /* 사선으로 잘린 컬러 블록. 반투명하면 지저분해 보여서 거의 불투명하게 채운다. */
      .slab{position:absolute;z-index:3;left:0;top:0;width:70%;height:100%;
            clip-path:polygon(0 0, 78% 0, 100% 100%, 0 100%);
            background:linear-gradient(150deg, ${mid} 0%, ${deep} 100%);}
      .slabEdge{position:absolute;z-index:4;left:0;top:0;width:70%;height:100%;
                clip-path:polygon(78% 0, 82% 0, 100% 100%, 96% 100%);
                background:${hot};}
      .grain{position:absolute;inset:0;z-index:4;opacity:.13;pointer-events:none;
             background-image:url("${GRAIN_SVG}");}
      .content{left:${pad}px;top:50%;transform:translateY(-50%);width:${Math.round(width * 0.46)}px;}
      .eyebrow{display:inline-block;font-size:${isThumb ? 19 : 16}px;font-weight:900;
               letter-spacing:.16em;color:${deep};background:${hot};
               padding:8px 16px;border-radius:6px;margin-bottom:${isThumb ? 20 : 14}px;
               transform:rotate(-2deg);}
      h1{font-size:${size}px;font-weight:900;line-height:1.15;letter-spacing:-.035em;
         text-shadow:0 4px 18px rgba(0,0,0,.45);}
      .sub{font-size:${isThumb ? 27 : 22}px;font-weight:600;margin-top:${isThumb ? 18 : 13}px;
           color:#fff;opacity:.9;}
      .sticker{position:absolute;z-index:6;right:${isThumb ? 78 : 58}px;bottom:${isThumb ? 74 : 54}px;
               transform:rotate(6deg);background:${hot};color:${deep};
               padding:${isThumb ? '18px 26px' : '13px 20px'};border-radius:18px;
               box-shadow:0 12px 34px rgba(0,0,0,.45);text-align:center;
               border:4px solid #fff;}
      .sticker b{display:block;font-size:${isThumb ? 46 : 34}px;font-weight:900;letter-spacing:-.03em;}
      .sticker i{display:block;font-style:normal;font-size:${isThumb ? 16 : 14}px;
                 font-weight:800;opacity:.8;margin-top:2px;}`,
      html: `
      <div class="content">
        ${ctx.eyebrow ? `<div class="eyebrow">${esc(ctx.eyebrow)}</div>` : ''}
        <h1>${esc(ctx.headline)}</h1>
        ${ctx.subline ? `<div class="sub">${esc(ctx.subline)}</div>` : ''}
      </div>`,
    };
  },

  /** 형광 하이라이터로 그은 듯한 제목. 잡지·진(zine) 감성. */
  zine(ctx) {
    const { width, isThumb, palette } = ctx;
    const [deep, mid, hot] = palette;
    const pad = isThumb ? 76 : 58;
    const size = fit(ctx.headline, isThumb ? 78 : 58);
    // 하이라이터 효과: 텍스트 뒤에 색 띠를 깐다
    const words = esc(ctx.headline)
      .split(' ')
      .map((w) => `<span class="hl">${w}</span>`)
      .join(' ');

    return {
      bgPosition: 'center 30%',
      photoFilter: 'contrast(1.1) saturate(0.9) brightness(0.85)',
      extraLayers: `<div class="grain"></div><div class="frame"></div>`,
      css: `
      .scrim{background:linear-gradient(0deg, rgba(0,0,0,.78) 0%, rgba(0,0,0,.3) 55%, rgba(0,0,0,.35) 100%);}
      .grain{position:absolute;inset:0;z-index:3;opacity:.2;pointer-events:none;
             background-image:url("${GRAIN_SVG}");}
      .frame{position:absolute;z-index:4;inset:${isThumb ? 26 : 20}px;
             border:3px solid rgba(255,255,255,.55);pointer-events:none;}
      .content{left:${pad}px;right:${pad}px;bottom:${pad}px;}
      .eyebrow{display:inline-block;font-size:${isThumb ? 19 : 16}px;font-weight:900;
               letter-spacing:.2em;color:#fff;border-bottom:3px solid ${hot};
               padding-bottom:5px;margin-bottom:${isThumb ? 20 : 14}px;}
      h1{font-size:${size}px;font-weight:900;line-height:1.32;letter-spacing:-.03em;
         max-width:${Math.round(width * 0.86)}px;}
      h1 .hl{background:linear-gradient(180deg, transparent 58%, ${hot}D9 58%);
             padding:0 4px;box-decoration-break:clone;-webkit-box-decoration-break:clone;}
      .sub{font-size:${isThumb ? 27 : 22}px;font-weight:600;margin-top:${isThumb ? 20 : 14}px;
           color:#fff;opacity:.92;text-shadow:0 2px 12px rgba(0,0,0,.8);}
      .badge{position:absolute;z-index:5;right:${pad}px;top:${pad}px;
             background:#fff;color:${deep};padding:${isThumb ? '14px 20px' : '10px 15px'};
             text-align:center;box-shadow:0 8px 26px rgba(0,0,0,.4);}
      .stat-v{font-size:${isThumb ? 44 : 33}px;font-weight:900;letter-spacing:-.03em;}
      .stat-l{font-size:${isThumb ? 15 : 13}px;font-weight:800;color:${mid};margin-top:2px;}`,
      html: `
      <div class="content">
        ${ctx.eyebrow ? `<div class="eyebrow">${esc(ctx.eyebrow)}</div>` : ''}
        <h1>${words}</h1>
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

  /** 사진 위에 초대형 타이포가 걸치는 포스터 연출. */
  poster(ctx) {
    const { width, isThumb, palette } = ctx;
    const [deep, mid, hot] = palette;
    const pad = isThumb ? 64 : 50;
    const size = fit(ctx.headline, isThumb ? 108 : 76);

    return {
      bgPosition: 'center 22%',
      photoFilter: 'contrast(1.15) saturate(1.1) brightness(0.8)',
      extraLayers: `<div class="grain"></div><div class="vign"></div>`,
      css: `
      .scrim{background:linear-gradient(0deg, rgba(0,0,0,.8) 0%, rgba(0,0,0,.25) 50%, rgba(0,0,0,.5) 100%);}
      .vign{position:absolute;inset:0;z-index:3;pointer-events:none;
            background:radial-gradient(ellipse 80% 70% at 50% 45%, transparent 40%, rgba(0,0,0,.6) 100%);}
      .grain{position:absolute;inset:0;z-index:4;opacity:.15;pointer-events:none;
             background-image:url("${GRAIN_SVG}");}
      .content{left:0;right:0;bottom:${pad}px;text-align:center;padding:0 ${pad}px;}
      .eyebrow{display:inline-block;font-size:${isThumb ? 18 : 15}px;font-weight:900;
               letter-spacing:.34em;color:${hot};margin-bottom:${isThumb ? 14 : 10}px;}
      h1{font-size:${size}px;font-weight:900;line-height:.98;letter-spacing:-.05em;
         color:#fff;text-transform:none;
         text-shadow:0 6px 34px rgba(0,0,0,.75);}
      .rule{width:${isThumb ? 120 : 90}px;height:5px;background:${hot};margin:${isThumb ? 22 : 15}px auto 0;
            box-shadow:0 0 20px ${hot};}
      .sub{font-size:${isThumb ? 26 : 21}px;font-weight:600;margin-top:${isThumb ? 16 : 12}px;
           color:#fff;opacity:.9;}
      /* 세로 배지는 브랜드 표기(좌상단)와 겹치지 않게 오른쪽에 둔다 */
      .badge{position:absolute;z-index:6;right:${pad}px;top:${pad}px;
             writing-mode:vertical-rl;font-size:${isThumb ? 20 : 16}px;font-weight:900;
             letter-spacing:.22em;color:${hot};text-shadow:0 2px 12px rgba(0,0,0,.95);}`,
      html: `
      <div class="content">
        ${ctx.eyebrow ? `<div class="eyebrow">${esc(ctx.eyebrow)}</div>` : ''}
        <h1>${esc(ctx.headline)}</h1>
        <div class="rule"></div>
        ${ctx.subline ? `<div class="sub">${esc(ctx.subline)}</div>` : ''}
      </div>
      ${ctx.statValue ? `<div class="badge">${esc(ctx.statValue)} ${esc(ctx.statLabel || '')}</div>` : ''}`,
    };
  },
};

/**
 * 정보를 최소화한 정사각 썸네일.
 * 티스토리 목록·공유 카드가 정사각으로 잘리는 것을 감안한 연출로,
 * 사진을 그대로 살리고 오른쪽 아래에 "무슨 글인지"만 짧게 얹는다.
 */
/**
 * clean — 사진을 최대한 살리고 제목만 얹는 연출.
 *
 * 배치: 좌우 가운데, 상하는 가운데보다 살짝 아래(58%).
 *   인물 사진은 얼굴이 위쪽 절반에 오는 경우가 많아, 정중앙에 글자를 두면
 *   얼굴을 가린다. 조금 내리면 얼굴을 피하면서도 시선 중심에 걸린다.
 *
 * 액센트 막대(.tick)와 분류 라벨(.eyebrow)은 뺐다 — 사진 위 요소가 적을수록
 * 보도사진이 원본 그대로 보이고, 2차적저작물 소지도 줄어든다.
 */
TRENDY_LAYOUTS.clean = function clean(ctx) {
  const { width } = ctx;
  const pad = Math.round(width * 0.075);
  const size = fit(ctx.headline, Math.round(width * 0.072));

  return {
    bgPosition: 'center 32%',
    photoFilter: 'contrast(1.08) saturate(1.06)',
    hideBrand: true, // 브랜드는 아래 .mark 로 직접 넣는다
    extraLayers: `<div class="grain"></div>`,
    css: `
      .grain{position:absolute;inset:0;z-index:3;opacity:.1;pointer-events:none;
             background-image:url("${GRAIN_SVG}");}
      /* 글자가 중앙에 오므로 아래쪽만 어둡게 하면 안 읽힌다.
         글자 자리만 부드럽게 눌러 사진은 최대한 밝게 남긴다. */
      .scrim{background:
             radial-gradient(ellipse 78% 34% at 50% 58%, rgba(0,0,0,.58) 0%,
                             rgba(0,0,0,.30) 55%, rgba(0,0,0,0) 100%),
             linear-gradient(0deg, rgba(0,0,0,.50) 0%, rgba(0,0,0,.14) 32%,
                             rgba(0,0,0,.04) 60%, rgba(0,0,0,.18) 100%);}
      .content{left:${pad}px;right:${pad}px;top:58%;transform:translateY(-50%);
               bottom:auto;text-align:center;}
      h1{font-size:${size}px;font-weight:900;line-height:1.2;letter-spacing:-.035em;
         text-shadow:0 4px 22px rgba(0,0,0,.9), 0 2px 6px rgba(0,0,0,.75);}
      .mark{display:block;margin-top:${Math.round(width * 0.018)}px;
            font-size:${Math.round(width * 0.016)}px;font-weight:700;letter-spacing:.16em;
            color:rgba(255,255,255,.62);text-shadow:0 2px 8px rgba(0,0,0,.9);}`,
    html: `
      <div class="content">
        <h1>${esc(ctx.headline)}</h1>
        <span class="mark">${esc(ctx.brand)}</span>
      </div>`,
  };
};

export const TRENDY_NAMES = Object.keys(TRENDY_LAYOUTS);

/** 팬 콘텐츠용 비비드 팔레트 — [deep, mid, hot] */
export const TRENDY_PALETTES = [
  ['#1a0b2e', '#7b2cbf', '#ff2e97'], // 보라 → 핫핑크
  ['#0b132b', '#1c7ed6', '#22d3ee'], // 네이비 → 시안
  ['#2b0a12', '#c9184a', '#ffb703'], // 버건디 → 앰버
  ['#0d1b2a', '#0f766e', '#5eead4'], // 딥틸 → 민트
  ['#1c1917', '#7c2d12', '#fb923c'], // 브라운 → 오렌지
  ['#111827', '#4338ca', '#a78bfa'], // 인디고 → 라벤더
];
