import { log, fmtDuration } from './log.js';
import { shot, clickIfPresent, findFirst } from './browser.js';

const SEL = {
  kakaoLoginBtn: [
    'a.link_kakao_id',
    '.btn_login.link_kakao_id',
    'a[href*="kakao"][class*="login"]',
    'button:has-text("카카오계정으로 로그인")',
    'a:has-text("카카오계정으로 로그인")',
    'a:has-text("카카오 로그인")',
  ],
  id: [
    'input[name="loginId"]',
    '#loginId--1',
    'input#id_email_2',
    'input[placeholder*="카카오메일"]',
    'input[type="text"][autocomplete="username"]',
  ],
  pw: [
    'input[name="password"]',
    '#password--2',
    'input#id_password_3',
    'input[type="password"]',
  ],
  submit: [
    'button.btn_g.highlight.submit',
    'button[type="submit"]:has-text("로그인")',
    'button.submit',
    'button[type="submit"]',
  ],
  // 카카오가 '로그인 상태 유지' → '간편로그인 정보 저장' 으로 바꿨다. 옛 이름도 남겨둔다.
  stay: [
    'input[name="saveSignedIn"]',
    '#saveSignedIn--4',
    'label:has-text("간편로그인 정보 저장")',
    '#staySignedIn',
    'input[name="stay_signed_in"]',
    'label:has-text("로그인 상태 유지")',
  ],
  // 주의: '취소' 나 .btn_cancel 을 여기에 넣으면 안 된다.
  // 카카오 로그인 화면의 취소 버튼을 눌러 로그인을 스스로 중단시킨다.
  skip: [
    'button:has-text("다음에 하기")',
    'a:has-text("다음에 하기")',
    'button:has-text("나중에 하기")',
    'a:has-text("나중에 하기")',
    'button:has-text("건너뛰기")',
  ],
  agree: [
    'button:has-text("동의하고 계속하기")',
    'button:has-text("계속하기")',
    'button.btn_agree',
  ],
  errorBox: ['.desc_error', '.txt_error', '[class*="error"]:visible'],
};

/**
 * 블로그 주소를 아직 모를 때 쓰는 기본 URL 묶음.
 * 주의: www.tistory.com/manage 는 존재하지 않는 페이지(404)라 로그인 판정에 쓰면 안 된다.
 */
export function genericUrls() {
  return {
    host: 'www.tistory.com',
    home: 'https://www.tistory.com/',
    manage: '', // 블로그를 알기 전에는 관리 URL 이 없다
    newPost: '',
    login: 'https://www.tistory.com/auth/login',
  };
}

/** 로그아웃 상태에서만 보이는 요소들 */
const LOGGED_OUT_MARKERS = [
  'a.btn_login.link_kakao_id',
  'a:has-text("카카오계정으로 시작하기")',
  'button.btn_log_info:has-text("시작하기")',
];

/**
 * 로그인한 계정이 가진 블로그 주소를 찾아낸다.
 * www.tistory.com/manage 로 들어가면 기본 블로그의 관리 페이지로 리다이렉트되므로
 * 최종 URL 의 호스트에서 블로그 이름을 얻는다.
 */
