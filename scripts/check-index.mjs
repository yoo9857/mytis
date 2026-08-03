/**
 * 색인 확인 — 글 **제목 전체**로 검색해 내 글이 나오는지 본다.
 * 제목 완전일치는 사실상 "이 문서가 색인에 있냐"는 질문이라 순위 문제와 구분된다.
 * 제목은 RSS 에서 읽는다(발행된 실제 제목).
 */
import { chromium } from 'playwright';

const BLOG = 'web_dev5';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
});

const res = await page.context().request.get(`https://rss.blog.naver.com/${BLOG}.xml`, {
  timeout: 30_000,
});
const xml = await res.text();
const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
const posts = items
  .map((it) => {
    const t = it.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1];
    const l = it.match(/<link>([\s\S]*?)<\/link>/)?.[1];
    const d = it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    return t && l ? { title: t.trim(), link: l.trim(), date: (d || '').slice(0, 16) } : null;
  })
  .filter(Boolean);

console.log(`RSS 글 ${posts.length}건 · 블로그 ${BLOG}\n`);
console.log('판정   | 발행일           | 제목');
console.log('-'.repeat(88));

let shown = 0;
let missing = 0;

for (const p of posts.slice(0, 20)) {
  const q = encodeURIComponent(`"${p.title}"`);
  const url = `https://search.naver.com/search.naver?query=${q}`;
  let verdict = '?';
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40_000 });
    await page.waitForTimeout(1600);
    const html = await page.content();
    const hit = html.includes(BLOG);
    verdict = hit ? '노출됨' : '누락';
    if (hit) shown++;
    else missing++;
  } catch (e) {
    verdict = '실패';
  }
  console.log(`${verdict.padEnd(6)} | ${p.date.padEnd(16)} | ${p.title.slice(0, 44)}`);
}

console.log('-'.repeat(88));
console.log(`노출 ${shown}건 · 누락 ${missing}건`);

await browser.close();
