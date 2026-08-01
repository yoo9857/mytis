/**
 * 영상 글의 **큰따옴표 인용이 자막에 실제로 있는지** 대조한다.
 *
 * ## 왜 필요한가
 *
 * 영상 모드는 자막을 근거로 글을 쓴다. 그런데 자막이 **자동 생성**인 영상이 많고,
 * 모델은 뜻이 통하게 문장을 다듬는다. 그 결과 **실존 인물이 하지 않은 말이
 * 큰따옴표 안에 들어간다.**
 *
 * > 2026-08-01 실측 — 나는솔로 32기 미방분(자동 자막 254줄):
 * >   ❌ "영호가 가장 꼴찌예요"      — 자막에 없음 (근처도 없음)
 * >   ❌ "외적인 게 제일 나았어"      — 자막에 없음
 * >   ⚠️ "상철이랑 일대일로 나는 길게 못 하겠어"
 * >      — 자막은 `상철이랑 일대일로 나는 길게하겠어 >> 어 못 하겠어` 로 갈려 있다
 * >   ✅ "1광수" · "7이는 영철이지" · "내가 1이라고 누구 말한 적 처음이지" 는 일치
 *
 * 앞의 둘은 **사람을 꼴찌라고 말했다**거나 **외모를 평가했다**는 내용이다.
 * 지어낸 말이 실존 인물의 발언으로 실리면 §6 의 보호선을 넘는다.
 *
 * ## 판정 방식
 *
 * 자동 자막은 같은 말을 두 번 겹쳐 내보내고(`>>` 중복), 조각 경계에서 어절이
 * 끊긴다. 그래서 **글자 그대로 일치**만 보면 정상 인용도 탈락한다.
 * 공백·문장부호를 지운 뒤 세 단계로 본다.
 *
 *   1. 정규화 후 그대로 포함  → 일치
 *   2. 인용을 어절로 쪼개 **모든 어절이 자막에 있고 순서도 맞으면** → 재구성(경고)
 *   3. 그것도 아니면 → **없음(위험)**
 *
 * 고치지 않고 **알려만 준다.** 자막 오인식이라 사람이 화면과 대조해야 한다.
 */

/** 공백·문장부호를 지운 비교용 문자열 */
function norm(s) {
  return String(s || '')
    .replace(/[\s]+/g, '')
    .replace(/[.,!?~…·"'“”‘’「」『』()[\]<>《》]/g, '');
}

/** 글에서 큰따옴표 인용을 모두 뽑는다 (한글 따옴표 포함) */
export function extractQuotes(article) {
  const out = [];
  const push = (where, text) => {
    for (const m of String(text || '').matchAll(/[“"]([^”"]{2,120})[”"]/g)) {
      const q = m[1].trim();
      if (q) out.push({ where, quote: q });
    }
  };
  push('title', article.title);
  push('directAnswer', article.directAnswer);
  for (const [i, s] of (article.sections || []).entries()) {
    push(`섹션${i} heading`, s.heading);
    for (const p of s.paragraphs || []) push(`섹션${i}`, p);
    for (const b of s.bullets || []) push(`섹션${i} bullet`, b);
    push(`섹션${i} callout`, s.callout);
  }
  push('conclusion', article.conclusion);
  for (const f of article.faq || []) push('faq', f.answer);
  for (const e of article.embeds || []) push('embed quote', e.quote);
  return out;
}

/**
 * @param {object} article
 * @param {string} transcript  자막 전문 (clip.lines 를 이어 붙인 것)
 * @returns {{quote:string, where:string, verdict:'ok'|'rebuilt'|'missing'}[]}
 */
export function verifyQuotes(article, transcript) {
  const hay = norm(transcript);
  return extractQuotes(article).map(({ where, quote }) => {
    const q = norm(quote);
    if (!q) return { where, quote, verdict: 'ok' };
    if (hay.includes(q)) return { where, quote, verdict: 'ok' };

    /* 어절이 모두 있고 순서도 맞고 **가까이 모여 있으면** '재구성'.
     *
     * ⚠️ 근접 조건이 없으면 어절 줍기를 통과시킨다 — "영호가"(0:35) + "가장"(3:00)
     * + "꼴찌예요"(6:24) 처럼 전혀 다른 대목의 낱말을 이어 붙인 것도 통과했다.
     * 자막 조각 경계에서 갈린 경우는 원문 길이의 3배 안에 다 들어온다. */
    const words = quote.split(/\s+/).map(norm).filter((w) => w.length >= 2);
    if (words.length >= 2) {
      const window = Math.max(40, q.length * 3);
      let at = 0;
      let first = -1;
      let ok = true;
      for (const w of words) {
        const i = hay.indexOf(w, at);
        if (i < 0) {
          ok = false;
          break;
        }
        if (first < 0) first = i;
        at = i + w.length;
      }
      if (ok && at - first <= window) return { where, quote, verdict: 'rebuilt', span: at - first };
      if (ok) return { where, quote, verdict: 'missing', reason: `어절이 ${at - first}자에 흩어져 있음(창 ${window})` };
    }
    return { where, quote, verdict: 'missing' };
  });
}

/** 로그로 찍기 좋게 요약한다 */
export function quoteReport(results) {
  const missing = results.filter((r) => r.verdict === 'missing');
  const rebuilt = results.filter((r) => r.verdict === 'rebuilt');
  return { total: results.length, missing, rebuilt };
}
