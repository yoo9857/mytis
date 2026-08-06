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
import fs from 'node:fs';
import path from 'node:path';
import { DIRS } from '../paths.js';
import book from './book.js';
import movie from './movie.js';
import drama from './drama.js';
import econ from './econ.js';

/** 선언 순서 = 판별 우선순서. 접두사 모드(`책:`·`영화:`·`경제:`)가 URL 판별보다 먼저다. */
const ALL = [econ, book, movie, drama, clip, news, topic];

export const MODES = Object.fromEntries(ALL.map((m) => [m.id, m]));

/** 켜져 있는 모드만 (선언은 있으나 지시문이 아직 없는 모드는 enabled:false) */
export const ACTIVE = ALL.filter((m) => m.enabled !== false);

export const MODE = Object.fromEntries(ALL.map((m) => [m.key, m.id]));
export const MODE_LABEL = Object.fromEntries(ALL.map((m) => [m.id, m.label]));
export const CAPABILITIES = Object.fromEntries(ALL.map((m) => [m.id, m.capabilities]));

/** 공용 규칙 이름 → 생성된 지시문에서 그 규칙을 찾아낼 표식 */
export const RULE_MARKERS = {
  engagementRules: '# 독자를 끌어당기는 편집',
  axisRules: '# 축은 글 끝까지 하나로',
  readabilityRules: '# 문단은 반드시 짧게',
  calloutRules: '# 강조박스(callout)',
  legalDisputeRules: '# 의혹·고소·재판이 걸린 사안이라면',
  imageBriefRules: '# 이미지 브리프',
};

/** 이 모드에서 그 공용 규칙이 켜져 있어야 하는가 (선언 기준) */
export function ruleOn(modeId, rule) {
  return (MODES[modeId]?.rules || []).includes(rule);
}

/**
 * 이 모드가 쓸 **본문 사진 수** — 지시문과 렌더가 같은 값을 본다.
 *
 * ## 왜 필요했나
 *
 * 숫자가 두 곳에 따로 적혀 있었다. 지시문은 모드마다 `cfg.images.bodyImages + N`
 * 을 손으로 더했고(책 +4 · 경제 +2), 실제로 그리는 쪽(`images.js`)은
 * `article.bodyImageCount ?? cfg.images.bodyImages` 를 봤다. 그 값을 심는 곳은
 * `codexWriter.js` 의 **책 모드 한 줄**뿐이었고, 그것도 `+2` 였다.
 *
 * > 2026-08-04 실측 — 브리프가 조용히 잘려 나가고 있었다:
 * >   책  지시문 9개 요청 → 7개 렌더 (2개 버림, 주석은 아직 "+2" 라고 적혀 있었다)
 * >   경제 지시문 7개 요청 → 5개 렌더 (2개 버림)
 * > 잘리는 것은 **뒤쪽 브리프**다. `images.js` 가 앞에서부터 slice 하므로
 * > afterSection 이 큰 브리프가 사라진다 — **뒤쪽 절의 사진이 통째로 없어진다.**
 * > 게이트는 사진 **총수**만 세므로 이것을 보지 못했다.
 *
 * 그래서 델타를 모드 선언으로 옮겼다. 모드에 관한 사실은 모드 파일에 있어야 한다.
 *
 * ⚠️ 이 값을 올리면 **사진 공급도 그만큼 필요하다.** 못 채운 자리는 빈 그라디언트
 * 카드가 되고, 그건 브리프 수만 채운 채 게이트를 통과하는 더 나쁜 상태다
 * (movie.js 의 photos 주석과 같은 경고). 올린 뒤에는 실제 초안으로 확인한다.
 *
 * 영상·영화 모드는 장면 캡처 수가 사진 수를 정하므로 여기 값을 쓰지 않는다 —
 * `run.js: applyClipShotLayout` 이 나중에 `article.bodyImageCount` 를 덮어쓴다.
 */
