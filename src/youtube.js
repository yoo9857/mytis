import { chromium } from 'playwright';
import { log } from './log.js';

/**
 * 유튜브 검색 결과에서 임베드할 영상을 찾는다.
 *
 * 왜 필요한가: 연예 글의 핵심 시각 자료는 "실제 장면"인데, 언론사 사진은 저작권 때문에
 * 쓸 수 없다. 반면 **공식 채널 영상의 임베드는 유튜브가 제공하는 기능이라 문제가 없고**,
 * 실제 무대·시구·행사 장면을 그대로 보여줄 수 있다.
 *
 * codex 웹 검색에 영상 ID를 맡기면 지어내거나 확신하지 못해 빈 배열을 주는 일이 잦아,
 * 유튜브 검색 페이지에서 직접 긁어온다. 영상을 내려받는 게 아니라 임베드할 대상을 찾는 것이다.
 */

/** 공식 채널로 볼 만한 신호 */
const OFFICIAL_HINTS =
  /official|공식|entertainment|records|엔터테인먼트|studios?|tv$|mbc|kbs|sbs|jtbc|tvn|mnet|스타뉴스|뉴스|newsen|dispatch|weverse|hybe|sm\b|jyp|yg\b|pledis|starship|kakao ?ent/i;

/** 임베드로 쓰기 곤란한 채널 */
const AVOID_HINTS = /reaction|리액션|해석|썰|정리해드림|ai |tts|모음zip/i;

function parseViews(text) {
  const m = String(text || '').match(/([\d.,]+)\s*(만|천|억)?/);
  if (!m) return 0;
  let n = parseFloat(m[1].replace(/,/g, '')) || 0;
  if (m[2] === '만') n *= 10_000;
  else if (m[2] === '천') n *= 1_000;
  else if (m[2] === '억') n *= 100_000_000;
  return Math.round(n);
}

/**
 * @param {string[]} queries 검색어 (앞쪽 우선)
 * @param {object} opts
 * @returns {Promise<Array<{videoId,title,channel,verified,views,published}>>}
 */
