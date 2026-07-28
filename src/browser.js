import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { DIRS, stamp, safeSlug } from './paths.js';
import { log } from './log.js';

/**
 * 티스토리 인증 쿠키(__T_, __T_SECURE)는 만료 시각이 없는 "세션 쿠키"라
 * 브라우저를 닫으면 디스크에 남지 않는다. 프로필 디렉터리만으로는 로그인이 유지되지 않는다.
 * 그래서 로그인 후 쿠키를 따로 저장해 두었다가 다음 실행에서 다시 주입한다.
 *
 * 네이버(NID_AUT·NID_SES)도 사정이 같으므로 같은 방식을 쓴다.
 * 다만 **파일을 플랫폼별로 나눈다.** 하나로 합치면 티스토리만 로그인한 실행이
 * 네이버 쿠키를 지운 파일로 덮어써서, 다음 네이버 실행이 조용히 로그아웃된다.
 */
const SESSIONS = {
  tistory: { file: 'session.json', domains: /tistory|kakao|daum/ },
  naver: { file: 'session-naver.json', domains: /naver\.com/ },
};

export const PLATFORMS = Object.keys(SESSIONS);

function sessionPath(cfg, platform) {
  return path.join(cfg.profileDir, SESSIONS[platform].file);
}

/** 현재 컨텍스트의 쿠키를 저장한다. */
export async function saveSession(ctx, cfg, platform = 'tistory') {
  const spec = SESSIONS[platform];
  if (!spec) throw new Error(`알 수 없는 플랫폼: ${platform}`);
  try {
    const state = await ctx.storageState();
    const cookies = (state.cookies || []).filter((c) => spec.domains.test(c.domain));
    if (!cookies.length) {
      log.debug(`저장할 ${platform} 세션 쿠키가 없습니다.`);
      return false;
    }
    fs.mkdirSync(cfg.profileDir, { recursive: true });
    fs.writeFileSync(sessionPath(cfg, platform), JSON.stringify({ cookies }, null, 2), 'utf8');
    log.debug(`${platform} 세션 쿠키 ${cookies.length}개 저장`);
    return true;
  } catch (err) {
    log.debug(`${platform} 세션 저장 실패: ${err.message}`);
    return false;
  }
}

/** 저장해 둔 쿠키를 컨텍스트에 다시 주입한다. */
export async function restoreSession(ctx, cfg, platform) {
  // 플랫폼을 지정하지 않으면 있는 것을 모두 복원한다. 서로 도메인이 달라 간섭하지 않는다.
  if (!platform) {
    let any = false;
    for (const p of PLATFORMS) any = (await restoreSession(ctx, cfg, p)) || any;
    return any;
  }
  const file = sessionPath(cfg, platform);
  if (!fs.existsSync(file)) return false;
  try {
    const { cookies } = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!cookies?.length) return false;
    await ctx.addCookies(cookies);
    log.debug(`${platform} 세션 쿠키 ${cookies.length}개 복원`);
    return true;
  } catch (err) {
    log.debug(`${platform} 세션 복원 실패: ${err.message}`);
    return false;
  }
}

export function hasSavedSession(cfg, platform = 'tistory') {
  return fs.existsSync(sessionPath(cfg, platform));
}

const STEALTH = `
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US'] });
  window.chrome = window.chrome || { runtime: {} };
`;

/**
 * 로그인 세션이 유지되는 persistent Chrome 컨텍스트를 연다.
 * profile/ 디렉터리에 쿠키·세션이 저장되므로 이후 실행에서 재로그인이 필요 없다.
 */
export async function launchBrowser(cfg, { headless } = {}) {
  fs.mkdirSync(cfg.profileDir, { recursive: true });

  const baseOpts = {
    headless: headless ?? cfg.browser.headless,
    slowMo: cfg.browser.slowMo,
    viewport: { width: 1480, height: 980 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    acceptDownloads: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-default-browser-check',
      '--no-first-run',
      '--disable-features=Translate,OptimizationHints',
    ],
  };

  let ctx;
  const withChannel = cfg.browser.channel
    ? { ...baseOpts, channel: cfg.browser.channel }
    : baseOpts;

  try {
    ctx = await chromium.launchPersistentContext(cfg.profileDir, withChannel);
    log.debug(`브라우저 실행: ${cfg.browser.channel || 'chromium'} (headless=${withChannel.headless})`);
  } catch (err) {
    if (!cfg.browser.channel) throw err;
    log.warn(`Chrome 채널 실행 실패 (${err.message.split('\n')[0]}) — 번들 Chromium 으로 대체합니다.`);
    ctx = await chromium.launchPersistentContext(cfg.profileDir, baseOpts);
  }

  ctx.setDefaultTimeout(cfg.browser.timeoutMs);
  ctx.setDefaultNavigationTimeout(cfg.browser.timeoutMs);
  await ctx.addInitScript(STEALTH);
  await restoreSession(ctx, cfg);

  return ctx;
}

