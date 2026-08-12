/** 목소리 — pickVoice() 가 첫 줄 해시로 고르고, config.article.<voicePin> 으로 고정한다 */
const VOICES = [
  {
    name: '정주행 평론가',
    rules: `당신의 목소리: **정주행 평론가** (구조를 읽는 사람).
- 이 장면이 서사에서 **하는 일**을 읽습니다 — 인물의 선택이 판을 어떻게 바꾸는지.
- 어미는 ~입니다/~이죠/~합니다 를 섞고, 확신에 찬 짧은 단정을 아껴 씁니다.
- 시그니처: 마지막 섹션을 **한 줄 평**으로 닫습니다 ("한 줄로 줄이면 — …").
- 위트는 인물이 아니라 **상황의 아이러니**에서 꺼냅니다.`,
  },
  {
    name: '본방사수 이웃',
    rules: `당신의 목소리: **본방사수 이웃** (옆자리에서 같이 본 사람).
- **해요체**입니다 ("~거든요", "~잖아요", "~더라고요"). 글 전체가 그렇습니다.
- 1인칭은 **"저"** 입니다 — "나는 ~보였어요" 처럼 섞지 마세요 (세 번 재발한 실수).
- 감정을 숨기지 않습니다 — 답답하면 답답하다고, 통쾌하면 통쾌하다고. 다만
  근거는 항상 화면 속 장면입니다 (자막에 있는 것만).
- 디테일을 잘 잡습니다 — 소품·표정·말 사이의 침묵 같은, 지나치기 쉬운 것 하나를
  글의 축으로 세웁니다.
- 시그니처: 독자에게 한 번 묻습니다 ("이 장면, 어떻게 보셨어요?" — 마지막 섹션에서만).`,
  },
  {
    name: '작법 뜯어보는 사람',
    rules: `당신의 목소리: **작법 뜯어보는 사람** (드라마 작가 지망생의 눈).
- 복선·배치·편집 리듬을 봅니다 — "작가가 여기서 무엇을 아꼈나", "왜 이 순서인가".
- 경어체 평서 위주, 건조한 위트. 감탄 대신 관찰의 정확함으로 재미를 만듭니다.
- 숫자(타임스탬프·회차·횟수)를 근거로 삼는 것을 좋아합니다.
- 시그니처: 한 장면을 골라 "만약 이 장면이 없었다면" 을 한 문단 상상합니다
  (사실과 상상을 분명히 구분해서).`,
  },
];

/** 유튜브 URL → 장면을 따라가는 서사 에세이 */
import { parseYouTube } from '../ytClip.js';
const isUrl = (t) => /^https?:\/\/\S+$/i.test(t);
export default {
  id: 'clip', key: 'CLIP', label: '영상',
  detect: (t) => isUrl(t) && !!parseYouTube(t),
  /** 자막이 없으면 영상 글을 쓸 근거가 없다 → 기사 모드로 강등 */
  fallback: { ok: (clip) => !!clip?.lines?.length, to: 'news' },
  capabilities: {
    sourcePhoto: false,
    /* ⚠️ 반드시 false. 영상 글에서 sources 는 배경조사용 참고 자료라 사안이 다르다.
     * 켜면 무관한 사진이 대표 이미지가 된다 (2026-07-28 사고). */
    relatedArticlePhotos: false,
    clipShots: true,              // 장면 캡처가 이 모드의 이미지 공급원
    youtubeEmbeds: false,         // 같은 영상의 장면이 이미 본문에 있다
    socialEmbeds: false,          // 방송용 이름을 쓰는 일반인이 많아 공식 계정이 없다
    allowTables: false,           // 이야기 흐름을 끊는다
  },
  schemaFile: 'article.schema.json',
  /* 사진 수는 장면 캡처가 정한다 — movie.js 와 같은 이유로 여기 값은 쓰이지 않는다. */
  bodyImageDelta: 0,
  rules: ['readabilityRules', 'calloutRules', 'legalDisputeRules', 'imageBriefRules'],
  voices: VOICES,
  voicePin: 'clipVoice',
  sections: ['자유'],             // 이야기의 마디로 나눈다
  /** 출력 규격 — 실측(2026-08-01, 발행 1편). 사진이 가장 촘촘한 모드다. */
  contract: {
    /* 실측 3편: 2738(나는솔로 32기) · 4115(나는솔로 21기) · 3103(전참시 박진영).
     * 처음엔 표본이 1편이라 [2650,3300] 으로 좁게 잡았는데 4115 가 걸렸다.
     * 영상 길이가 13~30분으로 갈리고 장면 수도 달라 편차가 크다 — 넓힌다. */
    chars: [2650, 4300],
    sections: [6, 8],
    photos: [12, 20],             // 실측 18 — 장면 캡처라 많이 쓸 수 있다
    photoDensity: [130, 230],     // 실측 152. 다섯 모드 중 참고 글(249)에 가장 가깝다.
    captions: 'fact-only',    // §7-6 — 근거 없는 캡션 19개를 지운 자리
    endingMax: 0.6,
    headingWorkTitle: null,       // 프로그램명 반복은 이 모드의 관심사가 아니다
    tables: [0, 1],
    embeds: [1, 3],
    tags: [8, 12],
    faq: [5, 5],
    noSpoilerIn: [],
  },
  platforms: ['tistory', 'naver'],
  conflicts: { headingStyle: '이야기의 마디 (검색 질문형 금지)' },
};
