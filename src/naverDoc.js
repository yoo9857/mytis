/**
 * 아티클 JSON → **스마트에디터 ONE 문서(컴포넌트 배열)**.
 *
 * 티스토리는 `html.js` 가 만든 HTML 을 그대로 넣으면 됐지만, 네이버 에디터에는
 * HTML 입구가 없다. 대신 `setDocumentData()` 로 **컴포넌트 JSON** 을 주입한다.
 * 그래서 이 파일이 `html.js` 의 네이버판이다.
 *
 * 아래 스키마는 전부 2026-07-28 에 실제 에디터에서 떠서 확인한 것이다
 * (`getDocumentData()` 왕복). 추측한 필드는 없다.
 *
 *   documentTitle  { id, layout, title:[paragraph], subTitle, align, @ctype }
 *   sectionTitle   { id, layout, title:[paragraph], @ctype }   ← **네이버의 진짜 소제목**
 *   text           { id, layout, value:[paragraph], @ctype }
 *   paragraph      { id, nodes:[textNode], @ctype:'paragraph' }
 *   textNode       { id, value, style?:{ bold, fontSizeCode, @ctype:'nodeStyle' }, @ctype }
 *   horizontalLine { id, layout, @ctype }
 *   quotation      { id, layout, value, source, @ctype }  ← layout 이 인용구 종류다
 *   image          업로드 결과를 그대로 회수해 쓴다 (naver.js 의 uploadImages)
 *
 * **소제목과 인용구는 네이버에서 별개 서식이다.** 굵게+큰 글자로 소제목을 흉내 내면
 * 목차·모바일 보기에서 소제목으로 인식되지 않고, 그냥 굵은 문단이 된다.
 * `sectionTitle` 컴포넌트를 써야 한다 (문단 서식 드롭다운의 '소제목' 이 이것이다).
 *
 * ⚠️ **표(table)와 링크 노드는 일부러 쓰지 않는다.**
 *   표는 셀마다 문단·이미지 노드를 품는 큰 구조라 손으로 만들 이유가 없고,
 *   무엇보다 **커서가 표 안에 있으면 사진 업로드가 표 셀 안으로 들어간다**
 *   (실측: 최상위 image 컴포넌트가 안 생기고 셀 안에 imageNode 로 박혔다).
 *   링크 노드는 스키마를 아직 실측하지 못했다. 모르는 필드를 넣으면 그 컴포넌트가
 *   통째로 "알 수 없는 컴포넌트" 가 되어 글에 회색 박스로 실린다.
 *   → 참고 자료는 평문으로 적는다. 확실하지 않으면 넣지 않는다(프로젝트 원칙).
 */

/**
 * 소제목·본문의 글자 크기 코드.
 *
 * ⚠️ **`se-fs-` 접두사가 겹쳐 보이지만 고치지 마세요.**
 * 네이버는 이 값을 `se-fs-${code}` 로 클래스에 붙이므로 발행된 HTML 에
 * `class="se-fs-fs24"` 라는 이상한 모양이 남는다. 중복처럼 보여서 `'24'` 로
 * 고치고 싶어지는데, 실제로는 이 형태가 정확히 동작한다.
 *
 * > 2026-07-28 실측 (발행된 글에서 getComputedStyle):
 * >   se-fs-fs24 → 24px / weight 700
 * >   se-fs-fs19 → 19px / weight 700
 * >   se-fs-fs15 → 15px / weight 400
 * >   코드 없음   → 19px (네이버 기본값)
 *
 * `'24'` 로 바꾸면 `se-fs-24` 가 되는데 그건 검증하지 않았다.
 * 본문 15px 은 에디터의 기본 본문 크기와 같다.
 */
const FS = {
  h3: 'fs19', // 소제목보다 한 단계 낮은 강조 (FAQ 질문, 참고 자료 머리)
  // 본문보다 작게 두는 자리 — 참고 자료·이미지 출처처럼 읽는 흐름의 주인공이 아닌 블록
  small: 'fs15',
};

