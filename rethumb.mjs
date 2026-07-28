/**
 * 이미 만들어 둔 아티클의 **대표 이미지 문구만** 바꿔 다시 렌더링한다.
 *
 * 글을 다시 쓰거나 장면을 다시 캡처하지 않는다. 캡처 파일은 그대로 두고
 * 카드만 다시 그리므로 몇 초면 끝난다.
 *
 *   node rethumb.mjs "out/글.json" "새 문구"
 */
import fs from 'node:fs';
import { renderImages } from './src/images.js';
import { loadConfig } from './src/config.js';

const [file, headline] = process.argv.slice(2);
if (!file || !headline) {
  console.error('사용법: node rethumb.mjs "out/글.json" "새 문구"');
  process.exit(1);
}

const article = JSON.parse(fs.readFileSync(file, 'utf8'));
const thumb = article.imageBriefs.find((b) => b.placement === 'thumbnail');
if (!thumb) {
  console.error('대표 이미지 브리프가 없습니다.');
  process.exit(1);
}

console.log('이전 문구:', thumb.headline);
thumb.headline = headline;
console.log('새 문구  :', headline);

const cfg = loadConfig();
const rendered = await renderImages(article, cfg);
console.log('대표 이미지:', rendered.thumbnail?.file);

fs.writeFileSync(file, JSON.stringify(article, null, 2), 'utf8');
console.log('아티클 갱신 완료 — 이제 npm run publish 로 발행할 수 있습니다.');
