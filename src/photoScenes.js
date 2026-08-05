/**
 * 부동산 글의 **'살고 싶은 집' 컷** — 검색어를 글마다 다르게 조합한다.
 *
 * ## 왜 코드가 정하는가
 *
 * 사용자 요청(2026-08-03): "누구나 살고 싶은 모델하우스 내부를 보여줘야 사람들의
 * 희망이 생긴다. 단 구도·각도·분위기·트렌드는 글마다 랜덤으로 달라져야 한다."
 *
 * 산문 규칙으로 두면 모델이 매번 같은 낱말을 쓴다. 실제로 그랬다 —
 * `apartment building exterior`, `notebook pen desk` 가 글마다 반복됐다.
 * 조합을 코드가 돌리면 **반복이 구조적으로 불가능**하다.
 *
 * ## 왜 난수가 아니라 해시인가
 *
 * `Math.random()` 을 쓰면 같은 글을 다시 뽑을 때마다 사진이 바뀌어 검토를 반복할 수
 * 없다(발행 전 검토 루프가 무너진다). 제목 해시로 고르면 **같은 글은 같은 조합,
 * 다른 글은 다른 조합**이다 — `pickVoice`(modes/index.js)가 쓰는 방식과 같다.
 *
 * ## 왜 생성 이미지가 아닌가
 *
 * 이 파이프라인에는 이미지 생성기가 없다. 스톡 검색어를 정확히 몰아 주는 것이
 * 지금 할 수 있는 최선이고, 실사 사진이라 AI 티가 애초에 없다.
 */

/** 구도 — 카메라가 어디에 서 있는가 */
const FRAMING = [
  'wide angle living room',
  'corner view of living room',
  'looking through open doorway into living room',
  'low angle living room with high ceiling',
  'view from hallway into bright living room',
  'window seat corner of apartment',
];

/** 빛 — 시간과 방향 */
const LIGHT = [
  'soft morning light through sheer curtains',
  'late afternoon sun across the floor',
  'bright overcast daylight, no harsh shadows',
  'warm evening lamplight with dusk outside',
  'backlit window with glowing curtains',
];

/** 분위기 — 어떤 삶이 보이는가 */
const MOOD = [
  'calm and uncluttered, quietly upscale',
  'warm and lived-in but tidy',
  'airy and serene, plenty of empty floor',
  'cozy and inviting, soft textures',
];

/** 트렌드 — 요즘 실내 감각 */
const TREND = [
  'warm minimal interior, oak wood and cream tones',
  'modern Korean apartment interior, matte white and light wood',
  'japandi style interior, linen and pale timber',
  'soft neutral interior with one deep green accent',
  'contemporary interior with stone countertop and warm wood',
];

/** 방 — 늘 거실만 보여주면 글마다 같은 사진이 된다 */
const ROOM = [
  'living room',
  'living room and dining area',
  'bedroom with large window',
  'kitchen and dining area',
  'balcony opening onto living room',
];

/**
 * 문자열 → 안정적인 정수. 첫 줄만 본다 (pickVoice 와 같은 이유 —
 * 뒤에 붙는 취재 재료가 바뀌어도 사진이 달라지면 안 된다).
 */
function hash(seed) {
  let h = 0;
  for (const ch of String(seed || '').split('\n')[0].trim()) {
    h = (h * 31 + ch.codePointAt(0)) % 1000003;
  }
  return h;
}

/**
 * 목록에서 하나 고른다.
 *
 * ⚠️ `(h + salt * n) % len` 으로 두면 **목록끼리 상관된다** — 두 글이 구도는 달라도
 * 트렌드·빛이 통째로 같아진다(2026-08-03 첫 시험에서 그렇게 나왔다).
 * salt 마다 해시를 다시 섞어서 각 목록이 독립적으로 움직이게 한다.
 */
