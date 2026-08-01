import fs from 'node:fs';
import path from 'node:path';
import { log } from './log.js';
import { shot, setDialogPolicy } from './browser.js';
import { DIRS, stamp } from './paths.js';
import { buildDocument, summarize } from './naverDoc.js';
import { pickCategory } from './category.js';

/**
 * 네이버 블로그(스마트에디터 ONE) 글쓰기 자동화.
 *
 * 티스토리(tistory.js)와 가장 다른 점:
 *
 *   **에디터에 HTML 입구가 없다.** 대신 에디터 인스턴스가 문서 API 를 노출한다.
 *   `setDocumentData()` 로 컴포넌트 JSON 을 통째로 주입한다.
 *
 * 그래서 전체 순서가 티스토리와 같은 모양이 된다 —
 * **사진을 먼저 올려 컴포넌트를 회수하고, 본문을 한 번에 주입한다.**
 * (티스토리에서 이미지 매크로를 먼저 회수하던 것과 같은 전략)
 *
 * 아래 셀렉터는 전부 2026-07-28 에 실제 화면에서 떠서 확인했다.
 */

/**
 * 실측 셀렉터 (2026-07-28).
 *
 * ⚠️ **발행 영역 버튼은 CSS 모듈 해시 클래스를 쓴다** — `publish_btn__m9KHH`,
 * `confirm_btn__WEaBq` 처럼 뒤에 해시가 붙는다. 배포마다 해시가 바뀌므로
 * **반드시 접두사 부분일치로 잡아야 한다.** 전체 클래스를 박아 두면 다음 배포에 깨진다.
 *
 * 반대로 발행 설정 안의 입력들은 안정적인 id 를 쓴다(`#open_public`, `#tag-input`).
 * 티스토리보다 이 부분은 오히려 낫다.
 */
const SEL = {
  // 에디터가 떴는지 판단하는 표식
  editorReady: ['.se-container', '.se-content', '.se-title-text'],
  // 임시저장 복구 확인 레이어 (네이티브 dialog 가 아니라 DOM 레이어다)
  draftPopup: '.se-popup-alert-confirm',
  draftCancel: '.se-popup-alert-confirm button.se-popup-button-cancel',
  draftConfirm: '.se-popup-alert-confirm button.se-popup-button-confirm',
  helpClose: ['.se-help-panel-close-button', '[class*="help"][class*="close"]'],
  photoButton: 'button.se-image-toolbar-button',
  // 사진 2장 이상이면 뜨는 '사진 첨부 방식' 모달 — 개별사진을 골라야 한다
  photoLayoutIndividual: ['*:text-is("개별사진")', 'button:has-text("개별사진")'],
  publishOpen: 'button[class*="publish_btn"]',
  publishConfirm: 'button[class*="confirm_btn"]',
  categoryButton: 'button[class*="selectbox_button"]',
  tagInput: '#tag-input',
  visibility: {
    public: '#open_public',
    neighbor: '#open_neighbor',
    bothNeighbor: '#open_both_neighbor',
    private: '#open_private',
  },
  options: {
    comment: '#publish-option-comment',
    sympathy: '#publish-option-sympathy',
    search: '#publish-option-search',
    scrap: '#publish-option-scrap',
    outside: '#publish-option-outside',
    ccl: '#publish-option-ccl',
  },
  timeNow: '#radio_time1',
  timeReserve: '#radio_time2',
};

const VISIBILITY_LABEL = {
  public: '전체공개',
  neighbor: '이웃공개',
  bothNeighbor: '서로이웃공개',
  private: '비공개',
};

async function sleep(page, ms) {
  await page.waitForTimeout(ms);
}

/**
 * 에디터 인스턴스를 페이지에 붙여 둔다.
 *
 * `SE.launcher.getEditor()` 는 **인자 없이 부르면 undefined** 다 (실측).
 * 에디터 id 가 필요한데 그 id 는 서비스마다 다르다(블로그 PC 는 `blogpc001`).
 * 그래서 `_editors` 의 첫 키를 찾아 쓴다 — id 가 바뀌어도 견딘다.
 */
async function installBridge(page) {
  const ok = await page.evaluate(() => {
    window.__seEd = () => {
      const L = window.SE?.launcher;
      if (!L) return null;
      let e = null;
      try {
        e = L.getEditor();
      } catch {
        /* 인자가 필요한 버전 */
      }
      if (!e && L._editors) {
        const k = Object.keys(L._editors)[0];
        if (k) {
          try {
            e = L.getEditor(k);
          } catch {
            /* 무시 */
          }
          if (!e) e = L._editors[k];
        }
      }
      return e || null;
    };
    return !!window.__seEd();
  });
  if (!ok) throw new Error('에디터 인스턴스를 찾지 못했습니다 (window.SE.launcher).');
  return true;
}

