import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DIRS = {
  root: ROOT,
  src: path.join(ROOT, 'src'),
  schema: path.join(ROOT, 'src', 'schema'),
  out: path.join(ROOT, 'out'),
  images: path.join(ROOT, 'out', 'images'),
  photos: path.join(ROOT, 'out', 'photos'),
  logs: path.join(ROOT, 'logs'),
  profile: path.join(ROOT, 'profile'),
  shots: path.join(ROOT, 'logs', 'shots'),
  tmp: path.join(ROOT, '.tmp'),
};

export const FILES = {
  config: path.join(ROOT, 'config.json'),
  env: path.join(ROOT, '.env'),
  topics: path.join(ROOT, 'topics.txt'),
  done: path.join(ROOT, 'topics.done.txt'),
  failed: path.join(ROOT, 'topics.failed.txt'),
  articleSchema: path.join(ROOT, 'src', 'schema', 'article.schema.json'),
  bookSchema: path.join(ROOT, 'src', 'schema', 'book.schema.json'),
  movieSchema: path.join(ROOT, 'src', 'schema', 'movie.schema.json'),
  photosSchema: path.join(ROOT, 'src', 'schema', 'photos.schema.json'),
  newsfeedSchema: path.join(ROOT, 'src', 'schema', 'newsfeed.schema.json'),
  socialSchema: path.join(ROOT, 'src', 'schema', 'social.schema.json'),
  radarSchema: path.join(ROOT, 'src', 'schema', 'radar.schema.json'),
  /** 선점 레이더가 뽑은 일정 — 성과를 되먹이는 자리이므로 지우지 않고 누적한다 */
  radar: path.join(ROOT, 'radar.json'),
};

export function ensureDirs() {
  for (const dir of Object.values(DIRS)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** 파일명으로 안전한 슬러그 (한글 유지, 경로 문자 제거) */
export function safeSlug(text, fallback = 'post') {
  const cleaned = String(text || '')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return cleaned || fallback;
}

/** 로컬 시간 기준 날짜 (YYYY-MM-DD).
 *
 * `toISOString().slice(0,10)` 을 쓰면 **UTC 날짜**가 나온다. KST 는 +9 이므로
 * 오전 9시 이전에 돌리면 하루 전 날짜가 찍힌다.
 *
 * > 2026-08-01 08:22 KST 실측: books.done.txt 에 `[2026-07-31]` 이 기록되고,
 * > 집필 지시문의 '오늘 날짜' 도 07-31 로 갔다. 화제성 글에서 "어제 발표" 가
 * > "이틀 전" 이 되므로 시의성 판단이 어긋난다.
 *
 * **'오늘' 을 뜻하는 자리에는 toISOString 을 쓰지 마세요.**
 */
export function todayStr(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** 로컬 시간 기준 타임스탬프 (파일명용) */
export function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  );
}
