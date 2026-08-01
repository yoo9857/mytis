import fs from 'node:fs';
import { log } from './log.js';
import { FILES, todayStr } from './paths.js';
import { runCodexJson } from './codexWriter.js';

/**
 * X(트위터)·인스타그램 **공식 게시물 임베드**.
 *
 * 왜 이렇게 하는가: 독자가 보고 싶어 하는 건 "최신 근황 사진"인데,
 * 그 사진을 **내려받아 본문에 올리면 저작권 침해에 플랫폼 약관 위반이 겹친다.**
 * 반면 공식 게시물 임베드는 원저작자 서버에서 렌더링되므로 문제가 없고,
 * 원본이 지워지면 임베드도 함께 사라진다. 유튜브 임베드와 같은 원리다.
 * (HANDOVER 6장·8장)
 *
 * ## 2026-07-28 실측 — 쓸 수 있는 경로와 막힌 경로
 *
 * | 경로 | 결과 |
 * |---|---|
 * | `syndication.twitter.com/srv/timeline-profile/screen-name/<핸들>` | **동작.** 무인증으로 최신 게시물·사진·작성자를 준다 |
 * | 없는 핸들 | 200 이지만 2KB 빈 껍데기 → **핸들 존재 검증에 그대로 쓴다** |
 * | `instagram.com/p/<코드>/embed/` | **동작.** 스크립트 없이 임베드되고 게시물 존재도 확인된다 |
 * | `publish.twitter.com/oembed` | 막힘 (X 에러 페이지 반환) |
 * | `cdn.syndication.twimg.com/tweet-result` | 막힘 (토큰 없이 404) |
 *
 * 그래서 **검증은 oEmbed 가 아니라 타임라인·임베드 페이지 파싱으로** 한다.
 * oEmbed 로 되돌리지 마세요. 이미 막혀 있습니다.
 *
 * ## 인스타그램의 한계
 *
 * 인스타는 로그인 없이 **계정의 최신 게시물 목록을 얻을 수 없다.** 개별 게시물
 * URL 을 알 때만 임베드된다. 그래서 codex 가 검색에서 본 게시물 주소를 먼저 쓰고,
 * 없으면 검색엔진으로 보완한 뒤 `/embed/` 로 검증한다. 못 찾으면 아무것도 넣지 않는다.
 *
 * ## 계정을 어떻게 찾는가 — AI 가 찾고, 코드가 검증한다
 *
 * 계정명은 **규칙으로 만들어낼 수 없다.** 공식 계정에는 소속사 이름이 붙는
 * 경우가 많아서(아이브 → `@IVEstarship`) 어떤 조합 규칙도 맞히지 못한다.
 * 그래서 탐색은 `resolveAccountsWithAi` 가 codex 웹 검색으로 하고,
 * **코드는 그 결과를 절대 그대로 믿지 않는다.**
 *
 * - X: 타임라인을 열어 **프로필 이름이 인물명과 겹치는지** 확인
 * - 인스타: `/embed/` 로 게시물 존재를 확인하고 **작성자가 codex 가 지목한
 *   공식 계정과 같은지** 확인
 * - codex 확신도가 `low` 면 아예 쓰지 않는다
 *
 * AI 는 계정을 지어낼 수 있지만, 지어낸 계정은 위 검증에서 전부 걸린다.
 * **검증 단계를 지우지 마세요.** 그 순간 엉뚱한 사람의 사진이 실립니다.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** 공식 계정으로 볼 만한 신호 (youtube.js 의 OFFICIAL_HINTS 와 같은 취지) */
const OFFICIAL_HINTS =
  /official|공식|entertainment|엔터테인먼트|records|studios?|cube|starship|hybe|pledis|\bsm\b|\bjyp\b|\byg\b|kakao|antenna|fnc|wm\b|mbc|kbs|sbs|jtbc|tvn|mnet|tving|coupangplay|netflix/i;

/** 팬·비공식 계정 신호. 이게 걸리면 임베드하지 않는다. */
const FAN_HINTS = /\bfan(s|cam|base|page)?\b|팬|직캠|백업|backup|archive|아카이브|update(s)?\b|\bbot\b|daily|pics?\b|media\b/i;

/**
 * @param {object} opts
 * @param {boolean} opts.browserUa 브라우저 UA 를 보낼지.
 *   **인스타에는 반드시 false 를 줘야 한다.** 2026-07-28 실측:
 *   브라우저 UA 를 보내면 `/embed/` 가 600KB 짜리 JS 앱 페이지를 돌려주고
 *   임베드 마크업이 아예 없다. UA 를 빼면 80~150KB 의 파싱 가능한 마크업이 온다.
 *   (검색엔진에는 반대로 UA 가 필요하다)
 */
async function getText(url, { timeoutMs = 15_000, browserUa = true } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: browserUa ? { 'User-Agent': UA } : {},
    });
    if (!res.ok) return { status: res.status, body: null };
    return { status: res.status, body: await res.text() };
  } catch {
    return { status: 0, body: null };
  } finally {
    clearTimeout(t);
  }
}

/* ────────────────────────── X (트위터) ────────────────────────── */

