/**
 * 아티클 하나에서 **ChatGPT 이미지 생성 프롬프트 묶음**을 뽑는다.
 *
 * 왜 필요한가: 이 파이프라인에는 이미지 생성기가 없다. 생성은 사람이 ChatGPT 에서
 * 하고, 여기서는 **정확한 프롬프트**만 만들어 넘긴다.
 *
 * 왜 손으로 쓰지 않는가:
 *  - 구도·각도·빛·분위기·트렌드를 글마다 다르게 섞어야 한다(사용자 요청 2026-08-03).
 *    손으로 쓰면 매번 같은 낱말이 나온다. 조합은 `src/photoScenes.js` 가 돌린다.
 *  - 금지 규칙(글자·얼굴·화폐·영문 서식)을 매번 다시 적을 수 없다. 한 번 정해 붙인다.
 *  - 자리(대표·몇 절 뒤)와 비율을 아티클에서 그대로 가져와야 어긋나지 않는다.
 *
 * 사용:
 *   npm run imgprompts -- out/<글>.json
 *
 * 결과: out/<글>.imgprompts.md  — 그대로 ChatGPT 에 붙이고,
 *       받은 파일을 out/photos/<slug>/ 에 01.png, 02.png … 로 저장한 뒤
 *       `npm run repreview -- out/<글>.json --pin` 으로 고정한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { interiorScene, isHousingArticle } from '../src/photoScenes.js';
import { steps } from '../src/infographic.js';

const file = process.argv[2];
if (!file) {
  console.error('아티클 JSON 경로를 주세요.  예)  npm run imgprompts -- out/xxx.json');
  process.exit(1);
}
const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
const article = JSON.parse(fs.readFileSync(abs, 'utf8'));

/**
 * 모든 프롬프트에 붙는 규칙. 실측에서 나온 것만 넣는다 — 늘리면 모델이 흘린다.
 *
 * ⚠️ `interior` 를 여기 쓰지 않는다. 실내 컷이 아닌 자리(건물 외관·책상)에도 붙기 때문에
 * 장면과 규칙이 서로 다른 말을 한다 (2026-08-03 첫 출력에서 그렇게 나왔다).
 */
const RULES = `Photorealistic photograph, shot on a full-frame camera with a 24mm lens,
natural light only, fine film grain, real photograph texture — not a 3D render, not an illustration.
Absolutely no text, no letters, no numbers, no signage, no logos, no watermarks anywhere.
No people, no faces, no hands. No currency, no banknotes, no coins.
No English documents or forms. Nothing cluttered.`;

/** 집을 다루는 글이면 '살고 싶은 집' 컷을 섞는다 (photoScenes.js) */
const housing = isHousingArticle(article);
const scene = housing ? interiorScene(article.title || article.primaryKeyword) : '';

const briefs = article.imageBriefs || [];
const lines = [];

lines.push(`# 이미지 생성 프롬프트 — ${article.title}`);
lines.push('');
lines.push(`- 아티클: \`${path.basename(abs)}\``);
lines.push(`- 이미지 ${briefs.length}장${housing ? ' · **집을 다루는 글**이라 실내 컷을 섞었습니다' : ''}`);
lines.push('');
lines.push('## 먼저 읽을 것');
lines.push('');
lines.push('1. **받은 뒤 확대해서 글자를 찾으세요.** 한글·영문 어느 쪽이든 글자가 보이면 다시 생성합니다. 깨진 글자 한 장이 글 전체를 아마추어로 만듭니다.');
lines.push('2. **너무 예쁘면 버리세요.** 광고처럼 보이면 목적을 잃었습니다. `less styled, more ordinary` 를 더해 다시 뽑습니다.');
lines.push('3. 저장 위치: `out/photos/' + (article.urlSlug || 'article') + '/` · 파일명은 `01.png`, `02.png` … 아래 번호 순서대로.');
lines.push('4. 다 채운 뒤 `npm run repreview -- "' + path.basename(abs) + '" --pin` 으로 고정하고 프리뷰를 봅니다.');
lines.push('');

