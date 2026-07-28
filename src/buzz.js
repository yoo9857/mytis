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
    /* 언론 보도. 커뮤니티보다 인용하기 좋다 — 매체명과 날짜가 분명하다.
     * codex 재량에 맡기면 실행마다 결과가 갈렸다. 같은 소재로 돌렸는데
     * 한 번은 매일경제·OSEN 기사를 찾고 다음 번엔 하나도 못 찾았다.
     * 그래서 커뮤니티와 같은 방식으로 코드가 직접 모은다. */
    name: '뉴스',
    kind: 'news',
    url: (q) => `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(q)}`,
    /* 네이버 뉴스 검색에서 **제목 링크는 언론사 사이트로 직접** 간다
     * (예: tvreport.co.kr/broadcast/article/1063221). 네이버 도메인만 잡으면
     * 정작 기사를 놓친다. 그래서 외부 링크를 폭넓게 받고 NOT_ARTICLE 로 걸러낸다. */
    linkPattern: /^https?:\/\//,
  },
  {
    name: '네이버카페',
    kind: 'community',
    url: (q) => `https://search.naver.com/search.naver?where=article&query=${encodeURIComponent(q)}`,
    linkPattern: /cafe\.naver\.com/,
  },
  {
    name: '네이트판',
    kind: 'community',
    url: (q) => `https://pann.nate.com/search/talk?searchType=A&q=${encodeURIComponent(q)}`,
    linkPattern: /pann\.nate\.com\/talk\/\d+/,
  },
  {
    name: '인스티즈',
    kind: 'community',
    url: (q) => `https://www.instiz.net/name?category=1&k=${encodeURIComponent(q)}`,
    linkPattern: /instiz\.net\/(name|pt)\/\d+/,
  },
];

/** 검색 결과에 섞여 오는 네이버 자체 링크·언론사 홈은 기사가 아니다. */
const NOT_ARTICLE =
  /nid\.naver|keep\.naver|help\.naver|search\.naver|media\.naver\.com|blog\.naver|cafe\.naver|section\.naver|\/main\/|naver\.com\/?$/;

/** 링크 글자가 제목이 아닌 것들 (언론사명·UI 라벨) */
const NOT_TITLE =
  /^(네이버뉴스|새 창 열림|Keep에 바로가기|관련뉴스|더보기|언론사별|최신순|오래된순|관련도순)/;

/** 조롱·비하가 담긴 글은 애초에 가져오지 않는다 (HANDOVER §6). */
const ABUSIVE =
  /(개(놈|년)|미친|병신|찐따|극혐|틀딱|한남|김치녀|얼굴\s*평가|성형|정신병|장애)/i;

/** 방송 회차를 가리키는 표기를 뽑는다: "23기" → ["23기"] */
function seasonTokens(season) {
  const n = String(season || '').match(/\d+/)?.[0];
  return n ? [`${n}기`, `${n} 기`] : [];
}

/**
 * 이 결과가 **우리가 찾는 기수**의 것인가.
 *
 * 커뮤니티와 뉴스에 서로 다른 기준이 필요하다.
 *
 * - **커뮤니티**: 제목에 기수가 있어야 한다. 스니펫까지 허용하면 검색 결과에서
 *   글과 나란히 붙어 있는 **카페 이름 링크**가 같은 스니펫을 물고 통과해 같은
 *   글이 두 번 실린다. (실측: "인천맘 쏙", "야구 24시-(KIA…" 가 제목 자리에 들어왔다)
 *   카페 이름에는 기수가 없으므로 이 조건 하나로 중복도 함께 걸러진다.
 *
 * - **뉴스**: 제목이 기수를 생략하는 경우가 많다
 *   ("얽히고설켰다…대환장 러브라인으로 시청률 4.3% 돌파"). 제목에서 요구하면
 *   정작 관련 기사가 다 탈락한다. 그래서 **제목이 다른 기수를 가리키는 경우만
 *   거부**하고, 그 밖에는 스니펫에 기수가 있으면 받는다.
 *   > 실측: "'피부과 일반의' **27기** 광수, 오늘 결혼" 이 23기 검색에 올라왔다.
 *   > 제목에 27기가 박혀 있으니 이 규칙으로 정확히 걸러진다.
 */
