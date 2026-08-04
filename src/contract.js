/**
 * 모드별 **출력 규격**을 재고 대조한다 — 하네스의 계측기.
 *
 * ## 왜 필요했나
 *
 * 형식이 글마다 흔들렸다. 원인은 규격이 **코드에 없었기 때문**이다.
 * `config.json` 은 모드 구분 없이 한 벌(`minChars: 3000`, `sectionCount: 7`,
 * `bodyImages: 5`)만 갖고 있어서, 모드마다 딴 데서 덧칠했다 —
 * 책은 `codexWriter` 가 `bodyImages + 2`, 영화는 사람이 매번 손으로.
 * 그래서 글마다 사람에게 확인을 받아야 했고, 확인받는 순간 그 글만의 형식이 됐다.
 *
 * > 사용자 지적 (2026-08-01): *"글마다 계속 컴펌을 하여서 형식이 달라지고,
 * >  좋지 못한 구성이 되어지고 있음"*
 *
 * ## 세 가지를 분리한다
 *
 * - `measure()` — **재기만** 한다. 판단하지 않는다.
 * - `checkContract()` — 모드 규격에 대고 **어긋난 것만** 돌려준다.
 * - `autoFix()` — **기계적으로 확실한 것만** 고친다. 애매하면 손대지 않고 경고로 넘긴다.
 *
 * 규격은 각 모드 파일의 `contract` 블록이 갖는다 (모드에 관한 사실은 한 곳 — modes/index.js).
 *
 * ## 재는 단위를 하나로 못박는다
 *
 * `flowChars` = 화면에 보이는 본문 전부 (한 줄 정리·핵심·소제목·문단·불릿·강조·FAQ·맺음).
 * `codexWriter.articleCharCount` 와 **같은 값**이다. 기준이 둘이면 규격이 둘이 된다.
 *
 * > 2026-08-01 실수 — 사진 밀도를 "문단+불릿" 으로 재서 황해가 241자/장 이라고 보고했다.
 * > 참고 글 249는 `.se-main-container` innerText(=보이는 글 전부)를 센 값이었다.
 * > 같은 기준으로 다시 세면 3,992 ÷ 9 = **443자/장** — 참고 글의 절반 밀도였다.
 * > **유리한 쪽 기준을 골라 쓰면 규격이 아니라 자기 위안이다.**
 */
import { MODES } from './modes/index.js';
import { endingStats, varyEndings } from './endings.js';

/** 규격을 선언하지 않은 모드의 기본값 — 느슨하게 둔다(막는 것이 목적이 아니다) */
const DEFAULT = {
  chars: [2800, 4200],
  sections: [6, 8],
  photos: [4, 20],
  photoDensity: [130, 500],
  captions: 'free',
  endingMax: 0.62,
  headingWorkTitle: null, // null = 검사하지 않음
  tables: [0, 3],
  embeds: [0, 4],
  tags: [8, 14],
  faq: [3, 6],
  noSpoilerIn: [],
  /* 0 = 검사하지 않음. 회차물처럼 **방송 뒤 보도가 근거인 모드**만 1 이상으로 둔다. */
  sourcesAfterAirDate: 0,
};

/** 이 항목이 어긋나면 발행을 막는다 (나머지는 경고) */
const BLOCKING = new Set([
  'sections', 'photos', 'endingMax', 'captions', 'schema',
  /* 회차 리캡을 방영 전 자료로 쓴 글 — **경고로 두면 안 된다.** 형식이 완벽하고
   * 내용만 다른 회차라서, 경고 한 줄은 사람이 넘겨 읽는다 (§7-17). */
  'recapSources',
  /* 정보 카드 — **모델이 세 번 연속 못 채웠다.** 경제 글 초안 3편이 전부 2개였다
   * (규격 3~5, 지시문은 "3~5개를 만드세요. 규격이 이 개수를 검사합니다." 를 굵게 쓴다).
   * 경고로 두면 사람이 넘겨 읽고, 그러면 본문 시각 자료가 스톡 사진으로만 남는다 —
   * 사용자가 두 번 지적한 그 상태다(2026-08-04). 셀 수 있는 항목이므로 막는다.
   * `cards` 를 선언하지 않은 모드는 checkContract 에서 검사를 건너뛰므로 영향이 없다. */
  'cards',
]);