if (housing) {
  lines.push('## 이 글에 배정된 실내 연출');
  lines.push('');
  lines.push('제목 해시로 고른 조합입니다 — **다른 글은 다른 조합**이 나오고, 같은 글은 다시 뽑아도 같습니다.');
  lines.push('');
  lines.push('```');
  lines.push(scene);
  lines.push('```');
  lines.push('');
}

/* 절차 글이면 **대표 이미지를 코드가 만든다** (src/infographic.js 의 절차 카드).
 * 그 자리를 생성하라고 안내하면 사람이 헛일을 한다. */
const stepCardTakesThumb = steps(article).length >= 2;

briefs.forEach((b, i) => {
  const n = String(i + 1).padStart(2, '0');
  const isThumb = b.placement === 'thumbnail';
  if (isThumb && stepCardTakesThumb) {
    lines.push('---');
    lines.push('');
    lines.push(`## ${n} · 대표 이미지 — **생성하지 않습니다**`);
    lines.push('');
    lines.push(`이 글은 절차 글(${steps(article).length}단계)이라 대표 이미지를 코드가 **절차 흐름 카드**로 만듭니다 (\`src/infographic.js\`). 목록·공유 카드에서 무슨 글인지 바로 보이게 하려는 것이고, 스톡·생성 사진보다 정직합니다.`);
    lines.push('');
    lines.push('아래 번호는 그대로 두세요 — 파일 번호와 자리가 어긋나면 사진이 엉뚱한 절에 붙습니다.');
    lines.push('');
    return;
  }
  const where = isThumb ? '대표 이미지' : `본문 · ${b.afterSection || 1}번째 절 뒤`;
  const ratio = isThumb ? '1:1 정사각' : '3:2 가로';

  /* 첫 본문 사진을 '살고 싶은 집' 자리로 쓴다. 대표는 절차 카드가 차지하는 일이 많고,
   * 실내 컷은 글 앞쪽에 있어야 독자가 자기 삶을 얹어 본다. */
  const useInterior = housing && !isThumb && i === 1;

  lines.push(`---`);
  lines.push('');
  lines.push(`## ${n} · ${where}`);
  lines.push('');
  lines.push(`- 비율: **${ratio}**${isThumb ? ' (티스토리 목록·공유 카드가 정사각으로 자릅니다)' : ''}`);
  if (b.headline) lines.push(`- 이 자리의 글: ${b.headline}${b.subline ? ` / ${b.subline}` : ''}`);
  if (useInterior) lines.push(`- **'살고 싶은 집' 컷** — 위 실내 연출을 씁니다`);
  lines.push('');
  lines.push('```');
  if (useInterior) {
    lines.push(`An empty, beautiful Korean apartment interior that anyone would want to live in.`);
    lines.push(scene);
  } else {
    lines.push(sceneFor(b, article));
  }
  lines.push('');
  lines.push(RULES);
  lines.push('```');
  lines.push('');
});

/**
 * 실내 컷이 아닌 자리의 장면.
 *
 * 모델이 적어 둔 photoQuery 를 **뼈대로만** 쓴다. 그 값은 스톡 검색용이라 짧고,
 * 생성 프롬프트로는 지시가 모자라다. 그리고 화폐·얼굴·영문 서식을 부르는 낱말이
 * 섞여 있으면 여기서 걸러야 한다 (실측 3건 — HANDOVER ⑦).
 */
function sceneFor(brief, art) {
  const q = String(brief.photoQuery || '').trim();
  const BAD = /money|cash|banknote|dollar|coin|contract|lease|form|invoice|tax return|people|person|man|woman|couple|businessman|smiling|hand/i;
  const cleaned = q
    .split(/\s+/)
    .filter((w) => !BAD.test(w))
    .join(' ')
    .trim();
  const base = cleaned || 'a quiet corner of a desk with a closed notebook';
  return `A still, ordinary Korean domestic scene: ${base}.
Shot from a natural seated eye level, slightly off-center, with generous empty space on one side.
Muted warm palette, soft daylight from a window just out of frame.`;
}

const out = abs.replace(/\.json$/, '.imgprompts.md');
fs.writeFileSync(out, lines.join('\n'));
console.log(`프롬프트 ${briefs.length}장 → ${out}`);
if (housing) console.log(`실내 연출: ${scene.replace(/, no people.*/, '')}`);
