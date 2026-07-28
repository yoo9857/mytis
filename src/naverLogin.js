import { log, fmtDuration } from './log.js';
import { shot, clickIfPresent, findFirst } from './browser.js';

/**
 * 네이버 로그인.
 *
 * 카카오(kakaoLogin.js)와 구조는 같지만 **입력 방식이 다르다.**
 *
 *   네이버는 로그인 폼에 자동화 탐지가 붙어 있어, 키보드로 한 글자씩 치면
 *   (`locator.type`, `keyboard.type`) "자동입력 방지문자" 캡차를 띄우는 일이 잦다.
 *   캡차가 뜨면 사람이 직접 통과해야 하므로 무인 실행이 깨진다.
 *
 *   → 그래서 **클립보드 붙여넣기**를 1순위로 쓴다. 붙여넣기는 paste 이벤트 하나로
 *     끝나서 타이핑 패턴을 남기지 않는다. 실패하면 값을 직접 심는 방식으로 물러난다.
 *     (네이버 로그인 스크립트는 제출 시점에 input 의 value 를 읽어 RSA 로 암호화하므로
 *      값만 심어도 로그인 자체는 성립한다)
 *
 * 그래도 캡차·2단계 인증·새 기기 등록은 **자동화로 뚫을 수 없다.**
 * 그때는 화면을 띄워 사람이 통과시키고, 쿠키를 저장해 다음부터 무인으로 넘긴다.
 * (티스토리와 완전히 같은 전략 — HANDOVER 2-4 참고)
 */

/**
 * 2026-07-28 실측으로 확정한 셀렉터.
 *
 * ⚠️ **`button:has-text("로그인")` 을 쓰면 안 된다.** 부분일치라서
 * **"패스키 로그인"** 버튼이 먼저 걸리고, 그걸 누르면 비밀번호 로그인이 아니라
 * 패스키 인증으로 새 버스 갈아탄다. 심지어 화면에 따라 숨겨져 있어서
 * `findFirst` 가 아무것도 못 찾고 조용히 실패했다.
 *
 * 그리고 네이버는 로그인 버튼을 **반응형으로 두 벌 렌더링한다** —
 * `#loginBtn_row` 와 `#loginBtn_column` 중 한쪽만 보인다. 둘 다 후보로 둔다.
 */
const SEL = {
  id: ['#id', 'input[name="id"]'],
  pw: ['#pw', 'input[name="pw"]'],
  submit: [
    '#loginBtn_row',
    '#loginBtn_column',
    // 폴백도 '패스키' 를 배제한 정확일치로 잡는다
    'button.btn_done:has(span.text:text-is("로그인"))',
  ],
  // '로그인 상태 유지'(name=nvlong) — 켜 두면 쿠키 수명이 길어져 재로그인이 줄어든다
  keep: ['#loginStay', 'label.login_stay'],
  errorBox: ['#err_common', '.error_message', '.err_common', '[class*="error_msg"]:visible'],
};

/** 사람이 직접 통과해야 하는 화면들. 자동화로 못 뚫는다. */
const HUMAN_MARKERS = [
  'text=자동입력 방지',
  'text=보안문자',
  '#captchaimg',
  'input[name="chptchakey"]',
  'text=2단계 인증',
  'text=인증번호',
  'text=새로운 기기',
  'text=기기 등록',
  'text=일회용 로그인',
];

/** 블로그 아이디를 아직 모를 때 쓰는 URL 묶음. */
export function genericUrls() {
  return {
    platform: 'naver',
    blogId: '',
    host: 'blog.naver.com',
    home: 'https://blog.naver.com/',
    writeCandidates: [],
    newPost: '',
    manage: '', // 블로그 아이디를 알기 전에는 관리 URL 이 없다
    // mode=form 금지 — 이미 로그인된 세션까지 폼에 앉힌다 (config.js naverUrls 주석 참고)
    login: 'https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fwww.naver.com',
  };
}

