/**
 * 유튜브 영상에서 **지정한 순간의 화면만** 캡처한다.
 *
 * 방식: 브라우저로 영상을 재생하고 그 지점으로 이동시킨 뒤 화면을 찍는다.
 *       영상 파일을 내려받지 않는다 — 사람이 직접 캡처하는 것과 같은 동작이다.
 *
 * ⚠️ 반드시 지켜야 할 것 (전부 실측으로 확인한 함정이다, 2026-07-27)
 *
 *   1) **일반 시청 페이지(/watch)를 써야 한다.**
 *      `youtube.com/embed/...` 를 최상위 페이지로 열면 유튜브가
 *      **"오류 153 · 동영상 플레이어 구성 오류"** 를 내고 재생을 거부한다.
 *      임베드는 정상 origin 의 iframe 안에 있을 때만 동작한다.
 *
 *   2) **설치된 Chrome(channel:'chrome')을 써야 한다.**
 *      Playwright 번들 Chromium 에는 H.264 등 독점 코덱이 없다.
 *
 *   3) **headless 를 쓰지 않는다.** 창이 떠 있어야 안정적으로 재생된다.
 *
 * ⚠️ 캡처 이미지는 제작사 저작물이다. 해설·비평에 필요한 최소한만 쓰고,
 *    화면의 로고·워터마크를 지우지 않는다. 출처(채널명)를 함께 남긴다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { log } from './log.js';
import { DIRS, stamp, safeSlug } from './paths.js';

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** 얼굴 선별 스크립트를 돌려 JSON 을 받는다. */
function runJson(cmd, args, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { p.kill(); reject(new Error('시간 초과')); }, timeoutMs);
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => reject(new Error(e.message)));
    p.on('close', () => {
      clearTimeout(timer);
      try { resolve(JSON.parse(out.trim().split('\n').pop())); }
      catch { reject(new Error(err.trim().slice(-120) || 'JSON 파싱 실패')); }
    });
  });
}

/**
 * @param {string} videoId 11자리 유튜브 ID
 * @param {number[]} seconds 캡처할 시각(초)
 * @param {object} opts
 * @param {number} [opts.candidates] 한 장면당 후보 프레임 수 (얼굴 잘 나온 걸 고르려고)
 * @returns {Promise<Array<{sec:number,file:string}>>}
 */
export async function captureFrames(videoId, seconds, { title = '', candidates = 8, headless = true } = {}) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || !seconds?.length) return [];

  const work = path.join(DIRS.tmp, 'cand');
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  fs.mkdirSync(DIRS.photos, { recursive: true });
  const prefix = `${stamp()}-${safeSlug(title || videoId, 'clip')}`;

  log.step(`장면 캡처 ${seconds.length}장 (재생 화면 캡처 · 영상 파일은 받지 않음)`);

  let browser;
  try {
    browser = await chromium.launch({
      channel: 'chrome', // 번들 Chromium 은 코덱이 없어 재생하지 못한다
      headless, // 창이 뜨면 작업에 방해되므로 기본은 숨김
      args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
    });
  } catch (err) {
    log.warn(`Chrome 을 실행하지 못해 캡처를 건너뜁니다: ${err.message.split('\n')[0]}`);
    return [];
  }

  const out = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    // 임베드가 아니라 일반 시청 페이지여야 한다 (오류 153 회피)
    await page.goto(`https://www.youtube.com/watch?v=${videoId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    try {
      await page.locator('button.ytp-large-play-button, .ytp-play-button').first().click({ timeout: 3000 });
    } catch {}

    const ready = await page
      .waitForFunction(() => {
        const v = document.querySelector('video');
        return v && v.readyState >= 3 && v.videoWidth > 0;
      }, { timeout: 40_000 })
      .then(() => true)
      .catch(() => false);
    if (!ready) {
      const err = await page.evaluate(() => document.querySelector('.ytp-error')?.innerText?.slice(0, 120) || null);
      log.warn(`재생이 시작되지 않아 캡처를 건너뜁니다${err ? ` (${err})` : ''}`);
      return [];
    }

    // 광고·오버레이 정리
    await page.addStyleTag({
      content: `.ytp-chrome-top,.ytp-chrome-bottom,.ytp-gradient-top,.ytp-gradient-bottom,
                .ytp-ce-element,.ytp-pause-overlay,.ytp-watermark,.iv-branding,
                .ytp-caption-window-container{display:none !important}`,
    });

    for (const sec of seconds) {
      const dir = path.join(work, `s${Math.round(sec)}`);
      fs.mkdirSync(dir, { recursive: true });
      const shots = [];

      /* 한 지점에서 여러 장을 찍는다.
       * 한 장만 찍으면 카메라가 멀 때 방 전경만 나온다.
       * 독자가 보고 싶은 건 그 순간의 표정이다. */
      for (let i = 0; i < candidates; i++) {
        const t = sec + i * 0.6;
        try {
          await page.evaluate(async (tt) => {
            const v = document.querySelector('video');
            v.muted = true;
            v.currentTime = tt;
            try { await v.play(); } catch {}
          }, t);
          await page.waitForFunction(
            (tt) => {
              const v = document.querySelector('video');
              return v && Math.abs(v.currentTime - tt) < 0.8 && v.readyState >= 3;
            },
            t,
            { timeout: 8000 }
          );
          await page.waitForTimeout(180);
          const f = path.join(dir, `c${String(i).padStart(2, '0')}.jpg`);
          const el = await page.$('video');
          await el.screenshot({ path: f, type: 'jpeg', quality: 92 });
          shots.push(f);
        } catch {
          /* 이 후보는 건너뛴다 */
        }
      }

      if (!shots.length) {
        log.warn(`${mmss(sec)} 캡처 실패 (후보 없음)`);
        continue;
      }

      // 얼굴이 가장 잘 나온 한 장 고르기
      let picked = shots[0];
      let note = '';
      try {
        const res = await runJson('python', [
          path.join(DIRS.root, 'scripts', 'pick_face_frame.py'),
          ...shots,
        ]);
        if (res?.best) {
          picked = res.best;
          note = res.faces ? ` · 얼굴 ${res.faces}개, 최대 ${res.biggest}%` : ' · 얼굴 없음';
        }
      } catch (err) {
        log.debug(`얼굴 선별 실패, 첫 후보 사용: ${err.message.slice(0, 70)}`);
      }

      const file = path.join(DIRS.photos, `${prefix}-shot${Math.round(sec)}.jpg`);
      fs.copyFileSync(picked, file);
      out.push({ sec, file });
      log.debug(`캡처 ${mmss(sec)} → ${path.basename(file)} (${shots.length}장 중 선택${note})`);
    }
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(work, { recursive: true, force: true });
  }

  if (out.length) log.ok(`장면 캡처 ${out.length}장 확보`);
  else log.warn('장면 캡처를 얻지 못했습니다. 임베드만으로 진행합니다.');
  return out;
}
