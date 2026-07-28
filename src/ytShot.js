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
 *   3) **headless 로 돌린다.** 예전에는 창이 떠 있어야 재생이 안정적이었지만,
 *      장면마다 `?t=<초>s` 로 새로 여는 방식으로 바꾼 뒤로는 headless 에서도
 *      문제없이 동작한다 (2026-07-28 실측: 10초에 성공).
 *      창을 띄우면 장면 수만큼 브라우저가 떴다 새로고침돼 **화면이 깜빡인다.**
 *
 * ⚠️ 캡처 이미지는 제작사 저작물이다. 해설·비평에 필요한 최소한만 쓰고,
 *    화면의 로고·워터마크를 지우지 않는다. 출처(채널명)를 함께 남긴다.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { log } from "./log.js";
import { DIRS, stamp, safeSlug } from "./paths.js";

const mmss = (s) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** 얼굴 선별 스크립트를 돌려 JSON 을 받는다. */
function runJson(cmd, args, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      p.kill();
      reject(new Error("시간 초과"));
    }, timeoutMs);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => reject(new Error(e.message)));
    p.on("close", () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(out.trim().split("\n").pop()));
      } catch {
        reject(new Error(err.trim().slice(-120) || "JSON 파싱 실패"));
      }
    });
  });
}

/** 지금 광고가 재생 중인가 */
function adShowing(page) {
  return page
    .evaluate(() => {
      const p = document.querySelector("#movie_player");
      return !!(
        (p && p.classList.contains("ad-showing")) ||
        document.querySelector(
          ".ytp-ad-player-overlay, .ytp-ad-overlay-container",
        )
      );
    })
    .catch(() => false);
}

/**
 * 광고가 끝날 때까지 처리한다. 건너뛸 수 있으면 누르고, 아니면 기다린다.
 *
 * 광고 중에 화면을 찍으면 **광고가 '장면 캡처' 로 발행된다.** 반드시 막아야 한다.
 * 건너뛰기 버튼은 보통 5초쯤 뒤에 나타나므로 주기적으로 다시 살핀다.
 */
async function clearAds(page, { timeoutMs = 45_000 } = {}) {
  const until = Date.now() + timeoutMs;
  let sawAd = false;

  while (Date.now() < until) {
    if (!(await adShowing(page))) {
      if (sawAd) log.debug("광고 종료 — 캡처를 이어갑니다.");
      return true;
    }
    if (!sawAd) {
      sawAd = true;
      log.debug("광고 재생 중 — 끝나기를 기다립니다.");
    }
    // 건너뛰기 버튼은 몇 초 뒤에야 활성화된다
    for (const sel of [
      ".ytp-skip-ad-button",
      ".ytp-ad-skip-button",
      ".ytp-ad-skip-button-modern",
      'button[id^="skip-button"]',
    ]) {
      try {
        await page.locator(sel).first().click({ timeout: 800 });
        log.debug("광고 건너뛰기를 눌렀습니다.");
        break;
      } catch {
        /* 아직 안 나왔거나 건너뛸 수 없는 광고다 */
      }
    }
    await page.waitForTimeout(1000);
  }

  log.warn(
    "광고가 끝나지 않았습니다 — 이 장면은 건너뜁니다 (광고 화면을 싣지 않기 위해).",
  );
  return false;
}

/**
 * @param {string} videoId 11자리 유튜브 ID
 * @param {number[]} seconds 캡처할 시각(초)
 * @param {object} opts
 * @param {number} [opts.candidates] 한 장면당 후보 프레임 수 (얼굴 잘 나온 걸 고르려고)
 * @returns {Promise<Array<{sec:number,file:string}>>}
 */