/**
 * **빈 말 캡션** — 정지 화면이 보여 줄 수 없는 것을 설명하는 캡션.
 *
 * 처음에는 `captions: 'verified-only'` 로 두고 **전부 지웠다.** 그건 과했다 —
 * 지시문이 좋은 예·나쁜 예까지 들어 캡션 품질을 끌어올리는데 코드가 통째로 버리면
 * 그 작업이 헛돈다. 문제였던 것은 캡션의 **존재**가 아니라 **빈 말**이다.
 *
 * 아래 패턴은 §7-6 에서 실제로 지운 19개에서 뽑았다:
 *   "웃음이 번진 직후" · "대화의 속도가 늦어진다" · "분위기가 다시 가벼워진다" ·
 *   "경수를 향한 첫인상 평가가 확인된다"
 * 공통점은 **분위기·흐름·심리** 를 말한다는 것이다. 한 장의 정지 화면은 그것을 못 보여 준다.
 *
 * 반대로 좋은 캡션은 화면에 보이는 사실을 말한다:
 *   "7번 자리에 영철의 이름이 놓인다" · "광수를 1위로 답한 직후"
 * 그래서 `직후` 같은 낱말 하나로는 가를 수 없다 — **분위기 어휘**만 잡는다.
 */
const VAGUE_CAPTION =
  /(분위기|흐름이|속도가|공기가|기류|심경|웃음이 번|표정이 굳|확인된다|확인됩니다|감지된다|느껴진다|느껴집니다|미묘)/;

/** 결말을 드러내는 말투 — 기계로 잡을 수 있는 만큼만. 완벽하지 않으니 경고로만 쓴다. */
const SPOILER_WORDS =
  /(으로 끝납니다|로 끝난다|죽고|죽는다|죽습니다|사망합니다|범인은|정체는|밝혀집니다|드러납니다)/;

/**
 * 비교용 정규화 — 공백과 **문장부호까지** 지운다.
 *
 * > 2026-08-01 발각 — 작품명이 "스파이더맨: 브랜드 뉴 데이" 인데 손으로 고친 소제목은
 * > "스파이더맨 브랜드 뉴 데이 정보"(콜론 없음)였다. 공백만 지우면
 * > `스파이더맨:브랜드뉴데이` ≠ `스파이더맨브랜드뉴데이` 라 3개가 0개로 보고됐다.
 * > §7-7 의 하이픈 사고(`Hwang Jung-min` vs `Hwang Jung-Min`)와 **같은 유형**이다.
 */
