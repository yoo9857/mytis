/**
 * 작가 카드 + 글귀 카드 한 쌍을 디자인해 렌더한다 (책 글의 콜라주용).
 *
 * 왜 생성 모델이 아니라 HTML 인가: 이미지 모델은 한글을 반드시 깨뜨린다.
 * 글귀 카드의 주인공은 글자이므로, 디자인은 우리가 하고 렌더만 브라우저가 한다
 * (카드 렌더러 images.js 와 같은 방법).
 *
 * 디자인 방향 (2026-07-29 독자 요구): 따뜻한 배경 · 인스타 감성 · 책과 연관.
 * 두 장은 한 쌍이다 — 같은 팔레트(크림·피치), 같은 타이포(명조), 4:5.
 *
 *   node scripts/quote-cards.mjs --dir "out/photos/book/투명한-나선" \
 *     --author-img author-src.jpg --author "히가시노 게이고" --life "1958 – 2026" \
 *     --role "소설가 · 갈릴레오 시리즈" \
 *     --quote "우리가 그동안 보아 왔던 것은 어쩌면 천재 물리학자의 기나긴 사춘기 시절이었을지도 모른다" \
 *     --from "『투명한 나선』 역자의 말에서"
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const opt = (n, d = '') => {
  const at = argv.indexOf(`--${n}`);
  return at >= 0 ? argv[at + 1] || d : d;
};
const dir = opt('dir');
const authorImg = opt('author-img');
const author = opt('author');
const life = opt('life');
const role = opt('role');
const quote = opt('quote');
const from = opt('from');
if (!dir || !author || !quote) {
  console.error('사용: node scripts/quote-cards.mjs --dir 폴더 --author-img 파일 --author 이름 --life 연도 --role 소개 --quote 글귀 --from 출처');
  process.exit(1);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const imgData = authorImg
  ? `data:image/jpeg;base64,${fs.readFileSync(path.join(dir, authorImg)).toString('base64')}`
  : '';

/* 팔레트 — 기본은 따뜻한 크림·피치.
 *
 * `--palette "#바탕1,#바탕2,#글자,#보조,#포인트"` 로 바꿀 수 있다.
 * 글귀 카드는 **책 표지 색을 따라가는 것**이 낫다는 독자 피드백(2026-07-30) —
 * 표지가 딥블루인 책에 크림색 카드는 남의 옷이다. 표지 지배색은
 * `cv2.kmeans` 로 뽑아 넘긴다 (안녕, 피터팬 = #065bab 96%).
 */
const PAL = (() => {
  const raw = opt('palette');
  const [bg1, bg2, ink, sub, accent] = raw ? raw.split(',').map((s) => s.trim()) : [];
  return {
    bg1: bg1 || '#fdf6ec',
    bg2: bg2 || '#f2ddc4',
    ink: ink || '#4a3f33',
    sub: sub || '#a58a66',
    accent: accent || '#c47f4a',
  };
})();

const BASE = `
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    .card {
      width:1080px; height:1350px; position:relative; overflow:hidden;
      background:
        radial-gradient(120% 90% at 20% 0%, ${PAL.bg1} 0%, ${PAL.bg2} 100%);
      font-family:'Malgun Gothic', sans-serif; color:${PAL.ink};
    }
    .serif { font-family:Batang, 'Nanum Myeongjo', serif; }
    .grain { position:absolute; inset:0; opacity:.5;
      background-image:radial-gradient(#00000008 1px, transparent 1px); background-size:5px 5px; }
    .edge { position:absolute; inset:36px; border:1px solid ${PAL.sub}55; border-radius:6px; }
    .bottom { position:absolute; left:0; right:0; bottom:64px; text-align:center; }
    .bookline { width:56px; height:3px; background:${PAL.accent}; margin:0 auto 18px; border-radius:2px; }
    .small { font-size:24px; letter-spacing:.35em; color:${PAL.sub}; }
  </style>`;

const authorCard = `${BASE}
  <div class="card">
    <div class="grain"></div><div class="edge"></div>
    <div style="position:absolute; top:120px; left:50%; transform:translateX(-50%);
                width:640px; height:790px; background:#fff; padding:22px 22px 110px;
                box-shadow:0 24px 60px #7a5c3a33; border-radius:4px;">
      <div style="width:100%; height:100%; background:url('${imgData}') center 20%/cover no-repeat;
                  filter:sepia(.12) saturate(.92) contrast(.98);"></div>
      <div class="serif" style="position:absolute; left:0; right:0; bottom:34px; text-align:center;
                  font-size:34px; color:#4a4a4a; letter-spacing:.08em;">${esc(author)}</div>
      <!-- 폴라로이드 안 이름은 흰 종이 위 — 팔레트 잉크(밝은 색일 수 있음)를 쓰면 안 보인다 -->
    </div>
    <div class="bottom">
      <div class="bookline"></div>
      <div class="serif" style="font-size:40px; margin-bottom:14px; color:${PAL.ink};">${esc(life)}</div>
      <div class="small">${esc(role)}</div>
    </div>
  </div>`;

const quoteCard = `${BASE}
  <div class="card">
    <div class="grain"></div><div class="edge"></div>
    <div style="position:absolute; inset:120px 110px 190px; display:flex; flex-direction:column;
                justify-content:center; align-items:center;">
      <div class="serif" style="font-size:190px; color:${PAL.accent}66; line-height:.6; margin-bottom:48px;">&ldquo;</div>
      <div class="serif" style="font-size:54px; line-height:2.0; color:${PAL.ink}; word-break:keep-all; text-align:center;">
        ${esc(quote)}
      </div>
    </div>
    <div class="bottom">
      <div class="bookline"></div>
      <div class="small" style="letter-spacing:.12em;">${esc(from)}</div>
    </div>
  </div>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
for (const [name, html] of [['card-author.png', authorCard], ['card-quote.png', quoteCard]]) {
  await page.setContent(`<!doctype html><html><body style="margin:0">${html}</body></html>`);
  await page.waitForTimeout(400);
  const file = path.join(dir, name);
  await page.locator('.card').screenshot({ path: file });
  console.log(`→ ${file}`);
}
await browser.close();
