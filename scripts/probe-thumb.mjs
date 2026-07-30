/**
 * 발행 레이어의 **대표 이미지 선택 UI** 를 실측한다 (실측 3단계의 1단계).
 *
 * 왜: 지금은 티스토리가 본문 첫 이미지를 대표로 자동 지정하는 데 의존한다.
 * 본문 첫 이미지와 다른 것을 대표로 쓰고 싶을 때 방법이 없다 (2026-07-30
 * 황정민 글에서 손으로 교체했다). 셀렉터를 추측해 넣으면 깨지므로,
 * 이미지 2장을 올리고 발행 레이어를 연 상태의 DOM 을 떠온다.
 *
 * 발행은 하지 않는다. 끝나면 에디터를 닫는다 (임시저장 복구는 dialog 정책이 거절).
 *
 * 사용: node scripts/probe-thumb.mjs
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

// 아무 이미지 2장 — 최근 렌더링한 카드에서 가져온다
const imgs = fs
  .readdirSync(path.join(DIRS.out, 'images'))
  .filter((n) => n.endsWith('.png'))
  .sort()
  .reverse()
  .slice(0, 2)
  .map((n) => path.join(DIRS.out, 'images', n));
if (imgs.length < 2) throw new Error('out/images 에 프로브에 쓸 PNG 가 2장 필요합니다.');

const ctx = await launchBrowser(cfg);
try {
  const page = await firstPage(ctx);
  await ensureLoggedIn(page, cfg, urls, { interactive: true });
  await openEditor(page, urls);
  await uploadImages(page, imgs);
  await setTitle(page, '(프로브) 대표 이미지 UI 실측 — 발행하지 않음');
  // setBody 의 검증(위지윅 200자 이상)을 통과할 만큼 길어야 한다 — 짧으면 함정 ③
  // 방어 로직이 "본문이 안 들어갔다" 로 판정하고 던진다.
  await setBody(
    page,
    `<p>${'대표 이미지 선택 UI 실측용 본문입니다. 발행하지 않습니다. '.repeat(8)}</p>`
  );
  await openPublishLayer(page);
  await page.waitForTimeout(2000);

  // 발행 레이어 전체를 떠온다 — 대표 이미지 관련 요소가 어디 있는지 모른 채로
  const info = await page.evaluate(() => {
    const dump = (el, depth = 0) => {
      if (!el || depth > 7) return null;
      const kids = [...el.children].map((c) => dump(c, depth + 1)).filter(Boolean);
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        cls: el.className?.toString?.().slice(0, 120) || undefined,
        text: !kids.length ? (el.innerText || '').trim().slice(0, 60) || undefined : undefined,
        src: el.tagName === 'IMG' ? (el.src || '').slice(0, 100) : undefined,
        aria: el.getAttribute?.('aria-label') || undefined,
        kids: kids.length ? kids : undefined,
      };
    };
    // 발행 레이어 후보: #publish-btn 이 들어 있는 최상위 레이어
    const btn = document.querySelector('#publish-btn');
    let layer = btn;
    while (layer && layer.parentElement !== document.body) layer = layer.parentElement;
    return {
      layerFound: !!layer,
      layer: dump(layer),
      thumbWords: [...document.querySelectorAll('*')]
        .filter((el) => /대표|썸네일|thumb/i.test(el.className?.toString?.() || '') ||
                        /^대표/.test((el.innerText || '').trim().slice(0, 10)))
        .slice(0, 30)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          id: el.id || undefined,
          cls: el.className?.toString?.().slice(0, 120),
          text: (el.innerText || '').trim().slice(0, 40) || undefined,
        })),
    };
  });

  fs.mkdirSync(DIRS.logs, { recursive: true });
  const file = path.join(DIRS.logs, `probe-thumb-${stamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(info, null, 2), 'utf8');
  await page.screenshot({ path: path.join(DIRS.logs, 'shots', `probe-thumb-${stamp()}.png`), fullPage: false });
  log.ok(`발행 레이어 덤프: ${file}`);
} finally {
  await ctx.close().catch(() => {});
}
