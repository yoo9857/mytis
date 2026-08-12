/**
 * 네이버 에디터의 **사진 묶기(콜라주) 컴포넌트 구조**를 실측한다. 발행하지 않는다.
 *
 * 왜 필요한가: 우리 네이버 발행은 사진을 늘 **한 장씩** 넣었다. `naver.js` 에 묶기
 * 코드가 아예 없다. 티스토리는 2열 표로 해결했지만(§7-7 ③) 네이버는 자체
 * `imageGroup` 컴포넌트를 쓰므로 표가 통하지 않는다.
 *
 * 구조를 **지어낼 수 없다.** 그래서 모달에서 '콜라주' 를 골라 한 번 만들어 보고
 * `getDocumentData()` 를 그대로 덤프한다 (책 카드 때와 같은 방법 — §7-2).
 *
 *   node scripts/probe-imagegroup.mjs  사진1.jpg 사진2.jpg [사진3.jpg ...]
 *
 * 결과는 `.tmp/imagegroup-probe.json` 에 저장된다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DIRS } from '../src/paths.js';
import { loadConfig, naverUrls } from '../src/config.js';
import { log } from '../src/log.js';
import { launchBrowser, firstPage } from '../src/browser.js';
import { ensureLoggedIn } from '../src/naverLogin.js';
import { openEditor } from '../src/naver.js';

const files = process.argv.slice(2).filter((f) => fs.existsSync(f));
if (files.length < 2) {
  console.error('사용: node scripts/probe-imagegroup.mjs 사진1.jpg 사진2.jpg  (2장 이상)');
  process.exit(1);
}

const cfg = loadConfig();
cfg.browser.headless = false; // 모달을 눈으로 확인할 수 있게
const urls = naverUrls(cfg);

const ctx = await launchBrowser(cfg);
const page = await firstPage(ctx);
try {
  await ensureLoggedIn(page, cfg, urls, { interactive: false });
  await openEditor(page, urls);

  await page.evaluate(() => window.__seEd().focusFirstText()).catch(() => {});
  await page.waitForTimeout(600);

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 20000 }),
    page.locator('button.se-image-toolbar-button').first().click({ timeout: 10000 }),
  ]);
  await chooser.setFiles(files);
  log.step(`사진 ${files.length}장 첨부 — 모달에서 '콜라주' 를 찾습니다`);

  /* 모달의 선택지 이름을 먼저 찍어 둔다. '콜라주' 가 아닐 수도 있다
   * (네이버가 '콜라주 / 슬라이드 / 개별사진' 으로 부르는 것을 확인만 하고 고른다). */
  const deadline = Date.now() + 20000;
  let choices = [];
  while (Date.now() < deadline) {
    choices = await page.evaluate(() =>
      [...document.querySelectorAll('button, label, li, span')]
        .map((e) => (e.innerText || '').trim())
        .filter((t) => t && t.length <= 8 && /콜라주|슬라이드|개별사진/.test(t))
    );
    if (choices.length) break;
    await page.waitForTimeout(700);
  }
  log.info(`모달 선택지: ${[...new Set(choices)].join(' · ') || '(없음)'}`);

  let picked = false;
  for (const sel of ['*:text-is("콜라주")', 'button:has-text("콜라주")']) {
    const loc = page.locator(sel).first();
    if (await loc.count().catch(() => 0)) {
      await loc.click({ timeout: 4000 }).catch(() => {});
      picked = true;
      log.ok('콜라주 선택');
      break;
    }
  }
  if (!picked) log.warn('콜라주 선택지를 찾지 못했습니다 — 그대로 삽입된 결과를 덤프합니다.');

  // 삽입 완료까지 기다린다
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(2000);
    const kinds = await page.evaluate(() =>
      window.__seEd().getDocumentData().document.components.map((c) => c['@ctype'])
    );
    if (kinds.some((k) => /image/i.test(k))) {
      log.info(`컴포넌트: ${kinds.join(', ')}`);
      if (kinds.filter((k) => /image/i.test(k)).length >= 1) break;
    }
  }

  const doc = await page.evaluate(() => window.__seEd().getDocumentData());
  const out = path.join(DIRS.tmp, 'imagegroup-probe.json');
  fs.mkdirSync(DIRS.tmp, { recursive: true });
  fs.writeFileSync(out, JSON.stringify(doc, null, 2), 'utf8');

  const kinds = doc.document.components.map((c) => c['@ctype']);
  log.ok(`덤프 완료: ${out}`);
  log.info(`컴포넌트 종류: ${kinds.join(', ')}`);
  for (const c of doc.document.components) {
    if (!/image/i.test(c['@ctype'])) continue;
    log.info(`  ${c['@ctype']} — 키: ${Object.keys(c).join(', ')}`);
    if (Array.isArray(c.images)) log.info(`    images ${c.images.length}개 · 첫 항목 키: ${Object.keys(c.images[0] || {}).join(', ')}`);
  }
  log.warn('발행하지 않습니다. 브라우저를 닫으면 임시저장만 남습니다.');
} finally {
  await page.waitForTimeout(1500);
  await ctx.close().catch(() => {});
}
