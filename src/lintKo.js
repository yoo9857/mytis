/**
 * 글이 나온 뒤 **조사(助詞)를 기계적으로 검사**한다.
 *
 * 왜 코드로 하는가: 지시문에 "조사를 한 번 훑으세요" 를 넣었는데도 두 번 연속
 * 새어나갔다(2026-07-29: "출산 발표은 나오지 않았다" · "iMBC연예은 보도했다").
 * 받침 유무로 정해지는 규칙이라 사람이 볼 필요 없이 판정할 수 있다.
 *
 * 규칙: 받침 없는 음절 뒤에는 는 / 가 / 를 / 와 / 로 가 온다.
 *       받침이 있으면 은 / 이 / 을 / 과 / 으로 다.
 *
 * **한 방향만 본다.** 받침 있는 음절 + 는/가/를 은 동사 어미로 늘 나오기 때문이다
 * ("먹는다", "앉가"…). 반대쪽(받침 없는 음절 + 은/을/으로)만 검사하면
 * 동사 어미와 겹치지 않아 오탐이 적다.
 *
 * 그래도 '예은·가을' 처럼 그 자체가 낱말인 경우가 있어 **고칠 것을 정해 주지 않고
 * 의심 구절만 알려 준다.** 판단은 사람이 한다.
 */

/**
 * 그 자체가 낱말이라 조사가 아닌 것들. **낱말 전체로 비교한다.**
 *
 * 처음에는 '예은·지은' 같은 이름도 넣고 endsWith 로 비교했는데,
 * 그러면 "연예은" 이 '예은' 으로 끝나 그냥 통과했다 — 잡아야 하는 실패였다.
 * 이름은 목록으로 감당할 수 없으니 빼고, 낱말 전체가 일치할 때만 넘긴다.
 * '예은' 처럼 조사 없이 끝나는 이름은 드물게 걸리지만, 이것은 경고일 뿐이라
 * 한 번 보고 넘기면 된다.
 */
const 예외 = [
  '마을', '가을', '노을', '고을', '그을', '이을',
  /* '가을' 은 있는데 **합성어가 빠져 있었다.** 낱말 전체로 비교하므로 '올가을' 은
   * 목록에 걸리지 않고 "올가 + 을" 로 읽혀 오탐이 난다.
   * > 2026-08-06 실측(영탁 탁쇼5 글): "영탁이 올가을 무대를 확정했다" 에
   * >   `조사 의심: 올가을 → 올가를` 이 찍혔다. 맞는 문장인데 경고가 났다.
   * 오탐이 쌓이면 경고를 넘겨 보는 습관이 생기고, 그러면 진짜 조사 오류가 묻힌다. */
  '올가을', '지난가을', '한가을', '늦가을', '초가을',
  /* ㅅ불규칙 활용형 — 어간의 ㅅ이 떨어져 받침 없는 음절 + 은 이 되므로
   * 규칙에 걸리지만 **맞는 말**이다. (긋다→그은, 잇다→이은, 짓다→지은,
   * 젓다→저은, 붓다→부은, 낫다→나은)
   * > 2026-08-01 실측: "관계의 선을 다시 그은 것입니다" 가 "그는" 으로 오탐. */
  '그은', '이은', '지은', '저은', '부은', '나은',
];

/** 받침이 있는가 (가~힣 범위에서 종성 인덱스가 0이 아니면 있다) */
function hasFinal(ch) {
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null; // 한글 음절이 아니다
  return (code - 0xac00) % 28 !== 0;
}

/**
 * 조사가 틀린 것으로 의심되는 구절을 찾는다.
 *
 * @param {string} text 검사할 본문
 * @param {object} [opts]
 * @param {string[]} [opts.names] 사람·작품 이름. 이 낱말은 조사로 보지 않는다.
 *
 * ## 이름 오탐을 이름 목록으로 끊는다
 *
 * 머리말에 "이름은 목록으로 감당할 수 없다" 고 적어 두었지만, **그 글에 나오는
 * 이름은 아티클이 이미 알고 있다** (`article.entities`).
 *
 * > 2026-08-01 실측 — 청룡시상식 종합 글: `김고은` 을 "김고는" 으로 **5번** 잡았다.
 * > 경고가 5줄이면 진짜 오류가 묻힌다. 실제로 그 글의 진짜 오류는
 * > 조사가 아니라 **이름 자체**였다(박지훈 ← 박지현).
 *
 * 일반 목록(`예외`)과 달리 이건 **글마다 다른 목록**이므로 인자로 받는다.
 */
/** 아티클에서 조사 검사에 넘길 이름 목록을 모은다 (entities · 태그 · 수상자 표) */
export function articleNames(article) {
  const out = [];
  for (const e of article?.entities || []) if (e?.nameKo) out.push(e.nameKo);
  /* 태그에도 인물명이 들어간다 (김고은·신혜선 …). 조사처럼 끝나는 것만 쓸모가 있다. */
  for (const t of article?.tags || []) out.push(t);
  /* 표의 칸에 수상자 이름이 들어간다 — 청룡 종합 글이 그런 형태였다 */
  for (const s of article?.sections || []) {
    for (const row of s?.table?.rows || []) for (const cell of row) out.push(cell);
  }
  return [...new Set(out.filter(Boolean))];
}