/**
 * '작성 중인 글이 있습니다 … 이어서 작성하시겠습니까?' 레이어를 닫는다.
 *
 * ⚠️ **반드시 '취소' 를 눌러야 한다.** '확인' 을 누르면 지난 임시저장 내용을
 * 불러와 그 위에 글을 덧쓰게 되고, 남의 글 조각이 섞인 채로 발행된다.
 *
 * 티스토리는 이게 네이티브 `confirm()` 이라 `page.on('dialog')` 정책으로
 * 처리됐지만(browser.js 의 REJECT_PATTERN), **네이버는 DOM 레이어**라
 * 직접 클릭해야 한다. 이 레이어는 화면 전체(1480×936)를 덮어서, 닫지 않으면
 * 툴바 클릭·타이핑·파일 선택이 **전부 조용히 실패한다.**
 * (실측: 이것 때문에 업로드·타이핑이 모두 타임아웃으로 죽었다)
 */
async function dismissDraftPopup(page, { waitMs = 6000 } = {}) {
  const deadline = Date.now() + waitMs;
  let handled = false;
  while (Date.now() < deadline) {
    const has = await page.locator(SEL.draftPopup).count().catch(() => 0);
    if (has) {
      const text = ((await page.locator(SEL.draftPopup).first().innerText().catch(() => '')) || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!/이어서|작성 중인 글|작성중이던/.test(text)) {
        log.warn(`예상 밖의 확인 레이어가 떴습니다(취소로 닫습니다): "${text.slice(0, 90)}"`);
      } else {
        log.debug('임시저장 복구 레이어 → 취소 (지난 글에 덧쓰지 않는다)');
      }
      await page.locator(SEL.draftCancel).first().click({ timeout: 5000 }).catch(() => {});
      handled = true;
      await sleep(page, 1500);
      continue; // 연달아 뜰 수 있다
    }
    if (handled) break;
    await sleep(page, 500);
  }
  return handled;
}

/** 처음 방문 때 뜨는 도움말 패널을 닫는다. 열려 있으면 우측을 가린다. */
async function closeHelpPanel(page) {
  for (const sel of SEL.helpClose) {
    if (await page.locator(sel).count().catch(() => 0)) {
      await page.locator(sel).first().click({ timeout: 4000 }).catch(() => {});
      log.debug('도움말 패널 닫음');
      await sleep(page, 800);
      return true;
    }
  }
  return false;
}

/** 글쓰기 화면 열기 */
export async function openEditor(page, urls) {
  log.step('네이버 글쓰기 화면 열기');
  setDialogPolicy(page, 'auto');

  const candidates = urls.writeCandidates?.length ? urls.writeCandidates : [urls.newPost];
  let lastUrl = '';
  for (const url of candidates.filter(Boolean)) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    } catch (err) {
      log.debug(`글쓰기 주소 열기 실패 (${url}): ${err.message.split('\n')[0]}`);
      continue;
    }
    await sleep(page, 5000);
    lastUrl = page.url();

    if (/nid\.naver\.com\/(?:nidlogin|login)/i.test(lastUrl)) {
      throw new Error('글쓰기 화면 접근 중 로그인 페이지로 튕겼습니다. 세션이 만료되었습니다.');
    }

    // 레이어를 먼저 걷어내야 아무것도 안 막힌다
    await dismissDraftPopup(page);
    await closeHelpPanel(page);

    const ready = await page
      .locator(SEL.editorReady.join(', '))
      .first()
      .isVisible({ timeout: 15000 })
      .catch(() => false);
    if (ready) {
      await installBridge(page);
      log.ok(`에디터 준비 완료 (${lastUrl})`);
      return true;
    }
    log.debug(`에디터 표식을 찾지 못했습니다: ${url}`);
  }

  await shot(page, 'naver-editor-not-ready');
  throw new Error(
    '네이버 글쓰기 에디터가 열리지 않았습니다. `npm run probe:naver` 로 화면을 확인해 주세요. ' +
      `(현재 URL: ${lastUrl})`
  );
}

/** 현재 문서의 컴포넌트 종류 목록 */
async function componentTypes(page) {
  return page
    .evaluate(() => (window.__seEd().getComponentInfoList() || []).map((c) => c.compType))
    .catch(() => []);
}

/**
 * 사진을 업로드하고 **이미지 컴포넌트를 업로드 순서대로 회수한다.**
 *
 * 회수해 두는 이유: 사진은 네이버 CDN 에 올라가야 하므로 우리가 URL 을 만들 수 없다.
 * 업로드가 끝나면 문서에 image 컴포넌트가 생기고 그 안에 src·path·크기가 채워진다.
 * 그것을 그대로 들고 있다가, 본문을 조립할 때 원하는 자리에 끼운다.
 *
 * 주의할 점 둘 (둘 다 실측으로 데인 것):
 *
 *  ① **업로드 전에 커서를 본문 텍스트에 두어야 한다.** 커서가 표 안에 있으면
 *     사진이 **표 셀 안의 imageNode** 로 들어가 최상위 image 컴포넌트가 생기지 않는다.
 *     그래서 빈 문서 상태에서 `focusFirstText()` 를 부르고 올린다.
 *
 *  ② **2장 이상이면 '사진 첨부 방식' 모달이 뜬다** (개별사진/콜라주/슬라이드).
 *     고르지 않으면 업로드가 영원히 끝나지 않는다. 반드시 **개별사진**을 고른다.
 *     (콜라주·슬라이드는 여러 장을 한 컴포넌트로 묶어 버려 본문 사이에 끼울 수 없다)
 */