/**
 * `tweet-result` 가 요구하는 토큰. **트윗 ID 만으로 계산된다** — 발급받는 값이 아니다.
 * vercel/react-tweet 의 `getToken` 과 같은 식이다.
 * (`6 ** 2` = 36진수. 원문 그대로 두는 편이 대조하기 쉽다)
 *
 * 처음에 이걸 몰라 `token=a` 로 찔러 보고 404 를 받아 "막힌 경로" 로 판단했었다.
 * 실제로는 열려 있다.
 */
function tweetToken(id) {
  return ((Number(id) / 1e15) * Math.PI).toString(6 ** 2).replace(/(0+|\.)/g, '');
}

const TWEET_FEATURES = [
  'tfw_timeline_list:',
  'tfw_follower_count_sunset:true',
  'tfw_tweet_edit_backend:on',
  'tfw_refsrc_session:on',
  'tfw_show_business_verified_badge:on',
  'tfw_show_blue_verified_badge:on',
  'tfw_show_gov_verified_badge:on',
  'tfw_show_business_affiliate_badge:on',
].join(';');

/**
 * 트윗 하나가 **지금도 살아 있는지** 확인하고 작성자·사진·날짜를 읽는다.
 *
 * 이 검증을 건너뛰면 안 되는 이유 (2026-07-28 실측):
 * 타임라인 엔드포인트는 **이미 삭제된 트윗의 ID 도 그대로 돌려준다.**
 * BTS 공식 계정 타임라인에서 받은 2020년 트윗들이 전부 404 였다.
 * 그대로 임베드했으면 독자에게 빈 박스만 보였을 것이다.
 * (반대로 아이브 계정의 최근 6건은 전부 살아 있었고 사진도 1~4장씩 붙어 있었다)
 *
 * 타임라인 HTML 파싱과 달리 이쪽은 구조화된 JSON 이고 429 도 덜 탄다.
 * 그래서 **게시물 판정은 언제나 이 함수가** 한다.
 */
export async function verifyTweet(id, { timeoutMs = 15_000, lang = 'ko' } = {}) {
  const tid = String(id || '').trim();
  if (!/^\d{10,25}$/.test(tid)) return null;

  const url =
    'https://cdn.syndication.twimg.com/tweet-result?' +
    new URLSearchParams({ id: tid, lang, token: tweetToken(tid), features: TWEET_FEATURES });

  const { status, body } = await getText(url, { timeoutMs, browserUa: false });
  if (!body) {
    // 404 = 삭제됐거나 비공개. 그 밖의 실패는 일시적일 수 있다.
    log.debug(`트윗 ${tid}: 확인 실패 (http ${status})${status === 404 ? ' — 삭제된 글' : ''}`);
    return null;
  }

  let d;
  try {
    d = JSON.parse(body);
  } catch {
    log.debug(`트윗 ${tid}: 응답이 JSON 이 아닙니다 (에러 페이지).`);
    return null;
  }
  if (!d || d.__typename === 'TweetTombstone' || !d.user?.screen_name) {
    log.debug(`트윗 ${tid}: 삭제·비공개 상태입니다.`);
    return null;
  }

  const photos = [
    ...(d.photos || []).map((p) => p.url || p.media_url_https),
    ...(d.mediaDetails || []).filter((m) => m?.type === 'photo').map((m) => m.media_url_https),
  ].filter(Boolean);

  return {
    id: tid,
    screenName: d.user.screen_name,
    authorName: d.user.name || '',
    verified: !!(d.user.is_blue_verified || d.user.verified),
    photos: [...new Set(photos)],
    text: d.text || '',
    createdAt: d.created_at || '',
  };
}

/**
 * 직전 타임라인 조회가 429(요청 제한)로 끝났는지.
 * "없는 계정" 과 "제한에 걸림" 은 둘 다 null 이지만 대응이 정반대다 —
 * 전자는 다음 후보로 넘어가야 하고, 후자는 즉시 멈춰야 한다.
 */
let lastWasRateLimit = false;

/**
 * 공식 계정 타임라인을 읽어 최신 게시물을 뽑는다.
 *
 * 주의: `entries` 는 **최신순이 아니다.** (실측: IVEstarship 96건 중 0번째가
 * 2023년, 실제 최신은 2025년) 반드시 id 로 내림차순 정렬해야 한다.
 * 트윗 id 는 시간순으로 증가하는 snowflake 라 문자열 길이+사전순으로 비교하면 된다.
 */
