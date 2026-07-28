/**
 * `out/` 에 쌓인 산출물을 정리한다.
 *
 * 왜 필요한가: 글 한 편에 캡처 20장 + 렌더 이미지 20장이 남는다. 하루 열 번
 * 돌리면 **250MB** 가 쌓인다. `out/` 은 .gitignore 대상이라 저장소에는 안 들어가지만
 * 디스크와 파일 목록을 어지럽힌다.
 *
 * ⚠️ **아티클 JSON 과 그 글이 참조하는 파일은 함께 지워야 한다.**
 * 예전에 손으로 지우다가 JSON 은 남기고 캡처만 지워서, 그 아티클로는
 * `rethumb.mjs` 도 재발행도 못 하는 상태가 됐다. 그래서 이 스크립트는
 * **JSON 이 참조하는 파일을 읽어** 같이 남기거나 같이 지운다.
 *
 *   node scripts/clean-out.mjs           최근 3편만 남기고 정리 (미리보기)
 *   node scripts/clean-out.mjs --apply   실제로 지운다
 *   node scripts/clean-out.mjs --keep 5 --apply
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const OUT = path.join(ROOT, 'out');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const keepN = Number(args[args.indexOf('--keep') + 1]) || 3;

if (!fs.existsSync(OUT)) {
  console.log('out/ 이 없습니다.');
  process.exit(0);
}

/** 최근 아티클 JSON 을 수정시각 내림차순으로 */
const articles = fs
  .readdirSync(OUT)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ f, t: fs.statSync(path.join(OUT, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);

const keep = new Set();
const keepArticles = articles.slice(0, keepN);

for (const { f } of keepArticles) {
  keep.add(path.join(OUT, f));
  // 이 글이 참조하는 캡처·이미지 파일도 함께 남긴다
  try {
    const a = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
    for (const s of a.clipShots || []) if (s.file) keep.add(path.resolve(s.file));
    const stem = f.replace(/\.json$/, '');
    for (const dir of ['images', 'photos']) {
      const d = path.join(OUT, dir);
      if (!fs.existsSync(d)) continue;
      // 같은 글에서 나온 렌더 이미지는 제목이 파일명에 들어간다
      const title = stem.replace(/^\d{8}-\d{6}-/, '');
      for (const g of fs.readdirSync(d)) {
        if (g.includes(title)) keep.add(path.join(d, g));
      }
    }
  } catch {
    /* 깨진 JSON 은 남길 가치가 없다 */
  }
}

const targets = [];
const walk = (dir) => {
  for (const g of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, g.name);
    if (g.isDirectory()) walk(p);
    else if (!keep.has(p)) targets.push(p);
  }
};
walk(OUT);

const mb = (n) => (n / 1024 / 1024).toFixed(1);
const bytes = targets.reduce((a, p) => a + fs.statSync(p).size, 0);

console.log(`최근 ${keepArticles.length}편 유지: ${keepArticles.map((a) => a.f.slice(0, 40)).join(', ') || '(없음)'}`);
console.log(`지울 파일 ${targets.length}개 · ${mb(bytes)}MB`);

if (!apply) {
  console.log('\n미리보기입니다. 실제로 지우려면 --apply 를 붙이세요.');
  process.exit(0);
}

for (const p of targets) fs.rmSync(p, { force: true });
// 빈 디렉터리 정리
for (const d of fs.readdirSync(OUT, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const p = path.join(OUT, d.name);
  if (!fs.readdirSync(p).length) fs.rmdirSync(p);
}
console.log(`정리 완료 — ${mb(bytes)}MB 회수`);