export async function uploadImages(page, files) {
  if (!files?.length) return [];

  const existing = files.filter((f) => fs.existsSync(f));
  if (existing.length !== files.length) {
    log.warn(`이미지 파일 ${files.length - existing.length}개를 찾을 수 없어 건너뜁니다.`);
  }
  if (!existing.length) return [];

  log.step(`이미지 ${existing.length}장 업로드`);

  // ① 커서를 본문 텍스트에 둔다
  await page.evaluate(() => window.__seEd().focusFirstText()).catch(() => {});
  await sleep(page, 600);

  try {
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 20000 }),
      page.locator(SEL.photoButton).first().click({ timeout: 10000 }),
    ]);
    await chooser.setFiles(existing);
  } catch (err) {
    log.warn(`사진 첨부 창을 띄우지 못했습니다: ${err.message.split('\n')[0]}`);
    await shot(page, 'naver-photo-chooser-fail');
    return [];
  }

  // ② 여러 장이면 '개별사진' 을 고른다
  if (existing.length > 1) {
    const deadline = Date.now() + 15000;
    let picked = false;
    while (Date.now() < deadline && !picked) {
      for (const sel of SEL.photoLayoutIndividual) {
        const loc = page.locator(sel).first();
        if (await loc.count().catch(() => 0)) {
          await loc.click({ timeout: 4000 }).catch(() => {});
          log.debug('사진 첨부 방식 → 개별사진');
          picked = true;
          break;
        }
      }
      if (!picked) await sleep(page, 700);
    }
    if (!picked) {
      log.debug('사진 첨부 방식 모달이 뜨지 않았습니다 (바로 삽입되는 경우도 있습니다).');
    }
  }

  // 업로드 완료 대기 — 이미지 컴포넌트 개수로 확인한다
  const deadline = Date.now() + 180_000;
  let count = 0;
  while (Date.now() < deadline) {
    await sleep(page, 2000);
    count = (await componentTypes(page)).filter((t) => t === 'image').length;
    if (count >= existing.length) break;
  }
  if (count < existing.length) {
    log.warn(`이미지 ${existing.length}장 중 ${count}장만 삽입됐습니다.`);
    await shot(page, 'naver-upload-partial');
  }

  const uploaded = await page.evaluate(() =>
    window.__seEd().getDocumentData().document.components.filter((c) => c['@ctype'] === 'image')
  );
  log.ok(`이미지 컴포넌트 ${uploaded.length}개 확보 (${uploaded.map((i) => i.fileName).join(', ').slice(0, 120)})`);
  return uploaded;
}

/**
 * 제목과 본문을 한 번에 주입하고 **왕복 검증**한다.
 *
 * 왜 검증이 필요한가: 컴포넌트에 모르는 필드나 잘못된 스타일 키를 넣으면 에디터가
 * 그 컴포넌트를 `unknown` 으로 처리하고 본문에 **"알 수 없는 컴포넌트" 회색 박스**를
 * 그린다. 주입은 성공(`ok:true`)으로 보이므로 검증 없이는 눈치챌 수 없다.
 * (실측: 잘못 만든 이미지 컴포넌트 2개가 그대로 회색 박스로 남았다)
 *
 * 티스토리에서 `wysiwygTextLength() > 200` 검증을 절대 지우지 말라고 한 것과
 * 같은 이유다 — 조용히 망가진 글이 발행되는 것을 막는 유일한 장치다.
 */
export async function injectDocument(page, article, { cfg, images, imageMeta, credits }) {
  log.step('본문 주입');

  const baseDoc = await page.evaluate(() => window.__seEd().getDocumentData().document);
  const components = buildDocument(article, { cfg, baseDoc, images, imageMeta, credits });
  log.debug(`조립한 컴포넌트: ${summarize(components)}`);

  const res = await page.evaluate(
    ({ comps }) => {
      const e = window.__seEd();
      const cur = e.getDocumentData();
      try {
        e.setDocumentData({ ...cur, document: { ...cur.document, components: comps } });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err).slice(0, 300) };
      }
    },
    { comps: components }
  );
  if (!res.ok) {
    await shot(page, 'naver-inject-fail');
    throw new Error(`본문 주입에 실패했습니다: ${res.error}`);
  }
  await sleep(page, 3000);

  // 제목은 전용 API 로 한 번 더 확실히 넣는다
  await page
    .evaluate((t) => window.__seEd().setDocumentTitle(t), article.title || '')
    .catch((err) => log.debug(`setDocumentTitle 실패: ${err.message.split('\n')[0]}`));
  await sleep(page, 800);

  // ── 왕복 검증 ────────────────────────────────────────────────────────────
  const after = await page.evaluate(() => {
    const e = window.__seEd();
    return {
      types: (e.getComponentInfoList() || []).map((c) => c.compType),
      title: e.getDocumentTitle(),
      textLen: (e.getContentText() || '').trim().length,
    };
  });

  const unknown = after.types.filter((t) => t === 'unknown' || !t).length;
  const images_ = after.types.filter((t) => t === 'image').length;
  log.debug(`주입 결과: ${after.types.length}개 컴포넌트 · 이미지 ${images_}개 · 본문 ${after.textLen}자`);

  if (unknown) {
    await shot(page, 'naver-unknown-components');
    throw new Error(
      `본문에 '알 수 없는 컴포넌트' ${unknown}개가 생겼습니다. 이대로 발행하면 회색 박스가 실립니다. ` +
        'naverDoc.js 의 컴포넌트 스키마를 확인하세요.'
    );
  }
  if (after.textLen < 200) {
    await shot(page, 'naver-body-too-short');
    throw new Error(
      `본문이 ${after.textLen}자뿐입니다. 주입이 제대로 반영되지 않았습니다. ` +
        '(빈 글이 발행되는 것을 막기 위해 여기서 멈춥니다)'
    );
  }
  if (!after.title?.trim()) {
    throw new Error('제목이 비어 있습니다.');
  }

  log.ok(`본문 주입 완료 (제목 "${after.title}" · 본문 ${after.textLen.toLocaleString()}자 · 이미지 ${images_}장)`);
  return after;
}

