/**
 * 모드 레지스트리 — **모드에 관한 사실은 모두 여기 한 곳에서 선언한다.**
 *
 * ## 왜 필요했나
 *
 * 모드 정보가 다섯 곳에 흩어져 있었다: `mode.js`(판별·capabilities),
 * `prompt.js`(지시문·목소리), `codexWriter.js`(라우팅), 스키마 3종, `config.json`.
 * 한 곳만 빠뜨려도 조용히 다른 모드처럼 동작했고, 실제로 그렇게 됐다.
 *
 * > 2026-08-01 실측 사고 셋:
 * >  ① `buildBookPrompt` 가 import 만 되고 **한 번도 호출되지 않았다** —
 * >     라우팅이 `clip / fromNews / else` 세 갈래라 책 글이 연예 이슈 톤으로 쓰였다.
 * >     책다운 것은 스키마뿐이었다.
 * >  ② 영화 모드를 만들면서 `imageBriefRules` 를 빼먹었다 (아무도 알려주지 않았다).
 * >  ③ `movie.schema.json` 을 `book.schema.json` 에서 복제했더니 "이 책이 무엇이고",
 * >     "표지·저자명" 같은 **다른 모드 어휘**가 3곳 남았다.
 *
 * ## 규칙
 *
 * - 모드를 추가할 때는 `src/modes/<id>.js` **한 파일만** 쓴다.
 * - 모드마다 정반대인 규칙이 있다(소제목에 작품명 반복: 책 금지 / 영화 권장).
 *   그런 것은 통합하지 말고 `conflicts` 에 **명시**한다.
 * - `lintModes()` 가 선언과 실제 지시문이 어긋난 곳을 잡는다 (`npm run doctor`).
 */
import topic from './topic.js';
import news from './news.js';
import clip from './clip.js';
import book from './book.js';
import movie from './movie.js';
import drama from './drama.js';

/** 선언 순서 = 판별 우선순서. 접두사 모드(`책:`·`영화:`)가 URL 판별보다 먼저다. */
const ALL = [book, movie, drama, clip, news, topic];

export const MODES = Object.fromEntries(ALL.map((m) => [m.id, m]));

/** 켜져 있는 모드만 (선언은 있으나 지시문이 아직 없는 모드는 enabled:false) */
export const ACTIVE = ALL.filter((m) => m.enabled !== false);

export const MODE = Object.fromEntries(ALL.map((m) => [m.key, m.id]));
export const MODE_LABEL = Object.fromEntries(ALL.map((m) => [m.id, m.label]));
export const CAPABILITIES = Object.fromEntries(ALL.map((m) => [m.id, m.capabilities]));

/** 공용 규칙 이름 → 생성된 지시문에서 그 규칙을 찾아낼 표식 */
export const RULE_MARKERS = {
  engagementRules: '# 독자를 끌어당기는 편집',
  readabilityRules: '# 문단은 반드시 짧게',
  calloutRules: '# 강조박스(callout)',
  legalDisputeRules: '# 의혹·고소·재판이 걸린 사안이라면',
  imageBriefRules: '# 이미지 브리프',
};

/** 이 모드에서 그 공용 규칙이 켜져 있어야 하는가 (선언 기준) */
export function ruleOn(modeId, rule) {
  return (MODES[modeId]?.rules || []).includes(rule);
}

/** 이 모드에서 해당 단계를 해도 되는가. 모르는 모드는 가장 보수적으로 본다. */
export function can(modeId, capability) {
  const caps = CAPABILITIES[modeId] || CAPABILITIES[MODE.TOPIC];
  return caps[capability] === true;
}

/**
 * 입력만 보고 모드를 정한다. 유튜브 자막을 읽기 **전** 단계의 판단이다.
 * 각 모드가 자기 `detect` 를 갖고, 레지스트리는 선언 순서대로 물어본다.
 */
export function detectMode(input) {
  const t = String(input || '').trim();
  for (const m of ACTIVE) if (m.detect?.(t)) return m.id;
  return MODE.TOPIC;
}

/** 자막 확보 결과까지 반영한 최종 모드 (영상인데 자막이 없으면 강등). */
export function resolveMode(input, clipData) {
  const guess = detectMode(input);
  const fb = MODES[guess]?.fallback;
  if (fb && !fb.ok(clipData)) return fb.to;
  return guess;
}