export async function fetchXTimeline(handle, { timeoutMs = 15_000 } = {}) {
  const clean = String(handle || '').replace(/^@/, '').trim();
  if (!/^[A-Za-z0-9_]{1,15}$/.test(clean)) return null;

  // 이 엔드포인트는 연속 호출하면 429 를 준다 (실측). 짧게 물러났다 한 번 더 본다.
  // 429 를 "없는 계정" 으로 오해하면 공식 계정을 조용히 놓친다.
  lastWasRateLimit = false;
  let html = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await getText(
      `https://syndication.twitter.com/srv/timeline-profile/screen-name/${clean}`,
      { timeoutMs }
    );
    if (res.body) {
      html = res.body;
      break;
    }
    if (res.status === 429) {
      if (attempt === 0) {
        log.debug(`X @${clean}: 요청이 몰려 429 — 3초 후 한 번 더 시도합니다.`);
        await new Promise((r) => setTimeout(r, 3_000));
        continue;
      }
      lastWasRateLimit = true;
      return null;
    }
    return null;
  }

  // 없는 핸들도 200 을 주지만 본문이 2KB 남짓한 빈 껍데기다
  if (!html || html.length < 5_000) {
    log.debug(`X @${clean}: 타임라인이 비어 있습니다 (없는 계정으로 판단)`);
    return null;
  }

  const m = html.match(/id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;

  let data;
  try {
    data = JSON.parse(m[1]);
  } catch (err) {
    log.debug(`X @${clean}: __NEXT_DATA__ 파싱 실패 — ${err.message}`);
    return null;
  }

  const entries = data?.props?.pageProps?.timeline?.entries || [];
  const tweets = [];
  for (const e of entries) {
    const t = e?.content?.tweet;
    if (!t?.id_str) continue;
    // 사진은 photos 에 오기도 하고 mediaDetails 에 오기도 한다
    const photos = [
      ...(t.photos || []).map((p) => p.media_url_https || p.url),
      ...(t.mediaDetails || [])
        .filter((d) => d?.type === 'photo')
        .map((d) => d.media_url_https),
    ].filter(Boolean);
    tweets.push({
      id: t.id_str,
      createdAt: t.created_at || '',
      text: t.text || t.full_text || '',
      photos: [...new Set(photos)],
      isRetweet: !!t.retweeted_status || /^RT @/.test(t.text || ''),
      screenName: t.user?.screen_name || clean,
      authorName: t.user?.name || '',
    });
  }
  if (!tweets.length) return null;

  // snowflake id 내림차순 = 최신순
  tweets.sort((a, b) => (a.id.length - b.id.length) || a.id.localeCompare(b.id)).reverse();

  const profile = tweets[0];
  return {
    handle: clean,
    name: profile.authorName,
    tweets,
  };
}

/**
 * codex 웹 검색으로 공식 계정을 찾는다. **풀오토의 핵심.**
 *
 * 왜 규칙 기반 추측을 버렸는가 (2026-07-28 실측):
 * 실제 공식 계정은 소속사 이름이 붙는 경우가 많다. 아이브의 공식 X 계정은
 * `@IVEstarship`, 인스타는 `@ivestarship`·`@officialstarship` 인데
 * **이름 조합으로는 어떤 규칙을 써도 만들어낼 수 없다.**
 * 게다가 후보를 여러 개 던지면 타임라인 엔드포인트가 곧바로 429 를 준다.
 * 즉 추측은 맞지도 않으면서 정작 맞는 후보의 조회까지 막았다.
 *
 * 그래서 **찾는 일은 AI 에, 판정은 코드에** 맡긴다.
 * codex 가 준 계정도 그대로 믿지 않고 `fetchXTimeline`·`verifyInstagramPost`
 * 로 실제 존재와 작성자를 확인한 뒤에만 쓴다. AI 는 계정을 지어낼 수 있지만
 * 지어낸 계정은 검증에서 걸린다.
 */
async function resolveAccountsWithAi(people, cfg, maxAgeDays = 180) {
  if (!fs.existsSync(FILES.socialSchema)) {
    log.debug(`SNS 계정 스키마를 찾을 수 없습니다: ${FILES.socialSchema}`);
    return [];
  }

  const list = people
    .map((p) => `- ${p.nameKo}${p.nameEn ? ` (${p.nameEn})` : ''} · ${p.role || ''}`)
    .join('\n');

  const prompt = `다음 인물·그룹의 **공식 SNS 계정**을 웹 검색으로 찾아 주세요.

${list}

# 반드시 지킬 것
- 웹 검색으로 **실제 확인한 계정만** 넣으세요. 계정명을 추측하거나 지어내지 마세요.
  틀린 계정을 넣으면 독자에게 엉뚱한 사람의 게시물이 보입니다.
- 공식 계정은 **소속사가 운영하는 경우가 많습니다.** 이름만으로 유추하지 말고
  소속사 공식 사이트, 위키백과, 언론 보도에 링크된 계정을 찾으세요.
  (예: 아이브의 공식 X 계정은 @IVEstarship 입니다)
- **팬 계정·백업 계정·직캠 계정·업데이트 계정은 절대 금지입니다.**
- 확인하지 못한 항목은 빈 문자열로 두세요. 빈 값은 안전하지만 틀린 값은 사고입니다.
# recentPosts — 이 항목이 실제 결과를 좌우합니다
- 계정 이름만으로는 부족합니다. **게시물 하나하나의 주소가 있어야** 본문에 넣을 수 있습니다.
  특히 인스타그램은 계정만 알면 최근 글 목록을 가져올 방법이 없어서,
  여기가 비면 그 인물의 인스타는 아예 쓰지 못합니다.
- 계정을 찾았다면 **그 계정의 게시물도 함께 검색해서** 채우세요.
  \`site:instagram.com/<계정명>\`, \`<계정명> instagram\` 같은 검색이 도움이 됩니다.
- 형태: \`https://www.instagram.com/p/<코드>/\` 또는 \`https://x.com/<핸들>/status/<숫자ID>\`
- 최신순으로 최대 4개. **사진이 있는 게시물을 우선**하세요.

## date 를 반드시 채우세요
- 이 글의 목적은 **"최신 근황"** 을 보여주는 것입니다. 몇 년 전 게시물이 실리면 글이 틀려집니다.
- 인스타그램은 date 말고는 게시일을 알아낼 방법이 아예 없습니다.
  **날짜가 빈 인스타 게시물은 버려집니다.** 그러니 게시일까지 확인해서 적으세요.
- 게시일을 확인하지 못했으면 빈 문자열로 두세요. **추측해서 적지 마세요** —
  오래된 글에 최근 날짜를 붙이면 독자를 속이게 됩니다.
- ${maxAgeDays}일 이내 게시물이 가장 좋습니다. 그보다 오래된 것만 있으면 그대로 적되
  날짜를 정확히 남기세요. 거르는 일은 저희 쪽에서 합니다.

- 검색 결과에 **실제로 나타난 것만** 넣으세요. 주소의 ID 부분을 지어내면
  깨진 임베드가 본문에 실립니다. 못 찾았으면 빈 배열로 두세요 — 그게 정답일 수 있습니다.

# 오늘 날짜
${todayStr()}

지정된 JSON 스키마에 맞는 JSON 객체 하나만 반환하세요.`;

  try {
    const raw = await runCodexJson({
      prompt,
      schemaFile: FILES.socialSchema,
      cfg,
      timeoutMs: Math.min(cfg.codex?.timeoutMs ?? 300_000, 300_000),
      search: true,
    });
    const accounts = Array.isArray(raw?.accounts) ? raw.accounts : [];
    for (const a of accounts) {
      const posts = Array.isArray(a.recentPosts) ? a.recentPosts : [];
      log.debug(
        `codex: ${a.nameKo} → X @${a.xHandle || '-'} · IG @${a.instagramUsername || '-'} ` +
          `(확신 ${a.confidence || '?'}${a.evidence ? ` · ${a.evidence}` : ''})`
      );
      // 계정을 찾아도 게시물이 없으면 아무것도 못 넣는다 — 어느 쪽이 비었는지 보이게 남긴다
      log.debug(
        `  └ 게시물 ${posts.length}건` +
          (posts.length
            ? `: ${posts
                .map((x) => `${x.date || '날짜없음'}${x.hasPhoto ? '·사진' : ''} ${x.url}`)
                .join(' / ')}`
            : ' (게시물 주소를 못 찾음 — 이 인물은 임베드 불가)')
      );
    }
    return accounts;
  } catch (err) {
    log.debug(`codex 공식 계정 검색 실패: ${err.message}`);
    return [];
  }
}