/**
 * 글감 > 책 카드를 본문 끝에 삽입한다 (2026-07-29 실측 — probe-material-book.mjs).
 *
 * 왜 UI 로 하나: 카드 컴포넌트(@ctype material, type book)의 link 는
 * 네이버 서명이 붙은 쇼핑 URL 이고 dataId·sign·thumbnail 도 네이버가 만든다.
 * setDocumentData 로 지어 넣을 수 없는 값들이다.
 *
 * 실측에서 배운 것:
 *   - 결과 항목은 셀렉터 클릭이 타임아웃 난다(겹침·hidden 매치) →
 *     제목 글자와 정확히 일치하는 말단 요소를 찾아 **좌표로** 클릭한다.
 *   - 검색 결과에 원서·타 판본이 섞인다("Invisible Helix" 3종) —
 *     제목이 정확히 일치하는 첫 카드가 한국어판이다.
 */
/**
 * 글감 첨부의 **공통 흐름**. 탭 이름만 다르고 나머지는 같다 (책 · 장소 · 영화 …).
 *
 * `attachBookMaterial` 이 책 전용으로 굳어 있었는데, 장소(GPS)를 붙이려면 같은
 * 흐름이 한 벌 더 필요했다 — 복사하면 실측으로 얻은 예외 처리가 두 곳으로 갈린다.
 *
 * `loose` 는 **장소용**이다. 책은 검색 결과의 말단 텍스트가 제목과 정확히 일치하지만,
 * 장소는 이름 뒤에 지점·분류가 붙어 나오는 일이 많아 정확 일치로는 못 집는다.
 */
