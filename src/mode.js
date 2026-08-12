/**
 * 글의 **용도(모드)** — 공개 창구.
 *
 * 실제 선언은 `src/modes/<id>.js` 에 모드마다 한 파일씩 있고, `src/modes/index.js`
 * 가 레지스트리다. 이 파일은 기존 import 경로를 지키기 위한 얇은 재수출이다.
 *
 * ## 왜 파일을 나눴나
 *
 * 모드 정보가 다섯 곳에 흩어져 있어서 한 곳만 빠뜨려도 조용히 다른 모드처럼
 * 동작했다. 2026-08-01 에 세 건이 한꺼번에 드러났다:
 *   ① `buildBookPrompt` 가 **한 번도 호출되지 않았다** (라우팅이 세 갈래였다)
 *   ② 영화 모드에 `imageBriefRules` 를 빼먹었다
 *   ③ `movie.schema.json` 에 책 어휘가 3곳 남았다 (스키마를 복제한 탓)
 *
 * **새 단계를 추가할 때는 조건문을 새로 쓰지 말고** 모드 파일의 `capabilities` 에
 * 항목을 넣고 `can(mode, '항목')` 으로 물어보세요.
 *
 * **모드를 추가할 때는 `src/modes/<id>.js` 한 파일만** 쓰세요.
 * 빠뜨린 것은 `lintModes()` 가 `npm run doctor` 에서 잡습니다.
 */
export {
  MODE,
  MODE_LABEL,
  MODES,
  ACTIVE,
  CAPABILITIES,
  RULE_MARKERS,
  detectMode,
  resolveMode,
  can,
  ruleOn,
  bodyImageCount,
  pickVoice,
  lintModes,
  platformOk,
} from './modes/index.js';
