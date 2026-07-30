/**
 * 실측 4단계 — **에디터 본문 안에서 이미지를 클릭**했을 때 뜨는 툴바를 떠온다.
 *
 * 3단계에서 안 것: 발행 레이어의 box_thumb 는 본문 첫 이미지를 자동 표시할 뿐
 * 고르는 UI 가 없다 (클릭 무반응 · 삭제 버튼만). 대표를 바꾸는 UI 가 있다면
 * 에디터 쪽 이미지 툴바다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, blogUrls } from '../src/config.js';
import { launchBrowser, firstPage } from '../src/browser.js';
import { ensureLoggedIn } from '../src/kakaoLogin.js';
import { openEditor, uploadImages, setTitle, setBody } from '../src/tistory.js';
import { DIRS, stamp } from '../src/paths.js';
import { log } from '../src/log.js';

const cfg = loadConfig();
cfg.browser.headless = false;
const urls = blogUrls(cfg);

const imgs = fs
  .readdirSync(path.join(DIRS.out, 'images'))
  .filter((n) => n.endsWith('.png'))
  .sort()
  .reverse()
  .slice(0, 2)
  .map((n) => path.join(DIRS.out, 'images', n));

const ctx = await launchBrowser(cfg);
try {
  const page = await firstPage(ctx);
  await ensureLoggedIn(page, cfg, urls, { interactive: true });
  await openEditor(page, urls);
  const macros = await uploadImages(page, imgs);
  await setTitle(page, '(프로브) 이미지 툴바 실측 — 발행하지 않음');
  const filler = `<p>${'이미지 툴바 실측용 본문입니다. 발행하지 않습니다. '.repeat(5)}</p>`;
  await setBody(page, `${filler}${macros[0] || ''}${filler}${macros[1] || ''}${filler}`);
  await page.waitForTimeout(1500);

  // 위지윅 iframe 안의 **두 번째** 이미지를 클릭한다 (첫 번째가 기본 대표이므로,
  // 두 번째에서 '대표로 지정' 같은 버튼이 있는지 봐야 한다)
  const frame = page.frameLocator('#editor-tistory_ifr');
  const images = frame.locator('img');
  log.info(`본문 이미지 ${await images.count()}개`);
  await images.nth(1).click();
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const clean = (el) => ({
      cls: el.className?.toString?.().slice(0, 100),
      id: el.id || undefined,
      text: (el.innerText || '').trim().slice(0, 120) || undefined,
      aria: el.getAttribute?.('aria-label') || undefined,
    });
    // 이미지 클릭 시 뜨는 플로팅 툴바는 mce 팝업/인라인 툴바 계열이다
    const pops = [...document.querySelectorAll(
      '.mce-floatpanel, .mce-panel[role="toolbar"], [class*="image-toolbar"], [class*="imagetool"]'
    )]
      .filter((el) => el.offsetParent !== null) // 보이는 것만
      .map((el) => ({
        ...clean(el),
        buttons: [...el.querySelectorAll('button, [role="button"]')].map(clean),
      }));
    return { pops };
  });

  const file = path.join(DIRS.logs, `probe-thumb4-${stamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(info, null, 2), 'utf8');
  await page.screenshot({ path: path.join(DIRS.logs, 'shots', `probe-thumb4-${stamp()}.png`) });
  log.ok(`이미지 툴바 덤프: ${file}`);
} finally {
  await ctx.close().catch(() => {});
}
