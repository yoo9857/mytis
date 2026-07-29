/**
 * 네이버 구조 프리뷰 — 발행하지 않고 `naverDoc.js` 의 조립 결과를 눈으로 본다.
 *
 * 왜 필요한가: 기존 프리뷰(`out/*.preview.html`)는 **티스토리 HTML** 이다.
 * 네이버는 컴포넌트 구조가 전혀 다르므로(소제목이 별도 컴포넌트, 인용구 6종,
 * 모바일 한 줄 문단, 제로폭 공백 여백) 티스토리 프리뷰로는 네이버 결과를 알 수 없다.
 * 발행해 보고 나서야 알게 되면 테스트 글이 계속 쌓인다.
 *
 * 여기서 그리는 스타일 수치는 **발행된 글에서 실측한 값**이다 (learned.md 6장):
 *   sectionTitle 30px · 본문 16px / line-height 2.0 / 가운데 정렬
 *   인용구는 layout 별로 모양이 다르고, 이미지는 본문 칼럼 폭(886px)에 맞는다
 *
 * 사용:
 *   node scripts/preview-naver.mjs out/<article>.json [이미지파일...]
 *   이미지를 생략하면 out/images/ 에서 아티클 stamp 로 시작하는 PNG 를 찾는다.
 *
 *   node scripts/preview-naver.mjs out/<article>.json --photos out/photos/ig/<폴더>
 *   눈으로 골라 둔 사진 폴더를 주면 **여기서 바로 렌더링**한다(색보정·비율 포함).
 *   어느 사진이 어느 섹션에 갈지는 아티클의 `imageBriefs[].photo`·`afterSection` 이 정한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../src/config.js';
import { buildDocument, summarize } from '../src/naverDoc.js';
import { renderImages } from '../src/images.js';

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 문단 배열 → HTML. textNode 의 스타일과 문단의 lineHeight·align 을 그대로 반영한다. */
function paragraphs(list) {
  return (list || [])
    .map((p) => {
      const st = p.style || {};
      const css = [
        st.lineHeight ? `line-height:${st.lineHeight}` : '',
        st.align ? `text-align:${st.align}` : '',
      ].filter(Boolean).join(';');
      const inner = (p.nodes || [])
        .map((n) => {
          const ns = n.style || {};
          const size = ns.fontSizeCode ? Number(String(ns.fontSizeCode).replace(/\D/g, '')) : null;
          const s = [
            size ? `font-size:${size}px` : '',
            ns.bold ? 'font-weight:700' : '',
            ns.underline ? 'text-decoration:underline;text-underline-offset:3px' : '',
            ns.italic ? 'font-style:italic' : '',
            ns.fontColor ? `color:${ns.fontColor}` : '',
            ns.backgroundColor ? `background:${ns.backgroundColor}` : '',
          ].filter(Boolean).join(';');
          // 제로폭 공백은 눈에 안 보이므로 프리뷰에서만 표시해 준다
          const isSpacer = n.value === '​';
          if (isSpacer) return `<span class="zwsp" title="제로폭 공백 여백"></span>`;
          return s ? `<span style="${s}">${esc(n.value)}</span>` : esc(n.value);
        })
        .join('');
      return `<p${css ? ` style="${css}"` : ''}>${inner || '&nbsp;'}</p>`;
    })
    .join('\n');
}

const QUOTE_CSS = {
  default: 'border:0;padding:18px 0;font-size:19px;text-align:center;',
  quotation_line: 'border-left:3px solid #222;padding:6px 0 6px 18px;',
  quotation_bubble: 'background:#f4f4f4;border-radius:14px;padding:18px 20px;',
  quotation_underline: 'border-top:1px solid #222;border-bottom:1px solid #222;padding:16px 0;',
  quotation_postit: 'background:#fff8d6;padding:18px 20px;',
  quotation_corner: 'border:1px solid #222;padding:18px 20px;',
};

