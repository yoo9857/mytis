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
  platforms: ['tistory', 'naver'],
};
