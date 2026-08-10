/** 기사 URL → 교차 확인한 뉴스 해설 */
const isUrl = (t) => /^https?:\/\/\S+$/i.test(t);
export default {
  id: 'news', key: 'NEWS', label: '기사',
  detect: (t) => isUrl(t),
  capabilities: {
    sourcePhoto: true,            // 원문 기사의 og:image (images.useSourcePhoto 로 별도 동의)
    relatedArticlePhotos: true,   // 같은 사안을 다룬 기사들이라 사진도 같은 사안이다
    noStockPhotos: true,          // 연예 기사에 외국인·달력·마이크 스톡을 대체 사진으로 넣지 않는다
    requireSubjectPhotos: true,   // 원문·실제 인물 등 소재 자체의 사진이 3장 미만이면 발행 중단
    requirePinnedPhotos: true,    // 자동 즉시 발행 금지: 미리보기로 확인하고 고정한 사진만 발행
    clipShots: false,
    youtubeEmbeds: true,
    socialEmbeds: true,
    allowTables: true,
  },
  schemaFile: 'article.schema.json',
  /**
   * 본문 사진 +3 (대표 1 + 본문 8 = 9장). **2026-08-04 에 0 에서 올렸다 (§8-9).**
   *
   * 왜: `photoDensity` 규격은 [300,500] 인데 그 실측 주석이 스스로 473·559 라고
   * 적어 뒤 있었다 — 559 는 선언한 범위 밖이다. 사진 6장으로는 3,000자대 기사 글이
   * 거의 매번 경고를 냈다 (2026-08-04 발행 2편 중 1편이 598자/장).
   * **게이트가 매번 우는 상태는 진짜 이상 신호를 덮는다.**
   *
   * 9장이면 2800~3600자가 311~400자/장으로 규격 안에 들어온다. 참고 글 실측(249)
   * 쪽으로 가는 방향이기도 하다. 범위를 넓히는 것은 증상 대응이었다.
   *
   * 공급: 원문 기사 사진 4~5장 + 위키미디어 인물 사진 5장이 후보다. 모자란 자리는
   * 그라디언트가 되므로, 이 값을 더 올리기 전에 공급을 먼저 봐야 한다.
   */
  bodyImageDelta: 3,
  rules: ['engagementRules', 'axisRules', 'readabilityRules', 'calloutRules', 'legalDisputeRules', 'imageBriefRules'],
  voices: [], voicePin: '',
  sections: ['자유'],
  /** 출력 규격 — 실측(2026-08-01, 발행 2편) */
  contract: {
    chars: [2800, 3600],          // 실측 2837 · 3356
    sections: [6, 8],             // 실측 6 · 7 — 사안 크기에 따라 달라진다
    /* 하한을 5 → 3 으로, 밀도 상한을 500 → 900 으로 넓혔다 (2026-08-05).
     *
     * 왜: 예전 값은 **빈 슬롯을 그라디언트·스톡으로 채우는 것**을 전제로 뽑혔다.
     * 그런데 정책이 바뀌었다 — 글과 무관한 스톡 사진은 독자의 흥미를 죽이므로 금지,
     * 그라디언트 카드도 자원 낭비라 만들지 않는다(사용자 지시). 그러면 사진 수는
     * **관련 있는 공급이 정하는 값**이 된다.
     *
     * > 실측 — 김우빈 '기프트' 글: 관련 기사 사진이 4장뿐이라 카드도 4장이 됐고,
     * > 옛 하한(5)이 발행을 막았다. 글에는 아무 문제가 없었다.
     *
     * 하한 3 은 "사진이 사실상 없는 글"을 여전히 잡는다. 밀도 900 은 3,000자대 글에
     * 사진 4장(811)을 통과시키되 1~2장짜리(1500~3000)는 잡는다.
     * 사진을 늘리려면 규격이 아니라 **관련 있는 공급**을 늘려야 한다. */
    photos: [3, 9],               // 실측 4 · 5 · 6 (관련 사진만 쓴 뒤)
    photoDensity: [300, 900],     // 실측 473 · 559 · 811
    captions: 'free',
    endingMax: 0.6,
    headingWorkTitle: null,
    tables: [0, 2],
    embeds: [0, 2],
    tags: [8, 12],
    faq: [5, 5],
    noSpoilerIn: [],
  },
  platforms: ['tistory', 'naver'],
};
