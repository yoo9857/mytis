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
 *
 * 아티클의 `photoDir`·`imageBriefs[].photo` 를 손으로 고친 뒤 이걸 돌리면 된다.
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

const images = mapImages(await renderImages(article, cfg));
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
