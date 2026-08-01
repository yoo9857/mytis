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
import { todayStr } from '../src/paths.js';
import { loadEnvFile } from '../src/config.js';

/* 이 스크립트는 단독 실행되므로 .env 를 직접 읽는다 (블로그 대조에 NAVER_BLOG 가 필요) */
const ENV = { ...loadEnvFile(), ...process.env };

const DONE_FILE = 'books.done.txt';
/* **월간** 베스트 · **문학 분야만** (시리즈 정체성: 서재/문학책 카테고리).
 * CID 1 = 소설/시/희곡 · 55889 = 에세이. 실측 2026-07-29:
 * BestType=MonthlyBest 가 월간이고, Year/Month 를 비우면 이번 달이 나온다. */
const now = new Date();
const LIST_URLS = [1, 55889].map(
  (cid) =>
    `https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=MonthlyBest&BranchType=1&CID=${cid}&Year=${now.getFullYear()}&Month=${now.getMonth() + 1}`
);

/** 괄호(판본·시리즈 표기)를 떼고 비교한다 — 목록의 "불안의 책 (먼슬리 클래식)" 과
 *  발행글 제목의 "불안의 책" 이 같은 책이다. */
function baseTitle(t) {
  return String(t || '')
    .replace(/\s*[(（][^)）]*[)）]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 이미 쓴 책 제목 목록 (기록 파일) */
function doneTitles() {
  if (!fs.existsSync(DONE_FILE)) return [];
  return fs
    .readFileSync(DONE_FILE, 'utf8')
    .split('\n')
    /* `[날짜] 제목 -> URL` — 날짜와 **주소를 모두** 떼야 제목만 남는다.
     * 주소를 안 떼면 `b.title.includes(d)` 가 영영 거짓이 되어 한 방향으로만
     * 비교된다 (2026-08-01 발견). */
    .map((l) => l.replace(/^\[[^\]]*\]\s*/, '').replace(/\s*->\s*\S+\s*$/, '').trim())
    .filter(Boolean)
    .map(baseTitle);
}

/** 블로그에 **실제로 발행된** 글 제목 (RSS).
 *
 * 왜 필요한가: books.done.txt 는 발행 성공 시에만 주소가 붙고, 다른 컴퓨터에서
 * 작업하면 파일이 커밋되지 않아 기록이 사라진다.
 *
 * > 2026-08-01 실측: 다른 기기에서 발행한 『불안의 책』·『사춘기 엄마의 오장육부』가
 * > 기록에 없어 『불안의 책』을 **두 번째로 뽑았다.** 파일만 믿으면 중복 발행된다.
 *
 * 기록 파일이 아니라 **블로그가 사실의 출처**다.
 */
async function publishedTitles(page) {
  const blogId = ENV.NAVER_BLOG || '';
  if (!blogId) {
    console.error('⚠ NAVER_BLOG 이 없어 블로그 대조를 건너뜁니다 (기록 파일만 봅니다).');
    return null;
  }
  try {
    /* page.evaluate 안의 fetch 는 안 된다 — 그때 페이지는 알라딘이고
     * rss.blog.naver.com 은 크로스오리진이라 CORS 로 막힌다.
     * request 컨텍스트는 브라우저 밖이라 CORS 를 타지 않는다. */
    const res = await page.context().request.get(`https://rss.blog.naver.com/${blogId}.xml`, {
      timeout: 20_000,
    });
    if (!res.ok()) throw new Error(`RSS ${res.status()}`);
    const xml = await res.text();
    const titles = [...xml.matchAll(/<title><!\[CDATA\[([^\]]*)\]\]><\/title>/g)].map((m) => m[1]);
    /* 첫 두 개는 채널 제목(피드·이미지)이라 글 제목이 아니다 */
    const posts = titles.slice(2);
    if (!posts.length) throw new Error('RSS 에서 글 제목을 못 읽었습니다');
    return posts;
  } catch (e) {
    console.error(`⚠ 블로그 대조 실패 (${e.message}) — 기록 파일만 봅니다.`);
    return null;
  }
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
  const posted = await publishedTitles(page);

  /** 이 책을 이미 썼는가 — 기록 파일과 블로그 발행글 **양쪽**을 본다 */
  function isDone(b) {
    const base = baseTitle(b.title);
    if (!base) return false;
    if (done.some((d) => base.includes(d) || d.includes(base))) return true;
    /* 발행글 제목은 "수족관, 2년 반 만의 역주행" 처럼 책 제목 + 각도다 */
    return !!posted?.some((t) => t.includes(base));
  }

  const fresh = books.filter(
    (b) => b.title && !SKIP.test(b.title) && !SKIP.test(b.publisher) && !isDone(b)
  );

  /* 블로그에는 있는데 기록에 없는 책을 알려 준다 — 기록이 어긋난 것을 조용히 넘기면
   * 다음 실행에서 또 중복을 뽑는다 */
  if (posted) {
    const drift = books.filter((b) => {
      const base = baseTitle(b.title);
      return base && posted.some((t) => t.includes(base)) && !done.some((d) => base.includes(d) || d.includes(base));
    });
    for (const b of drift) {
      console.error(`⚠ 기록 누락: '${b.title}' 은 블로그에 발행돼 있으나 ${DONE_FILE} 에 없습니다.`);
    }
  }

  if (!fresh.length) {
    console.error('후보가 없습니다 (전부 썼거나 목록을 못 읽었습니다).');
    process.exit(1);
  }

  if (process.argv.includes('--pick')) {
    const pick = fresh[0];
    const topic = `책: ${pick.title} — ${pick.author} (${pick.publisher})`;
    if (process.argv.includes('--save')) {
      fs.appendFileSync(DONE_FILE, `[${todayStr()}] ${pick.title}\n`);
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
