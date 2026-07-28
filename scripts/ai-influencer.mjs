/**
 * 배경 사진을 참조해 **인플루언서가 인생샷을 찍는 장면**을 만든다 (OpenAI 이미지 모델).
 *
 * 왜 이렇게 하는가 — 세 가지 요구가 서로 충돌한다:
 *
 *  ① **배경 일치**  그 장소여야 한다. 그래서 수집한 실사 사진을 `images/edits` 의
 *     참조로 넣는다. 텍스트로만 묘사하면 "아무 리조트" 가 나온다 (스톡 사진과 같은 실패).
 *  ② **인물 일치**  3장이 같은 사람이어야 한다. 그래서 **1장을 먼저 만들고, 그 결과를
 *     2·3장의 인물 참조로 물린다.** 텍스트 묘사(20대 여성, 긴 머리…)만으로는 매번
 *     다른 얼굴이 나온다.
 *  ③ **자연스러움**  AI 티가 나는 지점은 대개 얼굴이다. 인생샷은 원래 **뒷모습·옆모습·
 *     실루엣**이 많고, 그 구도가 어색함도 같이 피한다. 그래서 정면 클로즈업을 쓰지 않는다.
 *
 * ⚠️ **이 사진은 그 장소를 증명하지 않는다.** 생성 이미지이므로 "다녀왔다" 는 근거로
 * 쓰면 독자를 속이는 것이 된다. 연출컷·표지컷 용도로만 쓰고, 사실을 증명하는 자리
 * (간판·요금표·시설)에는 실사만 쓴다. 파일은 `ai/` 폴더에 따로 담고
 * `manifest.json` 에 생성 이미지임을 남긴다.
 *
 *   node scripts/ai-influencer.mjs --title "스파 라쿠아 …"
 *   node scripts/ai-influencer.mjs --title "…" --only 2      2번 컷만 다시
 *   node scripts/ai-influencer.mjs --title "…" --model gpt-image-1
 */
import fs from 'node:fs';
import path from 'node:path';
import { DIRS, safeSlug } from '../src/paths.js';

const argv = process.argv.slice(2);
const opt = (n) => {
  const at = argv.indexOf(`--${n}`);
  return at >= 0 ? argv[at + 1] || '' : '';
};
const title = opt('title');
const model = opt('model') || 'gpt-image-2';
const only = Number(opt('only') || 0);
const photoDirArg = opt('photos');

if (!title && !photoDirArg) {
  console.error('사용: node scripts/ai-influencer.mjs --title "글 제목" [--photos 폴더] [--only N]');
  process.exit(1);
}
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error('OPENAI_API_KEY 가 없습니다.');
  process.exit(1);
}

const photoDir = photoDirArg || path.join(DIRS.photos, 'ig', safeSlug(title));
if (!fs.existsSync(photoDir)) {
  console.error(`사진 폴더가 없습니다: ${photoDir}`);
  process.exit(1);
}
const outDir = path.join(photoDir, 'ai');
fs.mkdirSync(outDir, { recursive: true });

/** 폴더에서 `-NN.jpg` 로 끝나는 파일을 찾는다 */
function shot(n) {
  const tail = `-${String(n).padStart(2, '0')}.jpg`;
  const f = fs.readdirSync(photoDir).find((x) => x.endsWith(tail));
  if (!f) throw new Error(`배경 사진 ${tail} 을 찾지 못했습니다 (${photoDir})`);
  return path.join(photoDir, f);
}

/* 공통 지시 — 세 컷에 똑같이 건다.
 * "사진처럼" 이 아니라 **무엇을 하지 말지**를 적는 게 효과가 크다. */
const COMMON = `
Photorealistic candid travel photo taken on a smartphone. Natural imperfect framing,
real skin texture with visible pores and slight shine, natural hair strands, no beauty
retouching, no plastic skin, no over-sharpening, no HDR glow, no watermark, no text overlay.
Realistic mixed lighting with correct color temperature and soft natural shadows.
The woman is a Korean traveler in her mid-20s, slim, long dark brown hair loosely tied,
wearing the facility's grey loungewear set (short-sleeve top and relaxed pants) and slippers.
Her face is never fully facing the camera — keep the shot natural and unposed.
Keep the background architecture, furniture, lighting fixtures and view exactly as in the
reference photo; do not invent new buildings or change the layout.
`.trim();

/* 컷 셋 — **구도와 각도를 컷마다 다르게** 지정한다.
 * 세 장이 같은 각도면 한 장을 세 번 쓴 것처럼 보인다. */
