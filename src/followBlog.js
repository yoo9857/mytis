import fs from 'node:fs';
import path from 'node:path';
import { request } from 'playwright';
import { DIRS } from './paths.js';

const decodeXml = (s = '') =>
  String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

const field = (xml, name) => {
  const m = String(xml).match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return decodeXml(m?.[1] || '');
};

/** 네이버 블로그 RSS의 최근 글을 읽는다. 외부 XML 패키지를 늘리지 않는 좁은 파서다. */
export function parseNaverRss(xml) {
  return [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((m) => {
      const body = m[1];
      const guid = field(body, 'guid');
      const link = field(body, 'link');
      const canonical = (guid || link).replace(/[?&](?:fromRss|trackingCode)=[^&]+/g, '').replace(/[?&]$/, '');
      const logNo = canonical.match(/\/(\d{8,})\/?$/)?.[1] || '';
      return {
        id: logNo || canonical,
        title: field(body, 'title'),
        url: canonical,
        category: field(body, 'category'),
        publishedAt: field(body, 'pubDate'),
      };
    })
    .filter((x) => x.id && x.url);
}

export async function fetchNaverFeed(blogId) {
  if (!/^[A-Za-z0-9_-]+$/.test(blogId || '')) throw new Error(`블로그 아이디가 올바르지 않습니다: ${blogId}`);
  const ctx = await request.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127 Safari/537.36',
  });
  try {
    const url = `https://rss.blog.naver.com/${blogId}.xml`;
    return await retry(async () => {
      const res = await ctx.get(url, { timeout: 30_000 });
      if (!res.ok()) throw new Error(`네이버 RSS 응답 ${res.status()}: ${url}`);
      const items = parseNaverRss(await res.text());
      if (!items.length) throw new Error(`네이버 RSS가 비어 있습니다: ${url}`);
      return items;
    }, 3, 1_000);
  } finally {
    await ctx.dispose();
  }
}

export function followStateFile(blogId) {
  return path.join(DIRS.logs, `follow-${blogId}.json`);
}

export function loadFollowState(blogId) {
  const file = followStateFile(blogId);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    try {
      return JSON.parse(fs.readFileSync(`${file}.bak`, 'utf8'));
    } catch {
      return null;
    }
  }
}