/**
 * 지금 화면이 **로그인 화면인가**.
 *
 * ⚠️ 호스트만 보고 판정하면 안 된다. `nid.naver.com` 에는 로그인 화면만 있는 게
 * 아니라 **내정보 페이지도 같은 호스트**에 있다.
 *
 * > 2026-07-28 실측: 로그인에 성공해 내정보 페이지
 * > (`nid.naver.com/user2/help/myInfoV2`)까지 열렸는데, 판정 함수가 호스트만 보고
 * > "로그인 화면" 이라고 답해서 **성공한 로그인을 실패로 처리했다.**
 *
 * 그래서 경로까지 본다.
 */
const onLoginPage = (url) => /nid\.naver\.com\/(?:nidlogin|login)/i.test(url);

/**
 * 입력창을 클립보드 붙여넣기로 채운다.
 *
 * 클립보드 API 는 권한과 문서 포커스가 필요하다. 권한은 컨텍스트에 부여하고,
 * 포커스는 입력창을 클릭해 확보한다. 어느 하나라도 안 되면 false 를 돌려주고
 * 호출자가 값 주입으로 물러난다.
 */
async function pasteInto(page, locator, text) {
  try {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: new URL(page.url()).origin,
    });
  } catch {
    /* 권한 부여 실패 — writeText 가 던지면 아래 catch 가 받는다 */
  }

  try {
    await locator.click();
    await page.waitForTimeout(120);
    await page.evaluate((t) => navigator.clipboard.writeText(t), text);
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Control+V');
    await page.waitForTimeout(180);
    const got = await locator.inputValue().catch(() => '');
    return got.length === text.length;
  } catch (err) {
    log.debug(`클립보드 붙여넣기 실패: ${err.message.split('\n')[0]}`);
    return false;
  }
}

/** 값을 직접 심는다. 네이버 로그인 스크립트는 제출 시점에 value 를 읽는다. */
async function injectInto(page, locator, text) {
  try {
    await locator.evaluate((el, value) => {
      el.focus();
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    }, text);
    await page.waitForTimeout(150);
    const got = await locator.inputValue().catch(() => '');
    return got.length === text.length;
  } catch (err) {
    log.debug(`값 주입 실패: ${err.message.split('\n')[0]}`);
    return false;
  }
}

/** 붙여넣기 → 값 주입 순으로 시도한다. 타이핑은 쓰지 않는다(캡차 유발). */
async function fillCredential(page, selectors, text, label) {
  const { locator } = await findFirst(page, selectors, { timeout: 12000 });
  if (await pasteInto(page, locator, text)) {
    log.debug(`${label} 입력 (클립보드)`);
    return true;
  }
  if (await injectInto(page, locator, text)) {
    log.debug(`${label} 입력 (값 주입)`);
    return true;
  }
  log.warn(`${label} 를 입력하지 못했습니다.`);
  return false;
}

/** 사람 개입이 필요한 화면이 떴는지 */
async function needsHuman(page) {
  for (const m of HUMAN_MARKERS) {
    if (await page.locator(m).first().isVisible({ timeout: 300 }).catch(() => false)) return m;
  }
  return null;
}

/** 블로그 아이디가 아니라 네이버가 쓰는 페이지 이름들. 후보에서 걸러낸다. */
const RESERVED_ID =
  /^(?:Post|Blog|My|section|prologue|PostView|PostList|BlogHome|BlogAdmin|MyBlog|Recommend|Guest|Notice|Widget|Go|GoBlogWrite|MarketPlace|market|api|help|user\d*)$/i;

/**
 * 로그인한 계정의 블로그 아이디를 찾는다.
 *
 * ⚠️ **공개 피드(section.blog.naver.com)를 절대 긁지 마세요.**
 * 예전 구현이 거기서 링크를 모았는데, 그 페이지는 **남의 블로그 목록**이다.
 *
 * > 2026-07-28 실측: 로그아웃 상태에서 `bemyonday`, 그 다음 실행에서 `chbyslee` 를
 * > "내 블로그" 라고 찍어 `.env` 에 저장했다. 둘 다 전혀 모르는 사람의 블로그다.
 * > (티스토리 쪽 discoverBlog 에도 같은 경고가 붙어 있는데 그대로 밟았다)
 *
 * 그래서 방식을 바꿨다 — **후보를 모으고, 하나씩 내 것인지 검증한다.**
 * 검증은 관리 페이지로 한다. 남의 블로그 관리 페이지는 열 수 없기 때문이다.
 *
 * 블로그 아이디는 네이버 아이디와 다를 수 있다(실측: `hanbin9857` → `web_dev5`).
 * 그래서 아이디를 그대로 쓰지 않고 반드시 확인한다.
 */