const SHOTS = [
  {
    n: 1,
    bg: 8, // 파스텔 카바나 + 선더돌핀 야경
    label: '카바나-야경',
    prompt: `${COMMON}

Composition: wide shot, camera held low near waist height looking slightly up.
The woman stands at the left third of the frame, seen from behind at a three-quarter angle,
one hand lifting the pastel gauze curtain of the cabana as she steps in.
Her head is turned away toward the illuminated roller coaster track in the background,
so only the line of her cheek and ear is visible. The cabana occupies the right two thirds.
Night, warm lamp light on the fabric, cool blue city lights behind.`,
  },
  {
    n: 2,
    bg: 5, // Beach in the SKY / OTONA Beach 간판, 해질녘
    label: '간판-해질녘',
    prompt: `${COMMON}

Composition: medium shot at eye level, shot from the side.
The woman stands beside the wooden "Beach in the SKY / OTONA Beach" sign on the right,
seen in profile, looking up at the dusk sky away from the camera.
Her arms rest naturally at her sides; she is not posing for the lens.
Keep the sign fully readable and unobstructed. Shallow depth of field on the foreground cactus.
Dusk, soft pink and blue sky, warm rim light on her hair and shoulder.`,
  },
  {
    n: 3,
    bg: 13, // 야간 실내 풀 + 통유리 3연창
    label: '실내풀-야경',
    prompt: `${COMMON}

Composition: wide shot from a high angle behind her, camera above shoulder height.
The woman sits curled in one of the rattan ball chairs facing the floor-to-ceiling
window, seen entirely from behind, small in the frame at the right third.
The lit pool fills the lower half of the frame and the night city view fills the window.
She holds a phone loosely in one hand, not raised. Warm candle light in the foreground,
cool teal pool light below.`,
  },
];

async function api(pathname, form) {
  const r = await fetch(`https://api.openai.com/v1${pathname}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}` },
    body: form,
  });
  const j = await r.json();
  if (j.error) throw new Error(`${j.error.type || r.status}: ${j.error.message}`);
  return j;
}

function fileBlob(file) {
  const ext = path.extname(file).toLowerCase();
  const type = ext === '.png' ? 'image/png' : 'image/jpeg';
  return new File([fs.readFileSync(file)], path.basename(file), { type });
}

/** 배경(+인물) 참조를 걸고 한 장 만든다 */
async function generate({ prompt, refs }) {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', '1024x1536'); // 세로 2:3 — 모바일 본문에 맞는다
  form.append('quality', 'high');
  form.append('input_fidelity', 'high'); // 참조 사진의 배경·인물 특징을 최대한 유지
  for (const f of refs) form.append('image[]', fileBlob(f));
  const j = await api('/images/edits', form);
  return Buffer.from(j.data[0].b64_json, 'base64');
}

const manifestPath = path.join(outDir, 'manifest.json');
const prev = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { items: [] };
const items = prev.items || [];

/** 1번 컷은 인물의 기준이 된다 — 2·3번은 이 결과를 참조로 물린다 */
const anchorPath = path.join(outDir, 'ai-01-카바나-야경.png');

for (const s of SHOTS) {
  if (only && s.n !== only) continue;
  const bg = shot(s.bg);
  const isAnchor = s.n === 1;
  const refs = [bg];
  let prompt = s.prompt;

  if (!isAnchor) {
    if (!fs.existsSync(anchorPath)) {
      console.error(`✗ ${s.n}번: 인물 기준 컷(${path.basename(anchorPath)})이 없습니다. 1번을 먼저 만드세요.`);
      continue;
    }
    // 순서가 중요하다 — 배경을 먼저, 인물을 나중에 넣고 프롬프트에서 역할을 밝힌다
    refs.push(anchorPath);
    prompt +=
      `\n\nThe first reference image is the location. The second reference image shows ` +
      `the SAME WOMAN who must appear here — keep her exact face, hairstyle, body type and ` +
      `the identical grey loungewear set. Same person, different moment.`;
  }

  process.stdout.write(`▶ ${s.n}번 ${s.label} — 배경 ${path.basename(bg)}${isAnchor ? '' : ' + 인물 기준'} … `);
  const t0 = Date.now();
  let buf;
  try {
    buf = await generate({ prompt, refs });
  } catch (e) {
    console.log(`실패\n   ${e.message}`);
    continue;
  }
  const file = path.join(outDir, `ai-0${s.n}-${s.label}.png`);
  fs.writeFileSync(file, buf);
  console.log(`${Math.round(buf.length / 1024)}KB · ${Math.round((Date.now() - t0) / 1000)}초 → ${path.basename(file)}`);

  const rec = {
    n: s.n,
    file: path.basename(file),
    label: s.label,
    background: path.basename(bg),
    personRef: isAnchor ? null : path.basename(anchorPath),
    model,
    generated: true,
  };
  const at = items.findIndex((i) => i.n === s.n);
  if (at >= 0) items[at] = rec;
  else items.push(rec);
}

items.sort((a, b) => a.n - b.n);
fs.writeFileSync(
  manifestPath,
  JSON.stringify(
    {
      kind: 'ai-generated',
      model,
      note: '생성 이미지다. 그 장소에 다녀온 증거가 아니며, 사실을 증명하는 자리에는 쓰지 않는다.',
      items,
    },
    null,
    2
  ),
  'utf8'
);
console.log(`\n저장 ${outDir}`);
console.log('⚠️  생성 이미지입니다 — 연출컷으로만 쓰고, 실사가 필요한 자리에는 쓰지 마세요.');
