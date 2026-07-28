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
  photosSchema: path.join(ROOT, 'src', 'schema', 'photos.schema.json'),
  newsfeedSchema: path.join(ROOT, 'src', 'schema', 'newsfeed.schema.json'),
  socialSchema: path.join(ROOT, 'src', 'schema', 'social.schema.json'),
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

/** 로컬 시간 기준 타임스탬프 (파일명용) */
export function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  );
}