function renderComponent(c) {
  const t = c['@ctype'];
  if (t === 'documentTitle') return `<h1>${paragraphs(c.title)}</h1>`;
  if (t === 'sectionTitle') return `<div class="sectionTitle">${paragraphs(c.title)}</div>`;
  if (t === 'text') return `<div class="text">${paragraphs(c.value)}</div>`;
  if (t === 'horizontalLine') return `<hr>`;
  if (t === 'quotation') {
    const css = QUOTE_CSS[c.layout] || QUOTE_CSS.default;
    return `<blockquote style="${css}"><span class="tag">${esc(c.layout)}</span>${paragraphs(c.value)}${
      c.source ? `<footer>${paragraphs(c.source)}</footer>` : ''
    }</blockquote>`;
  }
  if (t === 'image') {
    const cap = c.caption ? `<figcaption>${paragraphs(c.caption)}</figcaption>` : '';
    return `<figure class="img" style="text-align:${c.align || 'left'}">
      <img src="${esc(c.src)}" alt="">${c.represent ? '<span class="tag">대표</span>' : ''}${cap}</figure>`;
  }
  if (t === 'imageGroup') {
    const imgs = (c.images || []).map((i) => `<img src="${esc(i.src)}" alt="">`).join('');
    return `<figure class="group"><span class="tag">${esc(c.layout)} · ${c.images?.length}장</span>
      <div class="row">${imgs}</div>${c.caption ? `<figcaption>${paragraphs(c.caption)}</figcaption>` : ''}</figure>`;
  }
  return `<div class="unknown">알 수 없는 컴포넌트 (${esc(t)})</div>`;
}

// ── 입력 ────────────────────────────────────────────────────────────────────
const file = process.argv[2];
if (!file) {
  console.error('사용: node scripts/preview-naver.mjs out/<article>.json [이미지...]');
  process.exit(1);
}
const article = JSON.parse(fs.readFileSync(file, 'utf8'));
const cfg = loadConfig();

const rest = process.argv.slice(3);
const photosAt = rest.indexOf('--photos');
// 아티클이 `photoDir` 을 들고 있으면 인수 없이도 그 폴더를 쓴다
const photoDir = photosAt >= 0 ? rest[photosAt + 1] : article.photoDir || '';

/* `--photos` 로 폴더를 주면 사진을 여기서 렌더링한다.
 * 배치·캡션·크레딧을 렌더 결과에서 그대로 받아 오므로, 아래의 "고르게 나눠 넣기"
 * 추정이 필요 없다 — 아티클이 지정한 자리에 정확히 들어간다. */
let rendered = null;
if (photoDir) {
  if (!fs.existsSync(photoDir)) {
    console.error(`사진 폴더가 없습니다: ${photoDir}`);
    process.exit(1);
  }
  cfg.images.localPhotoDir = path.resolve(photoDir);
  cfg.images.background = 'photo';
  // 본문 사진 개수는 아티클의 imageBriefs 가 정한다 (config 의 bodyImages 로 잘리면
  // 사진 100자당 1장 규칙을 맞출 수 없다 — learned.md 법칙 ②)
  article.bodyImageCount =
    article.bodyImageCount ?? (article.imageBriefs || []).filter((b) => b.placement === 'body').length;
  rendered = await renderImages(article, cfg);
}

let files = rest.filter((a) => a !== '--photos' && a !== photoDir);
if (rendered) {
  files = [rendered.thumbnail?.file, ...rendered.body.map((b) => b.file)].filter(Boolean);
}
if (!files.length) {
  const stampPrefix = path.basename(file).slice(0, 15); // 20260728-221640
  const dir = 'out/images';
  const all = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.png')) : [];
  const mine = all.filter((n) => n.startsWith(path.basename(file).slice(0, 8)));
  const pool = (mine.length ? mine : all).filter((n) => n.includes(stampPrefix.slice(9)) || mine.length === 0);
  const thumb = pool.find((n) => /thumb\.png$/.test(n));
  const bodies = pool.filter((n) => /body\d+\.png$/.test(n))
    .sort((a, b) => (+a.match(/body(\d+)/)[1]) - (+b.match(/body(\d+)/)[1]));
  files = [thumb, ...bodies].filter(Boolean).map((n) => path.join(dir, n));
}
if (!files.length) {
  console.error('이미지를 찾지 못했습니다. 파일 경로를 직접 넘겨 주세요.');
  process.exit(1);
}

/* 업로드된 이미지 컴포넌트를 흉내 낸다.
 * 실제 발행에서는 네이버 CDN 이 채우는 값이지만, 프리뷰는 로컬 파일로 그린다. */
