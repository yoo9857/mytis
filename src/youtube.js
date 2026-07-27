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
 * **인물 이름 + 사안 키워드가 모두 제목에 있을 때만** 통과시키고,
 * 관련 영상이 없으면 아예 넣지 않는다.
 */
function isRelevant(video, nameTerms, topicTerms) {
  const hay = `${video.title} ${video.channel}`.toLowerCase();
  const hasName = nameTerms.some((t) => t && hay.includes(t.toLowerCase()));
  const hasTopic = topicTerms.some((t) => t && hay.includes(t.toLowerCase()));
  return hasName && hasTopic;
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
  const queries = [
    article.primaryKeyword,
    people.length > 1 ? `${people[0]} ${people[1]}` : '',
    subject ? `${subject} 공식` : '',
    subject ? `${subject} 무대` : '',
  ].filter(Boolean);

  log.step(`공식 영상 검색: ${queries[0]}`);
  const videos = await searchYouTube(queries, { limit: want + 4 });

  if (!videos.length) {
    log.info('임베드할 영상을 찾지 못했습니다.');
    return article.embeds || [];
  }

  // 인물 이름(한글·영문) 과 사안 키워드를 모두 담은 영상만 고른다
  const nameTerms = (article.entities || []).flatMap((e) => [e.nameKo, e.nameEn]).filter(Boolean);
  if (!nameTerms.length) nameTerms.push(...keywords(article.primaryKeyword).slice(0, 2));
  const topicTerms = keywords(article.primaryKeyword).filter(
    (w) => !nameTerms.some((n) => n && n.toLowerCase().includes(w.toLowerCase()))
  );

  const relevant = videos.filter((v) => isRelevant(v, nameTerms, topicTerms));
  if (!relevant.length) {
    log.info(
      `이 사안과 관련된 영상이 없어 임베드를 넣지 않습니다. ` +
        `(검색은 됐지만 제목이 "${topicTerms.join(' / ') || '주제'}" 와 무관)`
    );
    return article.embeds || [];
  }

  const officials = relevant.filter((v) => v.official);
  const chosen = (officials.length ? officials : relevant).slice(0, want);

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