/**
 * 본문 글자 크기.
 *
 * 실측으로 확인한 것 (발행된 글에서 getComputedStyle):
 *   - `text` 컴포넌트 안에서 **코드를 비우면 15px** 이다. 스킨 기본값이라
 *     `fs15` 를 명시한 것과 결과가 같다. 즉 "안 넣으면 커진다" 는 기대는 틀렸다.
 *   - `sectionTitle` 컴포넌트 안에서 코드를 비우면 **30px** 로 나온다.
 *     컴포넌트가 크기를 정하므로 소제목에는 크기를 지정할 필요가 없다.
 *
 * 네이버 블로그는 모바일에서 읽는 비중이 크고 15px 은 답답하다.
 * 그래서 본문만 한 단계 올린다. (`se-fs-fs16`)
 */
const BODY_STYLE = { fontSizeCode: 'fs16' };

/**
 * 인용구 종류 (2026-07-28 실측 — `layout` 값이 종류를 결정한다).
 *
 *   default             기본 (큰 따옴표)
 *   quotation_line      왼쪽 세로선
 *   quotation_bubble    말풍선
 *   quotation_underline  위아래 밑줄
 *   quotation_postit    포스트잇
 *   quotation_corner    모서리 괄호
 *
 * **용도를 나눠 쓴다.** 같은 모양이 반복되면 글이 단조로워지고, 무엇보다
 * 독자가 "이건 핵심 정리" 와 "이건 팁" 을 구분할 수 없다.
 */
export const QUOTE = {
  answer: 'quotation_line', // 한 줄 정리 — 글의 결론
  tip: 'quotation_postit', // 섹션 팁·주의
  speech: 'quotation_bubble', // 인물 발언
  plain: 'default',
};

/**
 * 굵게는 `style: { bold: true }` 로 넣는다.
 * 발행되면 `<b>` 태그가 되고 weight 700 으로 렌더링된다 (위 실측 참고).
 */

let seq = 0;
/**
 * 컴포넌트 id.
 *
 * 에디터가 만드는 것은 `SE-<uuid>` 형식이지만 형식을 따를 필요는 없다.
 * **문서 안에서 겹치지 않기만 하면 된다.** 겹치면 에디터가 뒤엣것을 버린다.
 */
function uid(prefix = 'SE-gen') {
  seq += 1;
  return `${prefix}-${seq.toString(36)}-${Math.floor(seq * 2654435761 % 0xffffff).toString(36)}`;
}

/** 주입 사이에 id 가 이어지지 않도록 글마다 초기화한다. */
export function resetIds() {
  seq = 0;
}

function textNode(value, style) {
  const node = { id: uid(), value: String(value ?? ''), '@ctype': 'textNode' };
  if (style) node.style = { ...style, '@ctype': 'nodeStyle' };
  return node;
}

/**
 * @param {string} value      문단 텍스트
 * @param {object} [style]    **글자** 스타일 (bold·fontSizeCode) — nodeStyle
 * @param {object} [paraStyle] **문단** 스타일 (lineHeight) — paragraphStyle
 *
 * 스타일이 두 층이라는 점에 주의. 굵기·크기는 textNode 에, 줄간격은 문단에 붙는다.
 */
function paragraph(value, style, paraStyle) {
  const p = { id: uid(), nodes: [textNode(value, style)], '@ctype': 'paragraph' };
  if (paraStyle) p.style = { ...paraStyle, '@ctype': 'paragraphStyle' };
  return p;
}

/**
 * 본문 문단의 줄간격.
 *
 * 2026-07-28 실측 — 툴바의 줄간격 드롭다운을 열면 **"180% 선택됨"** 이라고 나오고,
 * 값을 고르면 문단에 `style: { lineHeight: 2.1, '@ctype': 'paragraphStyle' }` 이 붙는다.
 * (퍼센트가 아니라 배수로 저장된다)
 *
 * 왜 기본값(1.8)에서 올리는가 — 문단 사이를 띄우는 다른 방법이 **전부 막혀 있다.**
 *   · 빈 문단을 끼우면 **발행 시 삭제된다** (실측: 발행된 글의 빈 문단 0개)
 *   · 문단마다 컴포넌트를 쪼개도 **인접 컴포넌트 간격이 0** 이다
 * 남은 수단이 줄간격이고, 이것이 네이버 블로거들이 실제로 쓰는 방법이다.
 */
const BODY_PARA = { lineHeight: 2.0, align: 'center' };

