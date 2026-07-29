/**
 * 글감 > 책 첨부 실측 — 에디터의 글감 패널에서 책을 검색해 삽입하고,
 * 어떤 컴포넌트가 생기는지 떠온다.
 *
 * 왜: 책 글에는 네이버 책 DB 카드(글감)를 달아야 한다. 책 카드의 썸네일·링크는
 * 네이버가 만드는 값이라 손으로 지을 수 없다 → 장소(placesMap)와 같은 전략:
 * **UI 로 삽입하고 문서에서 회수한다.**
 *
 *   node scripts/probe-material-book.mjs "투명한 나선"
 */
import fs from 'node:fs';
import { loadConfig, naverUrls } from '../src/config.js';
import { launchBrowser, firstPage } from '../src/browser.js';
import { ensureLoggedIn } from '../src/naverLogin.js';
import { openEditor } from '../src/naver.js';
import { log } from '../src/log.js';

const query = process.argv[2] || '투명한 나선';
const cfg = loadConfig();
cfg.browser.headless = true;
const urls = naverUrls(cfg);

const ctx = await launchBrowser(cfg);
try {
  const page = await firstPage(ctx);
  await ensureLoggedIn(page, cfg, urls, { interactive: false });
  await openEditor(page, urls);

  const before = await page.evaluate(() =>
    window.__seEd().getDocumentData().document.components.map((c) => c['@ctype'])
  );

  // 1. 사이드바의 '글감' 버튼 — 이름을 모르니 글자로 찾는다
  const sideButtons = await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t && t.length < 12)
  );
  log.debug(`버튼 후보: ${[...new Set(sideButtons)].join(' · ').slice(0, 300)}`);

  const glButton = page.locator('button:has-text("글감")').first();
  if (!(await glButton.count())) {
    log.error('글감 버튼을 못 찾았습니다.');
    process.exit(1);
  }
  await glButton.click();
  await page.waitForTimeout(1500);

  // 2. 패널 안 '책' 탭 + 검색
  const bookTab = page.locator('[class*="side"] button:has-text("책"), [class*="panel"] button:has-text("책"), button:has-text("책")').first();
  if (await bookTab.count()) {
    await bookTab.click();
    await page.waitForTimeout(800);
  }
  const searchInput = page.locator('[class*="side"] input[type="text"], [class*="search"] input').first();
  await searchInput.fill(query);
  await searchInput.press('Enter');
  await page.waitForTimeout(2500);

  // 3. 첫 결과 삽입.
  // 실측(2026-07-29): 패널에 '책 4 / 쇼핑 7,141' 처럼 종류별 묶음이 뜨고,
  // 일반 li 셀렉터는 엉뚱한 것(검색어 텍스트)을 집었다. **책 묶음 안의 카드 제목**을
  // 글자로 집어 클릭한다 — 검색 입력창과 겹치지 않게 입력창은 제외한다.
  const shot = (n) => page.screenshot({ path: `logs/shots/material-${n}.png` });
  await shot('panel');
  // 셀렉터 클릭은 타임아웃이 났다(겹치는 요소·hidden 매치) — 화면에서 그 글자가
  // 있는 자리를 찾아 **좌표로** 클릭한다.
  const rect = await page.evaluate((q) => {
    const els = [...document.querySelectorAll('div,strong,span,a,p')].filter(
      (e) => e.childElementCount === 0 && e.textContent.trim() === q && e.getClientRects().length
    );
    const el = els[0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, query);
  if (!rect) {
    log.error('책 카드를 못 찾았습니다. logs/shots/material-panel.png 확인.');
    process.exit(1);
  }
  await page.mouse.click(rect.x, rect.y);
  await page.waitForTimeout(2500);
  await shot('after');

  // 4. 무엇이 생겼나 — 위치를 가정하지 말고 **종류가 새로운 것**을 떠온다
  // (처음에 after.slice(before.length) 로 떴다가 빈 text 문단을 카드로 오인했다)
  const after = await page.evaluate(() => window.__seEd().getDocumentData().document.components);
  const dump = after.filter((c) => !['documentTitle', 'text'].includes(c['@ctype']));
  fs.writeFileSync('logs/naver-book-material-schema.json', JSON.stringify(dump, null, 2));
  log.ok(`책 카드 후보 ${dump.length}개 → logs/naver-book-material-schema.json`);
  for (const c of dump) log.info(`@ctype=${c['@ctype']} · 키: ${Object.keys(c).join(', ')}`);
  log.info(`전체 컴포넌트: ${after.map((c) => c['@ctype']).join(' → ')}`);
} finally {
  await ctx.close();
}
