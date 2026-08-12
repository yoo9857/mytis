/**
 * 색인 확인 — 글 **제목 전체**로 검색해 내 글이 나오는지 본다.
 * 제목 완전일치는 사실상 "이 문서가 색인에 있냐"는 질문이라 순위 문제와 구분된다.
 * 제목은 RSS 에서 읽는다(발행된 실제 제목).
 */
import { chromium } from 'playwright';
import { log } from '../src/log.js';

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
/* 최신순으로 판정을 모아 둔다 — 재개 기준(최근 3건)을 아래에서 본다 */
const verdicts = [];

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
  verdicts.push(verdict);
  console.log(`${verdict.padEnd(6)} | ${p.date.padEnd(16)} | ${p.title.slice(0, 44)}`);
}

console.log('-'.repeat(88));
console.log(`노출 ${shown}건 · 누락 ${missing}건`);

/* ## 발행을 언제 다시 시작하나 — 기준을 코드에 둔다
 *
 * "괜찮아 보인다" 로 재개하면 같은 판단을 매번 새로 한다. 그래서 선을 적어 둔다.
 *
 * > 2026-08-03 상황: 07-30 이후 발행분 10건이 **연속으로** 누락됐다. 그 전 글들
 * > (07-21 ETF · 06-22 맛집 · 03-06 카페)은 정상 노출이었으므로 블로그가 통째로
 * > 죽은 것은 아니고, 특정 시점부터의 글이 색인에 안 들어갔다.
 *
 * 재개 기준: **최근 3건이 연속으로 노출**되면 하루 1건으로 재개한다.
 * 그전까지는 네이버 발행을 멈춘다(티스토리는 별개다).
 */
const RECENT = 3;
const recent = verdicts.slice(0, RECENT);
const recentOk = recent.length === RECENT && recent.every((v) => v === '노출됨');

console.log('');
if (recentOk) {
  log.ok(
    `최근 ${RECENT}건이 연속으로 노출됩니다 — 재개 기준을 만족합니다. ` +
      '하루 1건으로 천천히 시작하세요.'
  );
} else {
  const n = recent.filter((v) => v === '노출됨').length;
  log.warn(
    `최근 ${RECENT}건 중 ${n}건만 노출됩니다 — **네이버 발행을 멈춘 상태로 두세요.** ` +
      '지금 더 쌓으면 신호만 굳어집니다. (티스토리는 별개입니다)'
  );
  console.log('  · 서치어드바이저(searchadvisor.naver.com)에서 수집/색인 상태를 함께 보세요.');
}

await browser.close();
