import fs from 'node:fs';
import path from 'node:path';
import { DIRS } from './paths.js';

const LEVEL_COLORS = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  step: '\x1b[35m',
  ok: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

let logStream = null;
let verbose = process.env.MONEYTI_VERBOSE === '1';

function logFilePath() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return path.join(DIRS.logs, `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.log`);
}

function stream() {
  if (!logStream) {
    fs.mkdirSync(DIRS.logs, { recursive: true });
    logStream = fs.createWriteStream(logFilePath(), { flags: 'a' });
  }
  return logStream;
}

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function write(level, args) {
  const msg = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a, null, 2)))
    .join(' ');
  const line = `[${ts()}] ${level.toUpperCase().padEnd(5)} ${msg}`;
  try {
    stream().write(line + '\n');
  } catch {
    /* 로그 파일 실패는 무시 */
  }
  const color = LEVEL_COLORS[level] || '';
  process.stdout.write(`${color}${line}${RESET}\n`);
}

export const log = {
  setVerbose(v) {
    verbose = v;
  },
  debug: (...a) => verbose && write('debug', a),
  info: (...a) => write('info', a),
  step: (...a) => write('step', a),
  ok: (...a) => write('ok', a),
  warn: (...a) => write('warn', a),
  error: (...a) => write('error', a),
  /** 진행 구분선 */
  banner(text) {
    const bar = '─'.repeat(Math.max(0, 58 - [...text].length));
    process.stdout.write(`\n\x1b[1m▶ ${text} ${bar}\x1b[0m\n`);
    try {
      stream().write(`\n=== ${text} ===\n`);
    } catch {
      /* noop */
    }
  },
};

export function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}초`;
  return `${Math.floor(s / 60)}분 ${s % 60}초`;
}