export function findParticleErrors(text, { names = [] } = {}) {
  const out = [];
  /* 이름은 낱말 전체가 일치할 때만 넘긴다 — endsWith 로 하면 "연예은" 이 통과한다
   * (머리말의 '예은' 사고와 같은 이유) */
  const nameSet = new Set(
    names.flatMap((n) => String(n || '').split(/[\s·,]+/)).map((s) => s.trim()).filter(Boolean)
  );
  const 짝 = { 은: '는', 을: '를', 으로: '로' };
  // 낱말 끝(공백·문장부호·끝)에 붙은 조사만 본다 — 낱말 속의 '은'은 이름일 수 있다
  const re = /([가-힣])(으로|은|을)(?=[\s,.!?…"'”’)\]」』]|$)/g;
  let m;
  while ((m = re.exec(text))) {
    const [, syl, particle] = m;
    if (hasFinal(syl) !== false) continue; // 받침이 있거나 한글이 아니면 정상

    /* 조사가 붙은 **한글 낱말 전체**를 떼어 낸다 (앞의 영문·숫자는 낱말에 넣지 않는다).
     * m.index 는 조사가 아니라 **그 앞 음절**을 가리키므로 끝은 +1 해야 한다 —
     * 이걸 빼먹어 "발표은" 이 "발표" 로 잘려 엉뚱한 제안("발는")이 나왔다. */
    let start = m.index;
    while (start > 0 && /[가-힣]/.test(text[start - 1])) start--;
    const end = m.index + 1 + particle.length;
    const word = text.slice(start, end);
    if (예외.includes(word)) continue;
    if (nameSet.has(word)) continue; // 그 글에 나오는 사람·작품 이름

    out.push({
      phrase: word,
      suggest: word.slice(0, word.length - particle.length) + 짝[particle],
      context: text.slice(Math.max(0, start - 10), end + 10).replace(/\s+/g, ' '),
    });
  }
  return out;
}

/**
 * 같은 어미가 연달아 이어지는 문단을 찾는다 — "~이다. ~다. ~이다." 연타.
 *
 * 왜: 독자가 "기계적, AI 같다"고 지목한 첫 신호가 이것이었다 (2026-07-29).
 * 지금까지 임시 스크립트로 재던 것을 검사기로 굳힌다. 문장 끝 두 글자를
 * 어미 지문으로 보고, 한 문단에서 3문장 이상 같은 지문이면 보고한다.
 */
export function findMonotoneEndings(article) {
  const out = [];
  for (const [si, s] of (article.sections || []).entries()) {
    for (const p of s.paragraphs || []) {
      const sents = String(p)
        .split(/(?<=[.!?])\s+/)
        .map((x) => x.trim())
        .filter((x) => /[.!?]$/.test(x));
      if (sents.length < 3) continue;
      const tail = (x) => x.replace(/[.!?"”』」]+$/g, '').slice(-2);
      let run = 1;
      for (let i = 1; i < sents.length; i++) {
        run = tail(sents[i]) === tail(sents[i - 1]) ? run + 1 : 1;
        if (run >= 3) {
          out.push({ section: si + 1, ending: tail(sents[i]), sample: p.slice(0, 60) });
          break;
        }
      }
    }
  }

  /* 문단 안 3연타만 보면 **글 전체가 한 종결로 도배된 것**을 놓친다 —
   * 문단이 2문장씩이라 연타는 0인데 전체가 "~입니다" 인 글이 나갔다
   * (2026-07-29 신입사원 강회장: 독자가 "재미없다, AI 같다"). 전체 분포를 본다. */
  const all = [];
  for (const s of article.sections || []) {
    for (const p of s.paragraphs || []) {
      for (const x of String(p).split(/(?<=[.!?])\s+/)) {
        const t = x.trim().replace(/[.!?"”』」]+$/g, '').slice(-2);
        if (t) all.push(t);
      }
    }
  }
  if (all.length >= 15) {
    const cnt = {};
    for (const t of all) cnt[t] = (cnt[t] || 0) + 1;
    const [top, n] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (n / all.length >= 0.75) {
      out.push({ section: 0, ending: top, sample: `글 전체 ${all.length}문장 중 ${n}문장(${Math.round((n / all.length) * 100)}%)이 "…${top}." 로 끝남` });
    }
  }
  return out;
}

/** 아티클 전체에서 검사할 문자열을 모은다 (제목·본문·표·FAQ 까지) */
export function articleText(article) {
  const parts = [
    article.title,
    article.seoTitle,
    article.metaDescription,
    article.directAnswer,
    ...(article.keyTakeaways || []),
    ...(article.sections || []).flatMap((s) => [
      s.heading,
      ...(s.paragraphs || []),
      s.callout || '',
      ...(s.bullets || []),
      ...(s.table?.rows || []).flat(),
    ]),
    ...(article.faq || []).flatMap((f) => [f.question, f.answer]),
    article.conclusion,
  ];
  return parts.filter(Boolean).join('\n');
}
