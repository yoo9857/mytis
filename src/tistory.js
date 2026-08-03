import fs from 'node:fs';
import path from 'node:path';
import { log } from './log.js';
import { shot, findFirst, clickIfPresent, setDialogPolicy } from './browser.js';
import { DIRS, stamp } from './paths.js';
import { pickCategory } from './category.js';

/**
 * 티스토리 글쓰기 화면 자동화.
 * 티스토리는 공지 없이 마크업이 바뀌므로 모든 조작에 셀렉터 후보를 여러 개 두고,
 * 실패하면 텍스트 기반 로케이터로 폴백한다.
 */

const SEL = {
  editorReady: [
    '#editor-tistory',
    '#post-title-inp',
    '.editor_area',
    '#editorContainer',
    'textarea[placeholder*="제목"]',
  ],
  title: [
    '#post-title-inp',
    'textarea[placeholder*="제목"]',
    'input[placeholder*="제목"]',
    '.textarea_tit',
    '#title',
  ],
  modeButton: [
    '#editor-mode-layer-btn-open',
    '#editor-mode-layer-btn',
    'button[class*="btn_editor_mode"]',
    'button:has-text("기본모드")',
    'button:has-text("HTML")',
    'button:has-text("마크다운")',
  ],
  // 티스토리 현재 마크업은 id 에 '-tistory' 접미사가 붙는다 (2026-07 확인)
  modeHtml: [
    '#editor-mode-html-tistory',
    '#editor-mode-html',
    '#editor-mode-html-text',
    'li#editor-mode-html a',
    'a:has-text("HTML")',
    'button:has-text("HTML")',
  ],
  modeBasic: [
    '#editor-mode-kakao-tistory',
    '#editor-mode-kakao',
    '#editor-mode-kakao-text',
    'li#editor-mode-kakao a',
    'a:has-text("기본모드")',
    'button:has-text("기본모드")',
  ],
  codeMirror: ['.CodeMirror', '.cm-editor', '#html-editor', 'textarea.html-editor'],
  editorIframe: ['#editor-tistory_ifr', 'iframe[id*="editor"]', 'iframe.tox-edit-area__iframe'],
  fileInput: ['input[type="file"]'],
  // 티스토리 툴바의 첨부는 드롭다운이다. 버튼을 눌러 메뉴를 열고 '사진'을 골라야
  // 파일 선택창이 뜬다. (2026-07 확인: aria-label="첨부" + mce-i-image 아이콘)
  attachButton: [
    '#mceu_0-open',
    'div[aria-label="첨부"] .mce-open',
    'div[aria-label="첨부"]',
    'div.mce-btn:has(.mce-i-image)',
  ],
  attachPhotoItem: [
    '.mce-tistory-attach-item:has-text("사진")',
    '.mce-menu-item:has-text("사진")',
    '[role="menuitem"]:has-text("사진")',
  ],
  completeButton: [
    '#publish-layer-btn',
    'button:has-text("완료")',
    '.btn_type1:has-text("완료")',
  ],
  publishLayer: ['#publish-layer', '.layer_post', '[class*="publish"][class*="layer"]'],
  categoryButton: ['#category-btn', 'button:has-text("카테고리")', '.btn_category'],
  categoryList: ['#category-list', '.list_category', '[id*="category"] ul'],
  tagInput: ['#tagText', 'input[placeholder*="태그"]', '#tag-input', 'input[name="tag"]'],
  publishButton: [
    '#publish-btn',
    'button:has-text("공개 발행")',
    'button:has-text("비공개 발행")',
    'button:has-text("발행")',
  ],
  visibility: {
    public: ['#open20', 'label[for="open20"]', 'input[value="20"]'],
    protected: ['#open15', 'label[for="open15"]', 'input[value="15"]'],
    private: ['#open0', 'label[for="open0"]', 'input[value="0"]'],
  },
  reserveRadio: ['#radio_reserve', 'label:has-text("예약")', 'input[value="reserve"]'],
  nowRadio: ['#radio_now', 'label:has-text("현재")', 'input[value="now"]'],
};

