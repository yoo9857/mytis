/**
 * 이미 만든 아티클의 **사진과 배치만** 다시 그린다. 집필은 하지 않는다.
 *
 * 왜 필요한가: 사진을 바꿔 보려고 `npm run draft` 를 다시 돌리면 집필에만 3~10분이
 * 걸린다. 그런데 사진 큐레이션·배치·화질은 **글을 한 글자도 바꾸지 않는 작업**이다.
 *
 * > 2026-08-01 — 캡처 화질을 잡는다고 초안을 일곱 번 돌렸다. 사용자 지적:
 * >   "왜이리오래걸려?" 그 중 여섯 번은 이 스크립트면 5초로 끝날 일이었다.
 *
 * 사용:
 *   node scripts/repreview.mjs "out/<글>.json"
 *   node scripts/repreview.mjs "out/<글>.json" --open
 *   node scripts/repreview.mjs "out/<글>.json" --pin    ← 지금 이 사진으로 **고정**
 *
 * 아티클의 `photoDir`·`imageBriefs[].photo` 를 손으로 고친 뒤 이걸 돌리면 된다.
 *
 * ## --pin — 검토한 사진과 발행되는 사진을 같게 만든다
 *
 * `publish` 는 발행 직전에 이미지를 **다시 렌더한다.** 그런데 스톡 사진은
 * `photoQuery` 로 **매번 새로 검색**되므로, 검토할 때 본 사진과 실제로 실리는
 * 사진이 다를 수 있다. 네이버는 발행 후 수정이 안 되니 이건 되돌릴 수 없다.
 *
 * > 2026-08-03: 하루에 네 글을 냈는데 네 번 다 사람이 손으로 사진을 폴더에
 * > 복사하고 `photoDir` 을 적어 넣어 막았다. 손으로 네 번 하면 코드가 할 일이다.
 *
 * `--pin` 은 방금 렌더한 이미지를 글별 폴더에 복사하고, 아티클의 `photoDir` 과
 * `imageBriefs[].photo` 를 그 파일로 고쳐 쓴다. 그 뒤로는 몇 번을 렌더하든
 * 같은 사진이 나온다. 크레딧은 렌더 결과에서 뽑아 `manifest.json` 으로 남긴다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DIRS, stamp, safeSlug } from '../src/paths.js';
import { loadConfig } from '../src/config.js';
import { log } from '../src/log.js';
import { renderImages } from '../src/images.js';
import { mapImages } from '../src/run.js';
import { buildHtml, previewDocument } from '../src/html.js';

const file = process.argv[2];
if (!file) {
  console.error('사용: node scripts/repreview.mjs "out/<글>.json"');
  process.exit(1);
}

const cfg = loadConfig();
const article = JSON.parse(fs.readFileSync(file, 'utf8'));

const rendered = await renderImages(article, cfg);

/* --pin : 방금 그린 이미지를 글별 폴더에 고정하고 아티클이 그것을 가리키게 한다.
 *
 * 렌더 **결과물**을 고정한다(원본 배경이 아니라). 결과물에는 대표 헤드라인이 이미
 * 찍혀 있으므로 모든 브리프에 noText 를 준다 — 안 그러면 다음 렌더에서 글자가
 * 두 겹으로 얹힌다 (2026-07-30 실측: 글귀 카드 한가운데에 글 제목이 겹쳐 찍혔다). */
if (process.argv.includes('--pin')) {
  const slug = safeSlug(article.title, 'post');
  const dir = path.join(DIRS.photos, 'pinned', slug);
  fs.mkdirSync(dir, { recursive: true });

  const slots = [rendered.thumbnail, ...(rendered.body || [])].filter(Boolean);
  const briefs = [
    ...(article.imageBriefs || []).filter((b) => b.placement === 'thumbnail'),
    ...(article.imageBriefs || []).filter((b) => b.placement === 'body'),
  ];

  const items = [];
  slots.forEach((slot, i) => {
    const ext = path.extname(slot.file) || '.png';
    const name = `${String(i).padStart(2, '0')}${i === 0 ? '-thumb' : ''}${ext}`;
    fs.copyFileSync(slot.file, path.join(dir, name));
    const b = briefs[i];
    if (b) {
      b.photo = name;
      b.noText = true;
      b.photoQuery = '';
    }
    const bg = slot.background || {};
    items.push({
      file: name,
      source: bg.source || '',
      photographer: bg.photographer || '',
      license: bg.license || '',
      permalink: bg.pageUrl || '',
    });
  });

  /* 브리프가 렌더된 장수보다 많으면(공급 부족) 남는 브리프는 지운다 —
   * 남겨 두면 다음 렌더에서 그 자리를 스톡이 다시 채운다. */
  const extra = briefs.length - slots.length;
  if (extra > 0) {
    const keep = new Set(briefs.slice(0, slots.length));
    article.imageBriefs = (article.imageBriefs || []).filter((b) => keep.has(b));
    log.warn(`채우지 못한 브리프 ${extra}개를 지웠습니다 — 스톡이 그 자리를 다시 채우지 않도록.`);
  }

  article.photoDir = path.join('out', 'photos', 'pinned', slug).replace(/\\/g, '/');
  fs.writeFileSync(
    path.join(dir, 'manifest.json'),
    JSON.stringify(
      { note: '렌더 결과를 고정한 것이다. 원저작권은 각 원저작자에게 있다.', items },
      null,
      2
    ) + '\n',
    'utf8'
  );
  fs.writeFileSync(file, JSON.stringify(article, null, 2) + '\n', 'utf8');
  log.ok(`사진 ${slots.length}장 고정 → ${article.photoDir} (아티클의 photoDir 갱신)`);
}

const images = mapImages(rendered);
const preview = previewDocument(
  article,
  buildHtml(article, { cfg, images: images.withLocalSrc, imageCredits: images.credits })
);

const out = path.join(DIRS.out, `${stamp()}-${safeSlug(article.title)}.preview.html`);
fs.writeFileSync(out, preview, 'utf8');

/* 배치를 눈으로 세지 않아도 되게 숫자로 찍는다 — 몇 번째 섹션 뒤에 몇 장인가. */
const per = {};
for (const b of article.imageBriefs || []) {
  if (b.placement === 'thumbnail') continue;
  per[b.afterSection] = (per[b.afterSection] || 0) + 1;
}
const rhythm = Object.keys(per)
  .map(Number)
  .sort((a, b) => a - b)
  .map((k) => `${k}절:${per[k]}`)
  .join(' · ');

/* `withLocalSrc` 는 `{thumbnail, body[]}` 다 — 키를 세면 늘 2가 나온다(실제로 그랬다). */
const n = (images.withLocalSrc.thumbnail ? 1 : 0) + (images.withLocalSrc.body?.length || 0);
log.ok(`이미지 ${n}장 · 배치 ${rhythm || '없음'}`);
log.ok(`미리보기: ${out}`);
