/**
 * 실측 3단계 — 본문에 이미지 2장을 실은 상태에서 `.box_thumb` 가 어떻게
 * 동작하는지 본다. 대표를 **바꿀 수 있는 UI** 가 있는지가 관건이다.
 *
 * 2단계에서 안 것: 본문에 이미지가 없으면 box_thumb 는 삭제 버튼만 있는 빈 박스다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, blogUrls } from '../src/config.js';
import { launchBrowser, firstPage } from '../src/browser.js';
import { ensureLoggedIn } from '../src/kakaoLogin.js';
import { openEditor, uploadImages, setTitle, setBody, openPublishLayer } from '../src/tistory.js';
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
  await setTitle(page, '(프로브) 대표 이미지 UI 실측 3 — 발행하지 않음');
  const filler = `<p>${'대표 이미지 선택 UI 실측용 본문입니다. 발행하지 않습니다. '.repeat(4)}</p>`;
  await setBody(page, `${filler}${macros[0] || ''}${filler}${macros[1] || ''}${filler}`);
  await openPublishLayer(page);
  await page.waitForTimeout(2500);

  const dumpBox = () =>
    page.evaluate(() => {
      const clean = (html) =>
        html.replace(/\ssrc="([^"]{40})[^"]*"/g, ' src="$1…"').replace(/>\s+</g, '><');
      const box = document.querySelector('.box_thumb');
      return box ? clean(box.outerHTML).slice(0, 2500) : null;
    });

  const before = await dumpBox();
  log.info(`box_thumb (이미지 2장 실은 뒤):\n${before}`);

  // 박스를 클릭하면 선택 UI 가 열리는지 본다
  await page.locator('.box_thumb').click().catch(() => {});
  await page.waitForTimeout(1500);
  const afterClick = await dumpBox();
  const layerNow = await page.evaluate(() => {
    // 클릭으로 새 레이어·목록이 떴는지: 발행 레이어 밖에 새로 생긴 것들
    const found = [...document.querySelectorAll('[class*="thumb"], [class*="cover"]')].map((el) => ({
      cls: el.className?.toString?.().slice(0, 100),
      imgs: el.querySelectorAll('img').length,
      text: (el.innerText || '').trim().slice(0, 40) || undefined,
    }));
    return found.slice(0, 20);
  });

  const info = { before, afterClick, layerNow, macroCount: macros.length };
  const file = path.join(DIRS.logs, `probe-thumb3-${stamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(info, null, 2), 'utf8');
  log.ok(`덤프: ${file}`);
} finally {
  await ctx.close().catch(() => {});
}