function seasonOk(item, tokens, kind) {
  const marks = item.title.match(/\d+\s*기/g) || [];

  /* 제목에 기수가 여러 개 나오면 **맨 처음 것이 그 기사의 기수**다.
   *
   * 검색 결과의 링크 글자가 제목이 아니라 **본문 조각**인 경우가 있어서,
   * 우리 기수가 어딘가 섞여 있다는 이유로 통과시키면 엉뚱한 기사가 들어온다.
   *
   * > 실측 — 23기를 찾는데 통과해 버린 것들:
   * >   "24기 영식, **27기** 상철, 23기 영숙, 27기 영자…"  ← 27기 광수 결혼 기사
   * >   "**27기** 상철과 공개 열애 중인 23기 영숙도 축하합니다"  ← 같은 기사
   * > 둘 다 첫 기수가 우리 기수가 아니다. 이 규칙 하나로 정확히 걸러진다.
   */
  if (marks.length) return tokens.some((t) => marks[0].replace(/\s/g, '') === t.replace(/\s/g, ''));

  // 커뮤니티는 제목에 기수가 없으면 버린다 (중복 방지 — 위 함수 주석 참고)
  if (kind !== 'news') return false;

  // 뉴스 제목은 기수를 생략하는 경우가 많아 스니펫까지 본다
  return tokens.some((t) => item.snippet.includes(t));
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

    /* 종류별로 자리를 나눈다.
     * 뉴스가 먼저 돌기 때문에 한 통에 담으면 뉴스가 limit 을 다 써버리고
     * 커뮤니티가 0건이 된다 (실측). 뉴스는 인용하기 좋아 조금 더 준다. */
    const quota = { news: Math.ceil(limit * 0.6), community: Math.floor(limit * 0.4) };
    const taken = { news: 0, community: 0 };

    for (const src of SOURCES) {
      for (const q of queries) {
        if (taken[src.kind] >= quota[src.kind]) break;
        try {
          await page.goto(src.url(q), { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2000);
          const items = await page.evaluate(
            ({ patternSource, notArticleSource, notTitleSource }) => {
              const re = new RegExp(patternSource);
              const notArticle = new RegExp(notArticleSource);
              const notTitle = new RegExp(notTitleSource);
              const clean = (s) =>
                (s || '')
                  .trim()
                  .replace(/\s+/g, ' ')
                  .replace(/\s*새 창 열림\s*/g, ''); // 네이버 접근성 텍스트
              const out = [];

              document.querySelectorAll('a').forEach((a) => {
                if (!a.href || !re.test(a.href)) return;
                if (notArticle.test(a.href)) return;
                const title = clean(a.innerText);
                if (title.length < 10 || title.length > 300) return;
                if (notTitle.test(title)) return;

                /* 스니펫(본문 미리보기)을 함께 가져온다.
                 *
                 * **제목만으로는 글을 쓸 수 없다.** 실제로 제목만 넘겼더니
                 * codex 가 "이런 제목의 글이 있습니다" 라고만 쓰고 끝냈다.
                 * 독자에게 아무 정보도 주지 못하는 문단이 됐다.
                 *
                 * 사이트마다 결과 컨테이너 클래스가 달라 셀렉터를 박으면 잘 깨진다.
                 * 그래서 링크에서 **위로 올라가며** 제목보다 충분히 긴 텍스트
                 * 블록을 찾는다. 네이트판·네이버 카페 모두 이 방식으로 잡힌다. */
                let el = a;
                let snippet = '';
                for (let i = 0; i < 5 && el?.parentElement; i++) {
                  el = el.parentElement;
                  const t = clean(el.innerText);
                  if (t.length > title.length + 40 && t.length < 700) {
                    snippet = t;
                    break;
                  }
                }
                /* 작성일을 뽑는다. **글의 시점을 모르면 쓸 수 없다.**
                 * 오래된 기수의 커뮤니티 글은 1~2년 전 것인데, 그걸 지금 반응처럼
                 * 쓰면 독자를 속이게 된다. 형태가 사이트마다 다르다:
                 *   네이트판  "24.11.06 20:05"
                 *   네이버카페 "25.05.13."
                 * 날짜가 스니펫 블록 밖(형제·상위 노드)에 있는 경우가 많아
                 * 한 단계 더 올라가며 찾는다. */
                let date = '';
                let scan = el;
                for (let i = 0; i < 3 && scan && !date; i++) {
                  const t = clean(scan.innerText);
                  const abs = t.match(/(\d{2})\.(\d{2})\.(\d{2})\.?(?!\d)/);
                  if (abs) {
                    date = `20${abs[1]}-${abs[2]}-${abs[3]}`;
                    break;
                  }
                  /* 네이버 뉴스는 "5일 전", "2주 전" 처럼 상대 표기를 쓴다.
                   * 그대로 넘기면 codex 가 언제 일인지 알 수 없다. */
                  const rel = t.match(/(\d+)(분|시간|일|주|개월)\s*전/);
                  if (rel) {
                    const n = Number(rel[1]);
                    const days =
                      { 분: 0, 시간: 0, 일: 1, 주: 7, 개월: 30 }[rel[2]] * n;
                    const d = new Date(Date.now() - days * 86_400_000);
                    date = d.toISOString().slice(0, 10);
                    break;
                  }
                  scan = scan.parentElement;
                }

                // 제목 부분을 덜어내고 본문만 남긴다
                if (snippet.startsWith(title)) snippet = snippet.slice(title.length).trim();

                // 네이버 카페 링크에는 JWT 추적 쿼리가 길게 붙는다
                out.push({
                  title: title.slice(0, 200),
                  snippet: snippet.replace(/^[()\d.\s·-]+/, '').slice(0, 400),
                  date,
                  url: a.href.split('?')[0],
                });
              });
              return out.slice(0, 40);
            },
            {
              patternSource: src.linkPattern.source,
              notArticleSource: NOT_ARTICLE.source,
              notTitleSource: NOT_TITLE.source,
            }
          );

          for (const it of items) {
            if (taken[src.kind] >= quota[src.kind]) break;
            const key = it.url.split('?')[0];
            if (seen.has(key)) continue;

            /* ⚠️ 기수 필터 — 이 파일에서 가장 중요한 부분이다.
             * 이름만 걸린 결과는 **다른 기수의 다른 사람**이다. */
            const hay = `${it.title} ${it.snippet}`;
            if (!seasonOk(it, tokens, src.kind)) continue;
            if (ABUSIVE.test(hay)) {
              log.debug(`제외(비하 표현): ${it.title.slice(0, 40)}`);
              continue;
            }
            // 본문 없이 제목만 있는 것은 인용할 재료가 없다
            if (it.snippet.length < 25) {
              log.debug(`제외(본문 미리보기 없음): ${it.title.slice(0, 40)}`);
              continue;
            }

            /* 같은 글이 두 번 잡히는 것을 막는다.
             * 검색 결과에는 글 링크 옆에 **카페 이름 링크**가 같은 곳을 가리키며
             * 함께 있어서, 위로 올라가는 방식이 같은 스니펫을 두 번 집는다.
             * (실측: "인천맘 쏙", "야구 24시-(KIA…" 가 글 제목 자리에 들어왔다) */
            const bodyKey = it.snippet.slice(0, 60);
            if (seen.has(bodyKey)) continue;

            seen.add(key);
            seen.add(bodyKey);
            taken[src.kind]++;
            found.push({
              source: src.name,
              kind: src.kind,
              title: it.title,
              snippet: it.snippet,
              date: it.date,
              url: it.url,
            });
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
  const fmt = (b, i) =>
    `${i + 1}. [${b.source}] ${b.title}\n` +
    `   작성일: ${b.date || '확인 안 됨'}\n` +
    `   내용: ${b.snippet}\n` +
    `   출처: ${b.url}`;

  const news = items.filter((b) => b.kind === 'news');
  const community = items.filter((b) => b.kind !== 'news');

  let block = '\n# 방송 밖 자료 — 직접 수집했습니다 (기수까지 대조함)\n';
  if (news.length) {
    block += `\n## 언론 보도 ${news.length}건 — 인용하기 가장 좋습니다\n\n${news.map(fmt).join('\n\n')}\n`;
  }
  if (community.length) {
    block += `\n## 커뮤니티 반응 ${community.length}건\n\n${community.map(fmt).join('\n\n')}\n`;
  }
  return (
    block +
    `\n**작성일을 반드시 확인하고 쓰세요.** 오래된 기수의 자료는 1~2년 전 것입니다.\n` +
    `"지금 화제" 처럼 쓰면 안 되고, "방송 당시", "2024년 11월 보도" 처럼\n` +
    `시점을 밝혀 주세요. 작성일이 '확인 안 됨' 이면 시점을 단정하지 마세요.\n` +
    `언론 보도는 **매체명을 밝혀** 인용하세요("○○ 보도에 따르면").\n`
  );
}