export async function attachMaterial(page, { tab, query, label = tab, loose = false, align = 'center' }) {
  log.step(`글감 첨부: ${label} "${query}"`);

  // 커서를 본문 끝으로 — 카드는 커서 자리에 삽입된다
  await page.locator('.se-text-paragraph').last().click();
  await sleep(page, 300);

  await page.locator('button:has-text("글감")').first().click();
  await sleep(page, 1500);

  const input = page.locator('[class*="search"] input, [class*="side"] input[type="text"]').first();
  await input.fill(query);
  await input.press('Enter');

  /* 결과 패널이 **접힌 채** 올 때가 있다 — 에디터가 직전 상태(축소)를 기억한다
   * (2026-07-29 실측: 하단 검색바만 남아 카드가 안 보였고, 클릭이 허공을 짚었다).
   * '더보기' 가 보일 때까지 검색바의 펼침 버튼을 눌러 연다. */
  let opened = false;
  for (let k = 0; k < 4; k++) {
    await sleep(page, 1500);
    if (await page.locator('text=더보기').first().isVisible().catch(() => false)) {
      opened = true;
      break;
    }
    await page.locator('[class*="search"] button').last().click({ timeout: 2000 }).catch(() => {});
  }
  if (!opened) {
    await shot(page, 'naver-material-fail');
    throw new Error('글감 결과 패널이 펼쳐지지 않았습니다.');
  }
  // 해당 탭으로 좁힌다 — 책 글에서 쇼핑(나선호스…)이 섞여 나온 적이 있다
  await page.locator(`button:text-is("${tab}")`).first().click({ timeout: 2500 }).catch(() => {}); // 30초 기본 대기 금지 — 책 선택이 70초 걸린 주범
  await sleep(page, 1200);

  /* 같은 글자가 **본문에도** 있다 — 서지 표 셀과 참고 자료에 책 제목이 그대로
   * 들어 있어서, 문서 전체에서 첫 일치를 집으면 본문을 클릭한다 (2026-07-29 실측:
   * 오클릭 여파로 라이브러리 패널까지 열려 발행 버튼이 막혔다).
   * 글감 패널의 위치를 '전체 글감' 탭으로 잡고, **그 아래·오른쪽 일치만** 받는다. */
  const rect = await page.evaluate(({ q, loose }) => {
    const tabEl = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '전체 글감');
    if (!tabEl) return null;
    const t = tabEl.getBoundingClientRect();
    const leaves = [...document.querySelectorAll('div,strong,span,a,p')].filter((e) => e.childElementCount === 0);
    const norm = (x) => x.replace(/\s/g, '');
    /* 정확 일치를 먼저 본다. 못 찾으면(장소) 앞부분 일치 → 포함 순으로 넓힌다.
     * 넓히는 순서를 고정해야 "가장 그럴듯한 것" 이 아니라 **가장 좁은 일치**가 이긴다. */
    const tiers = loose
      ? [(e) => norm(e.textContent) === norm(q), (e) => norm(e.textContent).startsWith(norm(q)), (e) => norm(e.textContent).includes(norm(q))]
      : [(e) => e.textContent.trim() === q];
    for (const match of tiers) {
      for (const el of leaves) {
        if (!match(el)) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.top > t.top && r.left > t.left - 60) return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: el.textContent.trim().slice(0, 60) };
      }
    }
    return null;
  }, { q: query, loose });
  if (!rect) throw new Error(`글감 검색 결과에서 ${label} 카드를 찾지 못했습니다.`);
  log.debug(`글감 결과 선택: "${rect.text}"`);
  await page.mouse.click(rect.x, rect.y);
  await sleep(page, 2500);

  /* 패널을 닫는다 — 열려 있으면 **발행 설정 레이어가 아예 안 열린다**
   * (2026-07-29 실측: Escape 만으로는 하단 검색 바가 남아 발행이 3회 다 실패).
   * 글감 버튼은 토글이다 — 한 번 더 누르는 것이 가장 확실하게 닫는다.
   * 오클릭으로 열렸을 수 있는 라이브러리 패널도 같은 방식(토글)으로 닫는다. */
  await page.locator('button:has-text("글감")').first().click({ timeout: 2500 }).catch(() => {});
  await sleep(page, 800);
  if (await page.locator('text=현재 문서').first().isVisible().catch(() => false)) {
    await page.locator('button:has-text("라이브러리")').first().click({ timeout: 2500 }).catch(() => {});
    await sleep(page, 600);
  }
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(page, 500);

  /* 카드를 **대표 사진 바로 아래**로 올린다 (2026-07-29 독자 요청 — 처음엔 제목
   * 바로 아래였는데 썸네일 아래가 낫다고 확정). UI 삽입은 커서 위치라 끝에 붙는데,
   * material 컴포넌트는 왕복이 확인됐으므로 setDocumentData 로 자리만 옮긴다. */
  const ok = await page.evaluate((alignWanted) => {
    const e = window.__seEd();
    const cur = e.getDocumentData();
    const comps = cur.document.components;
    const at = comps.findIndex((c) => c['@ctype'] === 'material');
    if (at < 0) return false;
    // align:center 는 2026-07-29 왕복 실측으로 살아남는 것을 확인했다 (unknown 0)
    const [card] = comps.splice(at, 1);
    card.align = alignWanted;
    const firstImage = comps.findIndex((c) => c['@ctype'] === 'image');
    const titleAt = comps.findIndex((c) => c['@ctype'] === 'documentTitle');
    comps.splice((firstImage >= 0 ? firstImage : titleAt) + 1, 0, card);
    e.setDocumentData({ ...cur, document: { ...cur.document, components: comps } });
    return true;
  }, align);
  if (!ok) {
    await shot(page, 'naver-material-fail');
    throw new Error(`${label} 카드가 문서에 들어가지 않았습니다.`);
  }
  await sleep(page, 1500);
  log.ok(`${label} 카드 첨부 완료 (글감 > ${tab} · 대표 사진 아래)`);
}

/** 글감 > 책 (책 글 전용 — 기존 호출부를 그대로 둔다) */
export async function attachBookMaterial(page, title) {
  return attachMaterial(page, { tab: '책', query: title, label: '책' });
}

/**
 * 글감 > 장소 — 네이버 지도의 장소 카드를 붙인다 (GPS·주소·지도가 함께 실린다).
 *
 * 지역 검색에서 이 카드가 있는 글이 유리하다. 사용자 요구(2026-08-01): "gps 써서".
 * 장소명은 **네이버 지도에 등재된 이름**이어야 한다 — 없으면 검색 결과가 비고,
 * 그때는 발행을 막지 않고 경고만 한다 (책 카드와 같은 기준).
 */
export async function attachPlaceMaterial(page, place) {
  return attachMaterial(page, { tab: '장소', query: place, label: '장소', loose: true });
}

/** 발행 설정 레이어 열기 */
export async function openPublishLayer(page) {
  log.step('발행 설정 열기');
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.locator(SEL.publishOpen).first().click({ timeout: 10000 }).catch(() => {});
    await sleep(page, 2500);
    const opened = await page
      .locator(`${SEL.tagInput}, ${SEL.visibility.public}`)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (opened) {
      log.ok('발행 레이어 열림');
      return true;
    }
    log.debug(`발행 레이어가 열리지 않음 (${attempt}/3)`);
  }
  await shot(page, 'naver-publish-layer-fail');
  throw new Error('발행 설정 레이어를 열지 못했습니다.');
}

/**
 * 카테고리(게시판) 선택.
 *
 * 티스토리와 같은 함정이 있다 — **건드리지 않으면 직전 글의 카테고리를 물려받는다.**
 * 그래서 비어 있으면 최소한 현재 값을 로그에 남겨 어디로 갔는지 알 수 있게 한다.
 *
 * `name` 이 "auto" 면 목록을 읽어 글 내용에 맞는 것을 고른다(category.js 재사용).
 */
