/**
 * "드라마: 제목 N회" → 회차 리캡 (사용자 결정 2026-08-01)
 *
 * **아직 켜지 않았다** (`enabled: false`) — 지시문·스키마가 없다.
 * 선언만 먼저 두는 이유: 영화 모드를 만들 때 규칙을 어디에 둬야 하는지 몰라
 * 두 곳이 깨졌다. 성격을 먼저 적어 두면 그 실수를 반복하지 않는다.
 *
 * ## 영상(clip) 모드와 무엇이 다른가
 * 영상 모드는 입력이 **유튜브 URL** 이고 자막에서 장면을 뽑는다.
 * 드라마 모드는 입력이 **작품명 + 회차** 라 자막이 없다 — 방영 정보·보도·
 * 공식 예고를 취재해야 한다. 그래서 clipShots 를 쓸 수 없다.
 */
export default {
  id: 'drama', key: 'DRAMA', label: '드라마',
  enabled: false,
  detect: (t) => /^드라마\s*:/.test(t),
  capabilities: {
    sourcePhoto: true,            // 방송사 공식 스틸·보도자료 (발행자 감수)
    relatedArticlePhotos: true,
    clipShots: false,             // 입력이 URL 이 아니라 캡처 경로가 없다
    youtubeEmbeds: true,          // 공식 예고·하이라이트가 장면을 보여 준다
    socialEmbeds: true,           // 방송사·배우 공식 계정 근황이 회차 글과 맞는다
    allowTables: true,            // 편성·회차·시청률
  },
  schemaFile: 'drama.schema.json', // 2단계에서 생성
  rules: ['readabilityRules', 'calloutRules', 'legalDisputeRules', 'imageBriefRules'],
  voicePin: 'dramaVoice',
  sections: ['프롤로그', '방영 정보', '줄거리', '이 회차의 장면', '등장인물', '다음 회 예고', '포인트'],
  platforms: ['tistory', 'naver'],
  conflicts: {
    titleInHeading: 'require',    // "○○ 12회 줄거리" 가 검색어다
    spoiler: 'always',            // 회차 리캡은 그 회차를 다 말하는 글이다
    statCard: 'forbid',
  },
  foreignWords: ['서지 정보', '옮긴이', '쪽수', '상영시간'],
};
