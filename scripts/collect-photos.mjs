/**
 * 주어진 페이지들에서 **사진을 수집한다.**
 *
 * 왜 필요한가: 지금 파이프라인은 입력한 URL **한 장**만 훑어서 사진이 6장밖에
 * 안 나온다. 여행 글은 100자당 1장이 기준이라 20장이 필요하다.
 *
 * > 2026-07-28 실측 — 라쿠아 공식 사이트의 이미지 참조 수:
 * >   spa/facilities/spa-zone/ 54개 · spa/ 47개 · spa/information/ 29개
 * > 시설 페이지를 함께 훑으면 **실물 사진만으로 20장이 넘는다.**
 * > 스톡 사진은 그 장소가 아니므로 애초에 답이 아니다 (photo.js 주석 참고).
 *
 * 쓰는 곳: 소개하려는 **장소·시설의 공식 페이지**. 링크는 사용자가 지정한다.
 *
 * 사용:
 *   node scripts/collect-photos.mjs <URL> [URL...]
 *   node scripts/collect-photos.mjs --list urls.txt
 *   옵션: --min 600   짧은 변 최소 픽셀 (기본 500)
 *         --max 30    최대 수집 장수 (기본 30)
 *         --out DIR   저장 폴더 (기본 out/photos/collected)
 */
import fs from 'node:fs';
import path from 'node:path';
import { imageSize } from '../src/images.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';

/**
 * 사진이 아닌 것들. 로고·아이콘·스프라이트·배너가 섞이면 글에 못 쓴다.
 * 크기로도 걸러지지만, 큰 배너 이미지는 크기만으로는 안 걸린다.
 */
const NOT_PHOTO = /(logo|icon|sprite|btn|button|bullet|arrow|bg_|_bg|banner|badge|favicon|placeholder|dummy|blank|spacer|loading|share|sns|footer|header|nav|menu)/i;

/**
 * 같은 사진의 크기 변형을 하나로 본다.
 *
 * 언론사·시설 사이트는 같은 사진을 `_S`·`_M`·`-300x200`·`@2x` 처럼 여러 크기로
 * 내보낸다. URL 전체로 중복을 판정하면 **같은 컷이 여러 번 실린다.**
 * (photo.js 의 photoKey 와 같은 발상 — HANDOVER ⑦-5)
 */
