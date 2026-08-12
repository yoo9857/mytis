/** 주제 한 줄 → 검색해서 정보성 글 (기본 모드) */
export default {
  id: 'topic', key: 'TOPIC', label: '주제',
  detect: () => false, // 아무것도 안 걸리면 detectMode 가 기본값으로 준다
  capabilities: {
    sourcePhoto: false,           // 원문이 없다
    relatedArticlePhotos: false,  // 인용 기사는 배경조사용이라 사진이 주제와 무관하다
    clipShots: false,
    youtubeEmbeds: true,
    socialEmbeds: true,
    allowTables: true,
  },
  schemaFile: 'article.schema.json',
  /* 기사 모드와 규격이 같으므로 같이 올린다 (§8-9). 사진 6장으로는 photoDensity
   * [300,500] 을 3,000자대에서 넘긴다 — 9장이면 311~444자/장으로 들어온다. */
  bodyImageDelta: 3,
  rules: ['engagementRules', 'axisRules', 'readabilityRules', 'imageBriefRules'],
  voices: [], voicePin: '',
  sections: ['자유'], // 주제에 따라 codex 가 정한다
  /** 출력 규격 — 오늘 발행 이력이 없어 기사 모드에 맞춰 둔다. 실측이 쌓이면 조인다. */
  contract: {
    chars: [2800, 4000],
    sections: [6, 8],
    photos: [5, 9],
    photoDensity: [300, 500],
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