export async function discoverBlogId(page, cfg) {
  const candidates = new Set();

  /** URL 에 드러난 블로그 아이디를 줍는다. */
  const harvest = (url) => {
    const hits = [
      url.match(/(?:admin\.)?blog\.naver\.com\/([A-Za-z0-9_-]{3,})/),
      url.match(/blogId=([A-Za-z0-9_-]{3,})/),
      // 로그인 벽으로 튕길 때 return URL 안에 들어 있는 경우가 있다 (실측: web_dev5 를 이렇게 찾았다)
      url.match(/blog\.naver\.com%2F([A-Za-z0-9_-]{3,})/),
    ];
    for (const m of hits) {
      const id = m?.[1];
      if (id && !RESERVED_ID.test(id)) candidates.add(id);
    }
  };

  const visit = async (url) => {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2200);
      harvest(page.url());
      // 관리 페이지 HTML 안에 blogId 가 박혀 있는 경우
      const inHtml = await page
        .evaluate(() => {
          const m = document.documentElement.innerHTML.match(
            /blogId["']?\s*[:=]\s*["']([A-Za-z0-9_-]{3,})["']/
          );
          return m?.[1] || '';
        })
        .catch(() => '');
      if (inHtml && !RESERVED_ID.test(inHtml)) candidates.add(inHtml);
    } catch (err) {
      log.debug(`블로그 아이디 탐색 실패 (${url}): ${err.message.split('\n')[0]}`);
    }
  };

  await visit('https://blog.naver.com/MyBlog.naver');
  await visit('https://admin.blog.naver.com/');
  const naverId = (cfg?.secrets?.naverId || '').trim();
  if (naverId) {
    candidates.add(naverId); // 대개 같다. 다르면 검증에서 탈락한다
    // 없는 아이디로 글쓰기를 열면 네이버가 리다이렉트 URL 에 실제 아이디를 흘린다
    await visit(`https://blog.naver.com/${naverId}/postwrite`);
  }

  if (!candidates.size) {
    log.debug('내 블로그 아이디 후보를 찾지 못했습니다.');
    return null;
  }
  log.debug(`블로그 아이디 후보: ${[...candidates].join(', ')}`);

  // 검증 — 남의 블로그 관리 페이지는 열리지 않는다
  for (const id of candidates) {
    if (await ownsBlog(page, id)) {
      log.debug(`검증 통과: ${id}`);
      return id;
    }
    log.debug(`검증 실패(내 블로그 아님): ${id}`);
  }

  log.warn(
    `블로그 아이디 후보 ${candidates.size}개가 모두 검증에 실패했습니다: ${[...candidates].join(', ')}`
  );
  return null;
}

