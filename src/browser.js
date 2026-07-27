import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { DIRS, stamp, safeSlug } from './paths.js';
import { log } from './log.js';

/**
 * 티스토리 인증 쿠키(__T_, __T_SECURE)는 만료 시각이 없는 "세션 쿠키"라
 * 브라우저를 닫으면 디스크에 남지 않는다. 프로필 디렉터리만으로는 로그인이 유지되지 않는다.
 * 그래서 로그인 후 쿠키를 따로 저장해 두었다가 다음 실행에서 다시 주입한다.
 */
const SESSION_FILE = 'session.json';

function sessionPath(cfg) {
  return path.join(cfg.profileDir, SESSION_FILE);
}

/** 현재 컨텍스트의 쿠키를 저장한다. */
export async function saveSession(ctx, cfg) {
  try {
    const state = await ctx.storageState();
    const cookies = (state.cookies || []).filter((c) => /tistory|kakao|daum/.test(c.domain));
    if (!cookies.length) {
      log.debug('저장할 세션 쿠키가 없습니다.');
      return false;
    }
    fs.mkdirSync(cfg.profileDir, { recursive: true });
    fs.writeFileSync(sessionPath(cfg), JSON.stringify({ cookies }, null, 2), 'utf8');
    log.debug(`세션 쿠키 ${cookies.length}개 저장`);
    return true;
  } catch (err) {
    log.debug(`세션 저장 실패: ${err.message}`);
    return false;
  }
}

/** 저장해 둔 쿠키를 컨텍스트에 다시 주입한다. */
export async function restoreSession(ctx, cfg) {
  const file = sessionPath(cfg);
  if (!fs.existsSync(file)) return false;
  try {
    const { cookies } = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!cookies?.length) return false;
    await ctx.addCookies(cookies);
    log.debug(`세션 쿠키 ${cookies.length}개 복원`);
    return true;
  } catch (err) {
    log.debug(`세션 복원 실패: ${err.message}`);
    return false;
  }
}

export function hasSavedSession(cfg) {
  return fs.existsSync(sessionPath(cfg));
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

/** 여러 셀렉터 후보 중 먼저 보이는 것을 찾는다. */
export async function findFirst(scope, selectors, { timeout = 8000, state = 'visible' } = {}) {
  const deadline = Date.now() + timeout;
  let lastErr = null;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      try {
        const loc = scope.locator(sel).first();
        if (state === 'attached') {
          if ((await loc.count()) > 0) return { locator: loc, selector: sel };
        } else if (await loc.isVisible({ timeout: 250 }).catch(() => false)) {
          return { locator: loc, selector: sel };
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