/**
 * 모바일 한 줄에 들어가는 글자 수.
 *
 * 네이버 본문 폭은 모바일에서 화면 폭을 거의 다 쓴다. 16px 한글은 글자 폭이
 * 대략 글자 크기와 같으므로 390px 화면에 **22자 내외**가 한 줄이다.
 *
 * 참고 글 6편의 문단 길이가 여기에 정확히 맞는다 — 중간값 8~16자, p75 14~22자,
 * 최대 26~31자. 즉 그들은 **문단 하나 = 모바일 한 줄**로 쓴다. 우연이 아니다.
 * (learned.md 법칙 ①)
 */
const MOBILE_LINE = 22;
const MOBILE_LINE_MAX = 30;

/**
 * 긴 문단을 **모바일 한 줄 크기로 쪼갠다.**
 *
 * codex 가 써 주는 문단은 60~80자다. 그대로 넣으면 모바일에서 3~4줄이 되어
 * 글자 벽이 된다. 그래서 **의미가 끊기는 자리**에서 나눈다.
 *
 * 나눌 자리 우선순위: 문장 끝(`. ! ?`) → 쉼표·중점 → 연결 어미(`~고 ~며 ~서 ~면`)
 * → 마지막 수단으로 공백. **글자 수만 보고 아무 데서나 자르지 않는다** —
 * 조사 중간에서 끊기면 읽는 리듬이 오히려 더 나빠진다.
 */