export async function captureFrames(
  videoId,
  seconds,
  { title = "", candidates = 5, headless = true } = {},
) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || !seconds?.length) return [];

  const work = path.join(DIRS.tmp, "cand");
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  fs.mkdirSync(DIRS.photos, { recursive: true });
  const prefix = `${stamp()}-${safeSlug(title || videoId, "clip")}`;

  log.step(
    `장면 캡처 ${seconds.length}장 (재생 화면 캡처 · 영상 파일은 받지 않음)`,
  );

  let browser;
  try {
    browser = await chromium.launch({
      channel: "chrome", // 번들 Chromium 은 코덱이 없어 재생하지 못한다
      headless, // 창이 뜨면 작업에 방해되므로 기본은 숨김
      args: ["--mute-audio", "--autoplay-policy=no-user-gesture-required"],
    });
  } catch (err) {
    log.warn(
      `Chrome 을 실행하지 못해 캡처를 건너뜁니다: ${err.message.split("\n")[0]}`,
    );
    return [];
  }

  /* 가까운 장면끼리 묶는다.
   *
   * `?t=<초>s` 로 한 번 열면 버퍼가 그 지점부터 **약 25초 구간**을 덮는다
   * (실측: 161초 로드 → buffered [161,185]). 그 안의 다른 장면은 페이지를
   * 다시 열 필요 없이 정지 상태 seek 만으로 수십 ms 에 찍힌다.
   *
   * 장면 하나당 페이지를 새로 열면 13초씩 드는데, 사진을 20~30장 쓰려면
   * 그것만으로 6분이 넘는다. 묶으면 로드 횟수가 크게 준다. */
  const BUFFER_SPAN = 18; // 25초 창에서 안전 여유를 뺀 값
  const groups = [];
  for (const sec of [...seconds].sort((a, b) => a - b)) {
    const last = groups[groups.length - 1];
    if (last && sec - last[0] <= BUFFER_SPAN) last.push(sec);
    else groups.push([sec]);
  }
  if (groups.length < seconds.length) {
    log.debug(
      `장면 ${seconds.length}개 → 페이지 로드 ${groups.length}회로 묶음`,
    );
  }

  const out = [];
  try {
    // 1080p 원본을 그대로 담으려면 뷰포트가 그만큼 커야 한다 (아래 화질 주석 참고)
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });

    for (const group of groups) {
      const sec = group[0];
      /* **장면마다 그 시각을 URL 에 넣어 새로 연다.**
       *
       * 한 번 열어 두고 프로그램으로 이동하는 방식은 전부 실패했다 (2026-07-28 실측).
       *   · `v.currentTime = t` (정지 상태) → 유튜브가 새 구간을 아예 받아오지 않는다.
       *     currentTime 만 목표값이 되고 readyState 1 · seeking true 로 굳는다.
       *   · `v.currentTime = t` + `play()`  → 재생은 되지만 buffered 가 [0,37] 에서
       *     늘지 않는다. MSE 라 플레이어가 버퍼를 직접 관리하기 때문이다.
       *   · `#movie_player.seekTo(t, true)` → **플레이어가 리셋된다.**
       *     currentTime 0 · readyState 0 · buffered 빈 배열.
       * 그 결과 3장 중 1장만 캡처되고 12분이 걸렸다.
       *
       * `?t=<초>s` 로 열면 유튜브가 그 지점부터 로드하며 버퍼도 그곳에 잡힌다.
       * 실측: 161초 → 7초 만에 buffered [161,185] · 360초 → 19초 만에 [360,385].
       * 페이지를 다시 여는 비용이 있지만 확실하다.
       *
       * 임베드가 아니라 일반 시청 페이지여야 한다 (오류 153 회피 — 머리말 참고). */
      await page.goto(
        `https://www.youtube.com/watch?v=${videoId}&t=${Math.round(sec)}s`,
        {
          waitUntil: "domcontentloaded",
        },
      );
      await page.waitForTimeout(3000);
      try {
        await page
          .locator("button.ytp-large-play-button, .ytp-play-button")
          .first()
          .click({ timeout: 2500 });
      } catch {}

      /* 광고를 먼저 털어낸다.
       *
       * 광고가 재생 중이면 `<video>` 에 흐르는 것은 **본편이 아니라 광고**다.
       * 그대로 찍으면 광고 화면이 '장면 캡처' 로 발행된다. 가장 나쁜 실패다.
       * 게다가 광고 중에는 currentTime 이 광고 기준이라 시각 판정도 어긋난다.
       *
       * 유튜브는 광고 중 `#movie_player` 에 `.ad-showing` 을 붙인다.
       * 건너뛰기 버튼이 나오면 누르고, 없으면(건너뛸 수 없는 광고) 끝날 때까지 기다린다. */
      await clearAds(page);

      const ready = await page
        .waitForFunction(
          (tt) => {
            const v = document.querySelector("video");
            const p = document.querySelector("#movie_player");
            if (p && p.classList.contains("ad-showing")) return false; // 아직 광고다
            return (
              v &&
              v.readyState >= 3 &&
              v.videoWidth > 0 &&
              Math.abs(v.currentTime - tt) < 10
            );
          },
          sec,
          { timeout: 60_000 },
        )
        .then(() => true)
        .catch(() => false);

      if (!ready) {
        const err = await page.evaluate(
          () =>
            document.querySelector(".ytp-error")?.innerText?.slice(0, 120) ||
            null,
        );
        log.warn(
          `${mmss(sec)} 구간을 불러오지 못했습니다${err ? ` (${err})` : ""} — 건너뜁니다.`,
        );
        continue;
      }

      /* 화질을 끌어올린다. 두 가지를 **함께** 해야 한다.
       *
       * 유튜브는 플레이어 크기에 맞춰 스트림 화질을 고르고,
       * `el.screenshot()` 은 비디오 요소의 **CSS 크기**로 찍는다.
       * 둘 중 하나만 손보면 여전히 저화질이 나온다.
       *
       * > 2026-07-28 실측 (같은 영상, 원본은 1080p):
       * >   1280x900  뷰포트          → CSS 880x495   ← 누가 봐도 저화질
       * >   1920x1080 뷰포트          → CSS 1344x756
       * >   1920x1080 + 전체화면      → CSS 1920x1080 ← 원본 그대로
       * > 화질 지정을 안 하면 videoWidth 자체가 854(480p)로 내려간다.
       *
       * 그래서 ① setPlaybackQualityRange 로 소스를 1080p 로 올리고
       *        ② 전체화면으로 렌더 크기를 원본에 맞춘다. */
      await page.evaluate(() => {
        const p = document.querySelector("#movie_player");
        if (!p) return;
        try {
          p.setPlaybackQualityRange?.("hd1080", "hd1080");
        } catch {}
        try {
          if (!document.fullscreenElement) p.toggleFullscreen?.();
        } catch {}
      });
      await page
        .waitForFunction(
          () => {
            const v = document.querySelector("video");
            return (
              v &&
              v.videoWidth >= 1280 &&
              v.getBoundingClientRect().width >= 1280
            );
          },
          null,
          { timeout: 10_000 },
        )
        .catch(() =>
          log.debug("고화질 전환이 확인되지 않았습니다 — 그대로 진행합니다."),
        );

      /* 광고·오버레이 정리 — 페이지를 새로 열 때마다 다시 넣어야 한다.
       * 전체화면 전환 뒤에 넣어야 전체화면용 컨트롤까지 함께 가려진다.
       * ⚠️ 채널 워터마크(.annotation, .ytp-watermark)는 **지우지 않는다** —
       *    출처 표시를 제거하면 안 된다 (머리말 참고). */
      /* ⚠️ `.ytp-chrome-top` 만 지우면 **전체화면에서는 안 지워진다.**
       * 유튜브가 전체화면 오버레이에 새 클래스 체계를 쓰기 때문이다.
       *
       * > 2026-07-28 실측 — 발행된 대표 이미지 상단에 영상 제목이
       * > "영숙의 마음을 열기 위한 두 남자의 웃음기 싹 뺀 진지 모먼트 // 23-30"
       * > 그대로 찍혀 나왔고, 하단에는 좋아요 버튼이 남았다.
       * > 해당 요소는 `.ytp-overlay-top-left > .ytPlayerOverlayVideoDetailsRendererHost`
       * > 와 `.ytp-overlay-bottom-right > .ytPlayerQuickActionButtonsHost` 였다.
       *
       * `.ytp-overlays-container` 가 이것들의 공통 부모라 그걸 지우는 것이 확실하다.
       * 개별 클래스도 함께 적어 둔다 — 유튜브가 부모 클래스명을 바꿔도 버티도록. */
      await page.addStyleTag({
        content: `.ytp-overlays-container,.ytp-overlay-top-left,.ytp-overlay-bottom-right,
                  .ytPlayerOverlayVideoDetailsRendererHost,.ytPlayerQuickActionButtonsHost,
                  .ytp-chrome-top,.ytp-chrome-bottom,.ytp-gradient-top,.ytp-gradient-bottom,
                  .ytp-ce-element,.ytp-pause-overlay,.iv-branding,
                  .ytp-caption-window-container{display:none !important}`,
      });
      // 여기까지 왔으면 URL 로드로 이 구간이 이미 버퍼에 잡혀 있다.
      // 버퍼 안에서는 정지 상태 seek 이 수십 ms 로 끝나므로,
      // 같은 그룹의 장면들은 페이지를 다시 열지 않고 이어서 찍는다.
      await page.evaluate(() => {
        const v = document.querySelector("video");
        v.muted = true;
        v.pause();
      });

      for (const shotSec of group) {
        const dir = path.join(work, `s${Math.round(shotSec)}`);
        fs.mkdirSync(dir, { recursive: true });
        const shots = [];

        /* 한 지점에서 여러 장을 찍는다.
         * 한 장만 찍으면 카메라가 멀 때 방 전경만 나온다.
         * 독자가 보고 싶은 건 그 순간의 표정이다. */
        for (let i = 0; i < candidates; i++) {
          const t = shotSec + i * 0.6;
          try {
            /* **일시정지한 채로 seek 한다.** 재생시켜 두면 안 된다.
             *
             * 예전에는 `v.play()` 후 `|currentTime - tt| < 0.8` 을 기다렸는데,
             * 목표 지점이 버퍼에 없으면 버퍼링 동안 readyState 가 떨어지고,
             * 버퍼링이 끝나면 재생이 이어져 **0.8초 창을 지나쳐 버린다.**
             * 조건이 영영 참이 되지 않아 8초 타임아웃만 반복됐다.
             *
             * > 2026-07-28 실측: 0:29(버퍼 안)는 성공했지만 2:41·6:00 은
             * > 후보 8장이 전부 실패했고, 3장 캡처에 12분 39초가 걸렸다.
             *
             * 일시정지 상태에서는 목표가 움직이지 않으므로 `seeked` 이벤트 한 번만
             * 기다리면 된다. 훨씬 빠르고 확실하다. 정지 화면도 seek 하면 갱신된다. */
            await page.evaluate(
              (tt) =>
                new Promise((resolve) => {
                  const v = document.querySelector("video");
                  v.muted = true;
                  v.pause();
                  let done = false;
                  const finish = () => {
                    if (done) return;
                    done = true;
                    v.removeEventListener("seeked", finish);
                    resolve();
                  };
                  v.addEventListener("seeked", finish);
                  v.currentTime = tt;
                  setTimeout(finish, 9000); // 버퍼링이 길어져도 매달리지 않는다
                }),
              t,
            );
            // seek 직후에는 아직 이전 프레임이 남아 있을 수 있다
            await page.waitForFunction(
              () => {
                const v = document.querySelector("video");
                return v && v.readyState >= 2 && !v.seeking;
              },
              null,
              { timeout: 6000 },
            );
            await page.waitForTimeout(120);

            /* 찍기 직전에 한 번 더 확인한다.
             * 중간광고는 재생 도중 불쑥 끼어들 수 있고, 그 순간 <video> 에 흐르는
             * 것은 본편이 아니다. 여기서 안 막으면 광고 프레임이 그대로 실린다. */
            if (await adShowing(page)) {
              log.debug("중간광고가 끼어들어 이 후보를 버립니다.");
              if (!(await clearAds(page))) break;
              continue;
            }

            const f = path.join(dir, `c${String(i).padStart(2, "0")}.jpg`);
            const el = await page.$("video");
            await el.screenshot({ path: f, type: "jpeg", quality: 92 });
            shots.push(f);
          } catch {
            /* 이 후보는 건너뛴다 */
          }
        }

        if (!shots.length) {
          log.warn(`${mmss(shotSec)} 캡처 실패 (후보 없음)`);
          continue;
        }

        // 얼굴이 가장 잘 나온 한 장 고르기
        let picked = shots[0];
        let note = "";
        try {
          const res = await runJson("python", [
            path.join(DIRS.root, "scripts", "pick_face_frame.py"),
            ...shots,
          ]);
          if (res?.best) {
            picked = res.best;
            note = res.faces
              ? ` · 얼굴 ${res.faces}개, 최대 ${res.biggest}%`
              : " · 얼굴 없음";
          }
        } catch (err) {
          log.debug(
            `얼굴 선별 실패, 첫 후보 사용: ${err.message.slice(0, 70)}`,
          );
        }

        const file = path.join(
          DIRS.photos,
          `${prefix}-shot${Math.round(shotSec)}.jpg`,
        );
        fs.copyFileSync(picked, file);
        out.push({ sec: shotSec, file });
        log.debug(
          `캡처 ${mmss(shotSec)} → ${path.basename(file)} (${shots.length}장 중 선택${note})`,
        );
      }
    }
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(work, { recursive: true, force: true });
  }

  if (out.length) log.ok(`장면 캡처 ${out.length}장 확보`);
  else log.warn("장면 캡처를 얻지 못했습니다. 임베드만으로 진행합니다.");
  return out;
}
