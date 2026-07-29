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
 * **표(table)는 2026-07-29 에 실측을 마쳐 이제 쓴다.**
 *   스키마: scripts/probe-table.mjs (에디터가 만든 표를 떠옴) →
 *   logs/naver-table-schema.json. 셀에 문단·굵게·색·크기를 채운 것이
 *   왕복에서 살아남는 것까지 probe-table2.mjs 로 확인했다 (회색 박스 0개).
 *   "커서가 표 안에 있으면 사진 업로드가 표 셀 안으로 들어간다"는 함정은
 *   여전하지만, 우리는 **사진을 다 올린 뒤에** 문서를 주입하므로 안전하다.
 *
 * ⚠️ **링크 노드는 여전히 쓰지 않는다** — 스키마를 아직 실측하지 못했다.
 *   모르는 필드를 넣으면 그 컴포넌트가 통째로 "알 수 없는 컴포넌트" 가 되어
 *   글에 회색 박스로 실린다. → 참고 자료는 평문으로 적는다.
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
  lead: 'quotation_corner', // 섹션 머리 — 이 대목이 무엇인가 (상위 글의 주력 용법)
  tip: 'quotation_postit', // 섹션 팁·주의
  speech: 'quotation_bubble', // 인물 발언
  plain: 'default',
};

/* 인용구를 왜 이렇게 쓰는가 — 상위 여행 글 실측 (2026-07-29, 검색 상위 8편)
 *
 *   ppororogo/224255039046   인용구 9개 · **전부 `quotation_corner`**
 *                            "위치 및 기본 정보" "강추하는 이유" "이용 전에 알아둘 점" "총평"
 *   kkujuni-/223970686576    인용구 8개 · **전부 `quotation_line`**
 *                            "라쿠아 위치 가는 방법" "온천과 노천탕 최고임" "결제 후 퇴장"
 *
 * 즉 상위 글에서 **인용구는 소제목이다.** 한 글에서 한 종류로 통일해 리듬을 만든다.
 * 우리는 `sectionTitle`(GEO 용 목차)을 포기하지 않으므로, 섹션 안의 **대목 머리말**을
 * 인용구로 세워 같은 리듬을 만든다 (`sections[].lead`).
 */

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
/* 처음에는 22 / 30 이었다. max 를 30 으로 두니 29자 줄이 만들어졌고, 실제 렌더
 * 폭(390~420px ≈ 22~25자)을 살짝 넘겨 **마지막 두어 글자만 다음 줄로 떨어졌다**
 * ("…보도했 / 고,"). 줄을 화면 폭 안에 확실히 넣으려면 max 가 렌더 폭보다
 * 작아야 한다. 상위 글 문단 중간값이 8~16자인 것과도 방향이 같다. */
