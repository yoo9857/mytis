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
const 예외 = ['마을', '가을', '노을', '고을', '그을', '이을'];

/** 받침이 있는가 (가~힣 범위에서 종성 인덱스가 0이 아니면 있다) */
function hasFinal(ch) {
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null; // 한글 음절이 아니다
  return (code - 0xac00) % 28 !== 0;
}

/**
 * 조사가 틀린 것으로 의심되는 구절을 찾는다.
 * @param {string} text 검사할 본문
 * @returns {{phrase: string, suggest: string, context: string}[]}
 */
export function findParticleErrors(text) {
  const out = [];
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

    out.push({
      phrase: word,
      suggest: word.slice(0, word.length - particle.length) + 짝[particle],
      context: text.slice(Math.max(0, start - 10), end + 10).replace(/\s+/g, ' '),
    });
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
