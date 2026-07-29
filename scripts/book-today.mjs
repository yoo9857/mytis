/**
 * '오늘 뭐 읽지?' 소재 수집 — 알라딘 **월간 베스트(문학 분야)** 에서 오늘의 책을 고른다.
 *
 * 문학만 보는 이유: 이 시리즈는 블로그의 서재/문학책 카테고리로 나간다.
 * 월간을 보는 이유: 주간은 이벤트(리커버·굿즈)로 출렁여서 소재가 겹치고,
 * 한 달 단위가 "요즘 다들 읽는 책" 이라는 시리즈 취지에 맞는다.
 *
 * 왜 알라딘인가: 베스트 페이지가 서버 렌더링이라 그대로 읽히고,
 * 교재·수험서가 예스24 상위권보다 적다 (2026-07-29 실측 — 예스24 상위 5권에
 * 수험서 2권, 알라딘은 0권).
 *
 * 한 번 쓴 책은 books.done.txt 에 기록해 다시 뽑지 않는다 (topics.done.txt 방식).
 *
 *   node scripts/book-today.mjs            후보 목록 보기
 *   node scripts/book-today.mjs --pick     오늘의 책 하나를 골라 주제 문자열 출력
 *   node scripts/book-today.mjs --pick --save   고른 책을 books.done.txt 에 기록
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const DONE_FILE = 'books.done.txt';
/* **월간** 베스트 · **문학 분야만** (시리즈 정체성: 서재/문학책 카테고리).
 * CID 1 = 소설/시/희곡 · 55889 = 에세이. 실측 2026-07-29:
 * BestType=MonthlyBest 가 월간이고, Year/Month 를 비우면 이번 달이 나온다. */
const now = new Date();
const LIST_URLS = [1, 55889].map(
  (cid) =>
    `https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=MonthlyBest&BranchType=1&CID=${cid}&Year=${now.getFullYear()}&Month=${now.getMonth() + 1}`
);

/** 이미 쓴 책 제목 목록 */
function doneTitles() {
  if (!fs.existsSync(DONE_FILE)) return [];
  return fs
    .readFileSync(DONE_FILE, 'utf8')
    .split('\n')
    .map((l) => l.replace(/^\[[^\]]*\]\s*/, '').trim())
    .filter(Boolean);
}

/** 만화·잡지·수험서는 시리즈 소개가 어려워 거른다 — 제목과 출판사 둘 다 본다 */
const SKIP = /만화|코믹|잡지|매거진|Vol\.|문제집|기출|수험|단기|자격증|토익|토플|모의고사/i;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const books = [];
  const seen = new Set();
  for (const url of LIST_URLS) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(1500);
    const got = await page.evaluate(() => {
      // 알라딘 베스트 목록: .ss_book_box 하나가 책 하나
      return [...document.querySelectorAll('.ss_book_box')].slice(0, 20).map((box, i) => {
        const title = box.querySelector('a.bo3')?.textContent?.trim() || '';
        // 저자·출판사 줄: "지은이 | 출판사 | 날짜" 순의 li
        const lines = [...box.querySelectorAll('li')].map((li) => li.textContent.trim());
        const metaLine = lines.find((l) => l.includes('|')) || '';
        const parts = metaLine.split('|').map((s) => s.trim());
        return {
          rank: i + 1,
          title,
          author: (parts[0] || '').replace(/\(지은이\)|지음|저자?:?\s*/g, '').trim(),
          publisher: parts[1] || '',
          published: parts[2] || '',
        };
      });
    });
    // 분야 두 개를 순위 순서로 섞는다. 같은 책이 두 분야에 있으면 처음 것만.
    for (const b of got) {
      const key = b.title.replace(/\s+/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      books.push(b);
    }
  }
  books.sort((a, b) => a.rank - b.rank);

  const done = doneTitles();
  const fresh = books.filter(
    (b) =>
      b.title &&
      !SKIP.test(b.title) &&
      !SKIP.test(b.publisher) &&
      !done.some((d) => b.title.includes(d) || d.includes(b.title))
  );

  if (!fresh.length) {
    console.error('후보가 없습니다 (전부 썼거나 목록을 못 읽었습니다).');
    process.exit(1);
  }

  if (process.argv.includes('--pick')) {
    const pick = fresh[0];
    const topic = `책: ${pick.title} — ${pick.author} (${pick.publisher})`;
    if (process.argv.includes('--save')) {
      fs.appendFileSync(DONE_FILE, `[${new Date().toISOString().slice(0, 10)}] ${pick.title}\n`);
    }
    console.log(topic);
  } else {
    for (const b of fresh) {
      console.log(`${String(b.rank).padStart(2)}위  ${b.title} — ${b.author} (${b.publisher}) ${b.published}`);
    }
  }
} finally {
  await browser.close();
}
