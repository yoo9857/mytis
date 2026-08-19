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
  reserveRadio: [
    'button.btn_date:has-text("예약")',
    '#radio_reserve',
    'label:has-text("예약")',
    'button:has-text("예약")',
    '[role="radio"]:has-text("예약")',
    'input[type="radio"][value*="reserve" i]',
    'input[type="radio"][id*="reserve" i]',
    'label[for*="reserve" i]',
  ],
  nowRadio: ['button.btn_date:has-text("현재")', '#radio_now', 'label:has-text("현재")', 'input[value="now"]'],
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
      /* 화면만 바꾼 것으로 끝나면 티스토리의 저장 모델은 이전(빈) 본문을
       * 제출한다. TinyMCE 이벤트와 원본 textarea 동기화를 모두 발생시킨다. */
      ed.getBody?.().dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      ed.getBody?.().dispatchEvent(new Event('change', { bubbles: true }));
      ed.fire?.('input');
      ed.fire?.('change');
      ed.nodeChanged?.();
      ed.save?.();
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
/**
 * 위지윅 본문 글자수.
 *
 * **두 경로로 잰다.** iframe 을 먼저 보고, 0 이면 TinyMCE API 에 직접 묻는다.
 *
 * > 2026-08-03 실측: HTML 모드에서 기본모드로 돌아온 직후 iframe 경로가 **10초를
 * > 기다려도 0자**를 냈다. 처음엔 타이밍으로 보고 대기를 늘렸는데 그게 아니었다 —
 * > 그 시점의 `frameLocator` 가 새로 붙은 에디터를 못 잡는다. 정작 폴백으로
 * > 위지윅에 직접 쓰고 나면 **같은 함수가 6,501자를 정상으로 읽었다.**
 * > 그래서 매 발행마다 주 경로가 죽고 폴백으로만 나가고 있었다.
 * TinyMCE 인스턴스는 프레임 밖에서도 잡히므로 이쪽이 더 튼튼하다.
 */
