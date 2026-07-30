/**
 * 아티클 JSON 의 `sourceImages` 를 폴더에 내려받는다 — **눈으로 고르기 위해서**.
 *
 * 왜 필요한가: 파이프라인은 후보를 순서대로 먹기 때문에 합성본(4분할)이나 같은 컷이
 * 그대로 실린다. 자동 판정은 실패했다(HANDOVER ⑬). 그래서 후보를 한 폴더에 펼쳐
 * 놓고 사람이 고른 뒤 `imageBriefs[].photo` 로 지정하는 경로를 남긴다.
 *
 * ⚠️ 저작권 — 내려받은 사진은 원저작자 것이다. 수집은 고르기 위한 것이며
 *    발행 허가가 아니다. 발행 위험은 발행자가 진다 (HANDOVER §6).
 *
 * 사용: node scripts/grab-source-photos.mjs out/<글>.json <대상폴더>
 */
import fs from 'node:fs';
import path from 'node:path';

const [jsonPath, outDir] = process.argv.slice(2);
if (!jsonPath || !outDir) {
  console.error('사용: node scripts/grab-source-photos.mjs out/<글>.json <대상폴더>');
  process.exit(1);
}

const article = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const urls = [...new Set(article.sourceImages || [])];
fs.mkdirSync(outDir, { recursive: true });

/** 언론사 축소본 접미사를 떼어 더 큰 원본을 먼저 시도한다 (HANDOVER ⑦-5). */
function upgrades(url) {
  const out = [url];
  const bigger = url
    .replace(/\?type=w\d+$/, '')
    .replace(/\.(\d{3,4})x\.0(\.jpe?g)$/i, '$2')
    .replace(/_V(\.jpe?g)/i, '$1');
  if (bigger !== url) out.unshift(bigger);
  return out;
}

let n = 0;
for (const url of urls) {
  n++;
  let saved = false;
  for (const cand of upgrades(url)) {
    try {
      const res = await fetch(cand, {
        headers: { 'user-agent': 'Mozilla/5.0', referer: new URL(cand).origin },
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 8_000) continue; // 아이콘·에러 이미지
      const ext = (cand.match(/\.(jpe?g|png|webp)/i)?.[1] || 'jpg').toLowerCase();
      const name = `${String(n).padStart(2, '0')}.${ext === 'jpeg' ? 'jpg' : ext}`;
      fs.writeFileSync(path.join(outDir, name), buf);
      console.log(`${name}  ${(buf.length / 1024).toFixed(0)}KB  ${cand}`);
      saved = true;
      break;
    } catch {
      /* 다음 후보 */
    }
  }
  if (!saved) console.log(`-- 실패: ${url}`);
}
