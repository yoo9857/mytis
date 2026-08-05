/**
 * 저장소에 **추적 중인** 사진 폴더의 라이선스를 검사한다.
 *
 * 왜: `.gitignore` 는 기본으로 사진 폴더를 막고, 라이선스가 열린 폴더만 이름으로
 * 되돌린다. 그 이름을 적기 전에 이 검사를 돌린다 — 사람이 "이건 위키미디어니까
 * 괜찮겠지" 로 판단하던 자리를 코드로 옮긴 것이다.
 *
 * 허용 기준은 `src/photoLicense.js` 가 갖는다(수집기 `wm-photos.mjs` 와 같은 함수).
 *
 * 사용:
 *   npm run photolint            추적 중인 폴더 전부 검사
 *   npm run photolint -- <경로>  특정 폴더만 검사
 *
 * 종료 코드 1 = 재배포하면 안 되는 항목이 추적되고 있다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkManifest, OPEN_LICENSE_LABEL } from '../src/photoLicense.js';

const arg = process.argv[2];

/** git 이 실제로 추적하는 사진 폴더 목록. .gitignore 를 신뢰하지 않고 git 에 묻는다. */
function trackedPhotoDirs() {
  const out = execFileSync('git', ['ls-files', '-z', 'out/photos'], { encoding: 'utf8' });
  const dirs = new Set();
  for (const f of out.split('\0').filter(Boolean)) dirs.add(path.dirname(f));
  return [...dirs].sort();
}

const dirs = arg ? [arg.replace(/\\/g, '/')] : trackedPhotoDirs();

if (!dirs.length) {
  console.log('추적 중인 사진 폴더가 없습니다 — 검사할 것이 없습니다.');
  process.exit(0);
}

console.log(`허용 라이선스: ${OPEN_LICENSE_LABEL}\n`);

let failed = 0;
for (const dir of dirs) {
  const mf = path.join(dir, 'manifest.json');
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((n) => /\.(jpe?g|png|webp)$/i.test(n))
    : [];

  if (!fs.existsSync(mf)) {
    /* manifest 가 없으면 출처를 되짚을 수 없다. 사진이 없는 폴더(카드만 있는 등)는 넘긴다. */
    if (!files.length) continue;
    console.log(`✗ ${dir}\n    manifest.json 이 없다 — 사진 ${files.length}장의 출처·라이선스를 알 수 없다`);
    failed += 1;
    continue;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
  } catch (err) {
    console.log(`✗ ${dir}\n    manifest.json 을 읽지 못했다: ${err.message}`);
    failed += 1;
    continue;
  }

  const { ok, bad, count } = checkManifest(manifest);

  /* manifest 항목 수와 실제 파일 수가 다르면 표기 없는 사진이 섞여 있다. */
  const listed = new Set((manifest.items || []).map((i) => i.file));
  const unlisted = files.filter((n) => !listed.has(n));

  if (ok && !unlisted.length) {
    console.log(`✓ ${dir}  (${count}장)`);
    continue;
  }

  failed += 1;
  console.log(`✗ ${dir}  (manifest ${count}장 · 파일 ${files.length}장)`);
  for (const b of bad) console.log(`    ${b.file}  [${b.license}]  ← ${b.why}`);
  for (const n of unlisted) console.log(`    ${n}  ← manifest 에 없다 (출처를 알 수 없다)`);
}

console.log('');
if (failed) {
  console.log(
    `${failed}개 폴더가 기준에 맞지 않습니다.\n` +
      '이 폴더는 추적에서 빼세요:  git rm -r --cached <폴더>\n' +
      '사진은 발행 산출물이라 `repreview --pin` 으로 다시 만들 수 있습니다 — 잃는 것이 없습니다.'
  );
  process.exit(1);
}
console.log('추적 중인 사진 폴더 전부 기준을 지킵니다.');