async function wysiwygTextLength(page) {
  try {
    const { selector } = await findFirst(page, SEL.editorIframe, {
      timeout: 4000,
      state: 'attached',
    });
    const n = await page
      .frameLocator(selector)
      .locator('body')
      .first()
      .evaluate((b) => (b.innerText || '').trim().length);
    if (n > 0) return n;
  } catch {
    /* 아래 TinyMCE 경로로 넘어간다 */
  }
  try {
    return await page.evaluate(() => {
      const ed = window.tinymce?.activeEditor || window.tinyMCE?.activeEditor;
      if (!ed || typeof ed.getContent !== 'function') return 0;
      return String(ed.getContent({ format: 'text' }) || '').trim().length;
    });
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
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      await sleep(page, 700);
      len = await wysiwygTextLength(page);
      if (len > 200) break;
    }
    if (len > 200) {
      log.ok(`본문 입력 완료 (${html.length.toLocaleString()}자 → 본문 ${len.toLocaleString()}자)`);
      return true;
    }
    log.warn(`기본모드 반영이 부족합니다 (본문 ${len}자). 위지윅 직접 입력으로 재시도합니다.`);
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
/** 티스토리 태그 상한. **10개를 넘기면 입력창이 사라진다.**
 *
 * > 2026-08-03 실측: 태그 12개를 넣으려다 11번째에서
 * > `locator.type: Timeout 60000ms exceeded — #tagText` 로 60초를 버리고 죽었다.
 * > 앞의 10개는 정상으로 붙어 있었으므로 **부분 성공을 전체 실패로 보이게 하는**
 * > 로그이기도 했다.
 *
 * 그동안 안 드러난 이유: codexWriter 가 태그를 8개로 자르고 있어서 상한에 닿은
 * 적이 없었다. 그 자르기를 모드 규격(기사 12개)으로 푼 날 바로 터졌다.
 * — 한쪽의 제약을 풀 때는 그 값을 받는 **모든 곳**의 상한을 함께 본다. */
const TISTORY_MAX_TAGS = 10;

export async function setTags(page, tags) {
  if (!tags?.length) return false;
  const list = tags
    .map((t) => String(t).replace(/[,#]/g, '').trim())
    .filter(Boolean)
    .slice(0, TISTORY_MAX_TAGS);
  const dropped = tags.length - list.length;
  if (dropped > 0) {
    log.info(`티스토리 태그 상한 ${TISTORY_MAX_TAGS}개 — 뒤의 ${dropped}개는 넣지 않습니다.`);
  }
  try {
    const { locator } = await findFirst(page, SEL.tagInput, { timeout: 6000 });
    await locator.click();
    let done = 0;
    for (const clean of list) {
      /* 한 개가 실패해도 **앞서 넣은 것은 남는다.** 통째로 실패했다고 적으면
       * 사람이 글을 열어 보고 헛걸음한다 — 몇 개가 들어갔는지 세어 남긴다. */
      try {
        await locator.type(clean, { delay: 25, timeout: 8000 });
        await sleep(page, 200);
        await page.keyboard.press('Enter');
        await sleep(page, 350);
        done++;
      } catch (err) {
        log.warn(
          `태그 ${done + 1}번째('${clean}')에서 멈췄습니다 — ${done}개는 입력됐습니다. ` +
            `(${err.message.split('\n')[0]})`
        );
        break;
      }
    }
    if (done) log.ok(`태그 ${done}개 입력: ${list.slice(0, done).join(', ')}`);
    return done > 0;
  } catch (err) {
    log.warn(`태그 입력 실패: ${err.message.split('\n')[0]}`);
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
export async function setReserve(page, minutesLater, reserveAt = '') {
  try {
    let clicked = await clickIfPresent(page, SEL.reserveRadio, { timeout: 4000 });
    if (!clicked) {
      // Tistory occasionally renders the reservation control without a stable id/class.
      clicked = await page.evaluate(() => {
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        const nodes = [...document.querySelectorAll('label,button,a,li,span,div')]
          .filter((el) => visible(el) && /예약/.test((el.textContent || '').trim()))
          .sort((a, b) => (a.textContent || '').trim().length - (b.textContent || '').trim().length);
        const target = nodes.find((el) => /예약(?:\s*발행)?/.test((el.textContent || '').trim()));
        if (!target) return false;
        target.click();
        return true;
      }).catch(() => false);
    }
    if (!clicked) {
      log.error('예약 발행 옵션을 찾지 못했습니다. 즉시 발행으로 폴백하지 않습니다.');
      return false;
    }
    await sleep(page, 800);

    const when = reserveAt ? new Date(reserveAt) : new Date(Date.now() + minutesLater * 60_000);
    if (!Number.isFinite(when.getTime()) || when.getTime() <= Date.now()) {
      throw new Error(`유효하지 않은 예약 시각: ${reserveAt || minutesLater}`);
    }
    const p = (n) => String(n).padStart(2, '0');
    const dateStr = `${when.getFullYear()}-${p(when.getMonth() + 1)}-${p(when.getDate())}`;
    const timeStr = `${p(when.getHours())}:${p(when.getMinutes())}`;

    // `input[name*="date"]` is unsafe here: Tistory's hour/minute controls are
    // named dateHour/dateMinute, so the broad selector can mistake the hour for
    // the calendar date. Only accept controls that are unambiguously dates.
    const dateInput = page
      .locator([
        'input[type="date"]',
        'input#publish-date',
        'input[name="publishDate"]',
        'input[name="reserveDate"]',
        'input.inp_date:not([type="number"])',
      ].join(', '))
      .first();
    if ((await dateInput.count()) > 0) {
      await dateInput.fill(dateStr);
    } else {
      const shownDate = ((await page.locator('button.btn_reserve').first().innerText().catch(() => '')) || '').trim();
      const now = new Date();
      const targetIsToday = when.getFullYear() === now.getFullYear()
        && when.getMonth() === now.getMonth()
        && when.getDate() === now.getDate();
      // Tistory currently defaults the calendar to today and exposes only
      // dateHour/dateMinute inputs. A same-day reservation therefore needs no
      // calendar edit; for another day, fail closed unless the displayed date
      // can be verified.
      const normalizedShownDate = shownDate.replace(/[^0-9]/g, '');
      const normalizedTargetDate = dateStr.replace(/-/g, '');
      if (!targetIsToday && normalizedShownDate !== normalizedTargetDate) {
        throw new Error(`예약 날짜 입력 UI를 찾지 못했습니다 (화면 ${shownDate || '없음'} · 목표 ${dateStr})`);
      }
    }

    const timeInput = page
      .locator('input[type="time"], input#publish-time, input[name="publishTime"], input[name="reserveTime"], input.inp_time')
      .first();
    if ((await timeInput.count()) > 0) {
      await timeInput.fill(timeStr);
      if ((await timeInput.inputValue()) !== timeStr) {
        throw new Error(`예약 시간 설정 검증 실패 (${await timeInput.inputValue()} · 목표 ${timeStr})`);
      }
    } else {
      const hourInput = page.locator('#dateHour, input[name="dateHour"]').first();
      const minuteInput = page.locator('#dateMinute, input[name="dateMinute"]').first();
      if ((await hourInput.count()) === 0 || (await minuteInput.count()) === 0) {
        throw new Error('예약 시·분 입력칸을 찾지 못했습니다.');
      }
      await hourInput.fill(String(when.getHours()));
      await minuteInput.fill(String(when.getMinutes()));

      const gotHour = Number(await hourInput.inputValue());
      const gotMinute = Number(await minuteInput.inputValue());
      if (gotHour !== when.getHours() || gotMinute !== when.getMinutes()) {
        throw new Error(`예약 시간 설정 검증 실패 (${gotHour}:${gotMinute} · 목표 ${timeStr})`);
      }
    }

    const reserveButton = page.locator('button.btn_date').filter({ hasText: /^예약$/ }).first();
    if ((await reserveButton.count()) > 0) {
      const selected = await reserveButton.evaluate((el) => el.classList.contains('on'));
      if (!selected) throw new Error('예약 발행 옵션 선택 상태를 확인하지 못했습니다.');
    }

    log.ok(`예약 발행: ${dateStr} ${timeStr}`);
    return true;
  } catch (err) {
    log.warn(`예약 발행 설정 실패: ${err.message} — 즉시 발행하지 않고 중단합니다.`);
    return false;
  }
}

/**
 * 화면에 캡차가 떠 있는가.
 *
 * 티스토리는 `DKAPTCHA` 를 쓴다(지도에서 장소를 찾아 글자를 넣는 형태).
 * 클래스 이름 하나에 걸지 않고 **여러 신호를 함께** 본다 — 마크업이 바뀌어도
 * 문구는 남고, 문구가 바뀌어도 스크립트 이름은 남는다.
 */
async function hasCaptcha(page) {
  return page
    .evaluate(() => {
      const bigEnough = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 40 && r.height > 40;
      };
      /* 매칭된 노드 자신이 아니라 **부모까지 거슬러 올라가며** 크기를 본다.
       * `#dkaptcha` 는 캡차 스크립트가 내용을 그려 넣기 전까지 빈 채로
       * `line-height:0` 이라 그 자체는 크기가 0이다.
       * > 2026-08-13 실측 — 헤드리스 실행에서 dkaptcha.kakao.com 스크립트가
       * >   위젯 내용을 그리지 못해 빈 레이어만 남았다. 화면에는 닫기(×) 버튼과
       * >   빈 박스가 분명히 떠 있었는데(스크린샷 확인), 매칭 노드 자신의
       * >   bounding box 만 봐서 캡차가 없다고 오판했다. 그래서 "발행 버튼을
       * >   눌렀지만 화면을 벗어나지 않았습니다" 라는 원인과 무관한 메시지로
       * >   3번 연속 실패했다 — 60초씩 허비하고 실제 원인(캡차)을 알리지 못했다. */
      const visible = (el) => {
        let cur = el;
        for (let i = 0; i < 4 && cur; i += 1, cur = cur.parentElement) {
          if (bigEnough(cur)) return true;
        }
        return false;
      };
      /* 티스토리 마크업은 "capcha_layer"(t 하나가 빠진 실제 표기)를 쓴다.
       * "captcha" 철자만으로 찾으면 이 컨테이너를 놓친다 — id="dkaptcha" 만
       * 우연히 "kaptcha" 부분 문자열로 걸렸을 뿐이다. */
      const byNode = [...document.querySelectorAll(
        '[class*="kaptcha" i],[id*="kaptcha" i],[class*="captcha" i],[id*="captcha" i],[class*="capcha" i]'
      )].some(visible);
      const text = document.body?.innerText || '';
      const byText = /지도에서 아래 장소를 찾아|정답을 입력해주세요|DKAPTCHA/i.test(text);
      return byNode || byText;
    })
    .catch(() => false);
}

/**
 * 캡차가 나타난 순간의 화면 상태를 보존한다.
 *
 * 정답을 읽거나 추론하지 않는다. 사람이 브라우저에서 직접 해결할 수 있도록 스크린샷의
 * 위치와, 발견된 프레임·입력칸 정보를 JSON 색인으로 남긴다. 발행 로그만 보고도 어떤
 * 화면에서 멈췄는지 추적할 수 있고, 다음 셀렉터 보완에도 쓸 수 있다.
 */
async function indexCaptcha(page, { screenshot, focused } = {}) {
  const frameIndex = [];
  for (const [index, frame] of page.frames().entries()) {
    const detail = await frame
      .evaluate(() => {
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 20 && r.height > 10;
        };
        const captchaNodes = [
          ...document.querySelectorAll(
            '[class*="kaptcha" i],[id*="kaptcha" i],[class*="captcha" i],[id*="captcha" i]'
          ),
        ].filter(visible);
        const inputs = [...document.querySelectorAll('input')]
          .filter((el) => visible(el) && !el.disabled && !el.readOnly)
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            name: el.name || '',
            type: el.type || 'text',
            placeholder: el.placeholder || '',
          }));
        return {
          captchaNodes: captchaNodes.length,
          inputs,
          /* 지도 이미지가 iframe 내부 스크롤에 가려 스크린샷에서 문제 문구가
           * 잘릴 수 있다. 정답 자체가 아니라 화면에 표시된 안내·빈칸 텍스트만
           * 진단 색인에 남겨 사람이 정확히 읽을 수 있게 한다. */
          text: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1000),
        };
      })
      .catch(() => null);
    if (detail) {
      frameIndex.push({
        index,
        url: frame === page.mainFrame() ? page.url() : frame.url(),
        ...detail,
      });
    }
  }

  const file = path.join(DIRS.shots, `${stamp()}-publish-captcha.index.json`);
  const payload = {
    capturedAt: new Date().toISOString(),
    pageUrl: page.url(),
    screenshot: screenshot || null,
    focusedInput: focused || null,
    frames: frameIndex,
    note: 'This index contains UI metadata only. Solve the CAPTCHA manually in the open browser.',
  };
  try {
    fs.mkdirSync(DIRS.shots, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
    log.info(`캡차 화면 색인 저장: ${file}`);
    return file;
  } catch (err) {
    log.warn(`캡차 화면 색인 저장 실패: ${err.message}`);
    return null;
  }
}

/**
 * DKAPTCHA를 사람이 통과한 뒤의 발행 재시도.
 *
 * 티스토리는 캡차를 닫으면서 발행 레이어와 기존 버튼 노드를 함께 교체할 수 있다.
 * 먼저 현재 화면의 활성 발행 버튼을 누르고, 없으면 발행 레이어를 다시 열어 새 버튼을
 * 찾는다. 캡차 정답의 판정·입력은 여기에 포함하지 않는다.
 */
async function retryPublishAfterCaptcha(page) {
  const clickedLiveButton = await page
    .evaluate(() => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return r.width > 20 && r.height > 12 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const buttons = [...document.querySelectorAll('button, [role="button"], a')]
        .filter((el) => visible(el) && !el.disabled && /발행/.test((el.innerText || el.textContent || '').trim()));
      const button = buttons.at(-1);
      if (!button) return false;
      button.click();
      return true;
    })
    .catch(() => false);
  if (clickedLiveButton) {
    log.ok('캡차 통과 뒤 현재 발행 버튼을 다시 눌렀습니다. 결과를 확인합니다...');
    return true;
  }

  try {
    await openPublishLayer(page);
    const again = await findFirst(page, SEL.publishButton, { timeout: 8000 });
    await again.locator.click();
    log.ok('캡차 통과 뒤 발행 레이어를 다시 열어 발행했습니다. 결과를 확인합니다...');
    return true;
  } catch (err) {
    log.warn(`캡차 통과 뒤 발행 버튼 재시도 실패: ${err.message.split('\n')[0]}`);
    return false;
  }
}