/**
 * 대화상자 처리 정책을 바꾼다.
 *  - 'auto'    : 임시저장 복구류는 거절, 나머지는 수락 (기본값)
 *  - 'accept'  : 무조건 수락 (에디터 모드 전환 등)
 *  - 'dismiss' : 무조건 거절
 */
export function setDialogPolicy(page, policy) {
  page.__dialogPolicy = policy;
}

/** '이어서 작성하시겠습니까?' 처럼 반드시 거절해야 하는 문구 */
const REJECT_PATTERN = /이어서|작성 중인 글|작성중인 글|저장된 글|불러오|복구/;

/** 컨텍스트의 첫 페이지를 가져오거나 새로 만든다. */
export async function firstPage(ctx) {
  const pages = ctx.pages();
  const page = pages.length ? pages[0] : await ctx.newPage();
  page.__dialogPolicy = 'auto';
  page.__lastDialog = null;

  page.on('dialog', async (dialog) => {
    const msg = dialog.message();
    const policy = page.__dialogPolicy || 'auto';
    let action;
    if (policy === 'accept') action = 'accept';
    else if (policy === 'dismiss') action = 'dismiss';
    else action = REJECT_PATTERN.test(msg) ? 'dismiss' : 'accept';

    page.__lastDialog = { type: dialog.type(), message: msg, action };
    log.debug(`대화상자 [${dialog.type()}] "${msg.slice(0, 70)}" → ${action}`);
    try {
      await dialog[action]();
    } catch {
      /* 이미 닫혔으면 무시 */
    }
  });
  return page;
}

/** 디버그용 스크린샷. 실패해도 흐름을 막지 않는다. */
export async function shot(page, label) {
  try {
    fs.mkdirSync(DIRS.shots, { recursive: true });
    const file = path.join(DIRS.shots, `${stamp()}-${safeSlug(label, 'shot')}.png`);
    await page.screenshot({ path: file, fullPage: false });
    log.debug(`스크린샷: ${file}`);
    return file;
  } catch (err) {
    log.debug(`스크린샷 실패: ${err.message}`);
    return null;
  }
}

/**
 * 여러 셀렉터 후보 중 먼저 보이는 것을 찾는다.
 *
 * 한 셀렉터가 여러 요소에 걸릴 때 **첫 번째만 보고 포기하지 않는다.**
 * 예전에는 `.first()` 만 확인했는데, 화면에 따라 같은 마크업을 여러 벌 렌더링하고
 * 한 벌만 보이게 하는 사이트에서 조용히 실패했다.
 *
 * > 2026-07-28 실측 — 네이버 로그인: `button:has-text("로그인")` 의 첫 매치가
 * > **숨겨진** 패스키 버튼이라 8초를 헛돌고 "셀렉터를 찾지 못했습니다" 로 끝났다.
 * > 정작 바로 뒤에 보이는 로그인 버튼이 있었다.
 *
 * 보이는 것을 찾는 게 목적이므로 앞쪽 몇 개를 훑는다. 이렇게 바꿔도 예전에
 * 성공했던 경우의 결과는 같다(첫 번째가 보이면 그것을 그대로 쓴다).
 */
const SCAN_LIMIT = 5;

export async function findFirst(scope, selectors, { timeout = 8000, state = 'visible' } = {}) {
  const deadline = Date.now() + timeout;
  let lastErr = null;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      try {
        const all = scope.locator(sel);
        if (state === 'attached') {
          if ((await all.count()) > 0) return { locator: all.first(), selector: sel };
          continue;
        }
        const n = Math.min(await all.count(), SCAN_LIMIT);
        for (let i = 0; i < n; i++) {
          const loc = all.nth(i);
          if (await loc.isVisible({ timeout: 250 }).catch(() => false)) {
            return { locator: loc, selector: i ? `${sel} [${i}]` : sel };
          }
        }
      } catch (err) {
        lastErr = err;
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  const err = new Error(`셀렉터를 찾지 못했습니다: ${selectors.join(' | ')}`);
  err.cause = lastErr;
  throw err;
}

/** 있으면 클릭, 없으면 조용히 넘어간다. */
export async function clickIfPresent(scope, selectors, { timeout = 2500 } = {}) {
  try {
    const { locator, selector } = await findFirst(scope, selectors, { timeout });
    await locator.click({ timeout: 4000 });
    log.debug(`클릭: ${selector}`);
    return true;
  } catch {
    return false;
  }
}