const MOBILE_LINE = 20;
const MOBILE_LINE_MAX = 25;

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
    /* target~max 구간에서 끊을 자리를 찾는다.
     *
     * **max 가 아니라 target 에 가장 가까운 자리를 고른다.** 예전에는 max 에
     * 가까운(마지막) 자리를 골랐는데, 29자 문단이 모바일 실제 폭(~24자)을
     * 살짝 넘겨 **마지막 한두 글자만 다음 줄로 떨어졌다** (2026-07-29 프리뷰
     * 실측: "…불참했던 채영 / 이", "…브랜드 캠페인 / 과"). 고아 글자는
     * 가운데 정렬에서 특히 눈에 띈다.
     *
     * 그리고 **꼬리가 5자 이하로 남는 자리는 피한다** — 다음 줄에 "다." 만
     * 남는 것도 같은 문제다. 피할 자리가 없을 때만 어쩔 수 없이 받아들인다. */
    const window = rest.slice(0, max + 1);
    const at = (() => {
      const patterns = [
        /[.!?]\s+/g, // 문장 끝
        /[,·]\s*/g, // 쉼표·중점
        /(?:고|며|서|면|지만|는데|으로|에서|까지|부터)\s+/g, // 연결 어미·조사 뒤
        /\s+/g, // 공백
      ];
      /* 따옴표 **안**에서는 끊지 않는다 — 인용이 줄에 걸쳐 잘리면 강조를 붙일 수
       * 없고(여는/닫는 따옴표를 구분 못 한다), 읽기에도 발언이 두 동강 난다.
       * 위치 p 앞의 따옴표 개수가 홀수면 인용 속이다. max 보다 긴 인용은
       * 어차피 피할 수 없으므로 그때만 인용 속 자리도 허용한다. */
      const insideQuote = (p) => {
        let open = 0;
        for (let i = 0; i < p; i++) if (/["“”]/.test(rest[i])) open ^= 1;
        return open === 1;
      };
      for (const re of patterns) {
        const ends = [];
        for (const m of window.matchAll(re)) {
          const end = m.index + m[0].length;
          if (end >= target * 0.6 && end <= max) ends.push(end);
        }
        if (!ends.length) continue;
        const tail = (end) => rest.length - end; // 이 자리에서 끊으면 남는 길이
        let pool = ends.filter((e) => !insideQuote(e));
        if (!pool.length) pool = ends; // 인용이 max 보다 길면 어쩔 수 없다
        const good = pool.filter((e) => tail(e) === 0 || tail(e) > 5);
        if (good.length) pool = good;
        return pool.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
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
 * 본문 중간중간 넣는 강조 — 문장을 스타일이 다른 노드들로 쪼갠다.
 *
 * 어떤 키를 쓸 수 있는지는 **2026-07-29 에 에디터 왕복으로 실측**했다
 * (`scripts/probe-nodestyle.mjs` — 발행 없이 setDocumentData → getDocumentData):
 *
 *   살아남음: bold · underline · italic · fontColor · backgroundColor · fontSizeCode
 *   삭제됨:   strikethrough · strike
 *   알 수 없는 컴포넌트: 0개 (안전)
 *
 * 강조 규칙 — 상위 네이버 글의 문법대로 **역할을 고정**한다:
 *   따옴표 인용(발언)  → 굵게 + 한 단계 큰 글자 (fs19)  — 발언이 그 문단의 주인공이다
 *   날짜·시각·수치     → 굵게 + 밑줄                    — 스캔하는 눈이 걸리는 자리
 * 색은 쓰지 않는다 — 자동으로 고른 색은 반드시 촌스러워진다. 굵기·크기·밑줄이면
 * 리듬이 생기고, 과하지 않다.
 */
const ACCENTS = [
  /* 따옴표 인용 — **같은 줄 안에서 완결된 것만** 강조한다.
   * 처음에는 줄에 걸쳐 잘린 조각(여는 쪽·닫는 쪽)도 받았는데, 여는 따옴표와
   * 닫는 따옴표를 문자로 구분할 수 없어 "정숙은 " 같은 **화자 쪽이 강조되는**
   * 오작동이 났다. 대신 mobileLines 가 따옴표 안에서 끊지 않도록 고쳐(아래),
   * 웬만한 인용은 한 줄에 온전히 남는다. 그래도 잘린 긴 인용은 강조 없이 둔다. */
  { re: /["“][^"”]{2,60}["”]/g, style: { bold: true, fontSizeCode: 'fs19' } },
  // 날짜 (2026년 7월 30일 · 7월 30일 · 30일), 시각 (오후 3시), 수치+단위
  {
    re: /\d{4}년(?:\s?\d{1,2}월)?(?:\s?\d{1,2}일)?|\d{1,2}월(?:\s?\d{1,2}일)?|(?:오전|오후)\s?\d{1,2}시(?:\s?\d{1,2}분)?|\d[\d,.]*\s?(?:일|명|장|개|살|세|부작|곡|편|회|위|만|억|%|원|kg|cm)(?=[\s,.·)]|$)/g,
    style: { bold: true, underline: true },
  },
];

function accentNodes(text) {
  const src = String(text ?? '');
  // 겹치지 않게 자리를 먼저 모은다 — 앞선 규칙이 이긴다
  const marks = [];
  for (const { re, style } of ACCENTS) {
    re.lastIndex = 0;
    for (const m of src.matchAll(re)) {
      const [s, e] = [m.index, m.index + m[0].length];
      if (marks.some((x) => s < x.e && e > x.s)) continue;
      marks.push({ s, e, style });
    }
  }
  if (!marks.length) return [textNode(src, BODY_STYLE)];
  marks.sort((a, b) => a.s - b.s);

  const nodes = [];
  let at = 0;
  for (const m of marks) {
    if (m.s > at) nodes.push(textNode(src.slice(at, m.s), BODY_STYLE));
    nodes.push(textNode(src.slice(m.s, m.e), { ...BODY_STYLE, ...m.style }));
    at = m.e;
  }
  if (at < src.length) nodes.push(textNode(src.slice(at), BODY_STYLE));
  return nodes;
}

/**
 * 본문 문단 — 글자 크기·줄간격·가운데 정렬을 함께 입힌다.
 *
 * 가운데 정렬은 `paragraphStyle.align` 이다. 발행된 글의 문단 클래스가
 * `se-text-paragraph-align-` 로 끝나 있어(값이 비면 왼쪽) 여기에 붙는 것으로 봤다.
 * 실제 반영은 발행 후 `se-text-paragraph-align-center` 로 확인한다.
 */
function bodyPara(value) {
  const p = { id: uid(), nodes: accentNodes(value), '@ctype': 'paragraph' };
  p.style = { ...BODY_PARA, '@ctype': 'paragraphStyle' };
  return p;
}

/** 여러 문단을 한 text 컴포넌트로 묶는다. */
function textComponent(paragraphs) {
  const value = paragraphs.filter(Boolean);
  if (!value.length) return null;
  return { id: uid(), layout: 'default', value, '@ctype': 'text' };
}

/** 문단 하나만 담은 text 컴포넌트 (소제목처럼 단독으로 서야 하는 것) */
function line(value, style, paraStyle) {
  if (!String(value ?? '').trim()) return null;
  return textComponent([paragraph(value, style, paraStyle)]);
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
 * 진짜 표 — 스키마는 에디터가 만든 것을 그대로 베꼈다 (파일 머리말 참고).
 *
 * 왜 표인가: 시점 흐름을 문단으로 펼치니 행마다 4~5줄 + 화살표 + 여백으로
 * 세로가 너무 길다는 독자 피드백(2026-07-29). 표는 행 하나가 한 줄이다.
 *
 * @param {string[]} headers
 * @param {string[][]} rows
 * @param {object} opts
 * @param {boolean} opts.timeline  첫 열이 시점 — 2열(시점 30 : 내용 70)로 압축하고
 *                                 머리행을 생략한다 (날짜는 설명이 필요 없다)
 */
function naverTable(headers, rows, { timeline = false } = {}) {
  const cellPara = (v, style) => paragraph(v, style, { align: 'center' });
  const cell = (paras, width) => ({
    id: uid(),
    colSpan: 1,
    rowSpan: 1,
    width,
    height: 43,
    value: paras.filter(Boolean),
    '@ctype': 'tableCell',
  });
  const tr = (cells) => ({ cells, '@ctype': 'tableRow' });
  const metaCol = (h) => /의미|포인트|읽을|비고|해석/.test(String(h || ''));

  let outRows;
  let columnCount;
  if (timeline) {
    columnCount = 2;
    outRows = rows.map((row) =>
      tr([
        cell([cellPara(String(row[0] ?? ''), { bold: true })], 30),
        cell(
          [
            // 내용 열들 먼저, '의미' 열은 회색 작은 글자로 그 아래
            ...row.slice(1).flatMap((c, ci) => (metaCol(headers[ci + 1]) ? [] : [cellPara(String(c ?? ''))])),
            ...row
              .slice(1)
              .flatMap((c, ci) =>
                metaCol(headers[ci + 1]) ? [cellPara(String(c ?? ''), { fontColor: '#8c8c8c', fontSizeCode: 'fs13' })] : []
              ),
          ],
          70
        ),
      ])
    );
  } else {
    columnCount = headers.length;
    const w = Math.round((100 / columnCount) * 100) / 100;
    outRows = [
      tr(headers.map((h) => cell([cellPara(String(h ?? ''), { bold: true })], w))),
      ...rows.map((row) => tr(row.map((c) => cell([cellPara(String(c ?? ''))], w)))),
    ];
  }
  return {
    id: uid(),
    layout: 'default',
    width: 100,
    rows: outRows,
    columnCount,
    borderStyleName: 'thinLine',
    '@ctype': 'table',
  };
}

/**
 * 문장 단위로 나눈다 — **긴 덩어리를 문단으로 승격시키는 입구.**
 *
 * 왜 필요한가: 결론·FAQ 답·directAnswer 는 아티클에서 한 문자열로 온다.
 * mobileLines 는 줄만 쪼개고 **여백은 문단 사이에만** 들어가므로, 268자 결론이
 * 한 문단으로 남아 모바일에서 9줄 글자 벽이 됐다 (2026-07-29 발행글 실측 —
 * 문단 최대 길이 268자. 상위 글 법칙은 26~31자).
 * 문장으로 나눠 spacedParagraphs 에 넘기면 문장 사이에 여백이 생긴다.
 */
function sentences(text) {
  return String(text ?? '')
    .trim()
    .split(/(?<=[.!?…])\s+/)
    .filter(Boolean);
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
  /* 본문이 전부 가운데 정렬인데 소제목만 왼쪽이면 축이 두 개가 된다
   * (2026-07-29 발행글 독자 피드백 — "가운데 정렬이 안 되어 있다").
   * 소제목 문단에도 같은 align 을 싣는다.
   * 굵기도 명시한다 — 컴포넌트가 크기(30px)는 정해 주지만 발행글에서
   * 소제목이 본문과 같은 굵기로 나와 제목처럼 안 보였다 (같은 날 피드백). */
  return {
    id: uid(),
    layout: 'default',
    title: [paragraph(text, { bold: true }, { align: 'center' })],
    '@ctype': 'sectionTitle',
  };
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

  /* 도입 — 인사와 공감으로 시작한다.
   *
   * 상위 글은 예외 없이 이렇게 연다 (2026-07-29 실측):
   *   "안녕하세요, 분당 직장인 뽀로로 지은입니다:)" → "도쿄 여행 가면 하루 종일 걷고…
   *    진짜 좀 쉬어야겠다 싶을 때" → 그래서 이 장소
   *   "도쿄 여행을 하다 보면 하루에 2~3만 보는 기본입니다" → "다리가 무거워지죠"
   *
   * 정보부터 들이대지 않고 **읽는 사람의 상황**을 먼저 말한다. 그 자리가 없으면
   * 글이 안내문처럼 읽힌다. */
  if (article.intro?.length) {
    out.push(textComponent(spacedParagraphs(article.intro)));
  }

  /* 한 줄 정리 — 세로선 인용구로 세운다.
   * 글의 결론이므로 맨 위에서 눈에 걸려야 하고, 아래의 '팁' 인용구와는
   * 모양이 달라야 독자가 역할을 구분한다.
   *
   * **인용구에는 첫 문장만 넣는다.** directAnswer 는 2~4문장(240자대)인데
   * 그대로 넣었더니 인용구가 글자 벽이 됐다 (2026-07-29 발행글 실측 — 인용구
   * 243자. 상위 글의 인용구는 10~40자 짧은 한마디다). 나머지 문장은 인용구
   * 바로 아래 본문 문단으로 풀어 준다 — 정보는 버리지 않고 형태만 나눈다. */
  if (article.directAnswer) {
    const [first, ...rest] = sentences(article.directAnswer);
    if (first) out.push(quotation(first, { layout: QUOTE.answer }));
    if (rest.length) out.push(textComponent([spacer(), ...spacedParagraphs(rest)]));
  }

  /* 핵심 요약.
   * 네이버 에디터에는 목록(ul) 컴포넌트가 없어서 문단마다 가운뎃점을 붙인다.
   * html.js 의 <ul> 을 그대로 옮길 수 없는 자리다.
   *
   * 항목 사이를 빈 줄로 띄우지 않는다 — 모바일에서 화면 한 장을 다 잡아먹는다. */
  /* `naver.keyTakeaways: false` 면 '이 글의 핵심' 을 세우지 않는다.
   * 맨 위 '한 줄 정리'(세로선 인용구)가 이미 결론을 말하는데, 그 아래 요약 목록까지
   * 세우면 **읽기 전에 결론을 두 번** 보게 되고 사진·장소 이야기가 그만큼 밀린다.
   * 티스토리(html.js)와 JSON-LD 는 그대로 쓰므로 요약 자체를 버리는 것은 아니다.
   *
   * **책 글(에세이)에는 모드로 끈다** — ISBN·정가·쪽수가 목록으로 맨 위에 서면
   * 에세이가 상품 페이지처럼 열린다 (2026-07-29 독자 피드백: "이건 불필요").
   * 그 정보는 본문의 서지 표가 담는다. */
  const isBook = article.mode === 'book';
  if (
    !isBook &&
    cfg.naver?.keyTakeaways !== false &&
    seo.includeKeyTakeaways !== false &&
    article.keyTakeaways?.length
  ) {
    out.push(sectionTitle('이 글의 핵심'));
    out.push(textComponent([spacer(), ...article.keyTakeaways.map((t) => bodyPara(`· ${t}`))]));
  }

  /* 목차는 만들지 않는다.
   * 티스토리에서는 `#앵커` 링크로 이동했지만, 네이버 본문에는 앵커를 걸 수 없다.
   * 이동하지 않는 목차는 글만 길게 만든다. */

  const bodyImages = images.slice(1);
  const bodyMeta = imageMeta.slice(1);

  (article.sections || []).forEach((sec, i) => {
    /* 섹션 경계.
     * ① 여백 한 줄 — 인접 컴포넌트 간격이 0 이라 앞 문단 마지막 줄과
     *    소제목이 붙는다. "글이 넘어오는 부분이 어색하다"는 독자 피드백(2026-07-29)의
     *    정체가 이것이었다. 첫 섹션 앞에도 넣는다(도입 문단과 붙는다).
     * ② 구분선 — 화제가 바뀐다는 시각 신호. 상위 글은 1~23개 쓴다 (법칙 ⑥).
     *    첫 섹션 앞에는 넣지 않는다 — 위 '핵심' 블록과 이중 구분이 된다. */
    out.push(textComponent([spacer()]));
    if (i) out.push(horizontalLine());

    /* 책 글의 소제목은 sectionTitle 이 아니라 **왼쪽 세로선 인용구**다
     * (2026-07-29 독자 요청 — "왼쪽에 인용구로 세련되게").
     * 상위 글 실측과도 맞는다: kkujuni- 는 소제목 8개가 전부 quotation_line,
     * ppororogo 는 전부 corner — **한 종류로 통일**하는 것이 그들의 리듬이다.
     * 대신 sectionTitle 의 GEO(목차 인식)는 잃는다 — title·meta·FAQ 가 짊어진다. */
    out.push(isBook ? quotation(sec.heading, { layout: QUOTE.answer }) : sectionTitle(sec.heading));

    /* 섹션 머리말 인용구 — 이 대목에서 무엇을 보게 되는지 한 줄로 세운다.
     * 상위 글이 소제목 대신 쓰는 장치이고, 팁(`callout`, 포스트잇)과 모양이 달라
     * 독자가 역할을 구분한다 (위 QUOTE 주석의 실측 참고). */
    if (sec.lead) out.push(quotation(sec.lead, { layout: QUOTE.lead }));

    const paras = sec.paragraphs || [];
    // 이 섹션에 배치될 사진들의 인덱스
    const mine = bodyImages
      .map((img, k) => ({ img, k }))
      .filter(({ k }) => (bodyMeta[k]?.afterSection ?? 0) === i + 1);

    /* 사진 묶기 — 세 가지 방식이 있고, 우선순위가 있다.
     *
     * ① **`group` 이 같은 사진끼리 묶는다** (아티클이 지정). 에디터에서 사진을 옆으로
     *    끌어다 놓으면 초록 표시가 뜨며 두 장이 나란히 붙는 그 기능이고, 문서로는
     *    `imageGroup` 이다. **연관 있는 컷**(같은 공간의 가로/세로, 같은 야경 두 컷)만
     *    묶어야 예쁘다 — 관계없는 두 장이 붙으면 둘 다 죽는다.
     * ② `naver.collage: false` 면 그 밖의 사진은 **한 장씩** 세운다 (여행 글 기본값).
     * ③ 아니면 1·2·2·1 리듬으로 자동 묶는다.
     *
     * ①이 ②를 이긴다 — 자동 묶기는 관계를 모르지만, 아티클이 지정한 묶음은 안다. */
    const groups = [];
    {
      const pending = new Map(); // group 이름 → 모으는 중인 묶음
      const rest = [];
      for (const x of mine) {
        const g = bodyMeta[x.k]?.group;
        if (!g) {
          rest.push(x);
          continue;
        }
        if (!pending.has(g)) {
          const bucket = [];
          pending.set(g, bucket);
          groups.push(bucket); // 묶음의 자리는 첫 사진이 나온 순서로 정한다
        }
        pending.get(g).push(x);
      }
      const loose = cfg.naver?.collage === false ? rest.map((x) => [x]) : chunkByRhythm(rest, rhythmSeed + i);
      groups.push(...loose);
      // 사진 순서대로 다시 정렬한다 (묶음의 첫 사진 기준)
      groups.sort((a, b) => a[0].k - b[0].k);
    }
    /* 사진 자리.
     *
     * `afterParagraph` (1-based)를 주면 **그 문단 뒤**에 정확히 놓는다. 사진과 그 사진을
     * 설명하는 문장이 붙어야 하기 때문이다 — 자동 분배는 개수만 보고 나누므로
     * "사진과 관계없는 문장" 이 사진 사이에 끼는 일이 생긴다(2026-07-28 지적).
     * 지정하지 않은 묶음만 예전처럼 고르게 나눈다. */
    const slots = new Map();
    {
      const put = (p, gi) => {
        if (!slots.has(p)) slots.set(p, []);
        slots.get(p).push(gi);
      };
      const auto = [];
      groups.forEach((g, gi) => {
        const at = Number(bodyMeta[g[0].k]?.afterParagraph);
        if (Number.isFinite(at) && at >= 1) put(Math.min(paras.length, Math.round(at)), gi);
        else auto.push(gi);
      });
      if (auto.length) {
        for (const [p, list] of spreadImages(paras.length, auto.length)) {
          for (const j of list) put(p, auto[j]);
        }
      }
    }

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
        /* 첫 문단(pi=0)에도 여백을 넣는다 — 바로 위가 소제목인데 인접 컴포넌트
         * 간격이 0 이라 소제목과 본문이 붙었다 (2026-07-29 독자 피드백). */
        const c = textComponent([spacer(), ...lines]);
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
      const comp = textComponent([spacer(), ...sec.bullets.map((b) => bodyPara(`· ${b}`))]);
      if (comp) out.push(comp);
    }

    /* 표는 만들지 않는다 (파일 머리말 참고).
     * 표에 담겨 있던 정보를 버리지는 않고 문단으로 펼친다.
     * 모바일에서는 어차피 표가 옆으로 넘쳐 읽기 어렵다 — 펼치는 편이 낫다.
     *
     * 첫 열이 시점(날짜)이면 **타임라인**으로 그린다.
     * "확인된 내용: ○○ · 의미: ○○" 처럼 라벨을 반복하면 나열로 읽힌다는
     * 독자 피드백(2026-07-29)이 있었다. 라벨을 지우고 역할을 모양에 싣는다:
     *
     *     2025. 10. 24.        ← 굵게 + 한 단계 큰 글자 (이정표)
     *     JYP, 투어 불참 공지    ← 본문
     *     건강 관련 사유로 불참   ← 회색 작은 글자 (부연)
     *          ↓               ← 회색 연결 화살표
     *     2025. 10. 25.
     *
     * 회색(#8c8c8c)은 자동으로 고른 색이 아니라 **중립 회색 하나로 고정**한 것이다.
     * fontColor 가 에디터 왕복에서 살아남는 것은 probe-nodestyle 로 실측했다. */
    if (sec.table?.headers?.length && sec.table?.rows?.length) {
      const { headers, rows } = sec.table;
      if (sec.table.caption) {
        out.push(textComponent([spacer(), paragraph(sec.table.caption, { bold: true, fontSizeCode: FS.h3 }, BODY_PARA)]));
      }
      /* 처음에는 문단으로 펼쳤다(날짜 이정표 + ↓ 연결). 행마다 4~5줄이라
       * 세로로 너무 길다는 독자 피드백이 바로 왔다 — 표는 행 하나가 한 줄이다. */
      const isTimeline =
        /시점|날짜|일자|시기|연도/.test(String(headers[0] || '')) ||
        rows.every((r) => /^\d{4}[-.년]|^\d{1,2}월/.test(String(r[0] || '').trim()));
      out.push(naverTable(headers, rows, { timeline: isTimeline }));
    }

    /* 팁·주의는 포스트잇 인용구로 — '한 줄 정리'(세로선)와 모양이 달라야 구분된다.
     * 책 글의 callout 은 팁이 아니라 **책 속 문장**이다(buildBookPrompt) —
     * 포스트잇(메모지)이 아니라 기본 인용구(큰따옴표)로 세운다. 참고 글 실측
     * (bigsky04 어린 왕자): 책 속 문장 인용이 글의 뼈대였다. */
    if (sec.callout) {
      out.push(quotation(sec.callout, { layout: isBook ? QUOTE.plain : QUOTE.tip }));
    }

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
   * 'FAQ' 자체만 소제목으로 세우고, 질문은 굵은 한 줄로 둔다.
   *
   * 문답 하나 = 컴포넌트 하나로 담는다. 예전처럼 Q 컴포넌트·A 컴포넌트로
   * 나누면 인접 컴포넌트 간격이 0 이라(파일 위 실측) 다섯 문답이 전부 붙어
   * 한 덩어리 벽이 됐다. 문답 사이 여백은 컴포넌트 안의 spacer 가 만든다.
   * 답은 문장 단위로 풀어 문장 사이에도 숨을 넣는다. */
  if (seo.includeFaq !== false && article.faq?.length) {
    out.push(horizontalLine());
    out.push(isBook ? quotation('자주 묻는 질문', { layout: QUOTE.answer }) : sectionTitle('자주 묻는 질문'));
    article.faq.forEach((f, fi) => {
      /* "A. " 는 문장을 나눈 **뒤** 첫 문장에 붙인다.
       * sentences('A. 답변...') 으로 넘기면 "A." 가 한 문장으로 분리되어
       * 홀로 한 줄에 선다 (2026-07-29 프리뷰 실측). */
      const ans = sentences(f.answer);
      if (ans.length) ans[0] = `A. ${ans[0]}`;
      out.push(
        textComponent([
          spacer(), // 첫 문답도 소제목과 붙지 않게
          paragraph(`Q. ${f.question}`, { bold: true, fontSizeCode: FS.h3 }, BODY_PARA),
          ...spacedParagraphs(ans),
        ])
      );
    });
  }

  if (article.conclusion) {
    out.push(horizontalLine());
    // 책 글은 프롤로그로 열었으니 에필로그로 닫는다 — 에세이의 짝
    out.push(isBook ? quotation('에필로그', { layout: QUOTE.answer }) : sectionTitle('마치며'));
    out.push(textComponent([spacer(), ...spacedParagraphs(sentences(article.conclusion))]));
  }

  /* 영상 글의 원본 영상 주소.
   * 링크 노드 스키마를 아직 실측하지 못했으므로 주소를 평문으로 적는다.
   * 네이버는 본문의 유튜브 주소를 발행 시 카드로 바꿔 주는 경우가 있는데,
   * 그건 네이버가 알아서 하는 일이고 우리가 의존할 동작은 아니다. */
  const videoEmbeds = (article.embeds || []).filter((e) => /^[A-Za-z0-9_-]{11}$/.test(e.videoId || ''));
  if (videoEmbeds.length) {
    out.push(horizontalLine());
    out.push(line('원본 영상', { bold: true, fontSizeCode: FS.h3 }, { align: 'center' }));
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
    out.push(line('참고 자료', { bold: true, fontSizeCode: FS.h3 }, { align: 'center' }));
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
    out.push(line('이미지 출처', { bold: true, fontSizeCode: FS.h3 }, { align: 'center' }));
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
