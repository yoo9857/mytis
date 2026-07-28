/**
 * 사진 색보정(룩)을 **눈으로 비교한다.**
 *
 * 왜 필요한가: 룩 이름(`canon`·`fuji`·`fujiSoft`)은 숫자 몇 개일 뿐이라
 * 이름만 보고는 고를 수 없다. 게다가 같은 필터가 **사진에 따라 정반대로 작동한다** —
 * 야경에 `fujiSoft`(블랙 들어올림)를 쓰면 감성이 되지만, 이미 밝은 주간 사진에
 * 쓰면 그냥 흐려진다. 그래서 **쓸 사진 그대로** 비교해야 한다.
 *
 * 실제 렌더 경로(`renderPlainPhoto`)와 같은 CSS 를 쓴다 — 여기서 본 것이 곧 결과다.
 *
 *   node scripts/look-compare.mjs out/photos/ig/스파-…/*.jpg
 *   node scripts/look-compare.mjs <사진> --looks canon,fuji,fujiSoft
 *
 * `out/look-compare.html` 을 만들고 룩별 PNG 도 함께 남긴다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { DIRS } from '../src/paths.js';
import { resolveLook, LOOK_NAMES, photoHtml } from '../src/images.js';

const argv = process.argv.slice(2);
function opt(name) {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 ? argv[at + 1] || '' : '';
}
const looksArg = opt('looks');
const optValues = new Set(
  argv.flatMap((a, i) => (a.startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--') ? [argv[i + 1]] : []))
);
const files = argv.filter((a) => !a.startsWith('--') && !optValues.has(a));
const looks = looksArg ? looksArg.split(',').map((s) => s.trim()).filter(Boolean) : LOOK_NAMES.filter((n) => n !== 'none');

if (!files.length) {
  console.error('사용: node scripts/look-compare.mjs <사진…> [--looks canon,fuji,fujiSoft]');
  process.exit(1);
}
const unknown = looks.filter((l) => !LOOK_NAMES.includes(l));
if (unknown.length) {
  console.error(`모르는 룩: ${unknown.join(', ')}\n쓸 수 있는 룩: ${LOOK_NAMES.join(', ')}`);
  process.exit(1);
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
function dataUri(file) {
  const ext = path.extname(file).toLowerCase();
  return `data:${MIME[ext] || 'image/jpeg'};base64,${fs.readFileSync(file).toString('base64')}`;
}

const outDir = path.join(DIRS.out, 'looks');
fs.mkdirSync(outDir, { recursive: true });

const W = 640;
const H = 480;
const browser = await chromium.launch();
const rows = [];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`✗ 없는 파일: ${file}`);
    continue;
  }
  const uri = dataUri(file);
  const base = path.basename(file, path.extname(file));
  console.log(`\n▶ ${path.basename(file)}`);
  const cells = [];

  for (const name of ['none', ...looks]) {
    const look = resolveLook(name);
    // 실제 렌더와 **같은 함수**를 쓴다 — 여기서 본 것이 곧 결과여야 한다
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.setContent(photoHtml(uri, W, H, 'center center', look), { waitUntil: 'load' });
    await page.waitForTimeout(250);
    const png = path.join(outDir, `${base}--${name}.png`);
    await page.screenshot({ path: png, type: 'png' });
    await page.close();
    const layers = ['필터', look.overlay && '오버레이', look.glow && '글로우'].filter(Boolean).join('+');
    console.log(`  ${name.padEnd(11)} ${layers}  → ${path.basename(png)}`);
    cells.push({ name, uri: dataUri(png) });
  }
  rows.push({ label: path.basename(file), cells });
}

await browser.close();

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>사진 룩 비교</title><style>
  body{margin:0;padding:24px;background:#111;color:#eee;font:14px/1.5 -apple-system,'Malgun Gothic',sans-serif}
  h1{font-size:18px;margin:0 0 4px}
  p.note{color:#999;margin:0 0 20px}
  .row{margin:0 0 28px}
  .row h2{font-size:13px;color:#9cf;margin:0 0 8px;font-weight:600}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
  figure{margin:0}
  img{width:100%;display:block;border-radius:6px}
  figcaption{font-size:12px;color:#bbb;padding:5px 2px 0}
  figcaption b{color:#fff}
</style></head><body>
<h1>사진 룩 비교</h1>
<p class="note">맨 앞이 원본(<code>none</code>)이다. 고른 이름을 <code>config.json → images.look</code> 에 넣는다.</p>
${rows
  .map(
    (r) => `<div class="row"><h2>${r.label}</h2><div class="grid">${r.cells
      .map(
        (c) =>
          `<figure><img src="${c.uri}" alt="${c.name}"><figcaption><b>${c.name}</b>${
            c.name === 'none' ? ' — 원본' : ''
          }</figcaption></figure>`
      )
      .join('')}</div></div>`
  )
  .join('\n')}
</body></html>`;

const htmlPath = path.join(DIRS.out, 'look-compare.html');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log(`\n비교 페이지: ${htmlPath}`);
console.log(`룩별 PNG:    ${outDir}`);
