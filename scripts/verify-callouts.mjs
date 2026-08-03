/**
 * 책·기사 글의 **큰따옴표 인용이 출처에 실제로 있는지** 대조한다.
 *
 * ## 왜 필요한가
 *
 * `verifyQuotes` 는 영상 모드에만 걸려 있었다(기준 텍스트가 자막이므로).
 * 그래서 책 글의 callout 은 아무도 대조하지 않았고, **지어낸 인용이 두 번
 * 연속으로 발행 직전까지 갔다.**
 *
 * > 2026-08-03 실측
 * >   『독서의 기술』 callout — "책은 마법의 양탄자다. 내가 결코 생각하지 못했던
 * >     곳으로 나를 데려다준다." → 이 책의 공개 발췌 어디에도 없다
 * >   『세네카』 callout — "누구에게나 시간을 내주면서 자기 자신에게는 시간을
 * >     내주지 않는다." → 예스24 '책 속에서' 일곱 문장 중 어느 것과도 다르다
 * > 둘 다 사람이 눈으로 읽어서 잡았다. 사람이 두 번 잡았으면 기계가 할 일이다.
 *
 * ## 기준 텍스트를 어디서 얻나
 *
 * 아티클의 `sources` 를 실제로 열어 본문을 긁는다. 책 글의 sources 에는 서점
 * 상품 페이지(출판사 소개·책 속에서·목차)와 서평 기사가 들어 있으므로,
 * **공개된 발췌라면 여기 있어야 한다.** 없으면 지어낸 것이거나, 적어도
 * "공개된 문장" 이 아니므로 어느 쪽이든 발행 전에 봐야 한다.
 *
 * 판정은 `verifyQuotes` 를 그대로 쓴다 — 같은 문제에 두 개의 판정기를 두지 않는다.
 *
 * 사용:
 *   node scripts/verify-callouts.mjs "out/<글>.json"
 */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { verifyQuotes, quoteReport, extractQuotes } from '../src/verifyQuotes.js';
import { log } from '../src/log.js';

const file = process.argv[2];
if (!file) {
  console.error('사용: node scripts/verify-callouts.mjs "out/<글>.json"');
  process.exit(1);
}

const article = JSON.parse(fs.readFileSync(file, 'utf8'));

/* ⚠️ **callout 은 따옴표가 없어도 인용이다.**
 *
 * `extractQuotes` 는 큰따옴표만 찾는다. 그런데 발행 레이아웃(naverDoc)은 callout 을
 * **인용구 컴포넌트**로 세우므로, 따옴표를 안 써도 독자에게는 책에서 옮긴 문장으로
 * 보인다. 책 모드 지시문도 "callout 에 공개된 책 속 문장을 한 줄씩" 이라고 시킨다.
 *
 * > 2026-08-03: 세네카 글의 callout 세 개가 전부 따옴표 없이 들어가 있어
 * > 이 검사가 "인용 없음" 으로 통과시켰다. 정작 대조가 필요한 문장들이었다.
 *
 * 그래서 따옴표 없는 callout 을 따옴표로 감싸 같은 검사에 태운다. */
if (article.mode === 'book') {
  for (const s of article.sections || []) {
    const c = String(s.callout || '').trim();
    if (c && !/[“"]/.test(c)) s.callout = `"${c}"`;
  }
}

const quotes = extractQuotes(article);
if (!quotes.length) {
  log.ok('큰따옴표 인용이 없습니다 — 대조할 것이 없습니다.');
  process.exit(0);
}

const urls = [...new Set((article.sources || []).map((s) => s.url).filter(Boolean))];
if (!urls.length) {
  log.warn('sources 가 비어 있어 대조할 기준이 없습니다.');
  process.exit(1);
}

log.step(`인용 ${quotes.length}건 · 출처 ${urls.length}곳 대조`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
});

/* 출처를 **한 덩어리로 합치지 않는다.** 어디서 찾았는지가 판정의 절반이다 —
 * 서점·언론에서 찾은 인용과 개인 블로그에서만 찾은 인용은 무게가 다르다.
 * 블로거는 책 문장을 자기 말로 줄여 적는다. 그것과 일치했다고 '공개된 발췌'는
 * 아니다 (2026-08-03: 세네카 callout 이 개인 블로그에서만 일치했다). */
const PRIMARY = /yes24|aladin|kyobobook|ridibooks|millie|교보|알라딘|예스24|interpark|publisher/i;
const PRESS =
  /\b(news|press|daum|naver|hankyung|chosun|joongang|donga|yna|newsis|sportsworldi|starnews|mk|hani|khan|etnews|joynews)\b/i;
const kind = (u) => (PRIMARY.test(u) ? '서점' : PRESS.test(u) ? '언론' : '개인');

const perSource = [];
for (const url of urls) {
  let text = '';
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40_000 });
    await page.waitForTimeout(1200);
    /* 프레임까지 훑는다 — 예스24·알라딘은 '책 속에서' 를 iframe 에 넣기도 한다 */
    for (const f of page.frames()) {
      try {
        text += '\n' + (await f.evaluate(() => document.body?.innerText || ''));
      } catch {}
    }
  } catch (e) {
    log.warn(`못 읽음 (${e.message.split('\n')[0]}): ${url.slice(0, 70)}`);
  }
  perSource.push({ url, kind: kind(url), text });
}
await browser.close();

