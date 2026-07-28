import { chromium } from 'playwright';
import { log } from './log.js';

/**
 * 방송 **밖**의 반응을 모은다 — 커뮤니티 글·목격담·해명글.
 *
 * 왜 필요한가:
 *   방송 요약글은 이미 널려 있다. 잘 되는 리뷰 블로그 7편을 재 보니 차별점은
 *   문체가 아니라 **원소재 밖 정보**였다. 체육관 공지, 맘카페 목격담,
 *   커뮤니티 여론, 지인 해명글. 독자가 검색해서 들어오는 이유가 거기 있다.
 *
 * 우리 방식이 그들과 다른 점:
 *   블로거는 커뮤니티를 눈으로 읽고 옮겨 적는다. 우리는 **기계로 모으고
 *   기계로 거른다.** 특히 아래 함정은 사람 눈보다 코드가 잘 잡는다.
 *
 * ## ⚠️ 가장 위험한 함정 — 같은 이름, 다른 사람
 *
 * 나는솔로는 **매 기수 같은 가명**(영숙·광수·옥순·영철)을 재사용한다.
 * 그래서 이름만으로 검색하면 전혀 다른 사람의 이야기가 섞인다.
 *
 * > 2026-07-28 실측 — 네이트판에서 "나는솔로 광수" 검색:
 * >   · 16기 광수랑 22기 현숙 열애 인정
 * >   · 26기 광수가 인스타 라이브로 제작진에 왕따당했다고 하소연
 * >   · 25기 광수, 연봉 5억 개업의
 * >   23기 광수 글은 한 건도 없었다. 그대로 인용했으면 **다른 사람 이야기**를
 * >   우리 글에 실을 뻔했다.
 *
 * → 그래서 **기수 표기가 본문에 있는 것만** 통과시킨다. 이름만 걸린 것은 버린다.
 *   이 필터를 절대 풀지 마세요. 실존 인물에 대한 허위사실이 됩니다.
 *
 * ## 접근 가능한 곳 (2026-07-28 실측)
 *
 * | 출처 | 결과 |
 * |---|---|
 * | 네이버 카페검색(`where=article`) | **가능** — 맘카페 목격담이 여기 있다 |
 * | 네이트판 | **가능** — 스니펫까지 잘 나온다 |
 * | 인스티즈 | **가능** |
 * | 더쿠 | 정적 요청은 24KB 껍데기만 온다 |
 * | 디시인사이드 | 118B — 막힘 |
 *
 * 셋 다 정적 fetch 로는 부족하고 Playwright 가 필요하다 (JS 렌더링).
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** 어디를 뒤질 것인가. 한 곳이 막혀도 나머지로 굴러가게 둔다. */
const SOURCES = [
  {
    name: '네이버카페',
    url: (q) => `https://search.naver.com/search.naver?where=article&query=${encodeURIComponent(q)}`,
    linkPattern: /cafe\.naver\.com/,
  },
  {
    name: '네이트판',
    url: (q) => `https://pann.nate.com/search/talk?searchType=A&q=${encodeURIComponent(q)}`,
    linkPattern: /pann\.nate\.com\/talk\/\d+/,
  },
  {
    name: '인스티즈',
    url: (q) => `https://www.instiz.net/name?category=1&k=${encodeURIComponent(q)}`,
    linkPattern: /instiz\.net\/(name|pt)\/\d+/,
  },
];

/** 조롱·비하가 담긴 글은 애초에 가져오지 않는다 (HANDOVER §6). */
const ABUSIVE =
  /(개(놈|년)|미친|병신|찐따|극혐|틀딱|한남|김치녀|얼굴\s*평가|성형|정신병|장애)/i;

/** 방송 회차를 가리키는 표기를 뽑는다: "23기" → ["23기"] */
function seasonTokens(season) {
  const n = String(season || '').match(/\d+/)?.[0];
  return n ? [`${n}기`, `${n} 기`] : [];
}