export async function searchYouTube(queries, { limit = 6, timeoutMs = 45_000 } = {}) {
  const found = [];
  const seen = new Set();
  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(timeoutMs);

    for (const q of queries) {
      if (found.length >= limit) break;
      const url =
        'https://www.youtube.com/results?' +
        new URLSearchParams({ search_query: q, sp: 'EgIQAQ%3D%3D' }); // 동영상만
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);

        const items = await page.evaluate(() => {
          const data = window.ytInitialData;
          if (!data) return [];
          const out = [];
          const walk = (node) => {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) return node.forEach(walk);
            if (node.videoRenderer) {
              const v = node.videoRenderer;
              out.push({
                videoId: v.videoId,
                title: v.title?.runs?.[0]?.text || '',
                channel: v.ownerText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text || '',
                verified: JSON.stringify(v.ownerBadges || []).includes('VERIFIED'),
                views: v.viewCountText?.simpleText || '',
                published: v.publishedTimeText?.simpleText || '',
                length: v.lengthText?.simpleText || '',
              });
            }
            for (const k of Object.keys(node)) walk(node[k]);
          };
          walk(data);
          return out.slice(0, 20);
        });

        for (const it of items) {
          if (!/^[A-Za-z0-9_-]{11}$/.test(it.videoId || '')) continue;
          if (seen.has(it.videoId)) continue;
          if (AVOID_HINTS.test(it.channel) || AVOID_HINTS.test(it.title)) continue;
          seen.add(it.videoId);
          found.push({
            ...it,
            query: q,
            viewCount: parseViews(it.views),
            official: it.verified || OFFICIAL_HINTS.test(it.channel),
          });
        }
        log.debug(`유튜브 "${q}" → ${items.length}건`);
      } catch (err) {
        log.debug(`유튜브 검색 실패 (${q}): ${err.message.split('\n')[0]}`);
      }
    }
  } catch (err) {
    log.warn(`유튜브 검색을 열 수 없습니다: ${err.message.split('\n')[0]}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  // 공식 채널 → 조회수 순
  found.sort((a, b) => (b.official ? 1 : 0) - (a.official ? 1 : 0) || b.viewCount - a.viewCount);
  return found.slice(0, limit);
}

/**
 * 어느 글에나 붙는 범용어. 영상이 글과 관련 있다는 **근거로 쓰면 안 된다.**
 * ("교향곡 입문 추천" 에서 '추천' 이 있는 영상만 찾다가 늘 0개가 됐다)
 */
const GENERIC_TERMS = new Set([
  '추천', '방법', '순서', '정리', '총정리', '비교', '후기', '가이드', '기준',
  '조건', '종류', '리스트', '모음', '완벽', '최신', '오늘', '이유', '차이',
  'best', 'top', 'guide', 'tips',
]);

/** 조사·어미를 떼고 의미 있는 낱말만 남긴다 */
function keywords(text) {
  return String(text || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/(은|는|이|가|을|를|의|에|와|과|도|로|으로)$/u, ''))
    .filter((w) => w.length >= 2);
}

/**
 * 영상이 이 글의 사안과 실제로 관련 있는지 본다.
 *
 * 공식 채널이라는 이유만으로 아무 예능 영상을 넣으면 글과 따로 논다.
 * 그래서 글의 종류에 따라 기준을 다르게 둔다.
 *
 * - **인물 글**(entities 있음): 이름이 반드시 제목·채널에 있어야 하고,
 *   사안 키워드도 하나는 걸려야 한다. (예: "임영웅" + "콘서트")
 * - **정보성 글**(entities 없음): 이름이라는 개념이 없다. 주제어가
 *   2개 이상 걸리면 관련 있다고 본다.
 *
 * 예전에는 정보성 글에서도 primaryKeyword 를 앞 2단어(=이름)와
 * 나머지(=주제)로 억지로 쪼개, "교향곡 입문 추천" 의 경우 제목에
 * "추천" 이 있는 영상만 통과시켰다. 그래서 임베드가 늘 0개였다.
 * 주제어가 2단어 이하면 topicTerms 가 빈 배열이 되어 아예 전멸했다.
 */
function isRelevant(video, nameTerms, topicTerms) {
  const hay = `${video.title} ${video.channel}`.toLowerCase();
  const hit = (terms) => terms.some((t) => t && hay.includes(t.toLowerCase()));

  if (nameTerms.length) {
    // 인물 글: 이름은 필수. 사안 키워드는 있으면 함께 요구한다.
    return hit(nameTerms) && (topicTerms.length === 0 || hit(topicTerms));
  }

  // 정보성 글: 범용어를 뺀 '내용어' 가 하나라도 걸리면 관련 있다고 본다.
  // 내용어가 없으면(주제어가 전부 범용어면) 주제어 전체로 판단한다.
  if (!topicTerms.length) return false;
  const meaningful = topicTerms.filter((t) => !GENERIC_TERMS.has(t.toLowerCase()));
  const pool = meaningful.length ? meaningful : topicTerms;
  return pool.some((t) => hay.includes(t.toLowerCase()));
}

/** 제목·채널에 주제어가 몇 개나 걸리는지 — 관련도가 높은 것을 앞으로 보낸다 */
function relevanceScore(video, terms) {
  const hay = `${video.title} ${video.channel}`.toLowerCase();
  return terms.filter((t) => t && hay.includes(t.toLowerCase())).length;
}

/**
 * 아티클에 맞는 공식 영상을 찾아 embeds 를 채운다.
 * codex 가 이미 확실한 영상을 줬으면 그대로 둔다.
 */
export async function fillEmbeds(article, cfg) {
  const want = cfg.seo.embedCount ?? 2;
  if (want <= 0 || cfg.seo.includeEmbeds === false) return article.embeds || [];
  if ((article.embeds || []).length >= want) return article.embeds;

  const people = (article.entities || []).map((e) => e.nameKo || e.nameEn).filter(Boolean);
  const subject = people[0] || article.primaryKeyword;
  // "무대" 같은 검색어는 연예 글에서만 의미가 있다. 정보성 글에는
  // 주제어와 롱테일 검색어를 그대로 쓴다.
  const queries = (
    people.length
      ? [
          article.primaryKeyword,
          people.length > 1 ? `${people[0]} ${people[1]}` : '',
          `${subject} 공식`,
          `${subject} 무대`,
        ]
      : [
          article.primaryKeyword,
          `${article.primaryKeyword} 공식`,
          ...(article.secondaryKeywords || []).slice(0, 2),
        ]
  ).filter(Boolean);

  log.step(`공식 영상 검색: ${queries[0]}`);
  const videos = await searchYouTube(queries, { limit: want + 4 });

  if (!videos.length) {
    log.info('임베드할 영상을 찾지 못했습니다.');
    return article.embeds || [];
  }

  // 인물이 있으면 이름 / 사안으로 나눠서 보고, 없으면 전부 주제어로 본다.
  // (예전엔 인물이 없을 때 앞 2단어를 억지로 '이름'으로 삼아 필터가 늘 실패했다)
  const nameTerms = (article.entities || []).flatMap((e) => [e.nameKo, e.nameEn]).filter(Boolean);
  const allTerms = keywords(article.primaryKeyword);
  const topicTerms = nameTerms.length
    ? allTerms.filter((w) => !nameTerms.some((n) => n && n.toLowerCase().includes(w.toLowerCase())))
    : allTerms;

  const relevant = videos.filter((v) => isRelevant(v, nameTerms, topicTerms));
  if (!relevant.length) {
    log.info(
      `이 사안과 관련된 영상이 없어 임베드를 넣지 않습니다. ` +
        `(검색은 됐지만 제목이 "${topicTerms.join(' / ') || '주제'}" 와 무관)`
    );
    return article.embeds || [];
  }

  // 공식 채널을 우선하되, 그 안에서는 주제어가 많이 걸린 영상을 앞세운다.
  // (조회수만 보면 주제와 살짝 빗나간 인기 플레이리스트가 먼저 뽑힌다)
  const scoreTerms = [...nameTerms, ...topicTerms];
  const officials = relevant.filter((v) => v.official);
  const chosen = (officials.length ? officials : relevant)
    .slice()
    .sort((a, b) => relevanceScore(b, scoreTerms) - relevanceScore(a, scoreTerms))
    .slice(0, want);

  const sectionCount = Math.max(1, article.sections.length);
  const embeds = chosen.map((v, i) => ({
    videoId: v.videoId,
    title: v.title,
    channel: v.channel,
    // 본문에 고르게 흩뿌린다
    afterSection: Math.min(sectionCount, Math.round(((i + 1) * sectionCount) / (chosen.length + 1))),
  }));

  for (const e of embeds) log.ok(`영상: ${e.title.slice(0, 40)} — ${e.channel}`);
  return [...(article.embeds || []), ...embeds].slice(0, want);
}
