/**
 * 표(table) 컴포넌트 스키마 실측 — 툴바의 표 버튼을 눌러 에디터가 만드는
 * JSON 을 그대로 떠온다.
 *
 * 왜: 시점 흐름을 문단으로 펼치면 세로로 너무 길다는 독자 피드백(2026-07-29).
 * 압축하려면 진짜 표가 필요한데, 스키마를 추측으로 만들면 "알 수 없는 컴포넌트"
 * 회색 박스가 된다. 에디터가 만든 것을 베끼는 것이 유일하게 안전한 길이다.
 *
 *   node scripts/probe-table.mjs
 */
import fs from 'node:fs';
import { loadConfig, naverUrls } from '../src/config.js';
import { launchBrowser, firstPage } from '../src/browser.js';
import { ensureLoggedIn } from '../src/naverLogin.js';
import { openEditor } from '../src/naver.js';
import { log } from '../src/log.js';

const cfg = loadConfig();
cfg.browser.headless = true;
const urls = naverUrls(cfg);

const ctx = await launchBrowser(cfg);
try {
  const page = await firstPage(ctx);
  await ensureLoggedIn(page, cfg, urls, { interactive: false });
  await openEditor(page, urls);

  // 툴바에서 표 버튼을 찾는다 — 이름을 모르므로 후보를 넓게 잡고 다 찍어 본다
  const buttons = await page.evaluate(() =>
    [...document.querySelectorAll('button[class*="toolbar-button"]')].map((b) => ({
      cls: b.className,
      label: b.getAttribute('data-name') || b.getAttribute('aria-label') || b.title || b.textContent.trim(),
    }))
  );
  log.debug(`툴바 버튼 ${buttons.length}개: ${buttons.map((b) => b.label).filter(Boolean).join(' · ')}`);

  const tableBtn = page.locator('button[class*="se-table-toolbar-button"], button[data-name="table"], button[class*="toolbar-button"][class*="table"]').first();
  if (!(await tableBtn.count())) {
    log.error('표 버튼을 못 찾았습니다. 위 버튼 목록에서 이름을 확인하세요.');
    process.exit(1);
  }
  // 본문에 커서를 두고 표 버튼 클릭 → 기본 표가 삽입된다
  await page.locator('.se-text-paragraph').last().click();
  await tableBtn.click();
  await page.waitForTimeout(2000);

  const doc = await page.evaluate(() => window.__seEd().getDocumentData().document.components);
  const table = doc.find((c) => String(c['@ctype']).toLowerCase().includes('table'));
  if (!table) {
    log.error('표 컴포넌트가 안 생겼습니다. 컴포넌트 목록: ' + doc.map((c) => c['@ctype']).join(', '));
    process.exit(1);
  }
  fs.writeFileSync('logs/naver-table-schema.json', JSON.stringify(table, null, 2));
  log.ok('표 스키마 확보 → logs/naver-table-schema.json');
  // 구조 요약
  const summary = JSON.stringify(table).length;
  log.info(`@ctype=${table['@ctype']} · 전체 ${summary}자 · 최상위 키: ${Object.keys(table).join(', ')}`);
} finally {
  await ctx.close();
}