/**
 * 프로필 이름이 이 인물의 것인지 본다. 겹치지 않으면 남의 계정이다.
 *
 * 짧은 영문명 처리에 주의할 것. 그냥 부분일치로 열어 두면 `IVE` 가 `drive`·`live`
 * 같은 남의 계정에 걸리고, 반대로 길이 4자 이상만 허용하면 **정작 맞는 계정을
 * 놓친다.** (2026-07-28 실측: 아이브 공식 계정의 프로필 이름이 "IVE OFFICIAL"
 * 인데 `IVE` 가 3글자라 걸러져 임베드가 0개가 됐다)
 *
 * → 짧은 이름은 **낱말 단위로 정확히 일치**할 때만 통과시킨다.
 *   "IVE OFFICIAL" 은 낱말 `ive` 가 있으니 통과, "Drive Records" 는 탈락.
 */
function profileMatches(profileName, nameKo, nameEn) {
  const raw = String(profileName || '').toLowerCase();
  if (!raw) return false;

  const hay = raw.replace(/\s+/g, '');
  if (nameKo && hay.includes(nameKo.toLowerCase().replace(/\s+/g, ''))) return true;

  if (nameEn) {
    const en = nameEn.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!en) return false;
    // 긴 이름은 부분일치로 충분하다 (붙여 쓴 계정명까지 잡는다)
    if (en.length >= 4 && hay.replace(/[^a-z0-9]/g, '').includes(en)) return true;
    // 짧은 이름은 낱말이 통째로 같을 때만
    if (raw.split(/[^a-z0-9]+/).filter(Boolean).includes(en)) return true;
  }
  return false;
}

/* ────────────────────────── 인스타그램 ────────────────────────── */

/**
 * 프로필 그리드에서 최신 게시물 코드를 긁는다 — codex 가 계정은 짚었는데
 * 게시물 주소를 못 줬을 때의 폴백 (2026-07-30 하트시그널5 실측으로 확립).
 *
 * 왜 되는가: 익명 HTTP 는 전부 막혔지만(oEmbed 429 · og:title 은 로그인 월),
 * **실제 Chrome 으로 프로필을 열면** 그리드의 /p/·/reel/ 링크가 DOM 에 있다.
 * 그리드 순서 = 최신순이므로 날짜를 몰라도 "이 계정의 지금" 이라는 사실이
 * 구조적으로 보장된다 — codex 날짜가 없을 때 검색엔진 폴백(날짜도 순서도
 * 보장 없음)보다 강하다.
 *
 * 함정: **고정(pinned) 게시물이 그리드 맨 앞에 온다.** 실측(yykkye): 첫 링크가
 * 2022년 고정글(Cl…), 나머지는 전부 최신(Db…). 숏코드의 첫 글자는 대략
 * 시대순으로 증가하므로, 다수 프리픽스와 크게 어긋나는 맨 앞 항목만 걷어낸다.
 * (숏코드로 **정확한 날짜**를 계산하는 것은 여전히 금지 — 오차가 제각각이다.
 *  여기서는 '한 시대 이상 벌어진 고정글' 을 골라내는 데만 쓴다)
 *
 * 반환한 코드는 반드시 verifyInstagramPost() 를 다시 거친다 — 여기서는
 * 후보만 만들고, 존재·작성자·사진 검증은 기존 검증기가 한다.
 */