const IMAGE_MACRO_RE = /\[##_Image\|[\s\S]*?_##\]/g;

async function sleep(page, ms) {
  await page.waitForTimeout(ms);
}

/** 글쓰기 화면 열기 */
export async function openEditor(page, urls) {
  log.step('글쓰기 화면 열기');
  setDialogPolicy(page, 'auto'); // 임시저장 복구는 거절
  await page.goto(urls.newPost, { waitUntil: 'domcontentloaded' });
  await sleep(page, 2500);

  if (page.url().includes('/auth/login')) {
    throw new Error('글쓰기 화면 접근 중 로그인 페이지로 튕겼습니다. 세션이 만료되었습니다.');
  }

  try {
    await findFirst(page, SEL.editorReady, { timeout: 25000 });
  } catch {
    await shot(page, 'editor-not-ready');
    throw new Error(
      '에디터가 열리지 않았습니다. `npm run probe` 로 화면 상태를 확인해 주세요. ' +
        `(현재 URL: ${page.url()})`
    );
  }
  await sleep(page, 1200);
  log.ok('에디터 준비 완료');
}

/** 현재 에디터 모드 문자열 ('기본모드' | 'HTML' | '마크다운' 중 하나로 추정) */
async function currentMode(page) {
  try {
    const { locator } = await findFirst(page, SEL.modeButton, { timeout: 3000 });
    return ((await locator.innerText()) || '').trim();
  } catch {
    return '';
  }
}

/** 에디터 모드를 전환한다. mode: 'html' | 'basic' */
export async function setMode(page, mode) {
  const want = mode === 'html' ? 'HTML' : '기본';
  const now = await currentMode(page);
  if (now.includes(want)) {
    log.debug(`에디터 모드 이미 ${now}`);
    return true;
  }

  log.debug(`에디터 모드 전환: ${now || '?'} → ${want}`);
  // 모드 전환 confirm 은 수락해야 한다
  setDialogPolicy(page, 'accept');
  try {
    const btn = await findFirst(page, SEL.modeButton, { timeout: 8000 });
    await btn.locator.click();
    await sleep(page, 700);

    const target = mode === 'html' ? SEL.modeHtml : SEL.modeBasic;
    const item = await findFirst(page, target, { timeout: 6000 });
    await item.locator.click();
    await sleep(page, 2200);

    const after = await currentMode(page);
    const ok = after.includes(want);
    if (!ok) log.warn(`모드 전환 확인 실패 (표시: "${after}")`);
    return ok;
  } catch (err) {
    log.warn(`에디터 모드 전환 실패: ${err.message}`);
    await shot(page, `mode-switch-fail-${mode}`);
    return false;
  } finally {
    setDialogPolicy(page, 'auto');
  }
}

/** HTML 모드 에디터(CodeMirror)의 값을 읽는다. */
async function readHtmlMode(page) {
  return page.evaluate(() => {
    const wrap = document.querySelector('.CodeMirror');
    if (wrap && wrap.CodeMirror) return wrap.CodeMirror.getValue();
    const cm6 = document.querySelector('.cm-editor .cm-content');
    if (cm6) return cm6.innerText;
    const ta = document.querySelector('textarea.html-editor, #html-editor');
    if (ta) return ta.value;
    return null;
  });
}

/** HTML 모드 에디터에 값을 넣는다. */
async function writeHtmlMode(page, html) {
  const ok = await page.evaluate((value) => {
    const wrap = document.querySelector('.CodeMirror');
    if (wrap && wrap.CodeMirror) {
      wrap.CodeMirror.setValue(value);
      wrap.CodeMirror.refresh();
      return 'codemirror5';
    }
    const ta = document.querySelector('textarea.html-editor, #html-editor');
    if (ta) {
      ta.value = value;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      return 'textarea';
    }
    return null;
  }, html);

  if (ok) {
    log.debug(`HTML 모드 입력 성공 (${ok})`);
    return true;
  }

  // CodeMirror 6 등 API 가 없으면 키보드 입력으로 폴백
  try {
    const cm = await findFirst(page, ['.cm-editor .cm-content', '.CodeMirror'], { timeout: 4000 });
    await cm.locator.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.insertText(html);
    log.debug('HTML 모드 입력 성공 (keyboard)');
    return true;
  } catch (err) {
    log.warn(`HTML 모드 입력 실패: ${err.message}`);
    return false;
  }
}

/** 위지윅(TinyMCE) 본문에 HTML 을 넣는다. */
async function writeWysiwyg(page, html) {
  const viaApi = await page.evaluate((value) => {
    const ed = window.tinymce?.activeEditor || window.tinyMCE?.activeEditor;
    if (ed && typeof ed.setContent === 'function') {
      ed.setContent(value);
      ed.fire?.('change');
      return true;
    }
    return false;
  }, html);
  if (viaApi) {
    log.debug('위지윅 입력 성공 (tinymce API)');
    return true;
  }

  try {
    const { selector } = await findFirst(page, SEL.editorIframe, { timeout: 5000, state: 'attached' });
    const frame = page.frameLocator(selector);
    await frame.locator('body').first().evaluate((body, value) => {
      body.innerHTML = value;
      body.dispatchEvent(new Event('input', { bubbles: true }));
    }, html);
    log.debug('위지윅 입력 성공 (iframe innerHTML)');
    return true;
  } catch (err) {
    log.warn(`위지윅 입력 실패: ${err.message}`);
    return false;
  }
}

/** 위지윅 본문에 들어간 이미지 개수 (업로드 완료 확인용) */
async function countEditorImages(page) {
  try {
    const { selector } = await findFirst(page, SEL.editorIframe, {
      timeout: 3000,
      state: 'attached',
    });
    return await page.frameLocator(selector).locator('img').count();
  } catch {
    return 0;
  }
}

/** 위지윅 본문의 실제 텍스트 길이 — 저장될 내용이 들어갔는지 확인용 */
async function wysiwygTextLength(page) {
  try {
    const { selector } = await findFirst(page, SEL.editorIframe, {
      timeout: 4000,
      state: 'attached',
    });
    return await page
      .frameLocator(selector)
      .locator('body')
      .first()
      .evaluate((b) => (b.innerText || '').trim().length);
  } catch {
    return 0;
  }
}

/** 본문을 비운다. */
async function clearBody(page) {
  await page.evaluate(() => {
    const wrap = document.querySelector('.CodeMirror');
    if (wrap && wrap.CodeMirror) wrap.CodeMirror.setValue('');
    const ed = window.tinymce?.activeEditor || window.tinyMCE?.activeEditor;
    if (ed && typeof ed.setContent === 'function') ed.setContent('');
  });
}

/**
 * 이미지를 에디터에 업로드하고, 본문에 삽입할 마크업 문자열 배열을 돌려준다.
 * 티스토리는 첨부 이미지를 [##_Image|...|_##] 매크로로 저장하므로 그 원문을 확보한다.
 */
export async function uploadImages(page, files) {
  if (!files.length) return [];
  log.step(`이미지 ${files.length}장 업로드`);

  const existing = files.filter((f) => fs.existsSync(f));
  if (existing.length !== files.length) {
    log.warn(`이미지 파일 ${files.length - existing.length}개를 찾을 수 없어 건너뜁니다.`);
  }
  if (!existing.length) return [];

  await setMode(page, 'basic');
  await clearBody(page);
  await sleep(page, 600);

  for (let i = 0; i < existing.length; i++) {
    const file = existing[i];
    let uploaded = false;

    // 첨부 드롭다운 → '사진' → 파일 선택 다이얼로그 가로채기.
    // 첫 업로드 이후 생기는 input[type=file] 에 직접 넣으면 업로드는 되지만
    // 본문에 삽입되지 않는 경우가 있어, 항상 이 경로를 쓴다.
    try {
      const btn = await findFirst(page, SEL.attachButton, { timeout: 6000 });
      await btn.locator.click();
      await sleep(page, 1200);

      const item = await findFirst(page, SEL.attachPhotoItem, { timeout: 6000 });
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 15000 }),
        item.locator.click(),
      ]);
      await chooser.setFiles(file);
      uploaded = true;
      log.debug(`이미지 주입 ${i + 1}/${existing.length}: ${path.basename(file)}`);
    } catch (err) {
      log.warn(`이미지 업로드 실패 (${path.basename(file)}): ${err.message.split('\n')[0]}`);
      await page.keyboard.press('Escape').catch(() => {});
    }

    if (uploaded) {
      // 업로드가 본문에 반영될 때까지 기다린다 (매크로 개수가 늘어나는지로 확인)
      const want = i + 1;
      const deadline = Date.now() + 30_000;
      let got = 0;
      while (Date.now() < deadline) {
        await sleep(page, 1500);
        got = await countEditorImages(page);
        if (got >= want) break;
      }
      if (got < want) {
        log.warn(`이미지 ${want}번째가 본문에 반영되지 않았습니다 (현재 ${got}장).`);
      }
      await page.keyboard.press('End').catch(() => {});
      await page.keyboard.press('Enter').catch(() => {});
      await sleep(page, 500);
    }
  }

  await sleep(page, 2000);

  // HTML 모드로 넘어가 매크로 원문을 회수
  await setMode(page, 'html');
  await sleep(page, 1200);
  const raw = (await readHtmlMode(page)) || '';
  const macros = raw.match(IMAGE_MACRO_RE) || [];

  if (macros.length) {
    log.ok(`이미지 매크로 ${macros.length}개 확보`);
    return macros;
  }

  // 매크로가 없으면 CDN URL 을 그대로 쓴다
  const srcs = [...raw.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
  if (srcs.length) {
    log.ok(`이미지 URL ${srcs.length}개 확보 (매크로 미사용)`);
    return srcs.map((s) => `<img src="${s}" style="max-width:100%;height:auto;" />`);
  }

  log.warn('업로드된 이미지를 본문에서 찾지 못했습니다. 이미지 없이 진행합니다.');
  await shot(page, 'image-upload-empty');
  return [];
}

