import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { DIRS } from './paths.js';
import { log } from './log.js';

/**
 * 로그인 화면의 셀렉터가 현재 티스토리·카카오 마크업과 맞는지 확인한다.
 * 로그인하지 않고 공개 페이지만 열어보므로 계정 없이도 실행할 수 있다.
 * 어느 날 갑자기 자동 발행이 로그인에서 멈추면 이걸 먼저 돌려보면 된다.
 */

const CHECKS = [
  {
    name: '티스토리 로그인 페이지',
    url: 'https://www.tistory.com/auth/login',
    items: [
      {
        label: '카카오 로그인 버튼',
        required: true,
        where: 'src/kakaoLogin.js → SEL.kakaoLoginBtn',
        selectors: [
          'a.link_kakao_id',
          '.btn_login.link_kakao_id',
          'a[href*="kakao"][class*="login"]',
          'a:has-text("카카오계정으로 로그인")',
          'button:has-text("카카오계정으로 로그인")',
        ],
      },
    ],
  },
  {
    name: '카카오 계정 로그인 페이지',
    url: 'https://accounts.kakao.com/login/?continue=https%3A%2F%2Fwww.tistory.com',
    items: [
      {
        label: '아이디 입력창',
        required: true,
        where: 'src/kakaoLogin.js → SEL.id',
        selectors: ['input[name="loginId"]', '#loginId--1', 'input[placeholder*="카카오메일"]'],
      },
      {
        label: '비밀번호 입력창',
        required: true,
        where: 'src/kakaoLogin.js → SEL.pw',
        selectors: ['input[name="password"]', '#password--2', 'input[type="password"]'],
      },
      {
        label: '로그인 버튼',
        required: true,
        where: 'src/kakaoLogin.js → SEL.submit',
        selectors: [
          'button.btn_g.highlight.submit',
          'button[type="submit"]:has-text("로그인")',
          'button[type="submit"]',
        ],
      },
      {
        label: '로그인 정보 저장 체크박스',
        required: false,
        where: 'src/kakaoLogin.js → SEL.stay',
        selectors: [
          'input[name="saveSignedIn"]',
          '#saveSignedIn--4',
          'label:has-text("간편로그인 정보 저장")',
          '#staySignedIn',
        ],
      },
    ],
  },
];

async function probe(page, selectors) {
  const hits = [];
  for (const sel of selectors) {
    try {
      const n = await page.locator(sel).count();
      if (n > 0) hits.push(sel);
    } catch {
      /* 지원하지 않는 셀렉터 문법은 건너뛴다 */
    }
  }
  return hits;
}

export async function verifySelectors(cfg) {
  log.banner('로그인 셀렉터 점검');
  log.info('계정 없이 공개 페이지만 확인합니다.');

  fs.mkdirSync(DIRS.shots, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let broken = 0;

  try {
    const ctx = await browser.newContext({
      locale: 'ko-KR',
      viewport: { width: 1400, height: 950 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(30_000);

    for (const check of CHECKS) {
      log.step(check.name);
      try {
        await page.goto(check.url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
      } catch (err) {
        log.error(`  페이지를 열지 못했습니다: ${err.message}`);
        broken++;
        continue;
      }

      for (const item of check.items) {
        const hits = await probe(page, item.selectors);
        if (hits.length) {
          log.ok(`  ${item.label} — ${hits[0]}`);
        } else if (item.required) {
          broken++;
          log.error(`  ${item.label} 를 찾지 못했습니다. ${item.where} 를 고쳐야 합니다.`);
        } else {
          log.warn(`  ${item.label} 없음 (선택 항목이라 진행에는 지장 없음)`);
        }
      }

      const shotFile = path.join(
        DIRS.shots,
        `verify-${check.url.includes('kakao') ? 'kakao' : 'tistory'}.png`
      );
      await page.screenshot({ path: shotFile }).catch(() => {});
      log.debug(`  스크린샷: ${shotFile}`);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  if (broken) {
    log.error(`필수 셀렉터 ${broken}개가 깨졌습니다. 위에 표시된 파일을 수정하세요.`);
    log.info(`화면은 ${DIRS.shots} 에 저장했습니다.`);
    return false;
  }
  log.ok('로그인 셀렉터 정상 — 계정만 넣으면 자동 로그인이 동작합니다.');
  log.info('에디터 화면 셀렉터는 로그인이 필요해서 `npm run probe` 로 따로 확인하세요.');
  return true;
}
