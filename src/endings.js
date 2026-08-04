/**
 * 문장 끝맺음을 **기계적으로** 섞는다.
 *
 * ## 왜 코드가 하는가
 *
 * 경어체 평서로 쓰라고 하면 모델은 `~니다` 로 수렴한다. 지시문에 상한(60%)을 적고,
 * 예시를 주고, 재시도 사유로까지 올렸는데도 그렇다.
 *
 * > 2026-08-01 실측 — 세 편 연속:
 * >   신입사원 강회장 100% · 스파이더맨 84%(재시도 후 63% 는 손으로 20곳 고친 결과) ·
 * >   황해 93%(재시도 포함 10분 30초를 쓰고도).
 *
 * 재시도는 4분을 더 태우고 결과도 나아지지 않는다. 그런데 이 변환은 **규칙이 기계적**
 * 이라 사람이 할 이유가 없다. `~습니다` → `~죠` 는 뜻이 바뀌지 않는다.
 *
 * ## 무엇을 바꾸지 않는가 — 여기가 더 중요하다
 *
 * - **안전한 세 형태만** 바꾼다 (`습니다` · `입니다` · `합니다`). 나머지 `Xㅂ니다` 는
 *   ㄹ 불규칙에서 어긋난다: `만듭니다` → `만드죠`(✗ 만들죠), `압니다` → `아죠`(✗ 알죠).
 *   `삽니다` 는 사다·살다 둘 다여서 **원형을 모르면 판정이 불가능**하다.
 * - **큰따옴표 안은 건드리지 않는다.** 남의 말을 우리가 고치면 인용이 아니다.
 * - **연속된 문장을 연달아 바꾸지 않는다.** `죠` 가 새로운 연타가 되면 원점이다.
 * - 표·소제목·제목은 대상이 아니다. 문단·불릿·맺음말만 본다.
 * - 목표치를 이미 만족하면 **아무것도 하지 않는다.**
 */