/** 제목 입력 */
export async function setTitle(page, title) {
  const { locator } = await findFirst(page, SEL.title, { timeout: 12000 });
  await locator.click();
  await locator.fill('');
  await sleep(page, 200);
  await locator.fill(title);
  await sleep(page, 300);
  const got = await locator.inputValue().catch(() => '');
  if (!got) {
    // fill 이 안 먹는 컨트롤이면 타이핑으로 폴백
    await locator.type(title, { delay: 20 });
  }
  log.ok(`제목 입력: ${title}`);
}

/**
 * 본문 HTML 입력.
 *
 * 중요: 티스토리는 **위지윅(기본모드) 모델을 기준으로 글을 저장**한다.
 * HTML 모드의 CodeMirror 에 값만 넣고 발행하면, 위지윅 모델에는 반영되지 않아
 * 본문이 통째로 사라진다(업로드해 둔 이미지만 남는다).
 * 그래서 HTML 을 넣은 뒤 반드시 기본모드로 되돌려 티스토리가 파싱하도록 만든다.
 */
export async function setBody(page, html) {
  const htmlMode = await setMode(page, 'html');

  if (htmlMode && (await writeHtmlMode(page, html))) {
    await sleep(page, 1000);
    const written = (await readHtmlMode(page)) || '';
    log.debug(`HTML 모드 입력 확인: ${written.length}자`);

    // 기본모드로 되돌려 위지윅 모델에 반영시킨다
    await setMode(page, 'basic');

    /* ⚠️ **고정 대기 2초로는 모자랐다.**
     *
     * HTML 모드에서 기본모드로 돌아오면 에디터 iframe 이 다시 붙는데, 그 시점이
     * 글 길이·네트워크에 따라 흔들린다. 2초 뒤 한 번만 재면 0 자가 나오고,
     * 그러면 멀쩡히 들어간 본문을 두고 위지윅 폴백을 또 돌린다.
     *
     * > 2026-08-03 실측: 티스토리 발행 2건 모두 `기본모드 반영이 부족합니다
     * > (본문 0자)` 가 찍혔고, 곧이어 같은 함수가 폴백 뒤 7,156자를 정상으로 읽었다.
     * > 측정기는 멀쩡했고 **타이밍만 일렀다.** 주 경로가 매번 죽고 폴백으로만
     * > 발행되고 있었다 — 폴백이 깨지는 날 글이 빈 채로 나간다.
     *
     * 그래서 **채워질 때까지 폴링**한다. 진짜로 비었으면 그때 폴백으로 간다. */
    let len = 0;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      await sleep(page, 700);
      len = await wysiwygTextLength(page);
      if (len > 200) break;
    }
    if (len > 200) {
      log.ok(`본문 입력 완료 (${html.length.toLocaleString()}자 → 본문 ${len.toLocaleString()}자)`);
      return true;
    }
    log.warn(`기본모드 반영이 부족합니다 (10초 대기 뒤 본문 ${len}자). 위지윅 직접 입력으로 재시도합니다.`);
  }

  // 폴백: 위지윅에 직접 주입
  await setMode(page, 'basic');
  if (await writeWysiwyg(page, html)) {
    await sleep(page, 1200);
    const len = await wysiwygTextLength(page);
    if (len > 200) {
      log.ok(`본문 입력 완료 (위지윅 직접, 본문 ${len.toLocaleString()}자)`);
      return true;
    }
  }

  await shot(page, 'body-input-fail');
  throw new Error(
    '본문을 에디터에 넣지 못했습니다. `npm run probe` 로 에디터 구조를 확인하세요.'
  );
}