function pick(list, h, salt) {
  let x = (h ^ (salt * 0x9e3779b1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  /* `>>> 0` 을 반드시 붙인다 — `^` 는 int32 로 바꾸므로 큰 값에서 **음수**가 나오고,
   * 음수 % 길이는 음수 인덱스가 되어 `undefined` 를 돌려준다
   * (2026-08-03: 조합의 절반이 빈 문자열로 나왔던 원인). */
  return list[((x ^ (x >>> 16)) >>> 0) % list.length];
}

/**
 * '살고 싶은 집' 검색어 하나를 만든다.
 *
 * 사람은 넣지 않는다 — 얼굴이 들어오면 광고 사진이 되고, 그건 이미 금지한 것이다
 * (econ 스키마 photoQuery ②). 빈 방이 오히려 독자가 자기 삶을 얹어 보게 만든다.
 */
export function interiorScene(seed) {
  const h = hash(seed);
  return [
    pick(FRAMING, h, 1),
    pick(ROOM, h, 2),
    pick(TREND, h, 3),
    pick(LIGHT, h, 4),
    pick(MOOD, h, 5),
    'no people, real photograph',
  ].join(', ');
}

/**
 * 같은 조합의 **스톡 검색용 짧은 판**.
 *
 * `interiorScene` 은 생성 프롬프트용이라 길다. 스톡 검색에 그 문장을 그대로 넣으면
 * 낱말이 너무 많아 결과가 0건이 되거나 엉뚱한 것이 온다 (사진 검색은 낱말 몇 개로 돈다).
 * 같은 해시를 써서 **생성판과 같은 방을·같은 톤을** 고른다.
 */
export function interiorSceneShort(seed) {
  const h = hash(seed);
  const room = pick(ROOM, h, 2);
  /* 트렌드 항목에 쉼표가 없는 것도 있어서 `split(',')` 만으로는 안 짧아진다
   * (2026-08-03: 15낱말이 그대로 나왔다). 낱말 수로 자른다 — 사진 검색은
   * 낱말이 많으면 결과가 0건이 되거나 엉뚱한 것이 온다. */
  const trend = pick(TREND, h, 3).split(/[\s,]+/).slice(0, 3).join(' ');
  return `bright empty korean apartment ${room} ${trend}`;
}

/**
 * 이 글이 **집을 다루는 글**인가. 부동산 글이라도 세금·대출 서류 이야기만 하는 글에
 * 모델하우스 사진을 넣으면 글과 그림이 어긋난다.
 *
 * 판정 근거를 제목·키워드·태그로 좁힌다 — 본문까지 보면 "집" 이라는 낱말 하나에
 * 아무 글이나 걸린다.
 */
export function isHousingArticle(article) {
  const hay = [
    article?.title,
    article?.primaryKeyword,
    ...(article?.tags || []),
  ]
    .filter(Boolean)
    .join(' ');
  return /전세|월세|전월세|임대차|청약|아파트|주택|매매|이사|입주|분양|주담대|주택담보/.test(hay);
}

/**
 * 자녀·육아를 다루는 글의 장면.
 *
 * 왜 따로 두는가: 경제 글의 사진 자리는 모델의 `photoQuery` 를 뼈대로 쓰는데,
 * 한도·요건·신청처럼 추상적인 주제에서는 그 값이 **늘 같은 사물**로 수렴한다 —
 * 계산기, 노트와 펜, 노트북, 책상 플랫레이. 글과 아무 상관이 없다.
 *
 * > 2026-08-05 실측 — 보육수당 비과세 글: 스톡 4장이 노트·펜·안경, 계산기
 * >   플랫레이, 미국 변호사 사무실이었다. 이미지 생성 프롬프트를 뽑아 보니
 * >   `calculator notebook desk` · `blank paper pen desk` 로 **같은 그림**을
 * >   다시 만들게 되어 있었다 (생성 소스만 바뀌고 결과는 그대로).
 *
 * 자녀 혜택 글에서 독자가 자기 삶을 얹는 그림은 사물이 아니라 **아이의 흔적**이다.
 * 사람·얼굴은 넣지 않는다 (초상권·광고 느낌 — interiorScene 과 같은 이유).
 */
const CHILD_SCENES = [
  'a pair of very small child shoes placed neatly by the entrance of a Korean home',
  'two pairs of small child shoes side by side on a wooden floor',
  'pencil height marks on a door frame in a family home',
  'a small wooden high chair beside a sunlit window',
  'a child drawing held on a refrigerator door by a magnet',
  'a small backpack and a water bottle waiting by the front door',
  'folded tiny laundry stacked on a bed in soft daylight',
  'a low table with crayons scattered beside a half-finished drawing',
];

/** 이 글이 **자녀·육아를 다루는 글**인가 (판정 근거는 제목·키워드·태그로 좁힌다) */
export function isChildArticle(article) {
  const hay = [article?.title, article?.primaryKeyword, ...(article?.tags || [])]
    .filter(Boolean)
    .join(' ');
  return /자녀|아이|육아|보육|출산|양육|어린이|유아|아동|다자녀|임신/.test(hay);
}

/** 자녀 글의 장면 하나 — 같은 해시 방식이라 글마다 다른 컷이 나온다 */
export function childScene(seed) {
  const h = hash(seed);
  return [pick(CHILD_SCENES, h, 6), pick(LIGHT, h, 4), pick(MOOD, h, 5), 'no people, real photograph'].join(
    ', '
  );
}
