/**
 * 실측 2단계 — 발행 레이어의 `.box_thumb` (대표 이미지 박스) 주변만 정조준해 떠온다.
 * 1단계(probe-thumb.mjs)의 트리 덤프는 깊이 제한에 잘렸다.
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
  await uploadImages(page, imgs);
  await setTitle(page, '(프로브) 대표 이미지 UI 실측 2 — 발행하지 않음');
  await setBody(
    page,
    `<p>${'대표 이미지 선택 UI 실측용 본문입니다. 발행하지 않습니다. '.repeat(8)}</p>`
  );
  await openPublishLayer(page);
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => {
    const clean = (html) =>
      html
        .replace(/\ssrc="[^"]{60,}"/g, ' src="…"')
        .replace(/\sstyle="[^"]*"/g, '')
        .replace(/>\s+</g, '><');
    const box = document.querySelector('.box_thumb');
    // box_thumb 를 감싸는 컨테이너 두 단계 위까지 — 선택 화살표·목록이 형제일 수 있다
    const wrap = box?.parentElement?.parentElement || box?.parentElement || box;
    return {
      found: !!box,
      wrapHtml: wrap ? clean(wrap.outerHTML).slice(0, 4000) : null,
      buttons: wrap
        ? [...wrap.querySelectorAll('button, a, [role="button"]')].map((b) => ({
            tag: b.tagName.toLowerCase(),
            cls: b.className?.toString?.().slice(0, 80),
            text: (b.innerText || '').trim().slice(0, 30),
            aria: b.getAttribute('aria-label') || undefined,
          }))
        : [],
      imgs: wrap
        ? [...wrap.querySelectorAll('img')].map((i) => ({ src: (i.src || '').slice(-60), cls: i.className }))
        : [],
    };
  });

  const file = path.join(DIRS.logs, `probe-thumb2-${stamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(info, null, 2), 'utf8');
  log.ok(`대표 이미지 박스 덤프: ${file}`);
} finally {
  await ctx.close().catch(() => {});
}