export async function selectCategory(page, name, opts = {}) {
  const raw = (name || '').trim();
  const btn = page.locator(SEL.categoryButton).first();

  const current = ((await btn.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  if (!raw) {
    log.warn(
      `카테고리가 설정되지 않았습니다. 직전 값 "${current}" 이 그대로 쓰입니다. ` +
        '(.env 의 NAVER_CATEGORY 또는 config.json 의 naver.category 를 채우세요. ' +
        '"auto" 로 두면 글 내용에 맞춰 고릅니다)'
    );
    return false;
  }

  try {
    await btn.click({ timeout: 8000 });
    await sleep(page, 1200);

    /* 목록 항목의 셀렉터는 해시 클래스라 못 박을 수 없다.
     * 드롭다운이 열린 뒤 **보이는 항목의 글자**로 찾는다. */
    const items = page.locator(
      '[class*="selectbox"] li, [class*="selectbox"] button, [role="option"], [role="listbox"] li'
    );
    const texts = (await items.allInnerTexts().catch(() => []))
      .map((t) => t.replace(/\s+/g, ' ').trim())
      .map((t) => t.split('\n')[0]);
    const names = texts.filter(Boolean);
    if (!names.length) {
      log.warn('카테고리 목록을 읽지 못했습니다.');
      await page.keyboard.press('Escape').catch(() => {});
      return false;
    }
    log.debug(`카테고리 목록: ${names.join(' / ').slice(0, 250)}`);

    let target = raw;
    if (raw.toLowerCase() === 'auto') {
      const entries = names.map((n, index) => ({ index, depth: 0, name: n }));
      const { picked, ranked, ambiguous } = pickCategory(opts.article || {}, entries, {
        aliases: opts.aliases,
      });
      if (picked) {
        target = picked.name;
        log.ok(`카테고리 자동 선택: ${target} (점수 ${picked.score} ← ${picked.hits.join(', ')})`);
      } else {
        target = (opts.fallback || '').trim();
        const top = ranked
          .slice(0, 3)
          .filter((r) => r.score > 0)
          .map((r) => `${r.name}(${r.score})`)
          .join(' · ');
        if (!target) {
          log.warn(
            `카테고리를 자동으로 확신하지 못했습니다${ambiguous ? ' (1·2위 접전)' : ''}. ` +
              `현재 값 "${current}" 를 그대로 씁니다.` + (top ? ` 후보: ${top}` : '')
          );
          await page.keyboard.press('Escape').catch(() => {});
          return false;
        }
        log.warn(`카테고리 자동 선택 실패 → "${target}" 로 발행합니다.${top ? ` 후보: ${top}` : ''}`);
      }
    }

    const exact = names.findIndex((n) => n === target);
    const partial = names.findIndex((n) => n.includes(target));
    const pick = exact >= 0 ? exact : partial;
    if (pick < 0) {
      log.warn(`카테고리 "${target}" 를 찾지 못했습니다. 사용 가능: ${names.join(' / ').slice(0, 250)}`);
      await page.keyboard.press('Escape').catch(() => {});
      return false;
    }

    await items.nth(pick).click({ timeout: 5000 });
    await sleep(page, 900);
    const shown = ((await btn.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    log.ok(`카테고리 선택: ${names[pick]}${shown ? ` (표시: ${shown})` : ''}`);
    return true;
  } catch (err) {
    log.warn(`카테고리 선택 실패: ${err.message.split('\n')[0]}`);
    await page.keyboard.press('Escape').catch(() => {});
    return false;
  }
}

/** 태그 입력. 네이버 상한은 30개다. */
export async function setTags(page, tags, { max = 10 } = {}) {
  const list = (tags || [])
    .map((t) => String(t).replace(/[,#]/g, '').trim())
    .filter(Boolean)
    .slice(0, Math.min(max, 30));
  if (!list.length) return false;

  try {
    const input = page.locator(SEL.tagInput).first();
    await input.click({ timeout: 6000 });
    for (const tag of list) {
      await input.type(tag, { delay: 25 });
      await sleep(page, 200);
      await page.keyboard.press('Enter');
      await sleep(page, 350);
    }
    log.ok(`태그 ${list.length}개 입력: ${list.join(', ')}`);
    return true;
  } catch (err) {
    log.warn(`태그 입력 실패: ${err.message.split('\n')[0]}`);
    return false;
  }
}

/** 공개 범위. 네이버는 티스토리와 달리 '이웃공개' 가 하나 더 있다. */
export async function setVisibility(page, visibility) {
  const key = Object.keys(SEL.visibility).includes(visibility) ? visibility : 'public';
  const label = VISIBILITY_LABEL[key];
  try {
    const input = page.locator(SEL.visibility[key]).first();
    await input.check({ timeout: 5000 }).catch(async () => {
      // 라디오가 시각적으로 감춰져 있으면 라벨을 누른다
      await page.locator(`label:has-text("${label}")`).first().click({ timeout: 4000 });
    });
    await sleep(page, 400);
    const on = await input.isChecked().catch(() => false);
    if (on) log.ok(`공개 설정: ${label}`);
    else log.warn(`공개 설정(${label})이 반영되지 않았습니다.`);
    return on;
  } catch (err) {
    log.warn(`공개 설정 실패: ${err.message.split('\n')[0]}`);
    return false;
  }
}

/**
 * 발행 옵션 (댓글·공감·검색 허용 등).
 *
 * **검색 허용을 끄면 네이버 검색에 아예 잡히지 않는다.** 기본값이 켜져 있지만,
 * 한 번 껐던 설정이 '기본값으로 유지' 로 남아 있을 수 있으므로 명시적으로 맞춘다.
 */
export async function setPublishOptions(page, cfg) {
  const want = {
    comment: cfg.naver.allowComment !== false,
    sympathy: true,
    search: cfg.naver.allowSearch !== false,
  };
  for (const [k, on] of Object.entries(want)) {
    const box = page.locator(SEL.options[k]).first();
    if (!(await box.count().catch(() => 0))) continue;
    /* **이미 원하는 상태면 건드리지 않는다.**
     * 네이버 체크박스는 시각적으로 감춰져 있어 Playwright 의 check/uncheck 가
     * 실패하는 경우가 있는데, 값이 이미 맞으면 실패해도 아무 문제가 없다.
     * 그런데도 경고를 찍으면 진짜 문제와 구분이 안 된다. */
    const nowOn = await box.isChecked().catch(() => null);
    if (nowOn === on) continue;
    try {
      if (on) await box.check({ timeout: 3000 });
      else await box.uncheck({ timeout: 3000 });
    } catch {
      log.warn(`발행 옵션 '${k}' 를 ${on ? '켜지' : '끄지'} 못했습니다 (현재 ${nowOn ? '켜짐' : '꺼짐'}).`);
    }
  }
  const search = await page.locator(SEL.options.search).first().isChecked().catch(() => null);
  log.ok(`발행 옵션: 댓글 ${want.comment ? 'O' : 'X'} · 검색 허용 ${search === null ? '?' : search ? 'O' : 'X'}`);
  if (search === false) {
    log.warn('검색 허용이 꺼져 있습니다 — 이 글은 네이버 검색에 노출되지 않습니다.');
  }
}

/**
 * 발행 후 도착한 주소에서 **읽기 좋은 글 주소**를 만든다.
 *
 * 발행 직후 네이버가 보내는 곳은 이런 주소다:
 *   `blog.naver.com/PostView.naver?blogId=web_dev5&Redirect=View&logNo=224360820708&...`
 * 여기서 `logNo` 만 뽑으면 `blog.naver.com/{blogId}/{logNo}` 라는 정식 주소가 된다.
 * 큐·로그에 남는 주소이므로 사람이 눌러 볼 수 있는 형태로 남긴다.
 */
function readPostUrl(url, blogId) {
  const direct = url.match(/blog\.naver\.com\/([A-Za-z0-9_-]+)\/(\d{6,})/);
  if (direct) return `https://blog.naver.com/${direct[1]}/${direct[2]}`;
  const logNo = url.match(/logNo=(\d{6,})/)?.[1];
  if (logNo && blogId) return `https://blog.naver.com/${blogId}/${logNo}`;
  return undefined;
}

/** 최종 발행 */
export async function clickPublish(page, urls) {
  log.step('발행');
  setDialogPolicy(page, 'accept');
  try {
    await page.locator(SEL.publishConfirm).first().click({ timeout: 10000 });
    log.info('발행 버튼 클릭. 결과를 확인합니다...');

    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      await sleep(page, 1500);
      const url = page.url();
      if (!/postwrite|PostWriteForm/i.test(url)) {
        const postUrl = readPostUrl(url, urls.blogId);
        log.ok(`발행 완료 → ${postUrl || url}`);
        return { ok: true, url, postUrl };
      }
    }

    await shot(page, 'naver-publish-timeout');
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
 * 전체 발행 파이프라인.
 *
 * 순서를 지켜야 한다 —
 *   ① 레이어 걷기 → ② 사진 업로드(빈 문서에서) → ③ 본문 주입 → ④ 발행 레이어 설정 → ⑤ 발행
 *
 * ②를 ③보다 먼저 하는 이유는 티스토리와 같다: 사진의 최종 주소를 우리가 만들 수
 * 없으므로 먼저 올려 컴포넌트를 회수해야 본문에 끼울 수 있다.
 * 그리고 ②는 **문서가 비어 있을 때** 해야 한다 (표·인용구가 있으면 커서가 그 안으로
 * 들어가 사진이 셀 안에 박힌다).
 */
export async function publishPost(page, urls, cfg, { article, imageFiles = [], imageMeta = [], credits = [] }) {
  await openEditor(page, urls);

  const images = await uploadImages(page, imageFiles);
  if (imageFiles.length && images.length !== imageFiles.length) {
    log.warn(
      `이미지 ${imageFiles.length}장 중 ${images.length}장만 확보됐습니다. ` +
        '앞에서부터 순서대로 배치하고 나머지 자리는 비웁니다.'
    );
  }

  await injectDocument(page, article, { cfg, images, imageMeta, credits });

  /* 책 글은 글 끝에 **글감 > 책 카드**를 단다 (독자 구조의 ⑧ 책등록).
   * 카드의 link·sign·dataId 는 네이버 서명값이라 손으로 만들 수 없다 —
   * 사진·장소와 같은 전략으로 UI 로 삽입하고 문서에서 확인만 한다. */
  if (article.mode === 'book') {
    const bookTitle = String(article.topic || article.title || '')
      .replace(/^책\s*:\s*/, '')
      .split('—')[0]
      .replace(/\(.*?\)/g, '')
      .trim();
    try {
      await attachBookMaterial(page, bookTitle);
    } catch (err) {
      log.warn(`책 글감 첨부 실패 (발행은 계속합니다): ${err.message.slice(0, 100)}`);
      // 실패해도 패널은 반드시 닫는다 — 열려 있으면 발행 레이어가 안 열린다
      await page.locator('button:has-text("글감")').first().click({ timeout: 2500 }).catch(() => {});
      await sleep(page, 800);
      await page.keyboard.press('Escape').catch(() => {});
    }
  }

  /* 글감 > 장소 — `article.place` 가 있으면 지도 카드를 붙인다.
   * 네이버 지역 검색에서 이 카드가 있는 글이 유리하고, 독자에게도 위치가 바로 보인다.
   * 실패해도 발행은 계속한다 — 장소명이 지도에 없을 수 있다(책 카드와 같은 기준). */
  if (article.place) {
    try {
      await attachPlaceMaterial(page, article.place);
    } catch (err) {
      log.warn(`장소 글감 첨부 실패 (발행은 계속합니다): ${err.message.slice(0, 100)}`);
      await page.locator('button:has-text("글감")').first().click({ timeout: 2500 }).catch(() => {});
      await sleep(page, 800);
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

  await shot(page, 'naver-before-publish');

  return clickPublish(page, urls);
}

/**
 * 에디터 구조를 파일로 덤프한다 (셀렉터가 깨졌을 때 진단용).
 *
 * 티스토리의 `probeEditor` 와 같은 목적이지만, 레이어를 먼저 걷어낸 뒤 떠야
 * 쓸모 있는 정보가 나온다 — 복구 레이어가 화면을 덮고 있으면 아무것도 안 보인다.
 */
export async function probeEditor(page, urls) {
  const opened = [];
  for (const url of (urls.writeCandidates?.length ? urls.writeCandidates : [urls.newPost]).filter(Boolean)) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await sleep(page, 5000);
      opened.push({ requested: url, landed: page.url() });
      await dismissDraftPopup(page);
      await closeHelpPanel(page);
      if (
        await page.locator(SEL.editorReady.join(', ')).first().isVisible({ timeout: 8000 }).catch(() => false)
      ) {
        break;
      }
    } catch (err) {
      opened.push({ requested: url, error: err.message.split('\n')[0] });
    }
  }

  let bridge = false;
  try {
    bridge = await installBridge(page);
  } catch (err) {
    log.warn(err.message);
  }

  const info = await page.evaluate(() => {
    const brief = (el) => ({
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      cls: el.className?.toString?.().slice(0, 100) || undefined,
      type: el.type || undefined,
      text: (el.innerText || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 40) || undefined,
      visible: !!(el.offsetWidth || el.offsetHeight),
    });
    const ed = window.__seEd?.();
    return {
      url: location.href,
      hasSE: !!window.SE,
      editorMethods: ed
        ? Object.getOwnPropertyNames(Object.getPrototypeOf(ed)).filter((k) => /^(get|set)/.test(k))
        : null,
      documentTitle: ed?.getDocumentTitle?.() ?? null,
      components: ed?.getComponentInfoList?.() ?? null,
      // 화면을 덮고 있는 레이어 — 자동화를 조용히 막는 원인 1순위
      overlays: [...document.querySelectorAll('div,section,aside')]
        .filter((el) => {
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden') return false;
          const r = el.getBoundingClientRect();
          return r.width > 300 && r.height > 150 && (s.position === 'fixed' || s.position === 'absolute') && (+s.zIndex || 0) >= 10;
        })
        .slice(0, 10)
        .map((el) => ({ cls: el.className?.toString?.().slice(0, 90), text: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 100) })),
      toolbar: [...document.querySelectorAll('button[class*="se-"][class*="toolbar-button"]')]
        .slice(0, 40)
        .map(brief),
      publishArea: [...document.querySelectorAll('button[class*="publish"], button[class*="confirm_btn"], button[class*="save_btn"], button[class*="selectbox"]')]
        .map(brief),
      inputs: [...document.querySelectorAll('input, textarea')].slice(0, 40).map(brief),
    };
  });

  fs.mkdirSync(DIRS.logs, { recursive: true });
  const file = path.join(DIRS.logs, `probe-naver-${stamp()}.json`);
  fs.writeFileSync(file, JSON.stringify({ opened, bridge, ...info }, null, 2), 'utf8');
  const png = await shot(page, 'probe-naver');

  log.ok(`네이버 에디터 구조 덤프: ${file}`);
  if (png) log.ok(`스크린샷: ${png}`);
  log.info(`에디터 인스턴스: ${bridge ? '확보' : '실패'} · 컴포넌트 ${info.components?.length ?? '?'}개`);
  if (info.overlays?.length) {
    log.warn(`화면을 덮고 있는 레이어 ${info.overlays.length}개: ${info.overlays.map((o) => o.text.slice(0, 40)).join(' | ')}`);
  }
  return { file, png, info };
}