export async function scrapeProfilePosts(username, { limit = 3, timeoutMs = 25_000 } = {}) {
  const clean = String(username || '').replace(/^@/, '').trim();
  if (!/^[A-Za-z0-9._]{2,30}$/.test(clean)) return [];
  let browser = null;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ locale: 'ko-KR' });
    page.setDefaultTimeout(timeoutMs);
    await page.goto(`https://www.instagram.com/${clean}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    const codes = await page.evaluate(() =>
      [...new Set(
        [...document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')]
          .map((a) => (a.href.match(/\/(?:p|reel)\/([A-Za-z0-9_-]{5,20})/) || [])[1])
          .filter(Boolean)
      )]
    );
    if (!codes.length) {
      log.debug(`인스타 @${clean}: 프로필에서 게시물 링크를 찾지 못했습니다 (비공개이거나 로그인 월).`);
      return [];
    }
    // 고정글 걷어내기 — 첫 항목의 시대 프리픽스가 다수와 다르면 버린다
    let list = codes;
    if (codes.length >= 3) {
      const mode = [...codes.slice(1)].sort(
        (x, y) =>
          codes.filter((c) => c[0] === y[0]).length - codes.filter((c) => c[0] === x[0]).length
      )[0][0];
      if (codes[0][0] !== mode) {
        log.debug(`인스타 @${clean}: 맨 앞 게시물(${codes[0]})은 고정글로 보여 건너뜁니다.`);
        list = codes.slice(1);
      }
    }
    log.debug(`인스타 @${clean}: 프로필에서 게시물 ${list.length}건 확보 (최신순).`);
    return list.slice(0, limit);
  } catch (err) {
    log.debug(`인스타 @${clean} 프로필 수집 실패: ${String(err.message).split('\n')[0]}`);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * 인스타 게시물이 실제로 존재하는지 `/embed/` 로 확인하고 작성자를 읽는다.
 *
 * 판정 기준 두 가지를 **모두** 봐야 한다 (2026-07-28 실측).
 * 1. 게시물 종류 표시 `EmbedSimple`·`EmbedSidecar`·`EmbedVideo` 가 있을 것
 * 2. `EmbedBrokenMedia` 가 **없을** 것
 *
 * 2번이 없으면 안 된다. 없는 게시물도 200 과 함께 `EmbedSidecar` 를 주고,
 * 대신 `EmbedBrokenMedia` 를 함께 담아 보낸다. 종류만 보고 통과시키면
 * **깨진 회색 박스가 본문에 실린다.**
 */
export async function verifyInstagramPost(shortcode, { timeoutMs = 15_000 } = {}) {
  const code = String(shortcode || '').trim();
  if (!/^[A-Za-z0-9_-]{8,20}$/.test(code)) return null;

  /* 1단계 — 공식 oEmbed 로 존재를 확인한다.
   *
   * 메타가 2026-06-15 부터 이 엔드포인트를 **토큰 없이** 열었다. 앱 등록도,
   * 액세스 토큰도, App Review 도 필요 없다. 스크래핑이 아니라 공식 경로다.
   * 없는 게시물에는 http 400 과 "Media Not Found" 를 준다 — 판정이 깔끔하다.
   *
   * 다만 응답에 **author_name 이 없다**(version·provider·type·width·html 뿐).
   * 그래서 작성자는 2단계에서 따로 읽는다. oEmbed 의 html 은 embeds.js 스크립트를
   * 요구하는 blockquote 라서 렌더링에도 쓰지 않는다(티스토리가 script 를 지운다). */
  const oembed = await getText(
    'https://graph.facebook.com/v25.0/instagram_oembed?' +
      new URLSearchParams({ url: `https://www.instagram.com/p/${code}/` }),
    { timeoutMs, browserUa: false }
  );
  if (!oembed.body) {
    log.debug(`인스타 ${code}: 공식 oEmbed 가 거절했습니다 (http ${oembed.status}) — 없는 게시물.`);
    return null;
  }

  /* 2단계 — 작성자를 읽는다.
   * 브라우저 UA 를 보내면 임베드 마크업 대신 JS 앱 페이지가 온다 — getText 주석 참고 */
  const { body: html } = await getText(`https://www.instagram.com/p/${code}/embed/`, {
    timeoutMs,
    browserUa: false,
  });
  if (!html) return null;

  const type = html.match(/Embed(Simple|Sidecar|Video)/)?.[1];
  if (!type) {
    log.debug(`인스타 ${code}: 임베드 마크업이 없습니다 (삭제·비공개·로그인 벽)`);
    return null;
  }
  if (/EmbedBrokenMedia/.test(html)) {
    log.debug(`인스타 ${code}: 게시물이 깨져 있습니다 (EmbedBrokenMedia) — 건너뜁니다.`);
    return null;
  }

  const username =
    html.match(/instagram\.com\/([A-Za-z0-9_.]{2,30})\/\?utm_source=ig_embed/)?.[1] ||
    html.match(/class="UsernameText">([^<]+)</)?.[1] ||
    '';
  if (!username) {
    log.debug(`인스타 ${code}: 작성자를 읽지 못해 건너뜁니다 (공식 계정 확인 불가).`);
    return null;
  }
  return { shortcode: code, username, isVideo: type === 'Video' };
}