export function mobileLines(text, { max = MOBILE_LINE_MAX, target = MOBILE_LINE } = {}) {
  const src = String(text ?? '').trim();
  if (!src) return [];
  if (src.length <= max) return [src];

  const out = [];
  let rest = src;
  while (rest.length > max) {
    // target~max 구간에서 끊을 자리를 찾는다. 뒤에서부터 좋은 자리를 고른다.
    const window = rest.slice(0, max + 1);
    const at = (() => {
      const patterns = [
        /[.!?]\s+/g, // 문장 끝
        /[,·]\s*/g, // 쉼표·중점
        /(?:고|며|서|면|지만|는데|으로|에서|까지|부터)\s+/g, // 연결 어미·조사 뒤
        /\s+/g, // 공백
      ];
      for (const re of patterns) {
        let best = -1;
        for (const m of window.matchAll(re)) {
          const end = m.index + m[0].length;
          if (end >= target * 0.6 && end <= max) best = end;
        }
        if (best > 0) return best;
      }
      return max; // 끊을 자리가 없으면 어쩔 수 없이 자른다
    })();
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

/**
 * 본문 문단 — 글자 크기·줄간격·가운데 정렬을 함께 입힌다.
 *
 * 가운데 정렬은 `paragraphStyle.align` 이다. 발행된 글의 문단 클래스가
 * `se-text-paragraph-align-` 로 끝나 있어(값이 비면 왼쪽) 여기에 붙는 것으로 봤다.
 * 실제 반영은 발행 후 `se-text-paragraph-align-center` 로 확인한다.
 */
function bodyPara(value) {
  return paragraph(value, BODY_STYLE, BODY_PARA);
}

/** 여러 문단을 한 text 컴포넌트로 묶는다. */
function textComponent(paragraphs) {
  const value = paragraphs.filter(Boolean);
  if (!value.length) return null;
  return { id: uid(), layout: 'default', value, '@ctype': 'text' };
}

/** 문단 하나만 담은 text 컴포넌트 (소제목처럼 단독으로 서야 하는 것) */
function line(value, style) {
  if (!String(value ?? '').trim()) return null;
  return textComponent([paragraph(value, style)]);
}

/**
 * 문단마다 **별도 컴포넌트**로 쪼갠다 — 이것이 네이버에서 문단을 띄우는 방법이다.
 *
 * ⚠️ **빈 문단으로 띄우려 하면 안 된다.**
 *
 * 한 `text` 컴포넌트 안의 `<p>` 들은 줄바꿈만 되고 사이가 벌어지지 않아서,
 * 문단 4~5개를 한 컴포넌트에 넣으면 모바일에서 글자 벽이 된다.
 * 그래서 사람이 엔터를 두 번 치듯 빈 문단을 끼워 봤는데,
 *
 * > 2026-07-28 실측: **발행하면 빈 문단이 전부 삭제된다.**
 * > (발행된 글에서 빈 `.se-text-paragraph` 개수 = 0)
 *
 * 컴포넌트는 지워지지 않고 자기 여백을 가진다. 그래서 문단 하나 = 컴포넌트 하나로 둔다.
 * 목록(가운뎃점 항목)은 예외다 — 그건 한 덩어리로 읽혀야 하므로 묶어 둔다.
 */
function paragraphBlocks(texts) {
  return texts
    .map((t) => String(t ?? '').trim())
    .filter(Boolean)
    .map((t) => textComponent([bodyPara(t)]))
    .filter(Boolean);
}

/**
 * 한 줄 여백.
 *
 * ⚠️ **빈 문자열이 아니라 제로폭 공백(U+200B)이다.** 이 한 글자가 핵심이다.
 *
 * > 2026-07-28 실측 — 참고 글 6편의 문단 길이 분포에서 **최소·중간값이 1** 로
 * > 나왔다. 처음엔 이상한 데이터로 봤는데, 그 1글자가 제로폭 공백이었다.
 * > **6편이 전부 이 방법으로 여백을 만든다.**
 *
 * 왜 이게 유일한 방법인가 — 나머지가 전부 막혀 있다:
 *   · `value: ''` 빈 문단 → **발행 시 삭제된다**
 *   · 문단마다 컴포넌트 분리 → 인접 컴포넌트 간격 **0px**
 *   · 줄간격만 올리기 → 줄 사이는 벌어지지만 **문단 사이는 안 벌어진다**
 *
 * 눈에 안 보이는 글자라 지우고 싶어지지만, 지우면 글이 다시 벽이 된다.
 */
const ZWSP = '​';
function spacer() {
  return paragraph(ZWSP, BODY_STYLE, BODY_PARA);
}

/**
 * 문단들을 한 컴포넌트에 담되 **사이에 여백 문단을 끼운다.**
 * 참고 글 6편이 쓰는 방식 그대로다. 앞뒤로는 넣지 않는다(컴포넌트 여백과 겹친다).
 */
function spacedParagraphs(texts) {
  const blocks = texts
    .map((t) => String(t ?? '').trim())
    .filter(Boolean)
    // 문단 하나를 모바일 한 줄씩으로 쪼갠다. 쪼갠 줄 사이에는 여백을 넣지 않는다 —
    // 그건 원래 한 문단이므로 붙어 있어야 한 덩어리로 읽힌다.
    .map((t) => mobileLines(t).map((line) => bodyPara(line)));
  // 문단(덩어리) 사이에만 여백을 넣는다
  return blocks.flatMap((lines, i) => (i ? [spacer(), ...lines] : lines));
}

function horizontalLine() {
  return { id: uid(), layout: 'default', '@ctype': 'horizontalLine' };
}

/**
 * **네이버의 진짜 소제목.**
 *
 * `text` 컴포넌트에 굵게·큰 글자를 씌운 것과 다르다. 에디터의 문단 서식
 * 드롭다운에서 '소제목' 을 고르면 이 컴포넌트가 만들어진다.
 * 필드 이름이 `value` 가 아니라 **`title`** 인 점에 주의 (documentTitle 과 같다).
 */
function sectionTitle(text) {
  if (!String(text ?? '').trim()) return null;
  return { id: uid(), layout: 'default', title: [paragraph(text)], '@ctype': 'sectionTitle' };
}

/**
 * 인용구 컴포넌트. `layout` 이 종류를 결정한다 (QUOTE 참고).
 * 빈 인용구는 `value: null` 로 생성되지만 내용을 넣을 때의 구조는 text 와 같다.
 */
function quotation(text, { layout = QUOTE.plain, source = '' } = {}) {
  if (!String(text ?? '').trim()) return null;
  return {
    id: uid(),
    layout,
    value: [paragraph(text)],
    source: source ? [paragraph(source)] : null,
    '@ctype': 'quotation',
  };
}

/**
 * 업로드해 둔 이미지 컴포넌트를 본문에 놓을 형태로 다듬는다.
 *
 * 업로드 결과를 **그대로 쓰는 것이 원칙**이다. src·path·domain·fileSize 처럼
 * 네이버가 채운 값을 우리가 만들 수는 없다. 캡션과 대표 지정만 바꾼다.
 */
function imageComponent(uploaded, { caption = '', represent = false } = {}) {
  if (!uploaded) return null;
  const text = String(caption || '').trim();
  return {
    ...uploaded,
    id: uid(),
    represent,
    /* **가운데 정렬.** 업로드 직후 기본값은 `left` 라서, 그대로 두면 사진이
     * 본문 왼쪽에 붙어 오른쪽에 빈 공간이 남는다. 에디터의 '가운데 정렬' 버튼이
     * 바꾸는 필드가 바로 이것이다 (실측으로 확인).
     *
     * 크기는 건드리지 않는다 — `widthPercentage: 100` 은 저장은 되지만 실제
     * 렌더 폭이 바뀌지 않았다(886px 그대로). 효과를 확인하지 못한 필드는 넣지 않는다. */
    align: 'center',
    /* ⚠️ 캡션은 **문단 배열**이다. 문자열을 넣으면 안 된다.
     *
     * > 2026-07-28 실측: `caption: '본문 사진 1'` 로 넣었더니
     * > `setDocumentData` 가 **TypeError: e.map is not a function** 으로 터졌다.
     * > 빈 캡션이 `null` 로 나오니 문자열이겠거니 짐작한 것이 원인이었다.
     *
     * 비어 있을 때는 `null` 이 맞다(빈 배열이 아니다). */
    caption: text ? [paragraph(text)] : null,
  };
}

/**
 * 사진 2장을 한 덩어리로 묶는다 (에디터의 '콜라주').
 *
 * 2026-07-28 실측 — 사진을 2장 이상 첨부하면 뜨는 '사진 첨부 방식' 모달의
 * 세 선택지가 각각 이 컴포넌트를 만든다:
 *   개별사진 → image 컴포넌트 여러 개
 *   콜라주   → imageGroup { layout: 'collage' }
 *   슬라이드 → imageGroup { layout: 'slide' }
 *
 * 우리는 업로드는 **항상 개별사진**으로 하고(그래야 순서·자리를 우리가 정한다),
 * 조립할 때 원하는 것만 이 함수로 묶는다. 업로드 방식과 배치 방식을 분리하는 것이
 * 핵심이다 — 콜라주로 올려 버리면 묶음을 다시 풀 수 없다.
 *
 * 슬라이드는 쓰지 않는다. 넘겨야 보이므로 **안 넘기는 독자에게는 사진 1장**이고,
 * 검색엔진에도 첫 장만 노출된다. 정보를 숨기는 연출이다.
 */
function imageGroup(uploadedPair, { caption = '' } = {}) {
  const pair = uploadedPair.filter(Boolean);
  if (pair.length < 2) return null;
  const text = String(caption || '').trim();
  return {
    id: uid(),
    layout: 'collage',
    contentMode: 'extend',
    caption: text ? [paragraph(text)] : null,
    // 묶음 안의 이미지는 represent 를 켜지 않는다 — 대표는 맨 위 단독 사진이다
    images: pair.map((img) => ({ ...img, id: uid(), represent: false, caption: null })),
    '@ctype': 'imageGroup',
  };
}

/**
 * 사진을 몇 장씩 묶을지 정하는 리듬.
 *
 * 전부 1장씩 세우면 스크롤이 단조롭고, 전부 2장씩 묶으면 사진이 작아져
 * 풍경·객실 사진의 디테일이 죽는다. **1·2·2·1** 을 돌린다.
 *
 * 글마다 시작 위치를 바꿔 같은 리듬이 반복되지 않게 하되, `Math.random` 은 쓰지 않는다.
 * 같은 글은 항상 같은 결과여야 다시 만들었을 때 비교가 된다.
 */
const GROUP_RHYTHM = [1, 2, 2, 1];

function chunkByRhythm(items, seed = 0) {
  const out = [];
  let i = 0;
  let step = Math.abs(seed) % GROUP_RHYTHM.length;
  while (i < items.length) {
    const size = GROUP_RHYTHM[step % GROUP_RHYTHM.length];
    const take = items.slice(i, i + size);
    // 마지막에 1장만 남으면 묶지 않고 단독으로 세운다
    out.push(take);
    i += take.length;
    step += 1;
  }
  return out;
}

/** 제목에서 만든 안정적인 시드 — 같은 글이면 항상 같은 리듬이 나온다. */
function seedFrom(text) {
  let h = 0;
  for (const ch of String(text || '')) h = (h * 31 + ch.codePointAt(0)) % 100000;
  return h;
}

/**
 * 본문 이미지를 문단 사이에 고르게 끼운다.
 *
 * html.js 와 같은 원칙이다 — 섹션의 문단을 다 쓴 뒤 사진을 몰아 붙이면
 * 캡션이 줄줄이 쌓여 목록처럼 보이고 읽는 흐름이 끊긴다.
 * 마지막 문단 뒤에는 두지 않는다(다음 소제목과 붙어 다시 몰린 것처럼 보인다).
 */
function spreadImages(paragraphCount, imageCount) {
  const gaps = Math.max(1, paragraphCount - 1);
  const slots = new Map();
  for (let k = 0; k < imageCount; k++) {
    const at = Math.min(gaps, Math.max(1, Math.round(((k + 1) * (gaps + 1)) / (imageCount + 1))));
    if (!slots.has(at)) slots.set(at, []);
    slots.get(at).push(k);
  }
  return slots;
}

/**
 * 아티클을 스마트에디터 컴포넌트 배열로 만든다.
 *
 * @param {object} article  normalizeArticle 결과
 * @param {object} opts
 * @param {object} opts.cfg
 * @param {object} opts.baseDoc      현재 문서(getDocumentData().document) — documentTitle 골격을 물려받는다
 * @param {object[]} opts.images     업로드된 이미지 컴포넌트. [대표, 본문1, 본문2, ...] 순서
 * @param {object[]} opts.imageMeta  images 와 같은 순서의 { caption, afterSection }
 * @param {object[]} opts.credits    CC 라이선스 저작자 표기 목록
 */
export function buildDocument(article, { cfg, baseDoc, images = [], imageMeta = [], credits = [] }) {
  resetIds();

  const out = [];
  const seo = cfg.seo || {};
  // 사진 묶음 리듬의 시작 위치. 글 제목에서 만들므로 같은 글은 항상 같은 배치가 된다
  const rhythmSeed = seedFrom(article.title);

  /* 제목 컴포넌트는 **새로 만들지 않고 기존 것을 물려받는다.**
   * 빈 문서에도 documentTitle 이 이미 있고, 그 자리를 대체하는 편이 안전하다.
   * (에디터가 제목 컴포넌트를 특별 취급한다 — 없으면 문서가 깨진다) */
  const existingTitle = (baseDoc?.components || []).find((c) => c['@ctype'] === 'documentTitle');
  out.push({
    id: existingTitle?.id || uid(),
    layout: existingTitle?.layout || 'default',
    title: [paragraph(article.title || '')],
    subTitle: null,
    align: 'left',
    '@ctype': 'documentTitle',
  });

  // 대표 이미지 — 본문 맨 위. represent:true 가 목록·공유 카드에 쓰이는 사진이다
  const thumb = images[0] ? imageComponent(images[0], { represent: true }) : null;
  if (thumb) out.push(thumb);

  /* 한 줄 정리 — 세로선 인용구로 세운다.
   * 글의 결론이므로 맨 위에서 눈에 걸려야 하고, 아래의 '팁' 인용구와는
   * 모양이 달라야 독자가 역할을 구분한다. */
  if (article.directAnswer) {
    out.push(quotation(article.directAnswer, { layout: QUOTE.answer }));
  }

  /* 핵심 요약.
   * 네이버 에디터에는 목록(ul) 컴포넌트가 없어서 문단마다 가운뎃점을 붙인다.
   * html.js 의 <ul> 을 그대로 옮길 수 없는 자리다.
   *
   * 항목 사이를 빈 줄로 띄우지 않는다 — 모바일에서 화면 한 장을 다 잡아먹는다. */
  if (seo.includeKeyTakeaways !== false && article.keyTakeaways?.length) {
    out.push(sectionTitle('이 글의 핵심'));
    out.push(textComponent(article.keyTakeaways.map((t) => bodyPara(`· ${t}`))));
  }

  /* 목차는 만들지 않는다.
   * 티스토리에서는 `#앵커` 링크로 이동했지만, 네이버 본문에는 앵커를 걸 수 없다.
   * 이동하지 않는 목차는 글만 길게 만든다. */

  const bodyImages = images.slice(1);
  const bodyMeta = imageMeta.slice(1);

  (article.sections || []).forEach((sec, i) => {
    out.push(sectionTitle(sec.heading));

    const paras = sec.paragraphs || [];
    // 이 섹션에 배치될 사진들의 인덱스
    const mine = bodyImages
      .map((img, k) => ({ img, k }))
      .filter(({ k }) => (bodyMeta[k]?.afterSection ?? 0) === i + 1);

    /* 사진을 1·2·2·1 리듬으로 묶는다. 묶음 하나가 배치의 한 단위가 된다.
     * 시드에 섹션 번호를 섞어, 섹션마다 리듬의 시작 위치가 달라지게 한다. */
    const groups = chunkByRhythm(mine, rhythmSeed + i);
    const slots = spreadImages(paras.length, groups.length);

    /** 묶음 하나를 컴포넌트로 만든다 (1장이면 단독, 2장이면 콜라주) */
    const renderGroup = (g) => {
      if (g.length >= 2) {
        return imageGroup(g.map((x) => x.img), { caption: bodyMeta[g[0].k]?.caption });
      }
      return imageComponent(g[0].img, { caption: bodyMeta[g[0].k]?.caption });
    };

    /* 문단은 **하나씩 별도 컴포넌트**로 내보낸다 (paragraphBlocks 머리말 참고).
     * 사진 묶음은 지정된 문단 뒤에 끼운다. */
    const usedGroups = new Set();
    paras.forEach((para, pi) => {
      /* 문단 사이 여백. 첫 문단 앞에는 넣지 않는다.
       * ⚠️ 예전에 `spacedParagraphs([para])` 로 문단 하나씩 넘겼더니 배열 길이가
       * 항상 1 이라 **여백이 한 번도 삽입되지 않았다** (실측: 발행된 글의 여백 문단 0개).
       * 여백은 "문단들 사이" 이므로 호출 단위가 하나면 만들 수 없다. */
      {
        const lines = mobileLines(para).map((l) => bodyPara(l));
        const c = textComponent(pi ? [spacer(), ...lines] : lines);
        if (c) out.push(c);
      }
      const here = slots.get(pi + 1);
      if (here?.length) {
        for (const gi of here) {
          const comp = renderGroup(groups[gi]);
          if (comp) out.push(comp);
          usedGroups.add(gi);
        }
      }
    });

    /* 목록은 한 컴포넌트로 묶는다. 항목마다 컴포넌트를 만들면 항목 사이가
     * 문단만큼 벌어져 목록으로 읽히지 않는다. */
    if (sec.bullets?.length) {
      const comp = textComponent(sec.bullets.map((b) => bodyPara(`· ${b}`)));
      if (comp) out.push(comp);
    }

    /* 표는 만들지 않는다 (파일 머리말 참고).
     * 표에 담겨 있던 정보를 버리지는 않고 "항목: 값" 문단으로 펼친다.
     * 모바일에서는 어차피 표가 옆으로 넘쳐 읽기 어렵다 — 펼치는 편이 낫다. */
    if (sec.table?.headers?.length && sec.table?.rows?.length) {
      const { headers, rows } = sec.table;
      if (sec.table.caption) out.push(line(sec.table.caption, { bold: true, fontSizeCode: FS.h3 }));
      out.push(
        textComponent(
          rows.map((row) =>
            bodyPara(headers.map((h, ci) => `${h}: ${row[ci] ?? ''}`).join(' · '))
          )
        )
      );
    }

    // 팁·주의는 포스트잇 인용구로 — '한 줄 정리'(세로선)와 모양이 달라야 구분된다
    if (sec.callout) out.push(quotation(sec.callout, { layout: QUOTE.tip }));

    // 자리를 못 잡은 묶음은 섹션 끝에 (문단 수보다 사진 묶음이 많을 때)
    groups.forEach((g, gi) => {
      if (usedGroups.has(gi)) return;
      const comp = renderGroup(g);
      if (comp) out.push(comp);
    });
  });

  // 섹션 범위를 벗어난 사진은 본문 끝에 몰아 넣는다
  const sectionCount = (article.sections || []).length;
  bodyImages.forEach((img, k) => {
    const at = bodyMeta[k]?.afterSection ?? 0;
    if (at >= 1 && at <= sectionCount) return;
    out.push(imageComponent(img, { caption: bodyMeta[k]?.caption }));
  });

  /* FAQ.
   * 질문마다 소제목을 쓰면 소제목이 5개나 더 늘어 글의 구조가 무너진다.
   * 'FAQ' 자체만 소제목으로 세우고, 질문은 굵은 한 줄로 둔다. */
  if (seo.includeFaq !== false && article.faq?.length) {
    out.push(sectionTitle('자주 묻는 질문'));
    for (const f of article.faq) {
      out.push(line(`Q. ${f.question}`, { bold: true, fontSizeCode: FS.h3 }));
      out.push(textComponent([bodyPara(`A. ${f.answer}`)]));
    }
  }

  if (article.conclusion) {
    out.push(sectionTitle('마치며'));
    out.push(textComponent([bodyPara(article.conclusion)]));
  }

  /* 영상 글의 원본 영상 주소.
   * 링크 노드 스키마를 아직 실측하지 못했으므로 주소를 평문으로 적는다.
   * 네이버는 본문의 유튜브 주소를 발행 시 카드로 바꿔 주는 경우가 있는데,
   * 그건 네이버가 알아서 하는 일이고 우리가 의존할 동작은 아니다. */
  const videoEmbeds = (article.embeds || []).filter((e) => /^[A-Za-z0-9_-]{11}$/.test(e.videoId || ''));
  if (videoEmbeds.length) {
    out.push(horizontalLine());
    out.push(line('원본 영상', { bold: true, fontSizeCode: FS.h3 }));
    out.push(
      textComponent(
        videoEmbeds.map((e) =>
          paragraph(
            `${e.title || '유튜브에서 보기'} — https://www.youtube.com/watch?v=${e.videoId}`,
            { fontSizeCode: FS.small }
          )
        )
      )
    );
  }

  // 출처 · 이미지 저작자 표기 (CC 라이선스는 표기가 의무다)
  const sources = seo.includeSources !== false ? article.sources || [] : [];
  const useCredits = (credits || []).filter((c) => c && (c.photographer || c.credit));
  if (sources.length || useCredits.length) out.push(horizontalLine());

  if (sources.length) {
    out.push(line('참고 자료', { bold: true, fontSizeCode: FS.h3 }));
    out.push(
      textComponent(
        sources.map((s) =>
          paragraph(
            [s.title || s.url, [s.publisher, s.date].filter(Boolean).join(' · '), s.url]
              .filter(Boolean)
              .join(' · '),
            { fontSizeCode: FS.small }
          )
        )
      )
    );
  }

  if (useCredits.length) {
    // 같은 출처는 한 줄로 묶는다 (영상 글은 20장이 전부 같은 출처다)
    const merged = new Map();
    for (const c of useCredits) {
      const who = c.photographer || c.credit || '작자 미상';
      const key = `${who}|${c.license || ''}`;
      const cur = merged.get(key);
      if (cur) cur.count += 1;
      else merged.set(key, { who, license: c.license, pageUrl: c.pageUrl, count: 1 });
    }
    out.push(line('이미지 출처', { bold: true, fontSizeCode: FS.h3 }));
    out.push(
      textComponent(
        [...merged.values()].map((c) =>
          paragraph(
            [c.who, c.license, c.count > 1 ? `사진 ${c.count}장` : '', c.pageUrl]
              .filter(Boolean)
              .join(' · '),
            { fontSizeCode: FS.small }
          )
        )
      )
    );
  }

  return out.filter(Boolean);
}

/**
 * 주입한 문서가 실제로 살아남았는지 확인할 때 쓰는 요약.
 *
 * 스타일 키를 하나라도 잘못 쓰면 그 컴포넌트가 "알 수 없는 컴포넌트" 가 되어
 * 회색 박스로 실린다. 그래서 발행 전에 반드시 왕복 검증을 한다 — naver.js 참고.
 */
export function summarize(components) {
  const counts = new Map();
  for (const c of components || []) {
    const t = c['@ctype'] || 'unknown';
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()].map(([t, n]) => `${t}×${n}`).join(' ');
}
