/**
 * 이미 발행된 네이버 글을 **같은 주소로** 고쳐 다시 발행한다.
 *
 * 왜 필요한가: 발행 후에 이미지·문단을 고칠 일이 생긴다 (2026-07-30 실측 —
 * 책 글에 스탯 카드 3장이 실렸고, 작가 카드가 빠졌다는 독자 피드백).
 * 새로 발행하면 주소가 바뀌어 시리즈 연결(books.done.txt)이 끊긴다.
 *
 * 어떻게: 에디터는 `postwrite?logNo=<번호>` 로 기존 글을 편집 모드로 연다.
 * 단, 그대로 업로드하면 **회수가 어긋난다** — uploadImages 는 문서의 모든
 * image 컴포넌트를 가져오므로 기존 사진과 새 사진이 섞인다. 그래서
 * **문서를 먼저 비운다** (제목 + 빈 텍스트만 남김) → 그다음은 새 발행과 동일.
 *
 * 사용: node scripts/edit-naver-post.mjs "out/<글>.json" <logNo>
 */
import fs from 'node:fs';
import { loadConfig, naverUrls } from '../src/config.js';
import { launchBrowser, firstPage, saveSession } from '../src/browser.js';
import { ensureLoggedIn } from '../src/naverLogin.js';
import {
  openEditor,
  uploadImages,
  injectDocument,
  attachBookMaterial,
  openPublishLayer,
  selectCategory,
  setTags,
  setVisibility,
  setPublishOptions,
  clickPublish,
} from '../src/naver.js';
import { renderImages } from '../src/images.js';
import { log } from '../src/log.js';

const [file, logNo] = process.argv.slice(2);
if (!file || !/^\d{6,}$/.test(logNo || '')) {
  console.error('사용: node scripts/edit-naver-post.mjs "out/<글>.json" <logNo>');
  process.exit(1);
}

const article = JSON.parse(fs.readFileSync(file, 'utf8'));
const cfg = loadConfig();
const urls = naverUrls(cfg);
log.banner(`네이버 글 수정: ${urls.blogId}/${logNo}`);

// 이미지·메타 조립 — cli.js cmdPublishFile 과 같은 순서
const rendered = await renderImages(article, cfg);
const ordered = [rendered.thumbnail, ...rendered.body].filter(Boolean);
const imageFiles = ordered.map((i) => i.file);
const imageMeta = ordered.map((img, idx) => ({
  alt: img.alt || '',
  caption: idx === 0 ? '' : img.caption || '',
  afterSection: idx === 0 ? 0 : img.afterSection,
  afterParagraph: idx === 0 ? null : img.afterParagraph ?? null,
  group: idx === 0 ? '' : img.group || '',
}));
const credits = ordered.map((i) => i.background).filter((b) => b && (b.photographer || b.credit));

const ctx = await launchBrowser(cfg);
try {
  const page = await firstPage(ctx);
  await ensureLoggedIn(page, cfg, urls, { interactive: true });
  await saveSession(ctx, cfg, 'naver');

  // 편집 모드로 연다 — writeCandidates 를 통째로 바꿔 openEditor 를 재사용한다
  const editUrl = `https://blog.naver.com/${urls.blogId}/postwrite?logNo=${logNo}`;
  await openEditor(page, { ...urls, writeCandidates: [editUrl], newPost: editUrl });

  // ── 문서 비우기 — 제목과 빈 텍스트 하나만 남긴다 ────────────────────────
  // 기존 컴포넌트(사진·표·책카드)가 남아 있으면 업로드 회수가 섞이고,
  // 커서가 표·인용구 안에 들어가 사진이 셀 안에 박힌다.
  const clearedTitle = await page.evaluate(() => {
    const e = window.__seEd();
    const cur = e.getDocumentData();
    const comps = cur.document.components || [];
    const keep = comps.filter((c) => c['@ctype'] === 'documentTitle');
    // 빈 텍스트가 하나는 있어야 커서를 둘 곳이 생긴다 — 기존 첫 텍스트를 재사용
    const firstText = comps.find((c) => c['@ctype'] === 'text');
    if (firstText) keep.push(firstText);
    e.setDocumentData({ ...cur, document: { ...cur.document, components: keep } });
    return e.getDocumentTitle();
  });
  log.ok(`기존 문서 비움 (제목 유지: "${clearedTitle}")`);
  await page.waitForTimeout(1500);

  // ── 이후는 새 발행과 동일 ────────────────────────────────────────────────
  const images = await uploadImages(page, imageFiles);
  await injectDocument(page, article, { cfg, images, imageMeta, credits });

  if (article.mode === 'book') {
    const bookTitle = String(article.topic || article.title || '')
      .replace(/^책\s*:\s*/, '')
      .split('—')[0]
      .replace(/\(.*?\)/g, '')
      .trim();
    try {
      await attachBookMaterial(page, bookTitle);
    } catch (err) {
      log.warn(`책 글감 첨부 실패 (수정은 계속합니다): ${err.message.slice(0, 100)}`);
      await page.locator('button:has-text("글감")').first().click({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(800);
      await page.keyboard.press('Escape').catch(() => {});
    }
  }

  await openPublishLayer(page);
  await selectCategory(page, cfg.naver.category, {
    article,
    aliases: cfg.naver.categoryAliases,
    fallback: cfg.naver.categoryFallback,
  });
  await setTags(page, article.tags, { max: cfg.naver.tagCount });
  await setVisibility(page, cfg.naver.visibility);
  await setPublishOptions(page, cfg);

  const result = await clickPublish(page, urls);
  if (!result.ok) throw new Error(result.reason || '수정 발행에 실패했습니다.');
  log.ok(`수정 완료: ${result.postUrl || result.url}`);
} finally {
  await new Promise((r) => setTimeout(r, 1200));
  await ctx.close().catch(() => {});
}
