/**
 * 글 내용에 맞는 티스토리 카테고리 고르기.
 *
 * 왜 필요한가:
 *   블로그 카테고리가 한 주제로 통일돼 있지 않으면(예: Git / Unity / 주식 /
 *   암호화폐 / 방송잡탕) 고정 카테고리 하나로는 절대 맞출 수 없다.
 *   게다가 티스토리에서 카테고리를 **지정하지 않으면 직전 글의 카테고리를
 *   그대로 물려받기 때문에**, 비워 두면 엉뚱한 곳에 조용히 쌓인다.
 *
 * 어떻게 고르는가:
 *   codex 를 다시 부르지 않는다(느리고 값이 흔들린다). 글에서 뽑은 낱말
 *   뭉치와 카테고리 이름·별칭을 대조해 점수를 매기고 가장 높은 것을 고른다.
 *   결정적이라 같은 글이면 항상 같은 카테고리가 나온다.
 */

/**
 * 카테고리 이름만으로는 한국어 본문과 잘 안 붙는다.
 * ("Unity" 라는 카테고리에 "유니티" 로 쓴 글이 안 걸린다)
 * config.json 의 blog.categoryAliases 로 덮어쓰거나 보탤 수 있다.
 */
export const DEFAULT_ALIASES = {
  // 연예 카테고리. 블로그마다 이름이 달라서 쓰이는 이름을 모두 걸어 둔다.
  '스타·연예인': [
    '연예', '아이돌', '가수', '배우', '드라마', '예능', '방송', '컴백', '데뷔',
    '소속사', '음원', '팬덤', '걸그룹', '보이그룹', '무대', '콘서트', '앨범',
    '뮤직비디오', '팬미팅', '시구', '화보', '멤버', '스타',
  ],
  '스타연예인': [
    '연예', '아이돌', '가수', '배우', '드라마', '예능', '방송', '컴백', '데뷔',
    '소속사', '음원', '팬덤', '걸그룹', '보이그룹', '무대', '콘서트', '앨범',
    '뮤직비디오', '팬미팅', '시구', '화보', '멤버', '스타',
  ],
  방송: [
    '연예', '아이돌', '가수', '배우', '드라마', '예능', '방송', '컴백', '데뷔',
    '소속사', '음원', '팬덤', '걸그룹', '보이그룹', '무대', '콘서트', '앨범',
    '뮤직비디오', '팬미팅', '시구', '화보', '멤버',
  ],
  잡탕: ['잡담', '일상', '후기'],
  방송잡탕: ['연예', '방송', '아이돌', '드라마', '예능'],
  주식: ['주식', '증시', '코스피', '코스닥', '종목', '상장', '공모주', '배당', '증권', '나스닥'],
  재태크: ['재테크', '적금', '예금', '저축', '연금', '절세', '대출', '금리', '청약'],
  암호화폐: ['암호화폐', '비트코인', '코인', '이더리움', '가상자산', '블록체인', '업비트'],
  bitcoin: ['비트코인', 'btc', '코인'],
  unity: ['유니티', 'unity', '게임엔진', '게임개발'],
  'c#': ['c#', '씨샵', '닷넷', '.net'],
  git: ['git', '깃', '깃허브', 'github', '버전관리'],
  kotlin: ['kotlin', '코틀린', '안드로이드', 'android'],
  'kotlin language': ['kotlin', '코틀린', '안드로이드', 'android'],
  'design pattern': ['디자인패턴', '디자인 패턴', '싱글톤', '옵저버', '리팩터링'],
  // 주의: '영상'·'편집' 은 연예 기사 어디에나 나오는 범용어라 넣으면 안 된다.
  // 실제로 "장원영 시구 … 39초 영상 공개" 글이 '영상×6' 으로 Cinematic 에 잡혔다.
  cinematic: ['영화', '시네마틱', '연출', '촬영', '감독', '개봉', '예고편', '시나리오'],
  'it 전자기기': ['전자기기', '노트북', '스마트폰', '핸드폰', '컴퓨터', '가젯', '리뷰'],
  컴퓨터: ['컴퓨터', '노트북', 'pc', '조립', '그래픽카드', 'cpu'],
  핸드폰: ['스마트폰', '핸드폰', '아이폰', '갤럭시'],
  programmers: ['프로그래머스', '코딩테스트', '알고리즘'],
};