export async function discoverBlog(page) {
  const candidates = [];

  const collect = async (url) => {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);

      // 리다이렉트로 블로그 호스트에 도착했으면 그게 답이다
      const host = new URL(page.url()).hostname;
      if (host.endsWith('.tistory.com') && host !== 'www.tistory.com') candidates.push(host);

      const hrefs = await page
        .locator('a[href*=".tistory.com"]')
        .evaluateAll((els) => els.map((e) => e.href))
        .catch(() => []);
      for (const href of hrefs) {
        try {
          const h = new URL(href).hostname;
          if (h.endsWith('.tistory.com') && h !== 'www.tistory.com') candidates.push(h);
        } catch {
          /* 잘못된 URL 무시 */
        }
      }
    } catch (err) {
      log.debug(`블로그 탐색 실패 (${url}): ${err.message}`);
    }
  };

  // 내 블로그만 나오는 계정 페이지를 본다.
  // 티스토리 홈(www.tistory.com)은 남의 블로그 피드가 잔뜩 있어 절대 쓰면 안 된다.
  await collect('https://www.tistory.com/member/blog');
  if (!candidates.length) await collect('https://www.tistory.com/member/blogs');

  if (!candidates.length) {
    log.debug('계정 페이지에서 내 블로그를 찾지 못했습니다.');
    return null;
  }

  const counts = new Map();
  for (const h of candidates) counts.set(h, (counts.get(h) || 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  log.debug(`블로그 후보: ${ranked.map(([h, c]) => `${h}(${c})`).join(', ')}`);
  if (ranked.length > 1) {
    log.info(
      `블로그가 여러 개입니다: ${ranked.map(([h]) => h).join(', ')} — ` +
        '원하는 블로그가 아니면 .env 의 TISTORY_BLOG 를 직접 바꾸세요.'
    );
  }
  return ranked[0][0].replace(/\.tistory\.com$/, '');
}

/**
 * 로그인 여부 확인.
 *
 * 확실한 증거가 있을 때만 true 를 돌려준다. 애매하면 false 로 두는 편이
 * 안전하다 — 잘못 true 를 주면 로그인 단계를 건너뛰고 발행에서 실패한다.
 *
 *  - 블로그 주소를 알면: 그 블로그 관리 페이지가 열리는지로 판정 (가장 확실)
 *  - 모르면: 티스토리 홈에 '카카오계정으로 시작하기' 버튼이 있는지로 판정
 */
export async function isLoggedIn(page, urls) {
  // 1) 블로그 관리 페이지로 판정
  if (urls?.manage) {
    try {
      await page.goto(urls.manage, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);
      const url = page.url();
      if (
        url.includes('/auth/login') ||
        url.includes('accounts.kakao.com') ||
        url.includes('logins.daum.net')
      ) {
        return false;
      }
      // 관리 화면 고유 요소가 실제로 보여야 한다
      const hasAdmin = await page
        .locator('.wrap_manage, #mArticle, .list_post, .btn_post, a[href*="/manage/newpost"]')
        .first()
        .isVisible({ timeout: 6000 })
        .catch(() => false);
      if (hasAdmin) return true;
      log.debug(`관리 화면 요소를 찾지 못함 (URL: ${url})`);
      return false;
    } catch (err) {
      log.debug(`로그인 확인 실패: ${err.message}`);
      return false;
    }
  }

  // 2) 블로그 주소를 모를 때 — 홈의 로그인 CTA 유무로 판정
  try {
    await page.goto('https://www.tistory.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    for (const sel of LOGGED_OUT_MARKERS) {
      const visible = await page
        .locator(sel)
        .first()
        .isVisible({ timeout: 800 })
        .catch(() => false);
      if (visible) {
        log.debug(`로그아웃 상태 (${sel} 발견)`);
        return false;
      }
    }
    return true;
  } catch (err) {
    log.debug(`로그인 확인 실패: ${err.message}`);
    return false;
  }
}

/**
 * 로그인 버튼을 누른 뒤 결과가 확정될 때까지 기다린다.
 * 성공(카카오를 벗어남) / 실패(오류 메시지) / 추가 인증 / 정체 를 구분한다.
 */
async function waitForSubmitOutcome(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const url = page.url();

    // 카카오를 벗어났으면 자격 증명은 통과한 것
    if (!/accounts\.kakao\.com|logins\.daum\.net/.test(url)) {
      return { kind: 'left', url };
    }

    // 카카오가 표시한 오류 메시지
    for (const sel of SEL.errorBox) {
      try {
        const loc = page.locator(sel).first();
        if (await loc.isVisible({ timeout: 200 }).catch(() => false)) {
          const msg = ((await loc.innerText().catch(() => '')) || '').trim();
          if (msg) return { kind: 'error', message: msg.split('\n')[0].slice(0, 120) };
        }
      } catch {
        /* 셀렉터 미지원은 무시 */
      }
    }

    // 사람이 개입해야 하는 화면
    const human = await needsHuman(page);
    if (human) return { kind: 'human', marker: human };

    await page.waitForTimeout(1000);
  }
  return { kind: 'stuck' };
}

/** 로그인 후 나타날 수 있는 부가 화면들(간편로그인 등록, 약관 동의)을 넘긴다. */
async function dismissInterstitials(page) {
  for (let i = 0; i < 3; i++) {
    const agreed = await clickIfPresent(page, SEL.agree, { timeout: 1500 });
    const skipped = await clickIfPresent(page, SEL.skip, { timeout: 1500 });
    if (!agreed && !skipped) break;
    await page.waitForTimeout(1500);
  }
}

/** 로그인이 완료될 때까지(티스토리로 돌아올 때까지) 기다린다. */
async function waitForReturn(page, urls, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const url = page.url();
    if (url.includes('tistory.com') && !url.includes('/auth/login')) return true;
    await dismissInterstitials(page);
    await page.waitForTimeout(1500);
  }
  return false;
}

/** 카카오 로그인 페이지에 2단계 인증/기기 등록 같은 사람 개입이 필요한 화면이 떴는지 */
async function needsHuman(page) {
  const markers = [
    'text=인증번호',
    'text=카카오톡으로 인증',
    'text=2단계 인증',
    'text=자동입력 방지',
    'text=새로운 기기',
    'img[alt*="캡차"]',
    '#captcha',
  ];
  for (const m of markers) {
    if (await page.locator(m).first().isVisible({ timeout: 300 }).catch(() => false)) return m;
  }
  return null;
}

/**
 * 카카오 계정으로 티스토리에 로그인한다.
 * 이미 로그인되어 있으면 아무것도 하지 않는다.
 */