const corpus = perSource.map((s) => s.text).join('\n');
if (corpus.replace(/\s+/g, '').length < 500) {
  log.warn('출처에서 읽어 온 글이 너무 적습니다 — 대조 결과를 믿지 마세요.');
}

/** 이 인용이 어느 출처에서 나왔나 (판정은 verifyQuotes 가 한다) */
function whereFound(quote) {
  const hits = [];
  for (const s of perSource) {
    const one = verifyQuotes({ sections: [], directAnswer: `"${quote}"` }, s.text)[0];
    if (one && one.verdict !== 'missing') hits.push(s);
  }
  return hits;
}

const results = verifyQuotes(article, corpus);
const { total, missing, rebuilt } = quoteReport(results);

const weak = [];
for (const r of results) {
  const hits = r.verdict === 'missing' ? [] : whereFound(r.quote);
  const kinds = [...new Set(hits.map((h) => h.kind))];
  const onlyBlog = kinds.length > 0 && kinds.every((k) => k === '개인');
  if (onlyBlog) weak.push(r);

  const mark = r.verdict === 'missing' ? '없음' : r.verdict === 'rebuilt' ? '재구성' : '일치';
  const src = hits.length ? `(${kinds.join('·')})` : '';
  console.log(`${mark.padEnd(4)} ${src.padEnd(8)} | ${r.where.padEnd(16)} | ${r.quote.slice(0, 54)}`);
}

console.log('');
if (missing.length) {
  /* ⚠️ '없음' 을 곧바로 '지어냈다' 로 읽지 않는다.
   *
   * 이 검사는 출처 페이지의 **글자**만 본다. 그런데 우리가 쓰는 가장 좋은 발췌는
   * 서점 미리보기의 **뒤표지·제사 페이지 이미지**에서 눈으로 읽은 문장이다.
   * 그건 여기에 안 잡힌다.
   * > 2026-08-03: 세네카의 "곳간의 곡식이 줄어들면 바로 알아차린다…" 는 알라딘
   * > 뒤표지 이미지에서 읽은 실제 인쇄 문장인데 '없음' 으로 나왔다. 예스24 의
   * > 텍스트판은 "줄면 우리는 즉시…" 로 표현이 조금 달랐다.
   *
   * 그러므로 '없음' 은 **사람이 봐야 한다는 뜻**이지 유죄 판정이 아니다. */
  log.warn(
    `인용 ${total}건 중 ${missing.length}건이 출처 **본문 텍스트**에 없습니다. 둘 중 하나입니다:\n` +
      '  ① 뒤표지·미리보기 **이미지**에서 읽은 문장 — 사람이 확인했다면 정상입니다\n' +
      '  ② 지어낸 문장 — 빼거나 검증된 발췌로 바꾸세요\n' +
      '  어느 쪽인지 기억나지 않으면 ②로 취급하세요.'
  );
}
if (weak.length) {
  log.warn(
    `${weak.length}건은 **개인 블로그에서만** 확인됩니다 — 블로거가 줄여 적은 문장일 수 있습니다. ` +
      '서점 페이지의 책 속에서 · 출판사 소개에서 확인되는 문장으로 바꾸는 편이 안전합니다.'
  );
}
if (rebuilt.length) {
  log.warn(`${rebuilt.length}건은 어절 재구성입니다 — 원문과 대조하세요.`);
}
if (!missing.length && !weak.length && !rebuilt.length) {
  log.ok(`인용 ${total}건 전부 서점·언론 출처에서 확인됐습니다.`);
}
process.exit(missing.length ? 1 : 0);
