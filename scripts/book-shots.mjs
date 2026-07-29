/**
 * 책 연출컷 생성 — '오늘 뭐 읽지?' 글에 넣을 사진을 만든다 (OpenAI 이미지 모델).
 *
 * 무엇을 만드나 (독자 피드백 2026-07-29: "실물 책 + 내용이 살짝 보이는 책 +
 * 포스터/일지 이미지"):
 *
 *   1 desk    책상 위에 놓인 실물 느낌의 양장본 — 표지가 살짝 비껴 보인다
 *   2 pages   펼친 페이지 클로즈업 — 활자가 흐릿하게, 내용이 "살짝" 보이는 정도
 *   3 poster  책의 분위기를 담은 포스터풍 컷 — 문구는 넣지 않는다(아래 참고)
 *   4 journal 독서 일지 스프레드 — 노트·펜·책이 함께 놓인 톤
 *
 * ⚠️ 지켜야 할 선 (ai-influencer 와 같은 원칙):
 *   - **실제 표지·본문을 재현하지 않는다.** 표지 디자인과 본문 조판은 저작물이고,
 *     모델이 흉내 내면 어설픈 위조가 된다. 표지는 글감 책 카드(공식 썸네일)가
 *     합법으로 보여 준다 — 생성컷은 분위기만 만든다.
 *   - **글자를 그리게 하지 않는다.** 이미지 모델의 한글은 반드시 깨진다.
 *     포스터의 문구는 우리 카드 렌더러(images.js)가 얹는다.
 *   - 생성 이미지는 실물을 증명하지 않는다. manifest 에 생성물임을 남긴다.
 *
 *   node scripts/book-shots.mjs --title "투명한 나선" --mood "일본 미스터리, 밤, 실험실"
 *   node scripts/book-shots.mjs --title "…" --only 2
 *
 * 결과: out/photos/book/<제목>/ai-0N-*.png  → 아티클의 photoDir 로 지정해 쓴다.
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
const mood = opt('mood') || 'quiet evening, warm lamp light';
const model = opt('model') || 'gpt-image-2';
const only = Number(opt('only') || 0);

if (!title) {
  console.error('사용: node scripts/book-shots.mjs --title "책 제목" [--mood "분위기"] [--only N]');
  process.exit(1);
}
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error('OPENAI_API_KEY 가 없습니다. .env 또는 환경변수로 넣어 주세요.');
  process.exit(1);
}

const outDir = path.join(DIRS.photos, 'book', safeSlug(title));
fs.mkdirSync(outDir, { recursive: true });

/* 공통 지시 — "무엇을 하지 말지" 가 효과가 크다 (ai-influencer 실측). */
const COMMON = `
Photorealistic photo taken on a smartphone, natural imperfect framing, realistic
mixed lighting, soft natural shadows, real paper texture, no HDR glow, no watermark.
ABSOLUTELY NO readable text, letters or typography anywhere in the image — any book
cover or page must be turned away, out of focus, or blurred so no characters are legible.
Mood: ${mood}.
`.trim();

const SHOTS = [
  {
    n: 1,
    label: 'desk',
    prompt: `${COMMON}

A single hardcover novel lying closed on a wooden desk at dusk, slightly angled away
from the camera so the cover catches lamp light but shows no legible design.
A cup of tea beside it, steam barely visible. Shallow depth of field, cozy and quiet.`,
  },
  {
    n: 2,
    label: 'pages',
    prompt: `${COMMON}

Extreme close-up of an open book held in two hands, pages gently curved.
The lines of print are soft and out of focus — the texture of a paragraph is visible
but no character is readable. Warm evening window light from the left, film-like grain.`,
  },
  {
    n: 3,
    label: 'poster',
    prompt: `${COMMON}

A cinematic still-life poster composition: a closed book standing upright on a dark
surface, dramatic single light source from the side, deep shadows, a hint of
the story's atmosphere in the background (kept abstract and out of focus).
Large clean negative space at the center-left for a headline to be added later.`,
  },
  {
    n: 4,
    label: 'journal',
    prompt: `${COMMON}

Top-down flat-lay of a reading journal spread: an open blank notebook with a pen
resting on it, a closed book at the edge of the frame, reading glasses, a small coffee.
Soft morning light, calm and organized, muted warm tones. The notebook pages are
blank or show only faint illegible pencil marks.`,
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

async function generate(prompt, size) {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('quality', 'high');
  const j = await api('/images/generations', form);
  return Buffer.from(j.data[0].b64_json, 'base64');
}

const manifestPath = path.join(outDir, 'manifest.json');
const prev = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { items: [] };
const items = prev.items || [];

for (const s of SHOTS) {
  if (only && s.n !== only) continue;
  const file = path.join(outDir, `ai-${String(s.n).padStart(2, '0')}-${s.label}.png`);
  process.stdout.write(`${s.n}/${SHOTS.length} ${s.label} 생성 중...\n`);
  try {
    // 포스터(3)는 대표 이미지 후보라 가로가 낫고, 나머지는 모바일 본문용 세로
    const buf = await generate(s.prompt, s.n === 3 ? '1536x1024' : '1024x1536');
    fs.writeFileSync(file, buf);
    items.push({ file: path.basename(file), label: s.label, generated: true, model, title, at: new Date().toISOString() });
    console.log(`  → ${file}`);
  } catch (err) {
    console.error(`  ✗ ${s.label}: ${err.message}`);
  }
}
fs.writeFileSync(manifestPath, JSON.stringify({ items }, null, 2));
console.log(`완료 — ${outDir}`);
console.log('아티클에 쓰려면: article.photoDir 를 이 폴더로, imageBriefs[].photo 에 파일명을 지정');
