/**
 * 글의 **용도(모드)** 를 한 곳에서 정한다.
 *
 * 이 파일이 왜 필요한가:
 *   모드는 원래도 셋이었지만 이름이 없었다. `isUrl(topic)`, `!clip`,
 *   `article.fromClip`, `article.clipShots?.length` 같은 조건이 4개 파일에
 *   흩어져 있었고, 단계마다 자기 나름대로 모드를 다시 판단했다.
 *   **그래서 한 단계가 모드를 놓치면 조용히 다른 모드처럼 동작했다.**
 *
 *   > 2026-07-28 실측 — 나는솔로 영상 글:
 *   > '관련 기사에서 사진 더 긁어오기' 단계에 영상 글 예외가 없어서,
 *   > codex 가 배경조사로 인용한 기사에서 **전혀 다른 영상의 썸네일**을
 *   > 가져와 대표 이미지로 썼다. 그 위에 글 헤드라인이 얹혔다.
 *   >
 *   > 같은 글에서 출연자 '영숙·영철·영식·광수·옥순' 의 공식 SNS 계정도
 *   > 검색했다. 방송용 이름을 쓰는 일반인이라 있을 리 없는데 codex 호출
 *   > 1분을 그냥 버렸다.
 *
 *   두 사고 모두 "이 단계가 지금 어떤 글을 다루는지 몰라서" 생겼다.
 *   그래서 모드를 한 번만 정하고, 각 단계는 **묻기만** 한다.
 *
 * 새 단계를 추가할 때는 조건문을 새로 쓰지 말고 CAPABILITIES 에 항목을 넣으세요.
 */
import { parseYouTube } from './ytClip.js';

/* codexWriter 의 isUrl 과 같은 판별이지만 여기서 다시 쓴다.
 * codexWriter 가 이 파일을 import 하므로 반대로 가져오면 순환 참조가 된다. */
const looksLikeUrl = (text) => /^https?:\/\/\S+$/i.test(String(text || '').trim());

export const MODE = {
  /** 주제 한 줄 → 검색해서 정보성 글 */
  TOPIC: 'topic',
  /** 기사 URL → 교차 확인한 뉴스 해설 */
  NEWS: 'news',
  /** 유튜브 URL → 장면을 따라가는 서사 에세이 */
  CLIP: 'clip',
};

/**
 * 모드별로 무엇을 하고 무엇을 하지 않는가.
 *
 * `false` 는 "안 되는 것" 이 아니라 **"이 모드에서는 하면 안 되는 것"** 이다.
 * 대개 결과가 글과 어긋나거나, 성공할 수 없는데 시간만 쓰는 단계다.
 */
export const CAPABILITIES = {
  [MODE.TOPIC]: {
    sourcePhoto: false, // 원문이 없다
    relatedArticlePhotos: false, // 인용 기사는 배경조사용이라 사진이 주제와 무관하다
    clipShots: false,
    youtubeEmbeds: true,
    socialEmbeds: true,
    allowTables: true,
  },
  [MODE.NEWS]: {
    sourcePhoto: true, // 원문 기사의 og:image (images.useSourcePhoto 로 별도 동의)
    relatedArticlePhotos: true, // 같은 사안을 다룬 기사들이라 사진도 같은 사안이다
    clipShots: false,
    youtubeEmbeds: true,
    socialEmbeds: true,
    allowTables: true,
  },
  [MODE.CLIP]: {
    sourcePhoto: false,
    /* ⚠️ 반드시 false. 영상 글에서 sources 는 배경조사용 참고 자료라
     * 사안이 다르다. 여기를 켜면 무관한 사진이 대표 이미지가 된다. */
    relatedArticlePhotos: false,
    clipShots: true, // 장면 캡처가 이 모드의 이미지 공급원이다
    /* 같은 영상의 장면이 이미 본문에 있다. 다른 영상을 덧붙이면 글과 따로 논다. */
    youtubeEmbeds: false,
    /* 출연자가 방송용 이름을 쓰는 일반인인 경우가 많아 공식 계정이 없다.
     * 연예인이 나오는 영상이라면 config 의 social.enabled 로 켤 수 있다. */
    socialEmbeds: false,
    allowTables: false, // 이야기 흐름을 끊는다
  },
};

/**
 * 입력만 보고 모드를 정한다. 유튜브 자막을 읽기 **전** 단계의 판단이다.
 *
 * 자막이 없으면 영상 글을 쓸 수 없으므로, 실제 확정은 자막을 받아 본 뒤
 * `resolveMode` 가 한다 (유튜브 주소인데 자막이 없으면 NEWS 로 내려간다).
 */
export function detectMode(topic) {
  if (!looksLikeUrl(topic)) return MODE.TOPIC;
  return parseYouTube(topic) ? MODE.CLIP : MODE.NEWS;
}

/** 자막 확보 결과까지 반영한 최종 모드. */
export function resolveMode(topic, clip) {
  const guess = detectMode(topic);
  if (guess === MODE.CLIP && !clip?.lines?.length) return MODE.NEWS;
  return guess;
}

/** 이 모드에서 해당 단계를 해도 되는가. 모르는 모드는 가장 보수적으로 본다. */
export function can(mode, capability) {
  const caps = CAPABILITIES[mode] || CAPABILITIES[MODE.TOPIC];
  return caps[capability] === true;
}

/** 로그·디버깅용 이름 */
export const MODE_LABEL = {
  [MODE.TOPIC]: '주제',
  [MODE.NEWS]: '기사',
  [MODE.CLIP]: '영상',
};