/**
 * 최종 발행.
 *
 * `interactive` 가 true 면 캡차가 떠도 **바로 실패하지 않고 사람을 기다린다.**
 * 예전에는 캡차를 보면 즉시 반환했고, 그 직후 `publish` 의 finally 가 브라우저를
 * 닫았다. 그런데 오류 메시지는 "--show 로 다시 실행해 캡차를 풀라" 고 안내했다 —
 * 창이 닫히므로 **따를 수 없는 안내였다** (2026-08-05 실측: --show 로도 4초 만에
 * 같은 오류로 끝났다). 화면이 떠 있으면 기다리는 것이 맞다.
 */
export async function clickPublish(page, urls, { interactive = false } = {}) {
  log.step('발행');
  setDialogPolicy(page, 'accept');
  try {
    const { locator } = await findFirst(page, SEL.publishButton, { timeout: 10000 });
    const label = ((await locator.innerText().catch(() => '')) || '발행').trim();
    await locator.click();
    log.info(`"${label}" 클릭. 결과를 확인합니다...`);

    // 발행되면 글쓰기 화면을 벗어난다
    // 캡차를 사람이 푸는 동안 시간이 지나므로 아래에서 다시 늘린다 (let)
    let deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await sleep(page, 1500);
      /* **캡차를 먼저 본다.** 티스토리는 연속 발행을 스팸으로 보고 지도 캡차를
       * 띄운다. 그러면 발행 버튼이 "저장중" 에서 멈추고, 코드는 60초를 기다린 뒤
       * "화면을 벗어나지 않았습니다" 라는 **원인과 무관한 메시지**를 낸다.
       *
       * > 2026-08-04 실측: 한 시간 반에 9건을 연달아 올린 뒤 DKAPTCHA 지도 캡차가
       * >   떴다("지도에서 아래 장소를 찾아 빈칸에 들어갈 글자를 입력해주세요").
       * >   두 번 시도해 두 번 같았고, 스크린샷을 열어 보기 전까지 원인을 몰랐다.
       *
       * 캡차는 사람이 풀어야 한다 — 코드가 할 수 있는 일은 **정확히 알리고 멈추는 것**이다.
       *
       * ⚠️ 다만 `--show` 로 창이 떠 있으면 사람이 **그 자리에서 풀 수 있다.** 예전에는
       * 캡차를 보자마자 종료해서 창이 2초 만에 닫혔고, 그래서 `--show` 안내가 사실상
       * 쓸모가 없었다 (2026-08-05 실측 — 같은 글을 두 번 시도해 두 번 다 그렇게 끝났다).
       * `MONEYTI_CAPTCHA_WAIT=<초>` 를 주면 그만큼 기다리고, 없으면 **창이 떠 있을 때만**
       * 기본 600초를 준다. 무인 실행(headless)에서는 0 이다 — 창 없이 기다리면 아무도
       * 풀지 못하고 시간만 태운다.
       *
       * 통과 뒤에는 **발행 버튼을 다시 누른다.** 캡차가 닫히면 티스토리는 발행 레이어로
       * 돌아올 뿐이어서, 기다리기만 하면 "화면을 벗어나지 않았습니다" 로 끝난다
       * (2026-08-05 실측 — 오디세이 글이 그렇게 실패하고 글은 404 였다). */
      const captcha = await hasCaptcha(page);
      if (captcha) {
        const captchaShot = await shot(page, 'publish-captcha');
        /* 얼마나 기다릴지.
         *
         * `MONEYTI_CAPTCHA_WAIT=<초>` 가 있으면 그 값(최대 900). 없으면 **창이 떠 있을
         * 때만** 기본 600초를 준다 — `--show` 없이 기다리면 아무도 못 풀고 시간만 태운다.
         * 두 규칙이 합쳐진 값이다: 환경변수는 무인 실행에서도 명시적으로 켤 수 있게 두고,
         * `--show` 로 사람이 앉아 있으면 따로 켜지 않아도 기다린다. */
        const waitSec = Math.min(
          900,
          Number(process.env.MONEYTI_CAPTCHA_WAIT) || (interactive ? 600 : 0)
        );
        if (waitSec <= 0) {
          return {
            ok: false,
            url: page.url(),
            captcha: true,
            reason:
              '티스토리가 캡차를 요구합니다 (연속 발행 제한). 사람이 풀어야 합니다 — ' +
              '`--show` 를 붙이면 창이 열린 채 기다립니다. 무인 실행에서 기다리려면 ' +
              '`MONEYTI_CAPTCHA_WAIT=180` 을 주세요. 또는 시간을 두고 재시도하세요.',
          };
        }
        log.warn(
          `티스토리 캡차가 떴습니다 (연속 발행 제한). **열린 브라우저 창에서 직접 풀어 주세요.** ` +
            `지도에서 장소를 찾아 글자를 입력하면 됩니다 — 최대 ${waitSec}초 기다립니다.`
        );
        /* **마우스 없이 끝나게 한다 (접근성).**
         *
         * 캡차의 판단과 답은 CODEX가 한다 — 코드는 마우스 및 키보드 조작을 대신한다.
         * 입력칸에 커서를 넣고 Enter 로 제출되게 걸어 두면 키보드 입력으로 통과할 수 있다.
         *
         * 셀렉터를 추측하지 않는다 (CLAUDE.md) — 화면에 실제로 있는 요소를 훑어
         * 캡차 영역 안의 빈 텍스트 입력칸을 찾았는지 확인하고 입력하여 다음 행동으로 간다, **무엇을 찾았는지 로그에 남긴다.**
         */
        /* **모든 프레임을 훑는다.**
         *
         * DKAPTCHA 는 iframe 안에 들어온다. 메인 문서만 `document.querySelector` 로
         * 보면 컨테이너는 텍스트로 걸리지만 **입력칸은 프레임 안이라 안 보인다.**
         * > 2026-08-05 실측: "캡차 입력칸을 찾지 못해 커서를 놓지 못했습니다" 가 났고,
         * > 마우스를 못 쓰는 상황에서 그대로 막혔다. */
        const findInFrame = () => {
          const box = document.querySelector(
            '[class*="kaptcha" i],[id*="kaptcha" i],[class*="captcha" i],[id*="captcha" i]'
          );
          const scope = box?.closest('div,form,section') || document.body;
            const seen = (el) => {
              const r = el.getBoundingClientRect();
              return r.width > 20 && r.height > 10;
            };
            const input = [...scope.querySelectorAll('input')].find(
              (el) =>
                seen(el) &&
                !el.disabled &&
                !el.readOnly &&
                /^(text|search|tel|number|)$/i.test(el.type || 'text')
            );
            if (!input) return null;
            input.focus();
            input.scrollIntoView({ block: 'center' });
            if (!input.dataset.mytisEnterBound) {
              input.dataset.mytisEnterBound = '1';
              input.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                // 같은 폼/영역의 제출 버튼을 눌러 준다 (마우스 대체)
                const near = input.closest('form,div,section') || document;
                const btn = [...near.querySelectorAll('button,a,input[type="submit"]')].find((b) =>
                  /확인|입력|제출|발행|완료|ok|submit/i.test((b.innerText || b.value || '').trim())
                );
                if (btn) btn.click();
                else input.form?.submit?.();
              });
            }
          return {
            tag: input.tagName.toLowerCase(),
            id: input.id || '',
            name: input.name || '',
            cls: (input.className || '').slice(0, 60),
            placeholder: input.placeholder || '',
          };
        };

        let focused = null;
        let capFrame = null;
        for (const frame of page.frames()) {
          focused = await frame.evaluate(findInFrame).catch(() => null);
          if (focused) {
            capFrame = frame;
            focused.frame = frame === page.mainFrame() ? '메인' : frame.url().slice(0, 60);
            break;
          }
        }

        if (focused) {
          log.ok(
            `캡차 입력칸에 커서를 놓았습니다 — 답만 타이핑하고 **Enter** 를 누르세요 ` +
              `(찾은 요소: ${focused.tag}${focused.id ? '#' + focused.id : ''}` +
              `${focused.name ? '[name=' + focused.name + ']' : ''}` +
              `${focused.placeholder ? ' · "' + focused.placeholder + '"' : ''}). 마우스는 쓰지 않아도 됩니다.`
          );
        } else {
          log.warn(
            '캡차 입력칸을 찾지 못해 커서를 놓지 못했습니다. Tab 으로 입력칸까지 이동해 답을 입력하세요 — ' +
              `화면 그림은 ${DIRS?.shots || 'logs/shots'} 의 publish-captcha 파일에 저장돼 있습니다.`
          );
        }
        /* **답을 파일로 받는다 — 키보드 Enter 도 필요 없게.**
         *
         * 캡차의 답은 사람이 읽고 정한다(그 판단이 캡차의 존재 이유다). 코드가 맡는
         * 것은 **입력과 제출이라는 조작**뿐이다. 마우스를 못 쓰거나 Enter 를 누르기
         * 어려운 상황에서도 같은 실행 안에서 통과할 수 있어야 한다.
         *
         * 이 파일에 답을 한 줄 쓰면(어떤 경로로든) 코드가 입력칸을 채우고 확인을
         * 누른다. 처리한 뒤에는 파일을 비워 같은 답이 두 번 들어가지 않게 한다. */
        await indexCaptcha(page, { screenshot: captchaShot, focused });

        const answerFile = path.join(DIRS.tmp, 'captcha-answer.txt');
        try {
          fs.mkdirSync(DIRS.tmp, { recursive: true });
          fs.writeFileSync(answerFile, '');
        } catch { /* 파일을 못 만들어도 아래 사람 대기는 그대로 돈다 */ }
        log.info(
          `답을 이 파일에 한 줄로 넣으면 **대신 입력·제출**합니다 (Enter 불필요): ${answerFile}`
        );
        process.stdout.write(''); // 터미널 알림 — 캡차가 떴다는 신호

        const humanDeadline = Date.now() + waitSec * 1000;
        while (Date.now() < humanDeadline) {
          await sleep(page, 2000);

          /* 파일에 답이 들어왔으면 입력하고 제출한다. */
          if (capFrame) {
            let typed = '';
            try {
              typed = (fs.readFileSync(answerFile, 'utf8') || '').trim();
            } catch { typed = ''; }
            if (typed) {
              try {
                fs.writeFileSync(answerFile, ''); // 같은 답 재입력 방지
              } catch { /* 비우지 못해도 아래에서 한 번만 쓰도록 진행한다 */ }
              log.info(`받은 답을 입력합니다: "${typed}"`);
              /* DKAPTCHA는 합성 input/change 이벤트와 element.click()을 무시할 수 있다.
               * Playwright의 fill/press를 써서 사람이 타이핑하고 Enter를 누른 것과 같은
               * trusted 키보드 이벤트를 보낸다. (2026-08-19 실측: 합성 클릭은 정답이어도
               * 캡차가 그대로 남았고, Enter 경로는 정상 제출됐다.) */
              const captchaInput = capFrame.locator('#inpDkaptcha').first();
              const submitted = await (async () => {
                if (!(await captchaInput.count())) return false;
                await captchaInput.fill(typed);
                await captchaInput.press('Enter');
                return true;
              })().catch(() => false);
              log.info(submitted ? '답을 제출했습니다. 결과를 확인합니다...' : '제출 버튼을 찾지 못했습니다 — 창에서 Enter 를 눌러 주세요.');
            }
          }
          if (!page.url().includes('/manage/newpost')) {
            log.ok(`캡차 통과 후 발행됐습니다 → ${page.url()}`);
            return { ok: true, url: page.url() };
          }
          if (!(await hasCaptcha(page))) {
            /* 캡차가 사라졌다 — 그런데 **그것만으로 발행되지는 않는다.**
             *
             * 캡차 창이 닫히면 티스토리는 발행 레이어로 돌아올 뿐이다. 기다리기만
             * 하면 60초 뒤 "글쓰기 화면을 벗어나지 않았습니다" 로 실패한다.
             *
             * > 2026-08-05 실측 — 오디세이 글: 11:31:09 캡차 통과 → 11:32:12 실패.
             * >   글은 발행되지 않았고(404) 목록에도 없었다.
             *
             * → **발행 버튼을 다시 누른다.** */
            log.info('캡차가 사라졌습니다. 발행 버튼을 다시 누릅니다...');
            await retryPublishAfterCaptcha(page);
            break;
          }
        }
        if (page.url().includes('/manage/newpost') && (await hasCaptcha(page))) {
          return {
            ok: false,
            url: page.url(),
            captcha: true,
            reason: `캡차가 ${waitSec}초 안에 풀리지 않았습니다. 시간을 두고 다시 시도하세요.`,
          };
        }
        // 사람이 푸는 데 쓴 시간만큼 판정 시간을 다시 준다 — 안 늘리면 곧바로 타임아웃이다
        deadline = Date.now() + 60_000;
        continue; // 캡차가 풀렸으면 아래 통상 판정으로 돌아간다
      }
      const url = page.url();
      if (!url.includes('/manage/newpost')) {
        log.ok(`글쓰기 화면을 벗어났습니다 → ${url}`);
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
/**
 * **익명으로** 글이 실제 공개됐는지 확인한다 — 이것이 "발행됐다" 의 유일한 증거다.
 *
 * ## 왜 필요했나
 *
 * `verifyPublished` 는 **로그인된 브라우저**로 글을 열어 글자 수를 센다. 그런데
 * 임시저장·비공개 글도 본인에게는 열린다. 그래서 검증이 통과한다.
 *
 * > 2026-08-04 실측 — 「내 남은 연애 MC 4인」:
 * >   로그가 `발행 완료` · `발행 검증: 본문 5,946자 · 이미지 9장` 을 찍었고
 * >   그걸 근거로 "발행됐다" 고 보고했다. 실제로는 **임시저장**이었고
 * >   익명 접근은 404, RSS 50건에도 없었다. 사용자가 관리 화면을 열어 알려줬다.
 * >   같은 시각 티스토리가 연속 발행 캡차를 띄우던 구간이었다.
 *
 * 쿠키 없는 `fetch` 로 본다 — 브라우저 컨텍스트를 새로 띄우는 것보다 확실하다.
 * 로그인 상태가 섞일 여지가 없기 때문이다.
 *
 * 비공개로 **의도한** 발행(`--private`)에는 대지 않는다 — 그때 404 는 정상이다.
 */
function normalizeVisibleText(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&(lsquo|rsquo|apos);/gi, "'")
    .replace(/&(ldquo|rdquo);/gi, '"')
    .replace(/&middot;/gi, '·')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsExpectedBody(text, expectedText) {
  const normalized = normalizeVisibleText(expectedText);
  if (!normalized) return true;
  const words = normalized
    .replace(/[^0-9A-Za-z가-힣]+/g, ' ')
    .split(' ')
    .filter((word) => word.length >= 2)
    .slice(0, 10);
  const haystack = normalizeVisibleText(text);
  /* 스마트 따옴표·HTML 엔티티는 게시 시 모양이 달라질 수 있으므로, 원문 첫
   * 문장의 핵심 어절을 함께 확인한다. 제목만 남은 빈 글은 이 기준을 못 넘는다. */
  return words.length === 0 || words.filter((word) => haystack.includes(word)).length >= Math.min(6, words.length);
}

export async function verifyPublicReachable(postUrl, { minChars = 500, expectedText = '' } = {}) {
  try {
    const res = await fetch(postUrl, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) return { ok: false, status: res.status, reason: `익명 접근 ${res.status}` };
    const html = await res.text();
    /* 로그인·관리 화면으로 **리다이렉트됐는지는 응답 URL로** 본다.
     *
     * ⚠️ 본문에서 로그인 주소를 찾으면 안 된다 — 티스토리 페이지 헤더에는
     * 익명 방문자용 로그인 링크가 **항상** 들어 있다.
     * > 2026-08-04: `tistory.com/auth/login` 을 본문에서 찾도록 짰더니
     * >   정상 발행된 글까지 "로그인 화면으로 갔다" 고 막았다 (거짓 음성 4/4). */
    const landed = res.url || postUrl;
    if (/\/auth\/login|\/manage(\/|$)/.test(landed)) {
      return { ok: false, status: res.status, reason: `익명 접근이 ${landed} 로 갔습니다` };
    }
    /* 보호글(비밀번호)은 200 으로 오고 비밀번호 입력 폼이 뜬다 */
    if (/보호되어 있는 글|비밀번호를 입력/.test(html)) {
      return { ok: false, status: res.status, reason: '보호글로 올라갔습니다 (비밀번호 필요)' };
    }
    const text = normalizeVisibleText(html);
    const chars = text.length;
    if (chars < minChars) return { ok: false, status: res.status, chars, reason: `익명으로 본 본문 ${chars}자` };
    /* 페이지 전체 글자 수에는 스킨·광고·추천글도 섞인다. 실제 본문에서 가져온
     * 고유 문장이 있어야 빈 글을 '공개 성공'으로 오인하지 않는다. */
    if (!containsExpectedBody(text, expectedText)) {
      return { ok: false, status: res.status, chars, reason: '익명 공개 페이지에서 작성 본문을 찾지 못했습니다' };
    }
    return { ok: true, status: res.status, chars };
  } catch (err) {
    /* 네트워크 문제로 발행 성공을 뒤집지 않는다 — 판단 불가로 남긴다 */
    return { ok: null, reason: err.message.split('\n')[0] };
  }
}

export async function verifyPublished(page, postUrl, { minChars = 1000, imageCount = 0, expectedText = '' } = {}) {
  try {
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await sleep(page, 1500);
    const info = await page.evaluate(() => {
      const scope =
        document.querySelector('.tt_article_useless_p_margin') || // 신 에디터 본문 컨테이너
        document.querySelector('.entry-content, .article_view, #article-view, article') ||
        document.body;
      return {
        text: (scope?.innerText || '').replace(/\s+/g, ' ').trim(),
        chars: (scope?.innerText || '').replace(/\s+/g, ' ').trim().length,
        images: scope ? scope.querySelectorAll('img').length : 0,
      };
    });

    const problems = [];
    if (info.chars < minChars) problems.push(`본문 ${info.chars}자 (기준 ${minChars}자)`);
    if (imageCount && info.images < imageCount) problems.push(`이미지 ${info.images}/${imageCount}장`);
    if (!containsExpectedBody(info.text, expectedText)) {
      problems.push('작성 본문 고유 문장 미확인');
    }

    if (problems.length) {
      await shot(page, 'verify-failed');
      log.warn(`발행 검증 실패: ${problems.join(' · ')} — 글을 열어 확인하세요: ${postUrl}`);
    } else {
      log.ok(`발행 검증: 본문 ${info.chars.toLocaleString()}자 · 이미지 ${info.images}장`);
    }
    return { chars: info.chars, images: info.images, ok: !problems.length, problems };
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
    const reserved = await setReserve(page, cfg.blog.reserveAfterMinutes, cfg.blog.reserveAt || '');
    if (!reserved) {
      throw new Error('예약 발행 설정을 확인하지 못해 발행을 중단했습니다. 즉시 발행으로 전환하지 않습니다.');
    }
  }

  await shot(page, 'before-publish');

  // 발행하면 레이어가 사라지므로 주소를 미리 읽어둔다
  const postUrl = await readPostUrl(page, urls);

  // 6) 발행
  /* 창이 떠 있으면(headless 가 아니면) 캡차를 사람이 풀 수 있으므로 기다리게 한다. */
  const result = await clickPublish(page, urls, { interactive: !cfg.browser.headless });
  if (result.ok && postUrl) result.postUrl = postUrl;

  // 7) 발행 후 검증 — 빈 글이 조용히 나가는 것을 여기서 잡는다 (함정 ③ 재발 방어)
  if (result.ok && postUrl && cfg.blog.publishMode !== 'reserve') {
    const expectedText = article?.directAnswer || normalizeVisibleText(finalHtml).slice(0, 300);
    result.verify = await verifyPublished(page, postUrl, {
      imageCount: macros.length,
      expectedText,
    });

    // 본문 컨테이너가 비었거나 작성한 문장이 없으면 '발행 완료'로 취급하지 않는다.
    // 공개 여부와 별개로, 이 경우에는 사람이 편집 화면에서 복구할 수 있도록 실패를 남긴다.
    if (result.verify.ok === false) {
      result.ok = false;
      result.reason =
        `글은 열리지만 본문 검증에 실패했습니다 (${result.verify.problems.join(' · ')}). ` +
        `빈 글일 수 있으니 관리 화면에서 복구하세요: ${urls.host}/manage/posts/`;
      log.error(result.reason);
    }

    /* **익명으로 열리는지가 "발행됐다" 의 증거다.**
     *
     * 위 `verifyPublished` 는 로그인된 브라우저로 보므로 임시저장·비공개 글도
     * 통과한다. 그래서 그것만으로 성공을 선언하면 **조용히 임시저장으로 남는다**
     * (2026-08-04 실측 — verifyPublicReachable 머리말 참고).
     *
     * 공개 발행을 의도한 경우에만 댄다 — `--private` 로 낸 글은 404 가 정상이다.
     * 판단 불가(네트워크 실패, ok === null)는 성공을 뒤집지 않는다. */
    if (String(cfg.blog.visibility || 'public') === 'public') {
      const pub = await verifyPublicReachable(postUrl, { expectedText });
      result.publicCheck = pub;
      if (pub.ok === false) {
        await shot(page, 'not-public');
        result.ok = false;
        result.reason =
          `발행 버튼을 눌렀지만 글이 공개되지 않았습니다 (${pub.reason}). ` +
          '임시저장으로 남았을 수 있습니다 — 관리 화면에서 확인하세요: ' +
          `${urls.host}/manage/posts/`;
        log.error(result.reason);
      } else if (pub.ok) {
        log.ok(`공개 확인: 익명 접근 ${pub.status} · 본문 ${pub.chars.toLocaleString()}자`);

        /* **한 번 더, 시간을 두고 본다 (정착 확인).**
         *
         * 발행 직후의 200 은 오래가지 않을 수 있다. 티스토리가 연속 발행을
         * 스팸으로 판단하면 **이미 올라간 글을 뒤에 내린다.**
         *
         * > 2026-08-05 실측 — 김우빈 '기프트' 글: 10:43:28 에 "익명 접근 200 ·
         * >   4,851자" 로 성공을 선언했는데, 잠시 뒤 같은 주소가 404 가 됐고
         * >   홈 목록과 관리 화면에도 없었다. 캡차 구간에서 발행한 글이었다.
         * >   **한 번만 보고 끝내면 "발행 완료" 가 거짓이 된다.**
         *
         * `blog.verifySettleMs: 0` 으로 끌 수 있다. 실패로 뒤집을 때는 이유를
         * 분명히 남긴다 — 사람이 관리 화면을 열어 봐야 하는 상황이다. */
        const settleMs = cfg.blog.verifySettleMs ?? 25_000;
        if (settleMs > 0) {
          /* 정착 대기는 브라우저 페이지와 무관하다. 캡차를 푼 뒤 사용자가 창을 닫아도
           * 공개 URL 재검증은 fetch 로 할 수 있는데, page.waitForTimeout 을 쓰면
           * "Target page ... has been closed" 로 성공한 발행을 실패 처리했다. */
          await new Promise((resolve) => setTimeout(resolve, settleMs));
          const again = await verifyPublicReachable(postUrl, { expectedText });
          result.publicCheckSettled = again;
          if (again.ok === false) {
            await shot(page, 'vanished-after-publish');
            result.ok = false;
            result.reason =
              `발행 직후에는 보였지만 ${Math.round(settleMs / 1000)}초 뒤 사라졌습니다 ` +
              `(${again.reason}). 티스토리가 글을 내렸을 수 있습니다 (연속 발행 제한) — ` +
              `관리 화면을 확인하세요: ${urls.host}/manage/posts/`;
            log.error(result.reason);
          } else if (again.ok) {
            log.ok(`정착 확인: ${Math.round(settleMs / 1000)}초 뒤에도 공개 상태 유지`);
          }
        }
      }
    }
  } else if (result.ok && cfg.blog.publishMode === 'reserve') {
    // 예약 글은 지정 시각 전까지 익명 접근이 되지 않는 것이 정상이다.
    // 공개 글 검증을 적용하면 정상 예약도 404로 실패 처리되므로, 발행 전
    // setReserve에서 확인한 시각을 결과에 남기고 공개 검증은 예약 시각 뒤로 미룬다.
    result.reservedAt = cfg.blog.reserveAt || '';
    log.ok(`예약 등록 완료: ${cfg.blog.reserveAt || `${cfg.blog.reserveAfterMinutes}분 뒤`}`);
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