/**
 * 커뮤니티에서 이 회차·이 인물에 대한 반응을 모은다.
 *
 * @param {object} opts
 * @param {string} opts.program 프로그램명 (예: '나는솔로')
 * @param {string} opts.season  기수 (예: '23기' 또는 '23')
 * @param {string[]} opts.names 출연자 이름들
 * @returns {Promise<Array<{source,title,snippet,url}>>}
 */
export async function collectBuzz({ program, season, names = [], limit = 12, timeoutMs = 25_000 } = {}) {
  const tokens = seasonTokens(season);
  if (!program || !tokens.length) {
    log.debug('방송 밖 반응 수집: 프로그램명이나 기수를 몰라 건너뜁니다.');
    return [];
  }

  /* 기수를 검색어에 **반드시** 넣는다. 이름만으로 검색하면 다른 기수가 쏟아진다. */
  const queries = [
    `${program} ${tokens[0]}`,
    ...names.slice(0, 3).map((n) => `${program} ${tokens[0]} ${n}`),
  ];

  log.step(`방송 밖 반응 수집: ${queries[0]} 외 ${queries.length - 1}건`);

  let browser = null;
  const found = [];
  const seen = new Set();

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1000 },
      locale: 'ko-KR',
      userAgent: UA,
    });
    page.setDefaultTimeout(timeoutMs);

    for (const src of SOURCES) {
      for (const q of queries) {
        if (found.length >= limit) break;
        try {
          await page.goto(src.url(q), { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2000);
          const items = await page.evaluate(
            (patternSource) => {
              const re = new RegExp(patternSource);
              const out = [];
              document.querySelectorAll('a').forEach((a) => {
                const text = (a.innerText || '')
                  .trim()
                  .replace(/\s+/g, ' ')
                  .replace(/\s*새 창 열림\s*$/, ''); // 네이버 접근성 텍스트
                if (!a.href || !re.test(a.href)) return;
                if (text.length < 10 || text.length > 300) return;
                // 네이버 카페 링크에는 JWT 추적 쿼리가 길게 붙는다
                out.push({ title: text.slice(0, 200), url: a.href.split('?')[0] });
              });
              return out.slice(0, 40);
            },
            src.linkPattern.source
          );

          for (const it of items) {
            if (found.length >= limit) break;
            const key = it.url.split('?')[0];
            if (seen.has(key)) continue;

            /* ⚠️ 기수 필터 — 이 파일에서 가장 중요한 줄이다.
             * 이름만 걸린 결과는 **다른 기수의 다른 사람**이다. */
            if (!tokens.some((t) => it.title.includes(t))) continue;
            if (ABUSIVE.test(it.title)) {
              log.debug(`제외(비하 표현): ${it.title.slice(0, 40)}`);
              continue;
            }

            seen.add(key);
            found.push({ source: src.name, title: it.title, url: it.url });
          }
          log.debug(`${src.name} "${q}" → 누적 ${found.length}건`);
        } catch (err) {
          log.debug(`${src.name} 검색 실패 (${q}): ${err.message.split('\n')[0].slice(0, 60)}`);
        }
      }
    }
  } catch (err) {
    log.warn(`방송 밖 반응 수집을 열 수 없습니다: ${err.message.split('\n')[0]}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  if (!found.length) {
    log.info(`${program} ${tokens[0]} 관련 커뮤니티 글을 찾지 못했습니다.`);
  } else {
    log.ok(`방송 밖 반응 ${found.length}건 확보 (${[...new Set(found.map((f) => f.source))].join(', ')})`);
  }
  return found;
}

/** 프롬프트에 실을 수 있는 형태로 정리한다. 없으면 빈 문자열. */
export function buzzBlock(items) {
  if (!items?.length) return '';
  const lines = items
    .map((b, i) => `${i + 1}. [${b.source}] ${b.title}\n   ${b.url}`)
    .join('\n');
  return `\n# 방송 밖 반응 (커뮤니티에서 실제로 수집한 글 목록)\n\n${lines}\n`;
}