/**
 * 발행 설정 레이어 열기.
 * 레이어가 실제로 열렸는지는 레이어 안에만 있는 요소(#publish-btn, #open20)로 확인한다.
 */
export async function openPublishLayer(page) {
  log.step('발행 설정 열기');

  for (let attempt = 1; attempt <= 3; attempt++) {
    const { locator } = await findFirst(page, SEL.completeButton, { timeout: 12000 });
    await locator.click();
    await sleep(page, 2500);

    const opened = await page
      .locator('#publish-btn, #open20, #urlPublish')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (opened) {
      log.ok('발행 레이어 열림');
      await sleep(page, 500);
      return true;
    }
    log.debug(`발행 레이어가 열리지 않음 (${attempt}/3) — 다시 시도`);
  }

  await shot(page, 'publish-layer-fail');
  throw new Error('발행 설정 레이어를 열지 못했습니다. `npm run probe` 로 화면을 확인하세요.');
}

/**
 * 발행 레이어의 대표 이미지 박스(.box_thumb)가 채워졌는지 확인한다.
 *
 * ⚠️ 티스토리 신 에디터에는 **대표 이미지를 고르는 UI 가 없다** (2026-07-30 실측
 * 4단계 — probe-thumb*.mjs). 발행 레이어의 box_thumb 는 본문 **첫 번째 이미지**를
 * 자동 표시할 뿐이고(클릭 무반응, 삭제만 가능), 에디터의 이미지 툴바에도
 * '대표 지정' 버튼이 없다(편집·크기·정렬·링크·대체텍스트뿐).
 *
 * 그래서 대표를 정하는 유일한 방법은 **원하는 이미지를 본문 맨 앞에 두는 것**이고,
 * 파이프라인은 이미 그렇게 한다({{IMAGE_0}} = 대표). 여기서는 그 결과가 실제로
 * 반영됐는지만 확인한다 — 비어 있으면 목록·공유 카드에 썸네일이 안 뜬다.
 */