/** 인스타·X 게시물 URL 에서 식별자를 뽑는다. */
export function parseSocialUrl(url) {
  const s = String(url || '');
  const ig = s.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]{5,20})/);
  if (ig) return { platform: 'instagram', id: ig[1] };
  const x = s.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{10,25})/);
  if (x) return { platform: 'x', id: x[2], handle: x[1] };
  return null;
}

/**
 * 검색엔진에서 이 인물의 공식 인스타 게시물 주소를 찾는다.
 * 인스타는 목록 API 가 막혀 있어 이 방법밖에 없다. 못 찾으면 빈 배열.
 */
async function findInstagramPosts(nameKo, nameEn, { limit = 6, timeoutMs = 20_000, username = '' } = {}) {
  // 계정을 알면 그 계정으로 좁혀 찾는다. 이름으로 찾으면 동명이인·팬 계정이 섞인다.
  const terms = username
    ? `site:instagram.com/${username}`
    : `site:instagram.com ${[nameKo, nameEn].filter(Boolean).join(' ')}`;
  const q = encodeURIComponent(terms);
  // 검색엔진 쪽은 반대로 브라우저 UA 가 있어야 결과를 준다
  const { body: html } = await getText(`https://html.duckduckgo.com/html/?q=${q}`, { timeoutMs });
  if (!html) return [];
  const codes = [];
  const re = /instagram\.com(?:%2F|\/)(?:p|reel)(?:%2F|\/)([A-Za-z0-9_-]{8,20})/g;
  let m;
  while ((m = re.exec(html)) && codes.length < limit * 3) {
    // 검색 결과에는 잘린 주소가 섞여 온다. 짧은 것은 어차피 깨진 게시물이다.
    if (m[1].length >= 10 && !codes.includes(m[1])) codes.push(m[1]);
  }
  return codes.slice(0, limit);
}

/* ────────────────────────── 조립 ────────────────────────── */

/** 게시물이 이 사안과 관련 있는지 — 이름이나 주제어가 본문에 걸려야 한다. */
function textRelevant(text, terms) {
  const hay = String(text || '').toLowerCase();
  return terms.some((t) => t && t.length >= 2 && hay.includes(t.toLowerCase()));
}

function daysAgo(createdAt) {
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 86_400_000;
}

/**
 * 두 경로가 서로 다른 날짜 형식을 준다.
 * - tweet-result: ISO (`2025-07-16T07:30:00.000Z`)
 * - 타임라인 HTML: 트위터 구형식 (`Sun Sep 24 14:03:10 +0000 2023`)
 * 로그에 그대로 찍으면 한쪽이 깨져 보이므로 여기서 맞춘다.
 */
function fmtDate(createdAt) {
  const t = Date.parse(createdAt);
  return Number.isNaN(t) ? '날짜미상' : new Date(t).toISOString().slice(0, 10);
}

/**
 * 아티클에 맞는 공식 SNS 게시물을 찾아 socialEmbeds 를 채운다.
 *
 * 확실하지 않으면 **아무것도 넣지 않는다.** 남의 계정이나 팬 계정 게시물이
 * "공식 근황" 으로 실리는 쪽이 임베드가 0개인 쪽보다 훨씬 나쁘다.
 */