const strip = (s) => String(s || '').replace(/[\s:·・,.'"“”‘’!?()[\]<>《》〈〉「」『』\-–—]/g, '');

/**
 * 아티클을 잰다. 판단하지 않는다.
 *
 * `workTitle` 은 소제목의 작품명 반복을 세는 데 쓴다 — `topic` 의 접두사("영화: ")와
 * 괄호를 떼어 얻는다. 제목에서 뽑으면 훅이 섞여 못 쓴다.
 */
/**
 * 날짜 문자열에서 `YYYY-MM-DD` 를 뽑아 비교 가능한 숫자로 만든다.
 *
 * 모델이 쓰는 형태가 흔들린다 — "2026-08-03", "2026.08.03", "2026년 8월 3일".
 * 세 형태를 모두 받는다. 못 읽으면 `null` 이고, 그때는 **없는 것으로 센다** —
 * 읽지 못한 날짜를 통과시키면 검사가 무력해진다.
 */
function dayNum(text) {
  const s = String(text || '').trim();
  let m = s.match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (!m) m = s.match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!(y > 1900 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  return y * 10000 + mo * 100 + d;
}

/** 방송일 당일·이후에 나온 출처의 수 (회차 리캡 보도를 실제로 찾았는가) */
function countSourcesOnOrAfterAir(article) {
  const air = dayNum(article.airDate);
  if (air == null) return 0;
  return (article.sources || []).filter((s) => {
    const d = dayNum(s?.date);
    return d != null && d >= air;
  }).length;
}

export function measure(article) {
  const secs = article.sections || [];
  const flowParts = [
    article.directAnswer,
    ...(article.keyTakeaways || []),
    ...secs.flatMap((s) => [s.heading, ...(s.paragraphs || []), ...(s.bullets || []), s.callout]),
    ...(article.faq || []).flatMap((f) => [f.question, f.answer]),
    article.conclusion,
  ];
  const flowChars = flowParts.join('').length;
  const briefs = article.imageBriefs || [];
  const photos = briefs.length;

  /* ⚠️ **첫 줄만 본다.** `topic` 에는 취재 재료를 여러 줄로 붙여 넘기는 일이 많다
   * (책 모드는 수천 자짜리 브리핑이 붙는다). 전체를 쓰면 `workTitle` 이 거대해져
   * 어떤 소제목도 포함하지 않고, 규칙이 **항상 통과하는 죽은 규칙**이 된다.
   *
   * > 2026-08-01 발각 — 유래혁 수족관 글은 소제목 7개 중 2개에 "유래혁 수족관" 이
   * > 들어 있었는데 게이트는 0개로 보고했다. 책 모드의 `[0,0]` 규칙이 죽어 있었다.
   *
   * `pickVoice` 가 같은 함정을 이미 "첫 줄만" 으로 피했다(modes/index.js).
   *
   * 자르는 자리는 ` — `(저자·감독 구분)와 ` (`(출판사·감독 괄호)뿐이다.
   * 홑따옴표 하이픈으로 자르면 "미션 임파서블 - 폴아웃" 같은 제목이 잘린다. */
  const firstLine = String(article.topic || '').split('\n')[0].trim();
  /* 기사·영상 모드는 주제가 URL 이다. 그대로 두면 `workTitle` 이 URL 이 된다 —
   * 지금은 그 모드들이 `headingWorkTitle: null` 이라 무해하지만, 나중에 켤 때
   * 조용히 통과하는 규칙이 되므로 여기서 끊는다. */
  const workTitle = /^https?:\/\//i.test(firstLine)
    ? ''
    : firstLine
        .replace(/^(영화|책|드라마)\s*:\s*/, '')
        .split(/\s+—\s+| \(/)[0]
        .trim();
  /* 작품명은 공백 유무가 흔들린다 ("스파이더맨: 브랜드 뉴 데이" vs "브랜드뉴데이") */
  const bare = strip(workTitle);
  const headingWorkTitle = bare
    ? secs.filter((s) => strip(s.heading).includes(bare)).length
    : 0;

  const leaks = [];
  return {
    flowChars,
    sections: secs.length,
    photos,
    photoDensity: photos ? Math.round(flowChars / photos) : 0,
    captions: briefs.filter((b) => b.caption).length,
    vagueCaptions: briefs.filter((b) => b.caption && VAGUE_CAPTION.test(b.caption)),
    ending: endingStats(article),
    headingWorkTitle,
    workTitle,
    tables: secs.filter((s) => (s.table?.rows || []).length).length,
    embeds: (article.embeds || []).length,
    tags: (article.tags || []).length,
    faq: (article.faq || []).length,
    /** 경제 모드 전용 — 본문 수치와 출처·기준일의 짝 (src/modes/econ.js: contract.figures).
     *  `figures` 를 선언하지 않은 모드는 아래 checkContract 에서 검사를 건너뛴다. */
    figures: (article.figures || []).length,
    /** 출처는 있는데 기준일이 빈 수치. "숫자에 기준일을 붙인다" 는 약속이 반만 지켜진 것 */
    figuresMissingAsOf: (article.figures || []).filter((f) => !String(f?.asOf || '').trim()).length,
    /**
     * 정보 카드 수 — **실제로 그려질 것만** 센다.
     *
     * `infographic.renderCards` 는 `title` 이 있고 `items` 가 2개 이상인 것만 그린다.
     * 그 조건을 여기서 같이 보지 않으면, 껍데기만 있는 카드로 규격을 통과한 뒤
     * 렌더 단계에서 조용히 사라진다 — 게이트가 거짓말을 하는 셈이다.
     */
    cards: (article.cards || []).filter((c) => String(c?.title || '').trim() && (c?.items || []).length >= 2).length,
    /**
     * 드라마 모드 전용 — **그 회차를 실제로 취재했는가** (src/modes/drama.js:
     * contract.sourcesAfterAirDate). 선언하지 않은 모드는 검사를 건너뛴다.
     *
     * ## 왜 필요했나
     *
     * 회차 리캡은 방송 다음 날 나오는 리캡 보도가 근거다. 그것을 **못 찾았는데도
     * 글이 나온다** — 모델은 방영 전 소개 기사·제작발표회 기사·다른 회차 기사로
     * 그 회차를 구성해 버린다. 형식은 완벽하고 내용만 다른 회차다.
     *
     * > 2026-08-04 실측 — 「사랑이 온다」 4회(8/2 방송):
     * >   실제 4회는 무진의 공사장 사고·한석중의 독촉장·8년 후 8살 아들 한결·
     * >   경찰서 재회(충격 엔딩)였다. 초안은 "규림의 거짓말 뒤에 무진이 남겠다고
     * >   말한다" 를 썼고 **한결이 한 번도 나오지 않았다.**
     * >   sources 6건 중 방송일 이후 기사가 **0건**이었다 — KBS 방영 전 소개,
     * >   첫 방송 기사, 7/28 제작발표회, 프로그램·VOD 페이지가 전부였다.
     * >   그리고 **규격은 전부 통과했다.**
     *
     * 사람이 읽어야 잡히는 종류가 아니다. **방송일 이후 날짜의 출처가 하나도 없다**
     * 는 것은 기계가 셀 수 있다. 그래서 센다.
     *
     * `airDate` 는 스키마가 따로 받는다. 표 안에만 있으면 코드가 읽을 수 없다.
     */
    airDate: String(article.airDate || '').trim(),
    sourcesOnOrAfterAir: countSourcesOnOrAfterAir(article),
    /** `noSpoilerIn` 이 지정한 자리에서 결말 어휘가 걸린 문장들 */
    spoilerLeaks(fields) {
      leaks.length = 0;
      for (const field of fields || []) {
        const vals =
          field === 'keyTakeaways'
            ? article.keyTakeaways || []
            : field === 'directAnswer'
              ? [article.directAnswer]
              : [];
        for (const v of vals) {
          if (SPOILER_WORDS.test(String(v))) leaks.push({ field, text: String(v).slice(0, 70) });
        }
      }
      return leaks;
    },
  };
}

/** 모드의 규격 (선언 없으면 기본값) */
export function contractOf(modeId) {
  return { ...DEFAULT, ...(MODES[modeId]?.contract || {}) };
}

const inRange = (v, [lo, hi]) => v >= lo && v <= hi;

/**
 * 규격에 어긋난 것만 돌려준다. 통과 항목은 조용하다 — 로그가 시끄러우면 아무도 안 읽는다.
 * 각 항목은 `{ level, rule, got, want, note }`.
 */
export function checkContract(article, modeId) {
  const c = contractOf(modeId);
  const m = measure(article);
  const out = [];
  const add = (rule, got, want, note = '') =>
    out.push({ level: BLOCKING.has(rule) ? 'block' : 'warn', rule, got, want, note });

  if (!inRange(m.flowChars, c.chars)) add('chars', m.flowChars, c.chars.join('~') + '자');
  if (!inRange(m.sections, c.sections)) add('sections', m.sections, c.sections.join('~') + '개');
  /* 사진을 **일부러 끈 글**(사용자가 현장 사진을 직접 붙이는 후기 등)에는 사진 규격을
   * 대지 않는다. 그러지 않으면 `--no-images` 를 쓸 때마다 게이트에 막히고,
   * 막히는 것이 일상이 되면 `--force` 습관만 생긴다. */
  const photosOff = !(article.imageBriefs || []).length && article.bodyImageCount === 0;
  if (!photosOff) {
    if (!inRange(m.photos, c.photos)) add('photos', m.photos, c.photos.join('~') + '장');
    if (m.photos && !inRange(m.photoDensity, c.photoDensity)) {
      add('photoDensity', m.photoDensity + '자/장', c.photoDensity.join('~') + '자/장',
        '보이는 글 전부 ÷ 사진 수. 참고 글 실측 249자/장.');
    }
  }
  if (c.captions === 'fact-only' && m.vagueCaptions.length) {
    add('captions', m.vagueCaptions.length + '개', '0개',
      '정지 화면이 보여 줄 수 없는 것을 설명한다 — 예: "' +
        m.vagueCaptions[0].caption.slice(0, 28) + '"');
  }
  if (m.ending.total && m.ending.ratio > c.endingMax) {
    add('endingMax', Math.round(m.ending.ratio * 100) + '%', '≤' + Math.round(c.endingMax * 100) + '%',
      `"…${m.ending.top}." 가 ${m.ending.topCount}/${m.ending.total}`);
  }
  if (c.headingWorkTitle && !inRange(m.headingWorkTitle, c.headingWorkTitle)) {
    add('headingWorkTitle', m.headingWorkTitle + '개', c.headingWorkTitle.join('~') + '개',
      `소제목에 "${m.workTitle}"`);
  }
  if (!inRange(m.tables, c.tables)) add('tables', m.tables, c.tables.join('~') + '개');
  if (!inRange(m.embeds, c.embeds)) add('embeds', m.embeds, c.embeds.join('~') + '개');
  if (!inRange(m.tags, c.tags)) add('tags', m.tags, c.tags.join('~') + '개');
  if (!inRange(m.faq, c.faq)) add('faq', m.faq, c.faq.join('~') + '개');
  /* 수치↔출처 짝 — **이 항목을 선언한 모드에서만** 검사한다 (지금은 경제 모드뿐).
   * 연예·책·영화 모드에는 figures 가 없으므로 c.figures 가 없고, 조용히 건너뛴다. */
  if (c.figures) {
    if (!inRange(m.figures, c.figures)) {
      add('figures', m.figures + '개', c.figures.join('~') + '개',
        '본문 수치마다 출처·기준일을 짝지어야 합니다');
    }
    if (m.figuresMissingAsOf) {
      add('figures', m.figuresMissingAsOf + '개 기준일 없음', '0개',
        '기준일 없는 숫자는 언제 것인지 알 수 없습니다');
    }
  }
  /* 정보 카드 — 이 항목을 선언한 모드에서만 (지금은 경제 모드).
   * 본문 시각 자료가 스톡 사진으로만 채워지는 것을 막는 자리다. */
  if (c.cards && !inRange(m.cards, c.cards)) {
    add('cards', m.cards + '개', c.cards.join('~') + '개',
      '숫자 없이 순서·구조·이유만 담은 정보 카드. 스톡 사진이 정보를 대신하지 못합니다');
  }
  /* **그 회차를 실제로 취재했는가** — 이 항목을 선언한 모드에서만 (지금은 드라마).
   * 방송일 이후에 나온 출처가 하나도 없으면 그 글은 방송을 보지 않고 쓴 글이다.
   * 자세한 실측은 measure 의 sourcesOnOrAfterAir 주석. */
  if (c.sourcesAfterAirDate) {
    if (!m.airDate) {
      add('recapSources', '방송일 없음', 'airDate 필요',
        '방송일이 없으면 취재 여부를 대조할 수 없습니다');
    } else if (m.sourcesOnOrAfterAir < c.sourcesAfterAirDate) {
      add('recapSources', m.sourcesOnOrAfterAir + '건', c.sourcesAfterAirDate + '건 이상',
        `방송일(${m.airDate}) 당일·이후 출처. 방영 전 자료만으로 쓴 회차 리캡입니다`);
    }
  }
  for (const leak of m.spoilerLeaks(c.noSpoilerIn)) {
    add('spoilerLeak', leak.field, '결말 없음', leak.text);
  }
  return { measured: m, violations: out };
}

/**
 * 기계적으로 확실한 것만 고친다.
 *
 * **고치지 않는 것**을 정하는 편이 중요하다:
 * - 소제목의 작품명 초과 → 구절을 다시 써야 한다("해석 — " 만 남는다). 경고로 넘긴다.
 * - 사진 수 초과/부족 → 무엇을 버릴지는 내용 판단이다. 경고로 넘긴다.
 * - 분량 → 글을 쓰는 일이다. 경고로 넘긴다.
 */
export function autoFix(article, modeId) {
  const c = contractOf(modeId);
  const fixed = [];

  const varied = varyEndings(article, { max: c.endingMax });
  if (varied.changed) {
    fixed.push(
      `종결 ${varied.changed}곳을 "~죠" 로 — ` +
        `${Math.round(varied.before.ratio * 100)}% → ${Math.round(varied.after.ratio * 100)}%`
    );
  }

  /* **빈 말 캡션만** 비운다. 지우는 일이라 없는 사실을 만들지 않아 안전하다.
   * 캡션을 **채우는** 것은 검증이 필요해 코드가 할 수 없다.
   * 좋은 캡션까지 지우면 지시문이 쌓아 올린 품질이 헛돈다 — 처음 판이 그랬다. */
  if (c.captions === 'fact-only') {
    let n = 0;
    for (const b of article.imageBriefs || []) {
      if (b.caption && VAGUE_CAPTION.test(b.caption)) {
        b.caption = '';
        n++;
      }
    }
    if (n) fixed.push(`빈 말 캡션 ${n}개를 비움 (분위기·흐름 서술)`);
  }

  return fixed;
}

/**
 * **발행 직전 관문.** 규격에 어긋나면 던진다.
 *
 * 발행 경로가 셋이라(`npm run post` · `npm run queue` 는 `runTopic`,
 * `npm run publish` 는 `cmdPublishFile`) 한 곳에만 두면 **나머지로 새어 나간다.**
 * > 2026-08-01 발각 — 처음에 `cmdPublishFile` 에만 넣었더니 주력 명령인
 * > `npm run post` 가 게이트를 그냥 통과했다.
 *
 * 그래서 검사와 출력을 여기 한 벌만 두고 두 경로가 이것을 부른다.
 */
export function assertContract(article, { force = false, log } = {}) {
  const mode = article.mode || 'topic';
  const { violations, measured: m } = checkContract(article, mode);
  log?.info(
    `규격 대조 [${mode}] — ${m.flowChars}자 · 사진 ${m.photos}장 · ` +
      `${m.photoDensity}자/장 · 종결 ${Math.round(m.ending.ratio * 100)}%`
  );
  for (const line of formatViolations(violations)) {
    (line.startsWith('막음') ? log?.error : log?.warn)?.(line);
  }
  const blocks = violations.filter((v) => v.level === 'block');
  if (!blocks.length) return violations;
  if (force) {
    log?.warn(`--force 로 규격 위반 ${blocks.length}개를 무시하고 발행합니다.`);
    return violations;
  }
  throw new Error(
    `규격에 어긋난 항목 ${blocks.length}개 때문에 발행하지 않았습니다. ` +
      'npm run gate -- <글> --fix 로 기계적 교정을 먼저 하세요. ' +
      '규격 자체가 틀렸다면 src/modes/<모드>.js 의 contract 를 고치고, ' +
      '정말 이대로 내보내려면 --force 를 붙이세요.'
  );
}

/** 사람이 읽을 한 줄들 (cli·게이트가 함께 쓴다) */
export function formatViolations(violations) {
  return violations.map(
    (v) =>
      `${v.level === 'block' ? '막음' : '경고'} · ${v.rule}: ${v.got} (규격 ${v.want})` +
      (v.note ? ` — ${v.note}` : '')
  );
}