export async function checkThumbBox(page) {
  try {
    const bg = await page
      .locator('.box_thumb .thumb_g')
      .first()
      .evaluate((el) => el.style.backgroundImage || '', { timeout: 3000 });
    if (bg && bg.includes('url')) {
      log.debug('대표 이미지 확인: 본문 첫 이미지가 자동 지정됐습니다.');
      return true;
    }
    log.warn('대표 이미지가 비어 있습니다 — 본문에 이미지가 없으면 목록 카드에 썸네일이 안 뜹니다.');
    return false;
  } catch {
    return null; // 박스를 못 찾은 것은 마크업 변경일 수 있다 — 발행은 계속한다
  }
}

/**
 * 카테고리 선택.
 *
 * 티스토리 카테고리 목록은 TinyMCE 드롭다운(.mce-menu-item)으로 뜨고,
 * 하위 카테고리는 앞에 "- " 가 붙는다. 에디터 모드 메뉴도 같은 클래스를 쓰므로
 * 반드시 '보이는' 메뉴 안에서만 찾아야 한다.
 *
 * name 에 "auto" 를 주면 목록을 읽어 **글 내용에 맞는 카테고리를 직접 고른다.**
 * (config.json 의 blog.category 를 "auto" 로 두면 된다)
 *
 * @param {string} name           카테고리 이름 · "auto" · 빈 값
 * @param {object} [opts]
 * @param {object} [opts.article] auto 일 때 판단 근거로 쓸 아티클
 * @param {object} [opts.aliases] 카테고리 별칭 (config.json 의 blog.categoryAliases)
 * @param {string} [opts.fallback] auto 가 확신하지 못했을 때 쓸 카테고리
 */
export async function selectCategory(page, name, opts = {}) {
  // 주의: 티스토리에서 카테고리를 '건드리지 않는 것'은 '분류 없음'이 아니라
  // **직전에 쓴 카테고리를 그대로 물려받는 것**이다. 설정을 비워 두면 글이
  // 엉뚱한 카테고리에 조용히 들어간다. 그래서 비어 있으면 명시적으로
  // "카테고리 없음"을 고른다.
  const raw = (name || '').trim();
  if (!raw) {
    log.warn(
      '카테고리가 설정되지 않았습니다. 직전 카테고리를 물려받지 않도록 "카테고리 없음"을 지정합니다. ' +
        '(.env 의 TISTORY_CATEGORY 또는 config.json 의 blog.category 를 채우세요. ' +
        '"auto" 로 두면 글 내용에 맞춰 자동으로 고릅니다)'
    );
    return selectCategory(page, '카테고리 없음');
  }

  const isAuto = raw.toLowerCase() === 'auto';

  try {
    const btn = await findFirst(page, SEL.categoryButton, { timeout: 6000 });
    await btn.locator.click();
    await sleep(page, 1200);

    const items = page.locator('.mce-menu-item:visible');
    const count = await items.count();
    if (!count) {
      log.warn('카테고리 목록이 열리지 않았습니다.');
      await page.keyboard.press('Escape').catch(() => {});
      return false;
    }

    // 하위 카테고리 표시("- ")를 떼고 목록을 만든다. 깊이도 함께 기억한다.
    // 항목이 수십 개라 한 번에 읽어온다 (하나씩 읽으면 매우 느리다).
    const rawNames = await items.allInnerTexts();
    const entries = rawNames.map((t, index) => {
      const s = t.trim();
      const m = s.match(/^(-\s*)+/);
      return {
        index,
        depth: m ? m[0].split('-').length - 1 : 0,
        name: s.replace(/^(-\s*)+/, ''),
      };
    });
    const names = entries.map((e) => e.name);

    let target = raw;
    if (isAuto) {
      const { picked, ranked, ambiguous } = pickCategory(opts.article || {}, entries, {
        aliases: opts.aliases,
      });
      const top = ranked
        .slice(0, 3)
        .filter((r) => r.score > 0)
        .map((r) => `${r.name}(${r.score}${r.hits.length ? ' ← ' + r.hits.join(',') : ''})`)
        .join(' · ');
      log.debug(`카테고리 후보: ${top || '(근거 없음)'}`);

      if (picked) {
        target = picked.name;
        log.ok(`카테고리 자동 선택: ${target} (점수 ${picked.score} ← ${picked.hits.join(', ')})`);
      } else {
        target = (opts.fallback || '').trim() || '카테고리 없음';
        log.warn(
          `카테고리를 자동으로 확신하지 못했습니다${ambiguous ? ' (1·2위 점수가 비슷함)' : ''}. ` +
            `"${target}" 로 발행합니다.` + (top ? ` 후보: ${top}` : '')
        );
      }
    }

    const exact = names.findIndex((n) => n === target);
    const partial = names.findIndex((n) => n.includes(target));

    const pick = exact >= 0 ? exact : partial;
    if (pick < 0) {
      log.warn(
        `카테고리 "${target}" 를 찾지 못했습니다. 사용 가능: ${names.filter(Boolean).join(' / ').slice(0, 300)}`
      );
      await page.keyboard.press('Escape').catch(() => {});
      return false;
    }

    await items.nth(pick).click();
    await sleep(page, 900);

    const shown = ((await page.locator('#category-btn').innerText().catch(() => '')) || '').trim();
    log.ok(`카테고리 선택: ${names[pick]}${shown ? ` (표시: ${shown.split('\n')[0]})` : ''}`);
    return true;
  } catch (err) {
    log.warn(`카테고리 선택 실패: ${err.message}`);
    await page.keyboard.press('Escape').catch(() => {});
    return false;
  }
}

