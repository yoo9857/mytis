/** 기사 URL → 교차 확인한 뉴스 해설 */
const isUrl = (t) => /^https?:\/\/\S+$/i.test(t);
export default {
  id: 'news', key: 'NEWS', label: '기사',
  detect: (t) => isUrl(t),
  capabilities: {
    sourcePhoto: true,            // 원문 기사의 og:image (images.useSourcePhoto 로 별도 동의)
    relatedArticlePhotos: true,   // 같은 사안을 다룬 기사들이라 사진도 같은 사안이다
    clipShots: false,
    youtubeEmbeds: true,
    socialEmbeds: true,
    allowTables: true,
  },
  schemaFile: 'article.schema.json',
  rules: ['engagementRules', 'readabilityRules', 'calloutRules', 'legalDisputeRules', 'imageBriefRules'],
  voices: [], voicePin: '',
  sections: ['자유'],
  /** 출력 규격 — 실측(2026-08-01, 발행 2편) */
  contract: {
    chars: [2800, 3600],          // 실측 2837 · 3356
    sections: [6, 8],             // 실측 6 · 7 — 사안 크기에 따라 달라진다
    photos: [5, 9],               // 실측 5 · 6
    photoDensity: [300, 500],     // 실측 473 · 559 — 다섯 모드 중 가장 헐렁하다
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