/** 이 블로그가 내 것인지 관리 페이지 접근으로 확인한다. */
async function ownsBlog(page, blogId) {
  try {
    await page.goto(`https://admin.blog.naver.com/${blogId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);
    const url = page.url();
    if (onLoginPage(url)) return false;
    if (/section\.blog\.naver\.com/.test(url)) return false; // 내 블로그가 아니면 공개 피드로 보낸다
    return url.includes(blogId);
  } catch {
    return false;
  }
}

/**
 * 로그인 여부 확인.
 *
 * 티스토리와 같은 원칙: **확실한 증거가 있을 때만 true.**
 * 애매하면 false 로 둬야 안전하다 — 잘못 true 를 주면 로그인 단계를 건너뛰고
 * 발행에서 실패한다.
 */
export async function isLoggedIn(page, urls) {
  /* 1) 블로그 관리 페이지로 판정 (가장 확실).
   *
   * **요소 유무로 판정하지 않는다.** 관리 화면 마크업을 추측해 셀렉터를 박아 뒀더니
   * 실제로는 하나도 안 맞아서, 로그인이 살아 있는데도 false 를 돌려주고 로그인 폼에
   * 3분을 앉아 있었다 (2026-07-28 실측).
   *
   * 네이버는 **미인증이면 nid.naver.com 으로 리다이렉트한다.** 그게 신호다.
   * 관리 호스트에 그대로 남아 있으면 인증된 것이다. 화면 안쪽이 어떻게 생겼는지는
   * 알 필요가 없다. */
  if (urls?.manage && urls.blogId) {
    try {
      await page.goto(urls.manage, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1800);
      const url = page.url();
      if (onLoginPage(url)) {
        log.debug('관리 페이지가 로그인 화면으로 리다이렉트되었습니다.');
        return false;
      }
      /* ⚠️ `blog.naver.com` 이 URL 에 들어 있다는 것만으로 판정하면 안 된다.
       * 내 블로그가 아닌 아이디로 관리 페이지를 열면 네이버가 **공개 피드**
       * (section.blog.naver.com/BlogHome.naver) 로 조용히 보내는데, 그 주소에도
       * 'blog.naver.com' 이 들어 있어서 로그인된 것으로 오판한다. (2026-07-28 실측)
       * 그래서 **아이디가 주소에 그대로 남아 있는지**까지 본다. */
      if (/section\.blog\.naver\.com/.test(url)) {
        log.debug(`관리 페이지가 공개 피드로 튕겼습니다 (내 블로그가 아니거나 로그아웃): ${url}`);
        return false;
      }
      if (url.includes(urls.blogId)) return true;
      log.debug(`관리 페이지에서 예상 밖의 주소로 이동했습니다: ${url}`);
      return false;
    } catch (err) {
      log.debug(`로그인 확인 실패: ${err.message.split('\n')[0]}`);
      return false;
    }
  }

  /* 2) 블로그 아이디를 모를 때.
   *
   * **네이버 메인에서 '로그인' 버튼이 보이는지로 판정하면 안 된다.** 메인은 마크업이
   * 자주 바뀌고 로그인 링크가 여러 형태로 존재해서, 로그아웃 상태인데도 버튼을
   * 못 찾아 "로그인됨" 으로 오판했다 (2026-07-28 실측: 실제로는 완전 로그아웃이었다).
   *
   * 내정보 페이지는 **인증된 계정만 열 수 있다.** 로그아웃이면 로그인 화면으로
   * 리다이렉트된다. 없는 것을 찾는 대신 있는 것을 확인하는 쪽이 항상 안전하다. */
  try {
    await page.goto('https://nid.naver.com/user2/help/myInfoV2?menu=home', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(1800);
    return !onLoginPage(page.url());
  } catch (err) {
    log.debug(`로그인 확인 실패: ${err.message.split('\n')[0]}`);
    return false;
  }
}

/** 제출 결과가 확정될 때까지 기다린다. */
async function waitForSubmitOutcome(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!onLoginPage(page.url())) return { kind: 'left', url: page.url() };

    for (const sel of SEL.errorBox) {
      try {
        const loc = page.locator(sel).first();
        if (await loc.isVisible({ timeout: 200 }).catch(() => false)) {
          const msg = ((await loc.innerText().catch(() => '')) || '').trim();
          if (msg) return { kind: 'error', message: msg.split('\n')[0].slice(0, 140) };
        }
      } catch {
        /* 셀렉터 미지원 무시 */
      }
    }

    const human = await needsHuman(page);
    if (human) return { kind: 'human', marker: human };

    await page.waitForTimeout(1000);
  }
  return { kind: 'stuck' };
}

/** 로그인 후 끼어드는 부가 화면(기기 등록 권유, 비밀번호 변경 권유)을 넘긴다. */
async function dismissInterstitials(page) {
  const skip = [
    'a:has-text("등록안함")',
    'button:has-text("등록안함")',
    'a:has-text("다음에")',
    'button:has-text("다음에")',
    'a:has-text("나중에")',
    'button:has-text("나중에")',
    'a:has-text("건너뛰기")',
  ];
  for (let i = 0; i < 3; i++) {
    if (!(await clickIfPresent(page, skip, { timeout: 1500 }))) break;
    await page.waitForTimeout(1500);
  }
}

/** 로그인이 끝나 네이버로 돌아올 때까지 기다린다. */
async function waitForReturn(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!onLoginPage(page.url())) return true;
    await dismissInterstitials(page);
    await page.waitForTimeout(1500);
  }
  return false;
}

/**
 * 네이버에 로그인한다. 이미 로그인되어 있으면 아무것도 하지 않는다.
 */
export async function ensureLoggedIn(page, cfg, urls, { interactive = null } = {}) {
  const allowManual = interactive ?? !cfg.browser.headless;

  log.step('네이버 로그인 상태 확인');
  if (await isLoggedIn(page, urls)) {
    log.ok('이미 로그인되어 있습니다 (저장된 세션 사용).');
    return true;
  }

  const { naverId, naverPw } = cfg.secrets;
  log.info('로그인이 필요합니다. 네이버 로그인을 진행합니다.');

  await page.goto(urls?.login || genericUrls().login, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  if (naverId && naverPw) {
    try {
      await fillCredential(page, SEL.id, naverId, '아이디');
      await fillCredential(page, SEL.pw, naverPw, '비밀번호');
      await clickIfPresent(page, SEL.keep, { timeout: 1500 });

      const submit = await findFirst(page, SEL.submit, { timeout: 8000 });
      await submit.locator.click();
      log.info('계정 정보 입력 완료. 인증 결과를 기다립니다...');

      const outcome = await waitForSubmitOutcome(page, 45_000);
      if (outcome.kind === 'error') {
        await shot(page, 'naver-login-error');
        throw new Error(
          `네이버가 로그인을 거부했습니다: ${outcome.message}\n` +
            '.env 의 NAVER_ID / NAVER_PW 를 확인하세요.'
        );
      }
      if (outcome.kind === 'stuck') {
        log.warn('네이버 로그인 화면에서 진행이 멈췄습니다. 화면을 확인해 주세요.');
        await shot(page, 'naver-stuck');
      }
    } catch (err) {
      if (/네이버가 로그인을 거부/.test(err.message)) throw err;
      log.warn(`로그인 폼 자동 입력 실패: ${err.message.split('\n')[0]}`);
      await shot(page, 'naver-form-fail');
    }
  } else if (!allowManual) {
    throw new Error('NAVER_ID / NAVER_PW 가 없고 수동 로그인도 불가능한 환경입니다.');
  } else {
    log.warn('.env 에 네이버 계정이 없습니다. 열린 브라우저에서 직접 로그인해 주세요.');
  }

  await dismissInterstitials(page);

  const human = await needsHuman(page);
  if (human) {
    await shot(page, 'naver-2fa');
    if (!allowManual) {
      throw new Error(
        `네이버가 추가 인증을 요구합니다 (${human}). ` +
          'headless 로는 통과할 수 없습니다. `npm run login:naver` 를 실행해 한 번 직접 인증해 주세요. ' +
          '이후에는 profile/ 에 세션이 남아 무인 실행이 가능합니다.'
      );
    }
    log.warn(
      `네이버가 추가 인증을 요구합니다. 열린 브라우저에서 통과시켜 주세요. ` +
        `(최대 ${fmtDuration(cfg.browser.manualLoginWaitMs)} 대기)`
    );
  }

  if (!(await waitForReturn(page, cfg.browser.manualLoginWaitMs))) {
    await shot(page, 'naver-login-timeout');
    throw new Error(
      '로그인이 시간 내에 완료되지 않았습니다. `npm run login:naver` 로 직접 로그인한 뒤 다시 시도하세요.'
    );
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (await isLoggedIn(page, urls)) {
      log.ok('로그인 완료. 세션이 profile/ 에 저장되어 다음부터는 자동 통과합니다.');
      return true;
    }
    log.debug(`로그인 확인 실패 (${attempt}/3) — 잠시 후 재확인`);
    await page.waitForTimeout(2500);
  }

  await shot(page, 'naver-login-verify-fail');
  throw new Error(
    '로그인 절차는 끝났지만 로그인 상태가 확인되지 않습니다.\n' +
      '`npm run login:naver` 를 다시 실행해 열린 브라우저에서 직접 로그인해 주세요.'
  );
}
