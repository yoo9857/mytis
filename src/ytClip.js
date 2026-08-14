/**
 * 유튜브 영상 한 편을 글의 소재로 삼는다.
 *
 * 왜 이렇게 하나:
 *   "재미있는 장면을 캡처해서 올린다"는 방식은 방송·제작사 저작물을 복제하는 것이라
 *   쓸 수 없다. 대신 **자막(공개 데이터)에서 장면을 찾아내고, 그 지점부터 재생되는
 *   공식 영상 임베드**를 붙인다. 독자가 보는 것은 같은 장면이지만 원저작자 서버에서
 *   재생되므로 문제가 없고, 정지 캡처보다 체류시간도 길다.
 *
 * 영상 파일은 절대 내려받지 않는다 (`--skip-download`). 받는 것은 자막 텍스트뿐이다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { log } from './log.js';
import { DIRS } from './paths.js';

const YT_URL = /(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

/** 유튜브 주소인지, 그렇다면 영상 ID 는 무엇인지 */
export function parseYouTube(url) {
  const m = String(url || '').match(YT_URL);
  return m ? m[1] : null;
}

/** yt-dlp 를 돌리고 stdout 을 돌려준다. */
function runYtDlp(args, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn('yt-dlp', args, { windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      p.kill();
      reject(new Error(`yt-dlp 시간 초과 (${Math.round(timeoutMs / 1000)}초)`));
    }, timeoutMs);

    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) =>
      reject(
        new Error(
          e.code === 'ENOENT'
            ? 'yt-dlp 가 설치돼 있지 않습니다. `pip install -U yt-dlp` 로 설치하세요.'
            : e.message
        )
      )
    );
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(err.trim().split('\n').slice(-3).join(' ') || `yt-dlp 종료 코드 ${code}`));
    });
  });
}

/** json3 자막을 [{sec, text}] 로 편다. */
function parseJson3(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const lines = [];
  for (const e of j.events || []) {
    if (!e.segs) continue;
    const text = e.segs
      .map((s) => s.utf8 || '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) continue;
    lines.push({ sec: Math.round((e.tStartMs || 0) / 1000), text });
  }
  // 자동 자막은 같은 문장을 겹쳐 내보내는 경우가 있다 — 연속 중복 제거
  return lines.filter((l, i) => i === 0 || l.text !== lines[i - 1].text);
}

/** 초 → "m:ss" */
export function mmss(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * 영상 길이(초)만 빠르게 가져온다.
 *
 * 영화 모드가 **공식 예고편에 걸쳐 캡처 시각을 나눌 때** 쓴다. `fetchClip` 은
 * 자막까지 받아 오므로(자막 없는 예고편에서는 헛수고다) 길이만 필요한 자리에는 이걸 쓴다.
 */
export async function videoDuration(videoId) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(String(videoId || ''))) return 0;
  try {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(
      'yt-dlp',
      ['--skip-download', '--print', '%(duration)s', '--js-runtimes', 'node',
        `https://www.youtube.com/watch?v=${videoId}`],
      { encoding: 'utf8', maxBuffer: 8e6, timeout: 60_000 }
    );
    const n = parseInt(String(r.stdout || '').trim().split('\n').pop(), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * 영상 정보 + 자막을 가져온다.
 * @returns {Promise<{videoId,title,channel,uploadDate,duration,description,lines,transcript}|null>}
 */
export async function fetchClip(url, { subLang = 'ko', timeoutMs = 180_000 } = {}) {
  const videoId = parseYouTube(url);
  if (!videoId) return null;

  log.step('유튜브 자막 읽는 중 (영상은 내려받지 않음)');

  // 1) 메타데이터
  let meta = {};
  try {
    const raw = await runYtDlp(
      ['--dump-json', '--skip-download', '--no-warnings', `https://www.youtube.com/watch?v=${videoId}`],
      { timeoutMs }
    );
    meta = JSON.parse(raw.trim().split('\n').pop());
  } catch (err) {
    log.warn(`영상 정보 읽기 실패: ${err.message}`);
    return null;
  }

  // 2) 자막 (수동 자막 우선, 없으면 자동 생성)
  const dir = path.join(DIRS.tmp || '.tmp', 'subs');
  fs.mkdirSync(dir, { recursive: true });
  let lines = [];
  for (const flag of ['--write-subs', '--write-auto-subs']) {
    try {
      await runYtDlp(
        [flag, '--sub-langs', subLang, '--sub-format', 'json3', '--skip-download',
         '--no-warnings', '--paths', dir, '-o', '%(id)s.%(ext)s',
         `https://www.youtube.com/watch?v=${videoId}`],
        { timeoutMs }
      );
      const f = path.join(dir, `${videoId}.${subLang}.json3`);
      if (fs.existsSync(f)) {
        lines = parseJson3(f);
        if (lines.length) {
          log.ok(`자막 ${lines.length}줄 확보 (${flag === '--write-subs' ? '수동' : '자동 생성'})`);
          break;
        }
      }
    } catch (err) {
      log.debug(`${flag} 실패: ${err.message}`);
    }
  }
  if (!lines.length) log.warn('자막을 얻지 못했습니다. 장면 타임스탬프 없이 진행합니다.');

  return {
    videoId,
    title: meta.title || '',
    channel: meta.uploader || meta.channel || '',
    channelUrl: meta.channel_url || meta.uploader_url || '',
    uploadDate: meta.upload_date || '', // YYYYMMDD
    duration: meta.duration || 0,
    viewCount: meta.view_count || 0,
    description: (meta.description || '').slice(0, 1200),
    lines,
    // 프롬프트에 실을 형태: "0:21 어 여기"
    transcript: lines.map((l) => `${mmss(l.sec)} ${l.text}`).join('\n'),
  };
}

/**
 * codex 가 준 startSeconds 가 실제 자막에 있는 시각인지 검증한다.
 * 지어낸 타임스탬프를 넣으면 엉뚱한 장면이 재생되므로, 가장 가까운
 * 실제 자막 시각으로 스냅하고 너무 멀면 버린다.
 */
export function snapTimestamps(embeds, clip, { toleranceSec = 25 } = {}) {
  if (!clip?.lines?.length) return embeds;
  return (embeds || []).map((e) => {
    const want = Number(e.startSeconds) || 0;
    if (!want) return e;
    let best = null;
    for (const l of clip.lines) {
      if (best === null || Math.abs(l.sec - want) < Math.abs(best - want)) best = l.sec;
    }
    if (best === null || Math.abs(best - want) > toleranceSec) {
      log.warn(`타임스탬프 ${mmss(want)} 는 자막에 없는 지점이라 처음부터 재생합니다.`);
      return { ...e, startSeconds: 0 };
    }
    if (best !== want) log.debug(`타임스탬프 보정: ${mmss(want)} → ${mmss(best)}`);
    // 대사 시작 직전부터 보이도록 2초 앞에서 시작
    return { ...e, startSeconds: Math.max(0, best - 2) };
  });
}