/** 문장 끝의 두 글자 (판정 기준을 lintKo 와 같게 유지한다) */
const tailOf = (s) => s.replace(/[.!?"”』」]+$/g, '').slice(-2);

const SENT_SPLIT = /(?<=[.!?])\s+/;

/** 한글 음절에서 종성을 떼어낸다. `갑` → `가`, `입` → `이`, `합` → `하` */
function stripFinal(syl) {
  const code = syl.codePointAt(0) - 0xac00;
  if (code < 0 || code > 11171) return null;
  const jong = code % 28;
  if (jong === 0) return syl; // 종성이 없다
  return String.fromCodePoint(0xac00 + (code - jong));
}

/** 마지막 글자에 종성이 있는가 (`이죠`/`죠` 를 가르는 데 쓴다) */
function hasFinal(ch) {
  const code = (ch || '').codePointAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

/**
 * 문장 하나를 `~죠` 로 바꾼다. 바꿀 수 없으면 `null`.
 *
 * `습니다` 는 어떤 어간에 붙어도 `죠` 로 바뀐다 (않습니다→않죠, 갔습니다→갔죠,
 * 좋습니다→좋죠). `입니다`·`합니다` 는 종성 ㅂ 만 떼면 된다 (입→이, 합→하).
 */
export function toJyo(sentence) {
  const m = String(sentence).match(/^(.*?)(습니다|입니다|합니다|됩니다|아닙니다|옵니다|봅니다)([.!?]*)$/);
  if (!m) return null;
  const [, head, form, punct] = m;
  if (!head && form !== '아닙니다') return null;

  if (form === '습니다') return `${head}죠${punct || '.'}`;

  /* 원형이 하나뿐이라 안전한 것들만 추가로 받는다.
   * `갑니다`(가다/갈다)·`줍니다`(주다/줄다)·`삽니다`(사다/살다)는 **원형이 둘**이라
   * 넣지 않았다 — 어느 쪽인지 모르면 `갈죠`/`가죠` 중 하나가 반드시 틀린다. */
  const SAFE = { 됩니다: '되죠', 아닙니다: '아니죠', 옵니다: '오죠', 봅니다: '보죠' };
  if (SAFE[form]) return `${head}${SAFE[form]}${punct || '.'}`;

  if (form === '입니다') {
    /* 명사 + 입니다. 종성이 있으면 `이죠`, 없으면 `죠` 가 자연스럽다.
     * (구남입니다 → 구남이죠 / 바다입니다 → 바다죠) */
    const last = head.slice(-1);
    if (!/[가-힣]/.test(last)) return null; // 숫자·영문 뒤는 손대지 않는다
    return `${head}${hasFinal(last) ? '이죠' : '죠'}${punct || '.'}`;
  }

  // 합니다 → 하죠 (종성 ㅂ 만 뗀다)
  const bare = stripFinal('합');
  return `${head}${bare}죠${punct || '.'}`;
}

/** 글 전체의 종결 분포 */
export function endingStats(article) {
  const tails = [];
  for (const s of article.sections || []) {
    for (const p of [...(s.paragraphs || []), ...(s.bullets || [])]) {
      for (const x of String(p).split(SENT_SPLIT)) {
        const t = tailOf(x.trim());
        if (t) tails.push(t);
      }
    }
  }
  const count = {};
  for (const t of tails) count[t] = (count[t] || 0) + 1;
  const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  return {
    total: tails.length,
    top: top?.[0] || '',
    topCount: top?.[1] || 0,
    ratio: tails.length ? (top?.[1] || 0) / tails.length : 0,
    /** 종결별 개수. `varyEndings` 가 **이미 있는 `죠`** 를 세는 데 쓴다.
     *  `tailOf` 는 끝 두 글자라 `죠` 종결이 한 토큰이 아니다("렇죠"·"이죠"·"가죠"). */
    count,
  };
}

/** 큰따옴표 안의 문장인가 — 남의 말은 고치지 않는다 */
function insideQuote(text, sentence) {
  const at = text.indexOf(sentence);
  if (at < 0) return false;
  const before = text.slice(0, at);
  const opens = (before.match(/[“"]/g) || []).length;
  return opens % 2 === 1;
}

/**
 * 한 종결이 `max` 를 넘으면 넘는 만큼만 `~죠` 로 바꾼다.
 *
 * 바꿀 문장은 **띄어서** 고른다 — 붙은 두 문장을 함께 바꾸면 `죠` 연타가 된다.
 * 대상이 모자라 목표에 못 미치면 거기서 멈춘다 (억지로 채우지 않는다).
 */
export function varyEndings(article, { max = 0.6 } = {}) {
  const before = endingStats(article);
  if (!before.total || before.ratio <= max) {
    return { changed: 0, before, after: before };
  }

  /* 몇 개를 바꿔야 하는가. 분모는 그대로이므로 (top - n) / total <= max 를 풀면 된다. */
  const budget = Math.ceil(before.topCount - max * before.total);

  /* ① 후보를 **글 전체에서** 먼저 모은다.
   *
   * 앞에서부터 예산을 쓰면 변화가 앞 섹션에 몰린다.
   * > 2026-08-01 실측(황해) — 30개를 바꿔 89%→60% 를 맞췄는데 줄거리·결말만 바뀌고
   * >   정작 **해석 섹션은 한 문장도 안 바뀌었다.** 순서가 그렇게 되어 있어서다.
   * 줄거리는 건조해야 하는 정보층이고 리듬이 필요한 곳은 평론층이다 — 정확히 거꾸로다. */
  const cands = [];
  for (const s of article.sections || []) {
    for (const key of ['paragraphs', 'bullets']) {
      const list = s[key];
      if (!Array.isArray(list)) continue;
      for (let i = 0; i < list.length; i++) {
        const text = String(list[i]);
        const parts = text.split(SENT_SPLIT);
        for (let j = 0; j < parts.length; j++) {
          const sent = parts[j].trim();
          if (!sent || tailOf(sent) !== before.top) continue;
          if (insideQuote(text, sent)) continue;
          if (!toJyo(sent)) continue;
          cands.push({ list, i, j, sent });
        }
      }
    }
  }
  if (!cands.length) return { changed: 0, before, after: before };

  /* ② 고르게 흩어 고른다. 이웃한 후보를 연달아 고르면 `죠` 가 새 연타가 된다.
   *
   * 상한을 **후보의 절반**으로 뒀던 것이 목표를 못 맞추는 원인이 됐다.
   *
   * > 2026-08-04 실측 — 「사랑이 온다」 4회, 두 번 연속 같은 자리에서 멈췄다:
   * >   전체 64문장 · "…니다." 61개(95%) · 목표 60% → **23개**를 바꿔야 한다.
   * >   그런데 후보가 44개였고 절반 상한이 22개라 **1개가 모자랐다.**
   * >   결과 39/64 = 61% 로 남아 `endingMax` **막음**에 걸렸다. 발행 불가다.
   *
   * 진짜 제약은 절반이 아니다 — **`죠` 가 새 최다가 되지 않는 선**이다.
   * n 개를 바꾸면 `…니다` 는 (top - n), `죠` 는 (있던 죠 + n) 이 된다.
   * 둘 다 목표 이하여야 하므로 n 의 상한은 `floor(max × total) - 있던 죠` 다.
   * 위 실측에서 그 값은 38 - 3 = 35 로, 필요한 23 을 넉넉히 담는다.
   *
   * 절반을 넘으면 한 곳에서 `죠` 가 이웃할 수 있다. 그것이 **발행 불가보다 낫다** —
   * 아래 step 배분이 여전히 최대한 흩어 고른다. */
  const jyoNow = Object.entries(before.count || {})
    .filter(([t]) => t.endsWith('죠'))
    .reduce((n, [, c]) => n + c, 0);
  const jyoRoom = Math.floor(max * before.total) - jyoNow;
  const want = Math.max(0, Math.min(budget, cands.length, jyoRoom));
  if (!want) return { changed: 0, before, after: before };
  const step = cands.length / want;
  const picked = new Set();
  for (let k = 0; k < want; k++) {
    let idx = Math.min(cands.length - 1, Math.round(k * step));
    while (picked.has(idx) && idx < cands.length - 1) idx++;
    if (!picked.has(idx)) picked.add(idx);
  }

  /* ③ 한 문단 안에서는 **문장 번호가 큰 것부터** 바꾼다 —
   *    앞을 먼저 바꾸면 뒤 문장의 위치가 밀린다. */
  const chosen = [...picked]
    .map((k) => cands[k])
    .sort((a, b) => (a.list === b.list ? (b.i - a.i || b.j - a.j) : 0));

  let changed = 0;
  for (const c of chosen) {
    const parts = String(c.list[c.i]).split(SENT_SPLIT);
    if (parts[c.j]?.trim() !== c.sent) continue; // 이미 바뀐 자리
    const next = toJyo(c.sent);
    if (!next) continue;
    parts[c.j] = parts[c.j].replace(c.sent, next);
    c.list[c.i] = parts.join(' ');
    changed++;
  }

  return { changed, before, after: endingStats(article) };
}