export function bodyImageCount(modeId, cfg) {
  if (!cfg?.images?.enabled) return 0;
  const base = Number(cfg.images.bodyImages) || 0;
  const delta = Number(MODES[modeId]?.bodyImageDelta) || 0;
  return Math.max(0, base + delta);
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
  /* 고정 자리를 **두 곳** 본다. config.json 이 모드별 블록(`movie.voice`)과
   * 글 블록(`article.movieVoice`) 둘 다 갖고 있어서다.
   * > 2026-08-01 발각: `movie.voice` 를 채워도 아무 일도 일어나지 않았다 —
   * > 여기서 `article.movieVoice` 만 읽고 있었다. 설정 파일에 있는 칸이
   * > 아무 것도 안 하면 다음 사람이 채우고 왜 안 되는지 찾는다. */
  const wanted = String(
    (pinKey ? cfg?.article?.[pinKey] : '') || cfg?.[modeId]?.voice || '',
  ).trim();
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
export function lintModes({ buildPrompt, cfg, articleKeys }) {
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
    /* "소제목에" 로만 찾으면 **조사 하나에 걸린다.** 드라마 모드는 "소제목마다 …
     * 넣으세요" 로 썼고(더 자연스럽다) 검사는 지시가 있는데도 없다고 말했다.
     * 산문 규칙의 존재를 세는 검사이므로 표현의 폭을 조금 허용한다. */
    if (c.titleInHeading === 'require' && !/소제목(에|마다)\s*.*제목을 넣|소제목(에|마다)\s*.*(작품명|제목)[^.]*넣으세요/.test(prompt)) {
      problems.push(`${m.label}: conflicts.titleInHeading=require 인데 "소제목에 제목을 넣으라" 지시가 없습니다`);
    }
    if (c.statCard === 'forbid' && !/statValue \/ statLabel 은 항상 빈 문자열/.test(prompt)) {
      problems.push(`${m.label}: conflicts.statCard=forbid 인데 스탯 카드 금지 지시가 없습니다`);
    }
    if (c.spoiler === 'never' && !/스포일러|결말·전개 스포일러/.test(prompt)) {
      problems.push(`${m.label}: conflicts.spoiler=never 인데 스포일러 금지 지시가 없습니다`);
    }
    /* 경제 모드의 축 — **미래를 말하지 않는다.** 연예 글은 "다음 회차 관전 포인트" 를
     * 쓰는 것이 정상이고 경제 글은 그것이 사고다. 선언만 두면 거짓말이 되므로
     * 지시문에 실제로 그 금지가 있는지 센다. */
    if (c.forecast === 'forbid' && !/전망·추천을 쓰지 않습니다|전망과 예측/.test(prompt)) {
      problems.push(`${m.label}: conflicts.forecast=forbid 인데 전망·예측 금지 지시가 없습니다`);
    }

    if (!m.platforms?.length) problems.push(`${m.label}: platforms 선언이 없습니다`);

    /* 출력 규격이 온전한지 — 범위가 뒤집혀 있으면 **아무 글도 통과하지 못한다.**
     * 규격은 사람이 손으로 적는 값이라 뒤집힌 채로 조용히 굳기 쉽다. */
    const ct = m.contract;
    if (!ct) {
      problems.push(`${m.label}: contract 선언이 없습니다 (src/contract.js 가 기본값으로 뭅니다)`);
    } else {
      /* 숫자 범위인 항목만 본다. `noSpoilerIn` 은 **필드 이름 배열**이라 여기 넣으면
       * 배열이라는 이유로 오탐이 난다 (처음 판이 다섯 모드 전부를 잘못 잡았다). */
      const RANGES = ['chars', 'sections', 'photos', 'photoDensity', 'tables', 'embeds', 'tags', 'faq', 'headingWorkTitle', 'figures'];
      for (const k of RANGES) {
        const v = ct[k];
        if (v == null) continue; // headingWorkTitle: null = 검사 안 함
        if (!Array.isArray(v) || v.length !== 2 || !Number.isFinite(v[0]) || !Number.isFinite(v[1])) {
          problems.push(`${m.label}: contract.${k} 는 [최소, 최대] 두 숫자여야 합니다`);
        } else if (v[0] > v[1]) {
          problems.push(`${m.label}: contract.${k} 범위가 뒤집혔습니다 (${v[0]} > ${v[1]})`);
        }
      }
      if (!Array.isArray(ct.noSpoilerIn)) {
        problems.push(`${m.label}: contract.noSpoilerIn 은 필드 이름 배열이어야 합니다`);
      }
      if (!['free', 'fact-only'].includes(ct.captions)) {
        problems.push(`${m.label}: contract.captions 는 'free' 또는 'fact-only' 여야 합니다`);
      }
      if (!(ct.endingMax > 0 && ct.endingMax <= 1)) {
        problems.push(`${m.label}: contract.endingMax 는 0~1 사이 비율이어야 합니다`);
      }
    }
  }
  if (articleKeys?.length) problems.push(...lintSchemaKeys(articleKeys));
  return problems;
}

/**
 * 스키마가 요구하는 필드가 **아티클까지 살아 오는지** 대조한다.
 *
 * `normalizeArticle` 은 고정된 모양을 만든다. 그래서 스키마에 필드를 추가해도
 * 그 함수에 한 줄을 안 넣으면 모델이 채워 보낸 값이 조용히 버려진다.
 *
 * > 2026-08-01 발각 — 영화 스키마의 `spoiler` 는 처음부터 required 였는데 발행된
 * > 글 두 편 모두 그 키가 없었다. 제목의 "(스포 O)" 는 지시문이 시켜서 됐던 것이라
 * > 겉으로는 아무 문제가 없어 보였다. 같은 날 추가한 `angle` 도 똑같이 사라졌다.
 * > **겉으로 티가 안 나는 종류의 고장**이라 자동 대조가 필요하다.
 *
 * 실제 키 목록은 부르는 쪽(cli.js)이 `articleShapeKeys()` 로 넘긴다 —
 * 여기서 codexWriter 를 import 하면 순환 참조가 된다.
 */
function lintSchemaKeys(articleKeys) {
  const out = [];
  const have = new Set(articleKeys);
  for (const m of ACTIVE) {
    if (!m.schemaFile) continue;
    let schema;
    try {
      schema = JSON.parse(fs.readFileSync(path.join(DIRS.schema, m.schemaFile), 'utf8'));
    } catch (e) {
      out.push(`${m.label}: 스키마를 읽지 못했습니다 (${m.schemaFile}) — ${e.message.split('\n')[0]}`);
      continue;
    }
    for (const key of schema.required || []) {
      if (!have.has(key)) {
        out.push(
          `${m.label}: 스키마가 "${key}" 를 요구하는데 아티클에 남지 않습니다 — ` +
            'codexWriter.js 의 normalizeArticle 에 한 줄을 넣으세요'
        );
      }
    }
  }
  return out;
}

/**
 * 이 모드를 그 플랫폼에 발행해도 되는가 (선언 기준).
 * 막지는 않고 경고만 한다 — 책 글을 티스토리에 내보고 싶을 수도 있다.
 */
export function platformOk(modeId, platform) {
  const list = MODES[modeId]?.platforms;
  return !list?.length || list.includes(platform);
}
