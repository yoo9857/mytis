/**
 * 위키미디어 공용에서 **장소 사진**을 받아 글 폴더에 담는다.
 *
 * 왜 필요한가: 여행 글에는 인스타 사진으로 메울 수 없는 자리가 있다 —
 * **역 안내판·개찰구·출구·건물 외관** 같은 "가는 길" 컷이다. 남의 인스타에서
 * 그런 컷을 찾기도 어렵고, 찾아도 발행 허가가 없다.
 * 공용(Commons)의 역 사진은 **CC 라이선스라 표기만 하면 실을 수 있고**,
 * 철도 시설은 사진이 촘촘히 정리돼 있어 원하는 컷이 대개 존재한다.
 *
 * ⚠️ 스톡 사진과 다르다. 스톡은 "아무 역" 을 물어오지만 공용은 파일 이름과
 *    설명에 **역 이름이 박혀 있어** 그 장소임을 확인할 수 있다.
 *
 * 사용 — ① 찾고 ② 눈으로 고르고 ③ 받는다:
 *   node scripts/wm-photos.mjs --search "Korakuen Station sign"
 *   node scripts/wm-photos.mjs --title "글 제목" --file "이름1.jpg" --file "이름2.jpg"
 *
 * 받은 사진은 인스타 수집기(`ig-photos.mjs`)와 **같은 폴더·같은 번호 체계**로
 * 들어가고 `manifest.json` 에 이어 붙는다. 한 글에 쓸 사진은 폴더 하나에 모인다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DIRS, safeSlug } from '../src/paths.js';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'moneyti/1.0 (blog illustration; contact via repo)';

/* 허용 라이선스 판정은 **`src/photoLicense.js` 한 곳**이 갖는다.
 * 전에는 이 파일의 정규식이 기준이었고 `.gitignore` 주석이 따로 "PD·CC0만" 이라고
 * 말해서, 코드가 받아 둔 CC BY 폴더를 커밋해도 되는지 사람이 매번 다시 판단했다
 * (2026-08-05). 수집기와 검사기(`scripts/photolint.mjs`)가 같은 함수를 쓴다. */
import { isOpenLicense } from '../src/photoLicense.js';

const argv = process.argv.slice(2);
const opts = (name) =>
  argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] ? [argv[i + 1]] : []));
const opt = (name) => opts(name)[0] || '';

const title = opt('title');
const search = opt('search');
const wanted = opts('file');
const limit = Number(opt('limit') || 14);

if (!search && !wanted.length) {
  console.error(
    '사용: node scripts/wm-photos.mjs --search "검색어"\n' +
      '      node scripts/wm-photos.mjs --title "글 제목" --file "파일이름.jpg" [--file …]'
  );
  process.exit(1);
}

const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** imageinfo 한 벌을 우리가 쓰는 모양으로 정리한다. */
function normalize(page) {
  const ii = page.imageinfo?.[0] || {};
  const em = ii.extmetadata || {};
  return {
    name: page.title.replace(/^File:/, ''),
    license: strip(em.LicenseShortName?.value),
    author: strip(em.Artist?.value).slice(0, 60),
    desc: strip(em.ImageDescription?.value).slice(0, 90),
    width: ii.width,
    height: ii.height,
    // iiurlwidth 로 요청한 축소본. 원본은 5000px 이 넘는 경우가 많아 그대로 받지 않는다
    url: ii.thumburl || ii.url,
    pageUrl: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
  };
}

async function api(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: 'json', ...params })) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`Commons API ${r.status}`);
  return r.json();
}

const IMAGE_PROPS = {
  prop: 'imageinfo',
  iiprop: 'url|size|extmetadata',
  iiurlwidth: '1600',
};

