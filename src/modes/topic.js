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
  rules: ['engagementRules', 'readabilityRules', 'imageBriefRules'],
  voices: [], voicePin: '',
  sections: ['자유'], // 주제에 따라 codex 가 정한다
  platforms: ['tistory', 'naver'],
};