export async function fillSocialEmbeds(article, cfg) {
  const sc = cfg.social || {};
  if (sc.enabled === false) return [];
  const want = sc.count ?? 2;
  if (want <= 0) return [];

  const platforms = sc.platforms || ['x', 'instagram'];
  const maxAge = sc.maxAgeDays ?? 180;
  const people = (article.entities || []).filter((e) => e.nameKo || e.nameEn);
  if (!people.length) {
    log.debug('SNS 임베드: 인물이 없는 글이라 생략합니다.');
    return [];
  }

  const nameTerms = people.flatMap((p) => [p.nameKo, p.nameEn]).filter(Boolean);
  const found = [];

  log.step(`공식 SNS 근황 검색: ${people.map((p) => p.nameKo || p.nameEn).join(', ')}`);

  // 계정 탐색은 codex 에 맡긴다. 설정(social.handles)이 있으면 그게 우선이다.
  /* codex 의 게시물 검색은 편차가 크다 (실측: 같은 인물에 4건 → 2건 → 0건).
   * 계정은 찾았는데 게시물이 하나도 없으면 그 인물은 통째로 못 쓰므로,
   * 그 경우에만 한 번 더 물어본다. 계정까지 못 찾았으면 재시도해도 마찬가지라 그냥 넘어간다. */
  let ai = await resolveAccountsWithAi(people, cfg, maxAge);
  const hasPosts = (list) => list.some((a) => (a?.recentPosts || []).length);
  if (ai.length && !hasPosts(ai)) {
    log.debug('codex 가 계정만 찾고 게시물을 못 줬습니다 — 한 번 더 시도합니다.');
    const retry = await resolveAccountsWithAi(people, cfg, maxAge);
    if (hasPosts(retry)) ai = retry;
  }
  const aiFor = (p) =>
    ai.find(
      (a) =>
        a?.nameKo &&
        (a.nameKo === p.nameKo ||
          a.nameKo === p.nameEn ||
          (p.nameKo && a.nameKo.includes(p.nameKo)))
    ) || null;

  /* ── X ── */
  let rateLimited = false;
  let probed = 0;
  if (platforms.includes('x')) {
    for (const p of people) {
      if (found.length >= want || rateLimited) break;

      const acct = aiFor(p);
      const configured = (sc.handles || {})[p.nameKo] || (sc.handles || {})[p.nameEn];
      const handle = String(configured || acct?.xHandle || '').replace(/^@/, '').trim();
      if (!handle) {
        log.debug(`X: ${p.nameKo} 의 공식 계정을 확인하지 못했습니다 (codex 도 못 찾음).`);
        continue;
      }
      // codex 가 확신하지 못한 계정은 쓰지 않는다. 틀린 계정보다 없는 편이 낫다.
      if (!configured && acct?.confidence === 'low') {
        log.debug(`X @${handle}: codex 확신도가 low 라 건너뜁니다 (${acct.evidence || '근거 없음'}).`);
        continue;
      }

      /* 후보 트윗 ID 를 모은다.
       *
       * codex 가 준 게시물 주소를 **먼저** 쓴다. 타임라인 스크래핑과 달리
       * 요청 제한(429)에 걸리지 않기 때문이다. 타임라인은 codex 가 주소를
       * 주지 못했을 때만 쓰는 보조 수단으로 내렸다. */
      // X 는 tweet-result 가 정확한 게시일을 주므로 codex 의 date 는 참고만 한다
      const fromAi = (acct?.recentPosts || [])
        .map((p2) => ({ ...parseSocialUrl(p2?.url), date: p2?.date }))
        .filter((r) => r?.platform === 'x')
        .map((r) => r.id);

      let candidates = [...new Set(fromAi)];
      let timelineName = '';
      if (!candidates.length) {
        if (probed++) await new Promise((r) => setTimeout(r, 1_500));
        const tl = await fetchXTimeline(handle);
        if (!tl) {
          if (lastWasRateLimit) rateLimited = true;
          else log.debug(`X @${handle}: 타임라인을 확인하지 못했습니다.`);
          continue;
        }
        timelineName = tl.name;
        candidates = tl.tweets
          .filter((t) => !t.isRetweet && daysAgo(t.createdAt) <= maxAge)
          .slice(0, 8)
          .map((t) => t.id);
      }

      /* 후보를 하나씩 실제로 확인한다.
       * 타임라인은 **이미 삭제된 트윗 ID 도 준다** — verifyTweet 주석 참고.
       * 검증을 통과한 것만 임베드한다. */
      let picked = null;
      for (const id of candidates) {
        const tw = await verifyTweet(id);
        if (!tw) continue;

        // 계정이 실제로 이 인물의 것인지 — codex 가 준 핸들도 여기서 다시 본다
        const nameForCheck = tw.authorName || timelineName;
        if (!configured && !profileMatches(nameForCheck, p.nameKo, p.nameEn)) {
          log.debug(
            `X @${tw.screenName}: 프로필 이름 "${nameForCheck}" 이 ${p.nameKo} 와 맞지 않아 건너뜁니다.`
          );
          continue;
        }
        if (FAN_HINTS.test(`${tw.screenName} ${tw.authorName}`)) {
          log.debug(`X @${tw.screenName}: 팬·비공식 계정으로 보여 건너뜁니다.`);
          continue;
        }
        if (sc.requirePhoto && !tw.photos.length) continue;
        if (daysAgo(tw.createdAt) > maxAge) continue;

        // 사안과 관련된 글을 우선하되, 없으면 가장 최근 글을 쓴다
        if (!picked || textRelevant(tw.text, nameTerms)) picked = tw;
        if (textRelevant(tw.text, nameTerms)) break;
      }

      if (!picked) {
        log.debug(`X @${handle}: 최근 ${maxAge}일 안에 살아 있는 조건 충족 게시물이 없습니다.`);
        continue;
      }

      found.push({
        platform: 'x',
        postId: picked.id,
        handle: picked.screenName,
        author: picked.authorName,
        photoCount: picked.photos.length,
        text: picked.text.slice(0, 140),
        createdAt: picked.createdAt,
      });
      log.ok(
        `X 근황: @${picked.screenName} (${picked.authorName}) · ` +
          `사진 ${picked.photos.length}장 · ${fmtDate(picked.createdAt)}`
      );
    }
    if (rateLimited) {
      log.warn('X 타임라인이 요청 제한(429)에 걸려 X 근황을 건너뜁니다.');
    }
  }

  /* ── 인스타그램 ──
   * 인스타는 계정의 최신 게시물 목록을 로그인 없이 얻을 수 없다.
   * 그래서 codex 가 검색에서 본 게시물 주소를 먼저 쓰고, 없으면 검색엔진으로 보완한다.
   * 어느 쪽이든 최종 판정은 `/embed/` 검증이 한다. */
  if (platforms.includes('instagram') && found.length < want) {
    for (const p of people) {
      if (found.length >= want) break;

      const acct = aiFor(p);
      const expected = String(acct?.instagramUsername || '').replace(/^@/, '').trim().toLowerCase();

      /* 인스타는 게시일을 알아낼 공개 경로가 하나도 없다 (2026-07-28 조사).
       * - `/embed/` 와 공식 oEmbed 응답에 게시일이 없다 (Time 값은 요청 시각이다)
       * - shortcode 를 디코딩해 시각을 얻는 방법은 샘플마다 오차가 7년·14년으로
       *   제각각이라 신뢰할 수 없었다. 추측한 상수로 거르면 조용히 틀린다.
       *
       * 그래서 **codex 가 확인한 게시일만이 유일한 근거**다.
       * 날짜가 없으면 최근 글인지 알 수 없으므로 쓰지 않는다 —
       * 몇 년 전 사진이 '최신 근황' 으로 실리는 것이 최악이다.
       * (실측: codex 가 효린 인스타로 준 유일한 주소가 2018년경 게시물이었다) */
      const fromAi = (acct?.recentPosts || [])
        .map((p2) => ({ parsed: parseSocialUrl(p2?.url), date: p2?.date, hasPhoto: p2?.hasPhoto }))
        .filter((r) => r.parsed?.platform === 'instagram');

      const dated = [];
      for (const r of fromAi) {
        if (!r.date) {
          log.debug(`인스타 ${r.parsed.id}: 게시일을 확인할 수 없어 건너뜁니다 (근황인지 알 수 없음).`);
          continue;
        }
        const age = daysAgo(r.date);
        if (age > maxAge) {
          log.debug(
            `인스타 ${r.parsed.id}: ${fmtDate(r.date)} 게시물이라 너무 오래됐습니다 ` +
              `(${Math.round(age)}일 전 · 기준 ${maxAge}일).`
          );
          continue;
        }
        if (sc.requirePhoto && r.hasPhoto === false) {
          log.debug(`인스타 ${r.parsed.id}: 사진이 없는 게시물이라 건너뜁니다.`);
          continue;
        }
        dated.push({ id: r.parsed.id, date: r.date });
      }

      /* codex 가 날짜 있는 게시물을 못 줬을 때의 폴백 두 단계:
       * ① 계정을 짚어 줬으면 **프로필 그리드를 직접 긁는다** — 그리드 순서가
       *    최신순이라 날짜 없이도 근황임이 보장된다 (scrapeProfilePosts 주석).
       *    (2026-07-30 실측 — 하트시그널5: codex 가 7명 전부 계정만 찾고
       *     게시물 0건이었는데, 프로필 수집으로 7명 전부 임베드에 성공했다)
       * ② 계정조차 없으면 검색엔진 보완 (날짜도 순서도 보장 없음 — 최후) */
      let codes = dated;
      if (!codes.length && expected) {
        codes = (await scrapeProfilePosts(expected)).map((id) => ({ id, date: '' }));
      }
      if (!codes.length) {
        codes = (await findInstagramPosts(p.nameKo, p.nameEn, { username: expected })).map((id) => ({
          id,
          date: '',
        }));
      }

      if (!codes.length) {
        log.debug(`인스타: ${p.nameKo} 의 최근 게시물을 확인하지 못했습니다.`);
        continue;
      }

      for (const { id: code, date: postDate } of codes) {
        const post = await verifyInstagramPost(code);
        if (!post) continue;
        // 영상 게시물은 '근황 사진' 역할을 못 한다 — X 쪽 기준과 맞춘다
        if (sc.requirePhoto && post.isVideo) {
          log.debug(`인스타 ${code}: 영상 게시물이라 건너뜁니다 (requirePhoto).`);
          continue;
        }
        if (FAN_HINTS.test(post.username)) {
          log.debug(`인스타 @${post.username}: 팬 계정으로 보여 건너뜁니다.`);
          continue;
        }
        // codex 가 공식 계정을 짚어 줬으면 그 계정의 게시물만 쓴다.
        // 못 짚어 줬을 때만 이름·공식 신호로 판단한다.
        const official = expected
          ? post.username.toLowerCase() === expected
          : OFFICIAL_HINTS.test(post.username) ||
            profileMatches(post.username, p.nameKo, p.nameEn);
        if (!official) {
          log.debug(
            `인스타 @${post.username}: ${p.nameKo} 의 공식 계정${
              expected ? `(@${expected})` : ''
            }이 아니라 건너뜁니다.`
          );
          continue;
        }
        found.push({
          platform: 'instagram',
          postId: post.shortcode,
          handle: post.username,
          author: post.username,
          photoCount: post.isVideo ? 0 : 1,
          text: '',
          createdAt: postDate || '',
        });
        log.ok(
          `인스타 근황: @${post.username} · ${post.shortcode}` +
            (postDate ? ` · ${fmtDate(postDate)}` : '')
        );
        break;
      }
    }
  }

  if (!found.length) {
    log.info('공식 SNS 근황 게시물을 확인하지 못해 임베드를 넣지 않습니다.');
    return [];
  }

  // 본문에 고르게 흩뿌린다 (youtube.js 와 같은 방식)
  const sectionCount = Math.max(1, (article.sections || []).length);
  const chosen = found.slice(0, want);
  return chosen.map((e, i) => ({
    ...e,
    afterSection: Math.min(
      sectionCount,
      Math.max(1, Math.round(((i + 1) * sectionCount) / (chosen.length + 1)) + 1)
    ),
  }));
}