/** 카테고리로 쓸 수 없는 항목 (에디터 모드 메뉴가 섞여 들어오는 경우 대비) */
const NOT_A_CATEGORY = new Set(['카테고리 없음', '카테고리없음', '기본모드', '마크다운']);

/** 글에서 판단 근거가 될 텍스트를 모은다 */
export function articleHaystack(article = {}) {
  const parts = [
    article.title,
    article.seoTitle,
    article.primaryKeyword,
    article.metaDescription,
    ...(article.secondaryKeywords || []),
    ...(article.tags || []),
    ...(article.entities || []).flatMap((e) => [e?.nameKo, e?.nameEn]),
    ...(article.sections || []).map((s) => s?.heading),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/** 문자열 안에 term 이 몇 번 나오는지 (겹치지 않게) */
function countOf(haystack, term) {
  if (!term) return 0;
  let n = 0;
  let i = haystack.indexOf(term);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(term, i + term.length);
  }
  return n;
}

/**
 * 카테고리 후보에 점수를 매긴다.
 *
 * @param {object} article  아티클 JSON
 * @param {Array<{name:string, depth:number, index:number}>} entries 드롭다운에서 읽은 목록
 * @param {object} [aliases] 이름 → 별칭 배열 (config 로 덮어쓴 것)
 * @returns {Array<{name, index, depth, score, hits}>} 점수 높은 순
 */
export function scoreCategories(article, entries, aliases = {}) {
  const hay = articleHaystack(article);
  const table = { ...DEFAULT_ALIASES };
  for (const [k, v] of Object.entries(aliases || {})) {
    table[k.toLowerCase()] = [...(table[k.toLowerCase()] || []), ...(v || [])];
  }

  return entries
    .filter((e) => e.name && !NOT_A_CATEGORY.has(e.name.trim()))
    .map((e) => {
      const key = e.name.trim().toLowerCase();
      const terms = [...new Set([key, ...(table[key] || [])].map((t) => String(t).toLowerCase()))];

      let score = 0;
      const hits = [];
      for (const t of terms) {
        // 한 글자짜리는 아무 데나 걸려서 근거가 못 된다
        if (t.length < 2) continue;
        const n = countOf(hay, t);
        if (!n) continue;
        // 같은 낱말이 여러 번 나온다고 근거가 그만큼 강해지지는 않는다.
        // 상한을 두지 않으면 범용어 하나가 점수를 독식한다
        // (실제로 "39초 영상 공개" 글이 '영상×6' 으로 Cinematic 에 잡혔다).
        // 긴 낱말이 걸릴수록 확실한 근거다 (최대 6으로 잘라 과대평가를 막는다).
        score += Math.min(n, 3) * Math.min(t.length, 6);
        hits.push(`${t}×${n}`);
      }

      // 서로 다른 낱말이 여러 개 걸릴수록 우연이 아니다
      if (hits.length > 1) score *= 1 + 0.12 * Math.min(hits.length - 1, 5);

      // 하위 카테고리가 더 구체적이므로 동점이면 하위를 택한다
      if (score > 0) score *= 1 + 0.15 * Math.min(e.depth, 2);

      return { ...e, score: Math.round(score * 100) / 100, hits };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * 최종 선택. 근거가 약하면 고르지 않고 null 을 돌려준다
 * (호출부가 기본 카테고리로 물러날 수 있게).
 *
 * @param {number} [minScore] 이 점수 미만이면 확신 없다고 본다
 */
export function pickCategory(article, entries, { aliases, minScore = 6 } = {}) {
  const ranked = scoreCategories(article, entries, aliases);
  const best = ranked[0];
  if (!best || best.score < minScore) return { picked: null, ranked };
  // 1등과 2등이 붙어 있으면 애매하다고 본다 — 조용히 틀리는 것보다 낫다
  const second = ranked[1];
  const decisive = !second || best.score >= second.score * 1.25 || best.score - second.score >= 4;
  return { picked: decisive ? best : null, ranked, ambiguous: !decisive };
}