if (search) {
  const j = await api({
    action: 'query',
    generator: 'search',
    gsrsearch: `${search} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    ...IMAGE_PROPS,
  });
  const rows = Object.values(j?.query?.pages || {}).map(normalize);
  console.log(`검색 "${search}" — ${rows.length}건\n`);
  for (const r of rows) {
    const ok = isOpenLicense(r.license);
    console.log(`${ok ? ' ' : '✗'} ${(r.license || '?').padEnd(14)} ${String(r.width)}x${r.height}`);
    console.log(`   ${r.name}`);
    if (r.desc) console.log(`   ${r.desc}`);
    if (r.author) console.log(`   저작자 ${r.author}`);
    console.log('');
  }
  console.log('쓸 것을 골라 --file "이름.jpg" 로 다시 부르세요 (여러 개 가능).');
  process.exit(0);
}

// ── 내려받기 ────────────────────────────────────────────────────────────────
if (!title) {
  console.error('--file 로 받을 때는 --title "글 제목" 이 필요합니다 (폴더가 제목으로 만들어집니다).');
  process.exit(1);
}

const folder = safeSlug(title);
const outDir = path.join(DIRS.photos, 'ig', folder);
const manifestPath = path.join(outDir, 'manifest.json');

let prev = { title, items: [], posts: [] };
if (fs.existsSync(manifestPath)) {
  try {
    prev = { ...prev, ...JSON.parse(fs.readFileSync(manifestPath, 'utf8')) };
  } catch {
    /* 깨진 manifest 는 새로 쓴다 */
  }
}
const items = [...(prev.items || [])];
let n = items.reduce((m, it) => Math.max(m, it.n || 0), 0);
const already = new Set(items.map((it) => it.wmFile).filter(Boolean));

fs.mkdirSync(outDir, { recursive: true });
console.log(`폴더   ${outDir}\n기존   ${items.length}장 — 이어서 담습니다\n`);

const j = await api({
  action: 'query',
  titles: wanted.map((w) => `File:${w}`).join('|'),
  ...IMAGE_PROPS,
});
const found = new Map(Object.values(j?.query?.pages || {}).map((p) => [p.title.replace(/^File:/, ''), p]));

for (const want of wanted) {
  const page = found.get(want);
  if (!page || page.missing !== undefined) {
    console.error(`✗ ${want} — 공용에 없습니다 (이름을 정확히 적어야 합니다)`);
    continue;
  }
  const info = normalize(page);
  if (already.has(info.name)) {
    console.log(`· ${info.name} — 이미 있음, 건너뜁니다`);
    continue;
  }
  /* 라이선스를 여기서 한 번 더 막는다. 검색 목록에서 눈으로 걸렀더라도
   * 이름을 손으로 옮기다 다른 파일을 받는 일이 생긴다. */
  if (!isOpenLicense(info.license)) {
    console.error(`✗ ${info.name} — 라이선스 ${info.license || '알 수 없음'} 은 받지 않습니다`);
    continue;
  }

  const ext = (info.url.match(/\.(jpe?g|png)(\?|$)/i)?.[1] || 'jpg').toLowerCase();
  n += 1;
  const name = `${folder}-${String(n).padStart(2, '0')}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const dest = path.join(outDir, name);

  /* 429 를 조심한다.
   * `iiurlwidth` 로 받는 축소본은 요청 시점에 **서버가 새로 렌더링**하는 경우가 있어
   * 연달아 부르면 속도 제한이 걸린다 (실측: 7장 중 2장만 받고 나머지 전부 429).
   * → 사이를 띄우고, 429 면 기다렸다 다시 부른다. */
  let r = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(1500 * 2 ** attempt);
    r = await fetch(info.url, { headers: { 'User-Agent': UA } });
    if (r.status !== 429) break;
    console.log(`  429 — ${1.5 * 2 ** (attempt + 1)}초 뒤 다시 시도합니다 (${info.name})`);
  }
  if (!r?.ok) {
    console.error(`✗ ${info.name} — 내려받기 실패 ${r?.status}`);
    n -= 1;
    continue;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  await sleep(1200); // 다음 파일까지 간격
  fs.writeFileSync(dest, buf);

  items.push({
    n,
    file: name,
    source: 'wikimedia',
    wmFile: info.name,
    author: info.author || '작자 미상',
    license: info.license,
    permalink: info.pageUrl,
    dim: `${info.width}x${info.height}`,
    bytes: buf.length,
    alt: info.desc || '',
  });
  console.log(`✓ ${name}  ${Math.round(buf.length / 1024)}KB  ${info.license}  ${info.name}`);
}

fs.writeFileSync(
  manifestPath,
  JSON.stringify(
    {
      ...prev,
      title: prev.title || title,
      folder,
      count: items.length,
      items,
      note:
        prev.note ||
        '원저작자 사진. 후보 확인용 수집이며 발행 허가가 아니다. (source: wikimedia 인 항목은 CC 라이선스로, 표기하면 실을 수 있다)',
    },
    null,
    2
  ) + '\n',
  'utf8'
);
console.log(`\nmanifest ${manifestPath} · 총 ${items.length}장`);