/**
 * 글 주소(슬러그) 설정.
 * 티스토리는 제목을 그대로 URL 로 쓰는데, 한글 제목이면 퍼센트 인코딩된 긴 주소가 되어
 * 검색엔진에서 불리하다. 영문 슬러그로 바꿔준다.
 */
export async function setPostUrl(page, slug) {
  const clean = String(slug || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
  if (!clean || /[가-힣]/.test(clean)) {
    log.debug('영문 슬러그가 없어 티스토리 기본 주소를 씁니다.');
    return false;
  }
  try {
    const input = page.locator('#urlPublish');
    if ((await input.count()) === 0) {
      log.debug('글 주소 입력창(#urlPublish)이 없습니다.');
      return false;
    }
    await input.fill(clean);
    await sleep(page, 400);
    log.ok(`글 주소: /${clean}`);
    return true;
  } catch (err) {
    log.warn(`글 주소 설정 실패: ${err.message}`);
    return false;
  }
}

/** 태그 입력 */
export async function setTags(page, tags) {
  if (!tags?.length) return false;
  try {
    const { locator } = await findFirst(page, SEL.tagInput, { timeout: 6000 });
    await locator.click();
    for (const tag of tags) {
      const clean = tag.replace(/[,#]/g, '').trim();
      if (!clean) continue;
      await locator.type(clean, { delay: 25 });
      await sleep(page, 200);
      await page.keyboard.press('Enter');
      await sleep(page, 350);
    }
    log.ok(`태그 ${tags.length}개 입력: ${tags.join(', ')}`);
    return true;
  } catch (err) {
    log.warn(`태그 입력 실패: ${err.message}`);
    return false;
  }
}

/** 공개 설정 */
export async function setVisibility(page, visibility) {
  const key = ['public', 'protected', 'private'].includes(visibility) ? visibility : 'public';
  const label = { public: '공개', protected: '보호', private: '비공개' }[key];
  const ok = await clickIfPresent(page, SEL.visibility[key], { timeout: 5000 });
  if (ok) log.ok(`공개 설정: ${label}`);
  else log.warn(`공개 설정(${label})을 적용하지 못했습니다. 기본값으로 발행됩니다.`);
  return ok;
}

/** 예약 발행 시각 설정 (best-effort) */
export async function setReserve(page, minutesLater) {
  try {
    const clicked = await clickIfPresent(page, SEL.reserveRadio, { timeout: 4000 });
    if (!clicked) {
      log.warn('예약 발행 옵션을 찾지 못했습니다. 즉시 발행으로 진행합니다.');
      return false;
    }
    await sleep(page, 800);

    const when = new Date(Date.now() + minutesLater * 60_000);
    const p = (n) => String(n).padStart(2, '0');
    const dateStr = `${when.getFullYear()}-${p(when.getMonth() + 1)}-${p(when.getDate())}`;
    const timeStr = `${p(when.getHours())}:${p(when.getMinutes())}`;

    const dateInput = page.locator('input[type="date"], #publish-date, .inp_date').first();
    if ((await dateInput.count()) > 0) await dateInput.fill(dateStr).catch(() => {});
    const timeInput = page.locator('input[type="time"], #publish-time, .inp_time').first();
    if ((await timeInput.count()) > 0) await timeInput.fill(timeStr).catch(() => {});

    log.ok(`예약 발행: ${dateStr} ${timeStr}`);
    return true;
  } catch (err) {
    log.warn(`예약 발행 설정 실패: ${err.message}`);
    return false;
  }
}

/** 최종 발행 */
export async function clickPublish(page, urls) {
  log.step('발행');
  setDialogPolicy(page, 'accept');
  try {
    const { locator } = await findFirst(page, SEL.publishButton, { timeout: 10000 });
    const label = ((await locator.innerText().catch(() => '')) || '발행').trim();
    await locator.click();
    log.info(`"${label}" 클릭. 결과를 확인합니다...`);

    // 발행되면 글쓰기 화면을 벗어난다
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await sleep(page, 1500);
      const url = page.url();
      if (!url.includes('/manage/newpost')) {
        log.ok(`발행 완료 → ${url}`);
        return { ok: true, url };
      }
    }

    await shot(page, 'publish-timeout');
    return {
      ok: false,
      url: page.url(),
      reason: '발행 버튼을 눌렀지만 글쓰기 화면을 벗어나지 않았습니다.',
    };
  } finally {
    setDialogPolicy(page, 'auto');
  }
}

/**
 * 발행된 글을 다시 열어 **실제로 실렸는지** 확인한다 (HANDOVER §8-4).
 *
 * 함정 ③(위지윅 0자)이 재발하면 본문 없는 빈 글이 그대로 나간다. `setBody` 의
 * 검증이 1차 방어지만, 그 뒤 어딘가에서 내용이 사라지는 사고는 발행 후에만
 * 보인다. 발행을 되돌릴 수는 없으므로 **경고만 하고 결과에 수치를 남긴다** —
 * 로그에서 `발행 검증` 줄이 WARN 이면 글을 열어 봐야 한다.
 */
export async function verifyPublished(page, postUrl, { minChars = 1000, imageCount = 0 } = {}) {
  try {
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await sleep(page, 1500);
    const info = await page.evaluate(() => {
      const scope =
        document.querySelector('.tt_article_useless_p_margin') || // 신 에디터 본문 컨테이너
        document.querySelector('.entry-content, .article_view, #article-view, article') ||
        document.body;
      return {
        chars: (scope?.innerText || '').replace(/\s+/g, ' ').trim().length,
        images: scope ? scope.querySelectorAll('img').length : 0,
      };
    });

    const problems = [];
    if (info.chars < minChars) problems.push(`본문 ${info.chars}자 (기준 ${minChars}자)`);
    if (imageCount && info.images < imageCount) problems.push(`이미지 ${info.images}/${imageCount}장`);

    if (problems.length) {
      await shot(page, 'verify-failed');
      log.warn(`발행 검증 실패: ${problems.join(' · ')} — 글을 열어 확인하세요: ${postUrl}`);
    } else {
      log.ok(`발행 검증: 본문 ${info.chars.toLocaleString()}자 · 이미지 ${info.images}장`);
    }
    return { ...info, ok: !problems.length };
  } catch (err) {
    // 검증 실패가 발행 성공을 뒤집으면 안 된다 — 스킨·네트워크 문제일 수 있다
    log.warn(`발행 검증을 건너뜁니다 (${err.message.split('\n')[0]})`);
    return { ok: null };
  }
}

/**
 * 발행 직전에 글 주소를 확정한다.
 * 티스토리 글 주소는 /entry/{슬러그} 형식이고, 그 슬러그가 곧 #urlPublish 의 값이다.
 * 발행 후에 목록을 뒤지는 것보다 이 값을 읽는 편이 정확하다.
 */
export async function readPostUrl(page, urls) {
  try {
    const slug = await page.locator('#urlPublish').inputValue().catch(() => '');
    if (slug) return `${urls.home}entry/${encodeURIComponent(slug)}`;
  } catch {
    /* 읽기 실패는 치명적이지 않음 */
  }
  return null;
}

/**
 * 전체 발행 파이프라인.
 * @returns {Promise<{ok:boolean, url?:string, reason?:string}>}
 */
export async function publishPost(
  page,
  urls,
  cfg,
  { title, html, imageFiles = [], tags = [], urlSlug = '', article = null }
) {
  await openEditor(page, urls);

  // 1) 이미지 먼저 업로드해서 티스토리 매크로/URL 을 확보
  const macros = await uploadImages(page, imageFiles);

  // 2) 확보한 마크업을 본문 HTML 의 자리표시자와 치환
  //    업로드 개수가 어긋나면 이미지가 엉뚱한 자리에 붙으므로 경고를 남긴다
  if (imageFiles.length && macros.length !== imageFiles.length) {
    log.warn(
      `이미지 ${imageFiles.length}장 중 ${macros.length}장만 확보됐습니다. ` +
        '앞에서부터 순서대로 배치하고 나머지 자리는 비웁니다.'
    );
  }

  let finalHtml = html;
  macros.forEach((macro, i) => {
    finalHtml = finalHtml.replace(new RegExp(`\\{\\{IMAGE_${i}\\}\\}`, 'g'), macro);
  });
  // 남은 자리표시자와, 그 때문에 빈 껍데기만 남은 문단을 정리한다
  finalHtml = finalHtml
    .replace(/<p style="text-align:center;">\s*\{\{IMAGE_\d+\}\}\s*<\/p>/g, '')
    .replace(/\{\{IMAGE_\d+\}\}/g, '');

  // 3) 제목 · 본문
  await setTitle(page, title);
  await setBody(page, finalHtml);

  // 4) 에디터 화면에 있는 설정 (카테고리·태그)
  //    주의: 발행 레이어를 연 뒤에 이걸 건드리면 레이어가 닫힌다. 반드시 먼저 처리한다.
  await selectCategory(page, cfg.blog.category, {
    article: article || { title, tags },
    aliases: cfg.blog.categoryAliases,
    fallback: cfg.blog.categoryFallback,
  });
  await setTags(page, tags);

  // 5) 발행 레이어를 열고, 레이어 안에 있는 설정만 다룬다 (글 주소·공개 범위·예약)
  await openPublishLayer(page);
  await checkThumbBox(page); // 대표 이미지는 본문 첫 이미지 자동 지정뿐 — 채워졌는지만 확인
  await setPostUrl(page, urlSlug);
  await setVisibility(page, cfg.blog.visibility);
  if (cfg.blog.publishMode === 'reserve') {
    await setReserve(page, cfg.blog.reserveAfterMinutes);
  }

  await shot(page, 'before-publish');

  // 발행하면 레이어가 사라지므로 주소를 미리 읽어둔다
  const postUrl = await readPostUrl(page, urls);

  // 6) 발행
  const result = await clickPublish(page, urls);
  if (result.ok && postUrl) result.postUrl = postUrl;

  // 7) 발행 후 검증 — 빈 글이 조용히 나가는 것을 여기서 잡는다 (함정 ③ 재발 방어)
  if (result.ok && postUrl) {
    result.verify = await verifyPublished(page, postUrl, { imageCount: macros.length });
  }
  return result;
}

/** 에디터 구조를 파일로 덤프한다 (셀렉터가 깨졌을 때 진단용) */
export async function probeEditor(page, urls) {
  await page.goto(urls.newPost, { waitUntil: 'domcontentloaded' });
  await sleep(page, 4000);

  const info = await page.evaluate(() => {
    const list = (sel) =>
      [...document.querySelectorAll(sel)].slice(0, 60).map((el) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        cls: el.className?.toString?.().slice(0, 90) || undefined,
        text: (el.innerText || el.value || '').trim().slice(0, 50) || undefined,
        type: el.type || undefined,
        aria: el.getAttribute?.('aria-label') || undefined,
      }));
    return {
      url: location.href,
      title: document.title,
      hasTinymce: !!(window.tinymce || window.tinyMCE),
      hasCodeMirror: !!document.querySelector('.CodeMirror'),
      buttons: list('button'),
      inputs: list('input, textarea'),
      iframes: [...document.querySelectorAll('iframe')].map((f) => ({
        id: f.id,
        src: (f.src || '').slice(0, 80),
      })),
      idElements: [...document.querySelectorAll('[id]')]
        .slice(0, 200)
        .map((el) => el.id)
        .filter(Boolean),
    };
  });

  fs.mkdirSync(DIRS.logs, { recursive: true });
  const file = path.join(DIRS.logs, `probe-${stamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(info, null, 2), 'utf8');
  const png = await shot(page, 'probe');

  log.ok(`에디터 구조 덤프: ${file}`);
  if (png) log.ok(`스크린샷: ${png}`);
  log.info(`TinyMCE: ${info.hasTinymce} · CodeMirror: ${info.hasCodeMirror}`);
  return { file, png, info };
}
