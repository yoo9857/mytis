/**
 * 모드 **출력 규격**을 대조한다. 발행하지 않는다.
 *
 *   node scripts/gate.mjs "out/<글>.json"          재기만 한다
 *   node scripts/gate.mjs "out/<글>.json" --fix    기계적으로 고칠 수 있는 것만 고쳐 저장
 *   node scripts/gate.mjs out                      폴더 전체를 한 번에 (요약표)
 *
 * 규격은 `src/modes/<모드>.js` 의 `contract` 가 갖고 있다. 값은 발행 실측에서 뽑았다.
 * 규격이 틀렸다고 판단되면 **글을 고치지 말고 규격을 고치는 것**이 맞다 —
 * 예외를 글마다 두면 다시 형식이 흔들린다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { log } from '../src/log.js';
import { checkContract, autoFix, formatViolations, contractOf } from '../src/contract.js';

const target = process.argv[2];
const doFix = process.argv.includes('--fix');
if (!target) {
  console.error('사용: node scripts/gate.mjs "out/<글>.json" [--fix]');
  process.exit(1);
}

/** 파일 하나를 검사한다. 돌려주는 값은 요약표에 쓴다. */
function run(file) {
  const article = JSON.parse(fs.readFileSync(file, 'utf8'));
  const mode = article.mode || 'topic';

  const fixes = doFix ? autoFix(article, mode) : [];
  if (fixes.length) {
    fs.writeFileSync(file, JSON.stringify(article, null, 2), 'utf8');
    for (const f of fixes) log.ok(`고침 — ${f}`);
  }

  const { measured: m, violations } = checkContract(article, mode);
  const blocks = violations.filter((v) => v.level === 'block').length;
  return { article, mode, m, violations, blocks, fixes: fixes.length };
}

const stat = fs.statSync(target);
if (stat.isDirectory()) {
  const files = fs
    .readdirSync(target)
    .filter((f) => f.endsWith('.json') && !f.includes('.preview'))
    .map((f) => path.join(target, f));
  const seen = new Set();
  let bad = 0;
  console.log(
    '모드'.padEnd(7) + '자'.padStart(6) + '사진'.padStart(5) + '자/장'.padStart(7) +
      '종결'.padStart(6) + '  ' + '결과'.padEnd(10) + '제목'
  );
  for (const file of files.sort()) {
    let r;
    try {
      r = run(file);
    } catch {
      continue;
    }
    const key = (r.article.title || '').slice(0, 16);
    if (seen.has(key)) continue; // 같은 글의 여러 초안은 마지막 것만
    seen.add(key);
    if (r.blocks) bad++;
    const verdict = r.blocks ? `막음 ${r.blocks}` : r.violations.length ? `경고 ${r.violations.length}` : '통과';
    console.log(
      r.mode.padEnd(7) +
        String(r.m.flowChars).padStart(6) +
        String(r.m.photos).padStart(5) +
        String(r.m.photoDensity).padStart(7) +
        (Math.round(r.m.ending.ratio * 100) + '%').padStart(6) +
        '  ' + verdict.padEnd(10) + key
    );
  }
  log.info(`${seen.size}편 중 규격 위반 ${bad}편`);
  process.exit(bad ? 1 : 0);
}

const r = run(target);
const c = contractOf(r.mode);
log.info(`[${r.mode}] ${r.article.title}`);
log.info(
  `${r.m.flowChars}자(규격 ${c.chars.join('~')}) · 섹션 ${r.m.sections} · ` +
    `사진 ${r.m.photos}장(${r.m.photoDensity}자/장) · 종결 ${Math.round(r.m.ending.ratio * 100)}% · ` +
    `표 ${r.m.tables} · 임베드 ${r.m.embeds} · 태그 ${r.m.tags}`
);
if (!r.violations.length) {
  log.ok('규격 통과');
  process.exit(0);
}
for (const line of formatViolations(r.violations)) {
  (line.startsWith('막음') ? log.error : log.warn)(line);
}
if (r.blocks && !doFix) log.info('기계적으로 고칠 수 있는 것만 고치려면 --fix');
process.exit(r.blocks ? 1 : 0);
