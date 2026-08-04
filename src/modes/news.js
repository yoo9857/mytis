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