/**
 * 목소리 고르기 — **한 구현으로 통일했다.**
 * 예전에는 CLIP·BOOK·MOVIE 가 해시 로직을 각자 3벌 갖고 있었고,
 * 고정(pin) 경로는 2벌만 있어 CLIP 은 목소리를 고정할 수 없었다.
 *
 * 해시는 **첫 줄만** 본다 — topic 에 취재 재료를 붙여 넘기는 경우가 있고,
 * 그것까지 해시에 넣으면 같은 작품이 붙여넣은 자료에 따라 다른 목소리가 된다.
 */
export function pickVoice(modeId, key, cfg) {
  const voices = MODES[modeId]?.voices || [];
  if (!voices.length) return null;
  const pinKey = MODES[modeId]?.voicePin;
  const wanted = pinKey ? String(cfg?.article?.[pinKey] || '').trim() : '';
  const pinned = voices.find((v) => v.name === wanted);
  if (pinned) return pinned;
  let h = 0;
  for (const ch of String(key || '').split('\n')[0].trim()) h = (h * 31 + ch.codePointAt(0)) % 100000;
  return voices[h % voices.length];
}

/**
 * 선언과 실제가 어긋난 곳을 찾는다. `npm run doctor` 가 부른다.
 * 지시문을 실제로 만들어 표식을 세므로, 규칙을 빼먹으면 여기서 잡힌다.
 */
export function lintModes({ buildPrompt, cfg }) {
  const problems = [];
  for (const m of ACTIVE) {
    if (!m.schemaFile) problems.push(`${m.label}: schemaFile 선언이 없습니다`);
    if (!m.sections?.length) problems.push(`${m.label}: sections 선언이 없습니다`);
    let prompt = '';
    try {
      prompt = buildPrompt(m.id) || '';
    } catch (e) {
      problems.push(`${m.label}: 지시문 생성 실패 — ${e.message.split('\n')[0]}`);
      continue;
    }
    for (const [rule, marker] of Object.entries(RULE_MARKERS)) {
      const declared = m.rules.includes(rule);
      const actual = prompt.includes(marker);
      if (declared && !actual) problems.push(`${m.label}: ${rule} 을 켜기로 선언했는데 지시문에 없습니다`);
      if (!declared && actual) problems.push(`${m.label}: ${rule} 이 지시문에 있는데 선언에 없습니다`);
    }
    /* 다른 모드의 어휘가 섞였는지 — 스키마 복제가 남긴 잔재를 잡는다 */
    for (const word of m.foreignWords || []) {
      if (prompt.includes(word)) problems.push(`${m.label}: 지시문에 다른 모드 어휘 "${word}" 가 있습니다`);
    }

    /* conflicts 는 **모드끼리 정반대인 규칙**이다. 선언만 두면 거짓말이 되므로
     * 지시문에 그 지시가 실제로 있는지 센다.
     * (책=소제목에 제목 금지 / 영화·드라마=제목 넣기. 섞이면 검색 수요를 놓치거나
     *  책 글이 검색어를 반복한다.) */
    const c = m.conflicts || {};
    if (c.titleInHeading === 'forbid' && !/소제목마다 반복하지 마세요|소제목에 .*반복하지/.test(prompt)) {
      problems.push(`${m.label}: conflicts.titleInHeading=forbid 인데 "소제목에 제목 반복 금지" 지시가 없습니다`);
    }
    if (c.titleInHeading === 'require' && !/소제목에 \*\*영화 제목을 넣으세요\*\*|소제목에 .*제목을 넣/.test(prompt)) {
      problems.push(`${m.label}: conflicts.titleInHeading=require 인데 "소제목에 제목을 넣으라" 지시가 없습니다`);
    }
    if (c.statCard === 'forbid' && !/statValue \/ statLabel 은 항상 빈 문자열/.test(prompt)) {
      problems.push(`${m.label}: conflicts.statCard=forbid 인데 스탯 카드 금지 지시가 없습니다`);
    }
    if (c.spoiler === 'never' && !/스포일러|결말·전개 스포일러/.test(prompt)) {
      problems.push(`${m.label}: conflicts.spoiler=never 인데 스포일러 금지 지시가 없습니다`);
    }

    if (!m.platforms?.length) problems.push(`${m.label}: platforms 선언이 없습니다`);
  }
  return problems;
}

/**
 * 이 모드를 그 플랫폼에 발행해도 되는가 (선언 기준).
 * 막지는 않고 경고만 한다 — 책 글을 티스토리에 내보고 싶을 수도 있다.
 */
export function platformOk(modeId, platform) {
  const list = MODES[modeId]?.platforms;
  return !list?.length || list.includes(platform);
}
