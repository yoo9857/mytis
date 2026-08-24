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
    const res = await ctx.get(url, { timeout: 30_000 });
    if (!res.ok()) throw new Error(`네이버 RSS 응답 ${res.status()}: ${url}`);
    return parseNaverRss(await res.text());
  } finally {
    await ctx.dispose();
  }
}

export function followStateFile(blogId) {
  return path.join(DIRS.logs, `follow-${blogId}.json`);
}

export function loadFollowState(blogId) {
  try {
    return JSON.parse(fs.readFileSync(followStateFile(blogId), 'utf8'));
  } catch {
    return null;
  }
}

export function saveFollowState(blogId, state) {
  fs.mkdirSync(DIRS.logs, { recursive: true });
  fs.writeFileSync(followStateFile(blogId), JSON.stringify(state, null, 2) + '\n', 'utf8');
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
  const unseen = newestFirst(items.filter((item) => !state.seen?.[item.id]));
  if (unseen.length) {
    return { selected: unseen[0], reason: 'new', pending: unseen.length - 1 };
  }

  const nowMs = now.getTime();
  const current = new Map(items.map((item) => [String(item.id), item]));
  const tracked = Object.entries(state.seen || {}).map(([id, saved]) => ({
    id,
    ...saved,
    ...(current.get(String(id)) || {}),
  }));
  const backlog = newestFirst(tracked.filter((saved) => {
    if (!saved?.id || (!saved.url && !current.has(String(saved.id)))) return false;
    if (state.category && saved.category && saved.category !== state.category) return false;
    if (saved.status === 'baseline' || saved.status === 'superseded' || saved.status === 'pending') return true;
    if (saved.status !== 'failed' || Number(saved.attempts || 1) >= 3) return false;
    const retryAt = new Date(saved.retryAfter || 0).getTime();
    return !Number.isFinite(retryAt) || retryAt <= nowMs;
  }));
  if (backlog.length) {
    const saved = state.seen?.[backlog[0].id];
    return {
      selected: backlog[0],
      reason: saved?.status === 'failed' ? 'retry' : 'backlog',
      pending: backlog.length - 1,
    };
  }
  return { selected: null, reason: 'empty', pending: 0 };
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
  }
  state.updatedAt = now;
  return state;
}