const images = files.map((f) => ({
  src: pathToFileURL(path.resolve(f)).href,
  internalResource: true,
  represent: false,
  caption: null,
  '@ctype': 'image',
}));
const sc = article.sections?.length || 1;
/* 배치 정보.
 * 렌더 결과가 있으면 그 값을 쓴다(아티클이 지정한 자리 = 실제 발행과 같은 배치).
 * 없으면 예전처럼 섹션에 고르게 나눠 넣는 추정으로 그린다. */
const entries = rendered ? [rendered.thumbnail, ...rendered.body].filter(Boolean) : [];
const imageMeta = images.map((_, i) =>
  entries.length
    ? {
        alt: entries[i]?.alt || '',
        caption: entries[i]?.caption || '',
        afterSection: entries[i]?.afterSection ?? 0,
        afterParagraph: entries[i]?.afterParagraph ?? null,
        group: entries[i]?.group || '',
      }
    : {
        alt: '',
        caption: '',
        afterSection:
          i === 0 ? 0 : Math.min(sc, Math.floor(((i - 1) * sc) / Math.max(1, images.length - 1)) + 1),
      }
);
const credits = entries.map((e) => e.background).filter(Boolean);

const comps = buildDocument(article, {
  cfg,
  baseDoc: { components: [{ id: 'T', layout: 'default', '@ctype': 'documentTitle' }] },
  images,
  imageMeta,
  credits,
});

const unknown = comps.filter((c) => !c['@ctype']).length;
console.log(`컴포넌트 ${comps.length}개 · ${summarize(comps)}`);
console.log(`사진 ${files.length}장 · 알 수 없는 컴포넌트 ${unknown}개`);

/* 본문 폭 886px 은 실측값이다 (발행된 글의 칼럼 폭).
 * 모바일 확인은 브라우저 창을 390px 로 줄이면 된다. */
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>네이버 구조 프리뷰 — ${esc(article.title)}</title>
<style>
  body{margin:0;background:#fafafa;font-family:'Malgun Gothic',-apple-system,sans-serif;color:#222}
  .wrap{max-width:886px;margin:0 auto;background:#fff;padding:40px 20px 120px}
  .note{max-width:886px;margin:16px auto 0;font-size:13px;color:#666;line-height:1.7}
  h1{font-size:30px;line-height:1.4;margin:0 0 30px}
  h1 p{margin:0}
  .sectionTitle p{font-size:30px;line-height:1.4;margin:44px 0 16px;font-weight:400}
  .text p{font-size:16px;margin:0}
  .zwsp{display:block;height:1.6em}
  hr{border:0;border-top:1px solid #ddd;margin:34px 0}
  blockquote{margin:26px 0;position:relative}
  blockquote p{font-size:16px;margin:0}
  .img{margin:26px 0}
  .img img{max-width:100%;height:auto}
  .group .row{display:flex;gap:6px}
  .group img{width:50%;height:auto;object-fit:cover}
  figcaption p{font-size:14px;color:#888;margin:8px 0 0;text-align:center}
  .tag{position:absolute;left:0;top:-16px;font-size:10px;color:#999;letter-spacing:.02em}
  .img .tag,.group .tag{position:static;display:inline-block;margin-bottom:6px}
  .unknown{background:#eee;color:#c00;padding:30px;text-align:center;margin:20px 0}
</style></head><body>
<div class="note">
  <b>네이버 구조 프리뷰</b> — 실제 발행 결과를 흉내 낸 것입니다. 수치는 발행글 실측값
  (소제목 30px · 본문 16px / 줄간격 2.0 / 가운데 정렬 · 칼럼 886px).<br>
  회색 라벨은 컴포넌트 종류이고, <span class="zwsp" style="display:inline-block;width:0"></span>빈 줄은 제로폭 공백 여백입니다.
  모바일은 창 폭을 390px 로 줄여 보세요.
</div>
<div class="wrap">
${comps.map(renderComponent).join('\n')}
</div></body></html>`;

const out = path.join('out', `${path.basename(file, '.json')}.naver-preview.html`);
fs.writeFileSync(out, html, 'utf8');
console.log(`\n프리뷰: ${path.resolve(out)}`);