export function saveFollowState(blogId, state) {
  fs.mkdirSync(DIRS.logs, { recursive: true });
  const file = followStateFile(blogId);
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
  fs.writeFileSync(temp, JSON.stringify(state, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, file);
}

export function seedFollowState(blogId, category, items) {
  const now = new Date().toISOString();
  const state = {
    blogId,
    category,
    initializedAt: now,
    updatedAt: now,
    seen: Object.fromEntries(
      items.map((item) => [item.id, { ...item, status: 'baseline', detectedAt: now }])
    ),
  };
  saveFollowState(blogId, state);
  return state;
}

const publishedTime = (item) => {
  const value = new Date(item?.publishedAt || '').getTime();
  return Number.isFinite(value) ? value : 0;
};

const newestFirst = (items) => items.slice().sort((a, b) => publishedTime(b) - publishedTime(a));

const REQUIRED_TARGETS = {
  happytigers: 'classic-m',
  ektha0108: 'eco-m',
};

/** 알려진 참고 블로그가 엉뚱한 티스토리로 발행되는 설정 사고를 차단한다. */
export function assertFollowTarget(blogId, targetBlog) {
  const source = String(blogId || '').trim().toLowerCase();
  const target = String(targetBlog || '').trim().toLowerCase().replace(/\.tistory\.com$/, '');
  const required = REQUIRED_TARGETS[source];
  if (required && target !== required) {
    throw new Error(`참고 블로그 연결 오류: ${source} 글은 ${required}.tistory.com 에만 발행할 수 있습니다.`);
  }
  return true;
}

const safeCount = (value) => {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

/** 공감·댓글·공유를 하나의 안정적인 인기 점수로 합친다. */
export function popularityScore(item = {}) {
  const likes = safeCount(item.likes ?? item.popularity?.likes);
  const comments = safeCount(item.comments ?? item.popularity?.comments);
  const shares = safeCount(item.shares ?? item.popularity?.shares);
  return likes * 3 + comments * 5 + shares * 8;
}

const popularFirst = (items) => items.slice().sort((a, b) => {
  const score = popularityScore(b) - popularityScore(a);
  if (score) return score;
  const likes = safeCount(b.likes ?? b.popularity?.likes) - safeCount(a.likes ?? a.popularity?.likes);
  if (likes) return likes;
  return publishedTime(b) - publishedTime(a);
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retry(fn, attempts = 3, baseDelayMs = 750) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

function extractCount(html, name) {
  const text = String(html || '');
  const patterns = [
    new RegExp(`${name}="(\\d+)"`, 'i'),
    new RegExp(`"${name}"\\s*:\\s*(\\d+)`, 'i'),
    new RegExp(`\\\\"${name}\\\\"\\s*:\\s*(\\d+)`, 'i'),
  ];
  for (const pattern of patterns) {
    const found = text.match(pattern);
    if (found) return safeCount(found[1]);
  }
  return 0;
}

/**
 * RSS에는 조회수가 없으므로 공개 공감 API와 모바일 글의 댓글·공유 수를 결합한다.
 * 인기 조회 실패는 발행 전체를 막지 않고 0점(최신순 동률 처리)으로 폴백한다.
 */
export async function enrichNaverPopularity(blogId, items, {
  concurrency = 4,
  timeoutMs = 12_000,
} = {}) {
  if (!items.length) return [];
  const ctx = await request.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127 Safari/537.36',
    extraHTTPHeaders: { Referer: `https://m.blog.naver.com/${blogId}` },
  });
  const result = items.map((item) => ({ ...item }));
  let cursor = 0;

  const inspect = async (item) => {
    const q = encodeURIComponent(`BLOG[${blogId}_${item.id}]`);
    const likeUrl = `https://blog.like.naver.com/v1/search/contents?suppress_response_codes=true&q=${q}`;
    const mobileUrl = `https://m.blog.naver.com/${blogId}/${item.id}`;
    try {
      const [likeJson, html] = await Promise.all([
        retry(async () => {
          const response = await ctx.get(likeUrl, { timeout: timeoutMs });
          if (!response.ok()) throw new Error(`like HTTP ${response.status()}`);
          return response.json();
        }, 2),
        retry(async () => {
          const response = await ctx.get(mobileUrl, { timeout: timeoutMs });
          if (!response.ok()) throw new Error(`post HTTP ${response.status()}`);
          return response.text();
        }, 2),
      ]);
      const content = likeJson?.contents?.find((entry) => entry.contentsId === `${blogId}_${item.id}`)
        || likeJson?.contents?.[0];
      const likes = safeCount(
        content?.reactions?.reduce((sum, reaction) => sum + safeCount(reaction.count), 0)
      );
      const comments = extractCount(html, 'commentCount');
      const shares = extractCount(html, 'shareCount');
      return { ...item, popularity: { likes, comments, shares, score: likes * 3 + comments * 5 + shares * 8 } };
    } catch (error) {
      return { ...item, popularity: { likes: 0, comments: 0, shares: 0, score: 0, unavailable: true, error: error.message } };
    }
  };

  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      result[index] = await inspect(items[index]);
    }
  });
  try {
    await Promise.all(workers);
    return result;
  } finally {
    await ctx.dispose();
  }
}