export async function ensureLoggedIn(page, cfg, urls, { interactive = null } = {}) {
  const allowManual = interactive ?? !cfg.browser.headless;

  log.step('티스토리 로그인 상태 확인');
  if (await isLoggedIn(page, urls)) {
    log.ok('이미 로그인되어 있습니다 (저장된 프로필 세션 사용).');
    return true;
  }

  const { kakaoId, kakaoPw } = cfg.secrets;
  log.info('로그인이 필요합니다. 카카오 로그인을 진행합니다.');

  await page.goto(urls?.login || 'https://www.tistory.com/auth/login', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(1000);

  // 카카오 로그인 버튼
  try {
    const { locator } = await findFirst(page, SEL.kakaoLoginBtn, { timeout: 10000 });
    await locator.click();
  } catch {
    log.warn('카카오 로그인 버튼을 찾지 못했습니다. 이미 카카오 페이지일 수 있습니다.');
  }
  await page.waitForTimeout(2500);

  // 카카오 계정 페이지가 아니면 (이미 세션이 있어 바로 돌아온 경우) 확인
  if (!page.url().includes('kakao')) {
    if (await isLoggedIn(page, urls)) {
      log.ok('카카오 세션이 살아 있어 즉시 로그인되었습니다.');
      return true;
    }
  }

  if (kakaoId && kakaoPw) {
    try {
      const idField = await findFirst(page, SEL.id, { timeout: 12000 });
      await idField.locator.fill(kakaoId);
      await page.waitForTimeout(250);

      const pwField = await findFirst(page, SEL.pw, { timeout: 8000 });
      await pwField.locator.fill(kakaoPw);
      await page.waitForTimeout(250);

      // 로그인 상태 유지 (다음 실행에서 재로그인 방지)
      await clickIfPresent(page, SEL.stay, { timeout: 1500 });

      const submit = await findFirst(page, SEL.submit, { timeout: 8000 });
      await submit.locator.click();
      log.info('카카오 계정 정보 입력 완료. 인증 결과를 기다립니다...');

      // 제출 결과가 확정될 때까지 기다린다:
      // 카카오를 벗어났거나 / 오류 메시지가 떴거나 / 추가 인증을 요구하거나
      const outcome = await waitForSubmitOutcome(page, 45_000);
      if (outcome.kind === 'error') {
        await shot(page, 'kakao-login-error');
        throw new Error(
          `카카오가 로그인을 거부했습니다: ${outcome.message}\n` +
            '.env 의 KAKAO_ID / KAKAO_PW 를 확인하세요.'
        );
      }
      if (outcome.kind === 'stuck') {
        log.warn('카카오 화면에서 진행이 멈췄습니다. 화면을 확인해 주세요.');
        await shot(page, 'kakao-stuck');
      }
    } catch (err) {
      if (/카카오가 로그인을 거부/.test(err.message)) throw err;
      log.warn(`카카오 로그인 폼 자동 입력 실패: ${err.message}`);
      await shot(page, 'kakao-form-fail');
    }
  } else if (!allowManual) {
    throw new Error('KAKAO_ID / KAKAO_PW 가 없고 수동 로그인도 불가능한 환경입니다.');
  } else {
    log.warn('.env 에 카카오 계정이 없습니다. 열린 브라우저에서 직접 로그인해 주세요.');
  }

  await dismissInterstitials(page);

  // 사람 개입이 필요한 화면인지 확인
  const human = await needsHuman(page);
  if (human) {
    await shot(page, 'kakao-2fa');
    if (!allowManual) {
      throw new Error(
        `카카오가 추가 인증을 요구합니다 (${human}). ` +
          'headless 로는 통과할 수 없습니다. `npm run login` 을 실행해 한 번 직접 인증해 주세요. ' +
          '이후에는 profile/ 에 세션이 남아 무인 실행이 가능합니다.'
      );
    }
    log.warn(
      `카카오가 추가 인증을 요구합니다. 열린 브라우저에서 인증을 완료해 주세요. ` +
        `(최대 ${fmtDuration(cfg.browser.manualLoginWaitMs)} 대기)`
    );
  }

  const returned = await waitForReturn(page, urls, cfg.browser.manualLoginWaitMs);
  if (!returned) {
    await shot(page, 'login-timeout');
    throw new Error(
      '로그인이 시간 내에 완료되지 않았습니다. `npm run login` 으로 직접 로그인한 뒤 다시 시도하세요.'
    );
  }

  // 화면 전환 직후에는 판정이 흔들릴 수 있어 몇 번 확인한다
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (await isLoggedIn(page, urls)) {
      log.ok('로그인 완료. 세션이 profile/ 에 저장되어 다음부터는 자동 통과합니다.');
      return true;
    }
    log.debug(`로그인 확인 실패 (${attempt}/3) — 잠시 후 재확인`);
    await page.waitForTimeout(2500);
  }

  await shot(page, 'login-verify-fail');
  throw new Error(
    '로그인 절차는 끝났지만 로그인 상태가 확인되지 않습니다.\n' +
      '`npm run login` 을 다시 실행해 열린 브라우저에서 직접 로그인해 주세요.'
  );
}