function photoKey(url) {
  return decodeURIComponent(url.split('?')[0])
    .toLowerCase()
    .replace(/\.(jpg|jpeg|png|webp|avif|gif)$/i, '')
    .replace(/[-_](s|m|l|xl|thumb|small|medium|large|sp|pc)$/i, '')
    .replace(/[-_]\d{2,4}x\d{2,4}$/i, '')
    .replace(/@\dx$/i, '')
    .replace(/\/\d{2,4}\//, '/');
}

/**
 * 더 큰 원본을 노려 본다.
 *
 * 목록용 축소본이 박혀 있는 경우가 흔하다. 접미사·확장자를 떼면 원본이 나온다.
 * (실측: `_V` 와 `.webp` 를 떼서 660x503 → 4000x2667 까지 나온 적이 있다)
 */
function upgradeCandidates(url) {
  const out = [url];
  const noWebp = url.replace(/\.webp(\?|$)/i, '$1');
  if (noWebp !== url) out.unshift(noWebp);
  const noSize = url.replace(/[-_]\d{2,4}x\d{2,4}(\.\w+)/i, '$1').replace(/@\dx(\.\w+)/i, '$1');
  if (noSize !== url) out.unshift(noSize);
  const noSuffix = url.replace(/[-_](s|m|thumb|small|sp)(\.\w+)/i, '$2');
  if (noSuffix !== url) out.unshift(noSuffix);
  return [...new Set(out)];
}

/** 페이지 HTML 에서 이미지 주소를 뽑는다 (img src · srcset · og:image · CSS url()). */
function extractUrls(html, base) {
  const found = new Set();
  const add = (raw) => {
    if (!raw) return;
    const u = raw.trim().replace(/^["']|["']$/g, '');
    if (!u || u.startsWith('data:')) return;
    try {
      found.add(new URL(u, base).href);
    } catch {
      /* 잘못된 주소 무시 */
    }
  };

  for (const m of html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(["'][^"']+["'])/gi)) add(m[1]);
  // 지연 로딩 속성들 — 요즘 사이트는 src 가 빈 껍데기인 경우가 많다
  for (const attr of ['data-src', 'data-original', 'data-lazy', 'data-echo']) {
    for (const m of html.matchAll(new RegExp(`\\b${attr}\\s*=\\s*(["'][^"']+["'])`, 'gi'))) add(m[1]);
  }
  // srcset 은 가장 큰 후보를 고른다
  for (const m of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
    const best = m[1]
      .split(',')
      .map((s) => s.trim().split(/\s+/))
      .map(([u, d]) => ({ u, w: parseInt(d, 10) || 0 }))
      .sort((a, b) => b.w - a.w)[0];
    add(best?.u);
  }
  for (const m of html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/url\((["']?)([^"')]+\.(?:jpg|jpeg|png|webp|avif))\1\)/gi)) add(m[2]);

  return [...found].filter((u) => /\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(u));
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko,ja;q=0.8,en;q=0.6' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function download(url, dir, index, referer) {
  for (const candidate of upgradeCandidates(url)) {
    try {
      const res = await fetch(candidate, {
        headers: { 'User-Agent': UA, Referer: referer || '', Accept: 'image/*,*/*' },
      });
      if (!res.ok) continue;
      const type = res.headers.get('content-type') || '';
      if (!/^image\//.test(type)) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 20_000) continue; // 20KB 미만은 아이콘·썸네일이다
      const ext = (type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').split(';')[0];
      const file = path.join(dir, `p${String(index).padStart(2, '0')}.${ext}`);
      fs.writeFileSync(file, buf);
      return { file, url: candidate, bytes: buf.length };
    } catch {
      /* 다음 후보 */
    }
  }
  return null;
}

// ── 실행 ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const MIN = Number(opt('min', 500));
const MAX = Number(opt('max', 30));
const OUT = opt('out', path.join('out', 'photos', 'collected'));
const listFile = opt('list', null);

let pages = argv.filter((a) => /^https?:\/\//i.test(a));
if (listFile) {
  pages = pages.concat(
    fs.readFileSync(listFile, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s))
  );
}
if (!pages.length) {
  console.error('사용: node scripts/collect-photos.mjs <URL> [URL...]  또는  --list urls.txt');
  console.error('옵션: --min 600  --max 30  --out DIR');
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
console.log(`페이지 ${pages.length}개 · 짧은 변 ${MIN}px 이상 · 최대 ${MAX}장 → ${OUT}\n`);

/* 페이지마다 사진 주소를 모으고, 중복을 **페이지 사이에서도** 걸러낸다.
 * 같은 사이트는 여러 페이지에 같은 대표 사진을 반복해서 넣는다. */
const seen = new Set();
const candidates = [];
for (const page of pages) {
  let urls = [];
  try {
    urls = extractUrls(await fetchText(page), page);
  } catch (err) {
    console.log(`  ✗ ${page} — ${err.message}`);
    continue;
  }
  let added = 0;
  for (const u of urls) {
    if (NOT_PHOTO.test(u)) continue;
    const key = photoKey(u);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ url: u, referer: page });
    added += 1;
  }
  console.log(`  ${page}\n    이미지 ${urls.length}개 → 후보 ${added}개 (중복·아이콘 제외)`);
}

console.log(`\n후보 ${candidates.length}개를 내려받아 크기로 선별합니다...`);
const kept = [];
let i = 0;
for (const c of candidates) {
  if (kept.length >= MAX) break;
  i += 1;
  const got = await download(c.url, OUT, kept.length + 1, c.referer);
  if (!got) continue;
  const { w, h } = imageSize(got.file);
  // 짧은 변 기준. 세로 사진도 살린다
  if (Math.min(w, h) < MIN) {
    fs.unlinkSync(got.file);
    continue;
  }
  kept.push({ ...got, w, h });
  console.log(`  ${String(kept.length).padStart(2)}. ${w}x${h}  ${(got.bytes / 1024).toFixed(0)}KB  ${path.basename(got.file)}`);
}

const manifest = path.join(OUT, 'manifest.json');
fs.writeFileSync(
  manifest,
  JSON.stringify({ collectedAt: new Date().toISOString(), pages, kept }, null, 2),
  'utf8'
);

console.log(`\n수집 완료: ${kept.length}장 (후보 ${candidates.length}개 중)`);
console.log(`폴더: ${path.resolve(OUT)}`);
console.log(`목록: ${manifest}   ← 출처 URL 이 함께 기록됩니다 (저작자 표기·재확인용)`);
if (kept.length < 15) {
  console.log(`\n⚠️ ${kept.length}장뿐입니다. 페이지를 더 넣거나 --min 을 낮춰 보세요.`);
}