/** 네이버 글 주소의 logNo를 형식별로 읽는다(PostView URL·모바일 URL·일반 URL). */
export function sourcePostId(url = '') {
  const text = String(url);
  return text.match(/[?&]logNo=(\d{8,})/i)?.[1] || text.match(/\/(\d{8,})(?:[/?#]|$)/)?.[1] || '';
}

/**
 * 수동 발행도 자동 추적의 중복 방지 이력으로 합친다.
 *
 * out/*.json의 sourceUrl·urlSlug와 logs/*.log의 실제 "티스토리 발행 완료" 줄을
 * 함께 만족할 때만 발행 완료로 인정한다. 초안만 만든 JSON이나 캡차에서 멈춘 시도는
 * 완료 로그가 없으므로 잘못 제외되지 않는다.
 */
export function reconcilePublishedArtifacts(state, items, {
  outDir = DIRS.out,
  logsDir = DIRS.logs,
  now = new Date(),
} = {}) {
  const publishedBySlug = new Map();
  let logText = '';
  try {
    const files = fs.readdirSync(logsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.log'));
    logText = files.map((entry) => {
      try { return fs.readFileSync(path.join(logsDir, entry.name), 'utf8'); } catch { return ''; }
    }).join('\n');
  } catch {
    return [];
  }

  for (const match of logText.matchAll(/(?:티스토리 발행 완료|추적 발행 완료):\s*(https:\/\/[^\s]+?\/entry\/([a-z0-9-]+))(?:\s|$)/gi)) {
    publishedBySlug.set(match[2], match[1]);
  }
  if (!publishedBySlug.size) return [];

  const current = new Map(items.map((item) => [String(item.id), item]));
  const reconciled = [];
  let articles = [];
  try {
    articles = fs.readdirSync(outDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
  } catch {
    return [];
  }

  for (const entry of articles) {
    let article;
    try { article = JSON.parse(fs.readFileSync(path.join(outDir, entry.name), 'utf8')); } catch { continue; }
    const id = sourcePostId(article.sourceUrl);
    const slug = String(article.urlSlug || '').trim();
    const postUrl = publishedBySlug.get(slug);
    if (!id || !postUrl || (!current.has(id) && !state.seen?.[id])) continue;
    if (state.seen?.[id]?.status === 'published') continue;

    state.seen ||= {};
    state.seen[id] = {
      ...(current.get(id) || state.seen[id] || { id, url: article.sourceUrl }),
      status: 'published',
      postUrl,
      completedAt: state.seen[id]?.completedAt || now.toISOString(),
      reconciledAt: now.toISOString(),
    };
    reconciled.push(state.seen[id]);
  }
  if (reconciled.length) state.updatedAt = now.toISOString();
  return reconciled;
}

/** 실패 재시도 때 이미 완성된 최신 원고를 찾아 비싼 재생성을 건너뛴다. */
export function findLatestFollowArtifact(sourceUrl, { outDir = DIRS.out } = {}) {
  const wanted = sourcePostId(sourceUrl);
  if (!wanted || !fs.existsSync(outDir)) return '';
  const matches = [];
  for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const file = path.join(outDir, entry.name);
    let article;
    try { article = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (sourcePostId(article.sourceUrl) !== wanted) continue;
    if (!article.title || !(article.sections || []).length || !(article.imageBriefs || []).length) continue;
    matches.push({ file, mtime: fs.statSync(file).mtimeMs });
  }
  matches.sort((a, b) => b.mtime - a.mtime);
  return matches[0]?.file || '';
}

/** 사진 후보 자체가 부족했던 실패는 같은 JSON을 재사용하면 반드시 똑같이 실패한다. */
export function shouldRegenerateFollowArtifact(error = '') {
  return /기사 사진이\s*\d+장뿐|기사 사진 안전 검사 실패|photos:\s*\d+\s*\(규격/i.test(String(error));
}

/**
 * 한 실행에 발행할 글 하나를 고른다.
 *
 * 1. 아직 상태에 없는 새 글이 있으면 그중 최신 글
 * 2. 새 글이 없으면 baseline·superseded 상태인 과거 미작성 글 중 최신 글
 * 3. 실패 글은 5시간 뒤 재시도하되 3회 실패하면 자동 대기열에서 제외
 *
 * 선택하지 않은 글은 상태를 바꾸지 않는다. 다음 5시간 주기에서 다시 후보가 된다.
 */
export function selectNextFollowItem(items, state, now = new Date()) {
  const nowMs = now.getTime();
  const current = new Map(items.map((item) => [String(item.id), item]));
  const unseen = items.filter((item) => !state.seen?.[item.id]);
  const tracked = Object.entries(state.seen || {}).map(([id, saved]) => ({
    id,
    ...saved,
    ...(current.get(String(id)) || {}),
  }));
  const backlog = tracked.filter((saved) => {
    if (!saved?.id || (!saved.url && !current.has(String(saved.id)))) return false;
    if (state.category && saved.category && saved.category !== state.category) return false;
    if (saved.status === 'baseline' || saved.status === 'superseded' || saved.status === 'pending') return true;
    if (saved.status !== 'failed') return false;
    const retryAt = new Date(saved.retryAfter || 0).getTime();
    return !Number.isFinite(retryAt) || retryAt <= nowMs;
  });

  // 실패 후보 하나가 계속 전체 대기열을 막지 않도록 정상 후보를 먼저 처리한다.
  const healthy = popularFirst([...unseen, ...backlog.filter((item) => item.status !== 'failed')]);
  const retries = popularFirst(backlog.filter((item) => item.status === 'failed'))
    .sort((a, b) => Number(a.attempts || 0) - Number(b.attempts || 0));
  const candidates = healthy.length ? healthy : retries;
  if (candidates.length) {
    const selected = candidates[0];
    const saved = state.seen?.[selected.id];
    return {
      selected,
      reason: !saved ? 'new' : saved.status === 'failed' ? 'retry' : 'backlog',
      pending: healthy.length + retries.length - 1,
    };
  }
  return { selected: null, reason: 'empty', pending: 0 };
}

/** 실패 원인과 누적 횟수에 따라 10분~24시간 사이에서 다시 시도한다. */
export function followRetryDelayMs(error = '', attempts = 1) {
  const message = String(error);
  const transient = /timeout|timed out|net::|ECONN|ENOTFOUND|HTTP 429|HTTP 5\d\d|로그인|세션|브라우저|navigation|captcha|틀린그림|dkaptcha/i.test(message);
  const base = transient ? 10 * 60_000 : 30 * 60_000;
  return Math.min(24 * 60 * 60_000, base * 2 ** Math.max(0, Number(attempts) - 1));
}

/** Codex 사용량 제한처럼 모든 글에 공통인 차단은 글별 실패와 분리한다. */
export function usageLimitRetryAt(error = '', now = new Date()) {
  const message = String(error);
  if (!/usage limit|purchase more credits|try again at|사용량.*한도|크레딧/i.test(message)) return null;
  const retry = new Date(now);
  const clock = message.match(/try again at\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!clock) return new Date(now.getTime() + 4 * 60 * 60_000);
  let hour = Number(clock[1]) % 12;
  if (clock[3].toUpperCase() === 'PM') hour += 12;
  retry.setHours(hour, Number(clock[2]), 0, 0);
  if (retry.getTime() <= now.getTime()) retry.setDate(retry.getDate() + 1);
  return retry;
}

/** 같은 Chrome 프로필을 쓰는 서로 다른 follow 작업의 동시 실행을 막는다. */
export async function acquireFollowLock({
  lockFile = path.join(DIRS.logs, 'follow-publish.lock'),
  owner = '',
  waitMs = 30 * 60_000,
  pollMs = 5_000,
  staleMs = 3 * 60 * 60_000,
  now = () => Date.now(),
} = {}) {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const token = `${process.pid}-${now()}-${Math.random().toString(16).slice(2)}`;
  const deadline = now() + waitMs;

  while (true) {
    try {
      const fd = fs.openSync(lockFile, 'wx');
      fs.writeFileSync(fd, JSON.stringify({ token, owner, pid: process.pid, startedAt: new Date(now()).toISOString() }));
      fs.closeSync(fd);
      return () => {
        try {
          const held = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
          if (held.token === token) fs.rmSync(lockFile, { force: true });
        } catch {
          // 이미 정리됐거나 손상된 잠금은 해제할 것이 없다.
        }
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let stale = false;
      try {
        const held = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
        const started = new Date(held.startedAt || 0).getTime();
        let ownerAlive = true;
        const ownerPid = Number(held.pid);
        if (!Number.isInteger(ownerPid) || ownerPid <= 0) {
          ownerAlive = false;
        } else {
          try {
            process.kill(ownerPid, 0);
          } catch (error) {
            // EPERM은 프로세스가 있지만 조회 권한만 없다는 뜻이다.
            ownerAlive = error.code === 'EPERM';
          }
        }
        stale = !ownerAlive || !Number.isFinite(started) || now() - started > staleMs;
      } catch {
        stale = true;
      }
      if (stale) {
        fs.rmSync(lockFile, { force: true });
        continue;
      }
      if (now() >= deadline) throw new Error(`다른 자동발행 작업이 실행 중입니다 (${owner || 'follow'} 대기 시간 초과).`);
      await delay(Math.min(pollMs, Math.max(1, deadline - now())));
    }
  }
}

/** Preserve every newly observed item that was not selected in this cycle. */
export function queueUnselectedNew(state, items, selectedId = '', now = new Date()) {
  state.seen ||= {};
  const queued = items.filter((item) => (
    String(item.id) !== String(selectedId) && !state.seen[item.id]
  ));
  if (!queued.length) return queued;

  const detectedAt = now.toISOString();
  for (const item of queued) {
    state.seen[item.id] = { ...item, status: 'pending', detectedAt };
  }
  state.updatedAt = detectedAt;
  return queued;
}

/** 기존 호출부·외부 사용자를 위한 호환 래퍼. 새 글만 고르는 옛 의미를 유지한다. */
export function selectLatestNew(items, state) {
  const unseen = newestFirst(items.filter((item) => !state.seen?.[item.id]));
  return { selected: unseen[0] || null, skipped: unseen.slice(1) };
}

export function recordDetected(state, items, status, extra = {}) {
  const now = new Date().toISOString();
  state.seen ||= {};
  for (const item of items) {
    state.seen[item.id] = { ...item, status, detectedAt: now, ...extra };
    if (status === 'published') {
      // 재시도 성공 뒤 과거 실패 정보가 남으면 운영 화면에서 여전히 실패처럼 보인다.
      delete state.seen[item.id].error;
      delete state.seen[item.id].attempts;
      delete state.seen[item.id].retryAfter;
    }
  }
  state.updatedAt = now;
  return state;
}
