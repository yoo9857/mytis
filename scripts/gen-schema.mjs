/**
 * 모드 스키마 생성기 — **형태는 공유하고 설명만 모드가 갖는다.**
 *
 * ## 왜 필요했나
 *
 * `movie.schema.json` 을 `book.schema.json` 에서 손으로 복제했더니 "이 책이 무엇이고",
 * "표지·저자명" 같은 **다른 모드 어휘가 3곳** 남았다 (§7-5 ②). 스키마는 350줄이라
 * 눈으로 훑어 잡히지 않는다. 그래서 §8-7 이 "손으로 복제하지 말 것 — 생성기를
 * 먼저 만드는 것이 낫다" 고 적어 두었다.
 *
 * ## 무엇을 공유하나
 *
 * 실측(2026-08-04, 기존 스키마 4종 대조): 공통 속성 15개 중 **거의 전부가 모드별로
 * 설명이 다르다.** 반대로 `sections`·`faq`·`sources`·`entities`·`embeds` 의
 * **형태(타입·중첩·required)는 네 모드가 완전히 동일**했다.
 *
 * 그래서 공유하는 것은 문구가 아니라 **형태**다. 설명은 모드가 100% 갖는다 —
 * 공유하려 들면 그것이 바로 "다른 모드 어휘" 사고의 재발이다.
 *
 * ## 기존 스키마 4종은 다시 만들지 않는다
 *
 * 이 생성기로 `article`·`book`·`econ`·`movie` 를 재생성하면 문구가 미세하게 바뀌고
 * **모델 거동이 함께 바뀐다.** 발행 실측으로 뽑은 규격이 그 문구 위에 서 있다.
 * 새 모드만 여기서 만든다. 옮기는 것은 별개 작업이다.
 *
 *   node scripts/gen-schema.mjs drama       # src/schema/drama.schema.json 을 쓴다
 *   node scripts/gen-schema.mjs drama --check   # 쓰지 않고 현재 파일과 대조만
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = path.join(HERE, '..', 'src', 'schema');

/* ── 형태(SHAPES) — 모드가 바꾸지 않는다 ──────────────────────────────── */

const str = { type: 'string' };
const strArr = { type: 'array', items: { type: 'string' } };

/** 설명만 갈아 끼우는 배열 항목 — `obj(required, props)` */
const obj = (required, properties) => ({
  type: 'object',
  additionalProperties: false,
  required,
  properties,
});

const SHAPES = {
  entities: (d) => ({
    type: 'array',
    description: d,
    items: obj(['nameKo', 'nameEn', 'role', 'historical'], {
      nameKo: str,
      nameEn: str,
      role: str,
      historical: { type: 'boolean' },
    }),
  }),
  sections: (d) => ({
    type: 'array',
    description: d,
    items: obj(['heading', 'paragraphs', 'bullets', 'table', 'callout'], {
      heading: str,
      paragraphs: strArr,
      bullets: strArr,
      table: obj(['caption', 'headers', 'rows'], {
        caption: str,
        headers: strArr,
        rows: { type: 'array', items: strArr },
      }),
      callout: str,
    }),
  }),
  faq: (d) => ({
    type: 'array',
    description: d,
    items: obj(['question', 'answer'], { question: str, answer: str }),
  }),
  sources: (d) => ({
    type: 'array',
    description: d,
    items: obj(['title', 'url', 'publisher', 'date'], {
      title: str,
      url: str,
      publisher: str,
      date: str,
    }),
  }),
  /* `speaker`·`isStudio`·`isHook` 은 영상 모드의 장면 판정에 쓰인다.
   * 세 필드가 `normalizeArticle` 에서 버려져 경로 3개가 죽어 있었다 (§7-15 넷째).
   * 새 모드가 embeds 를 켤 때도 required 는 그대로 둔다 — 모델이 채우는 값이
   * 코드에 닿는지는 `doctor` 가 아니라 사람이 확인해야 한다. */
  embeds: (d) => ({
    type: 'array',
    description: d,
    items: obj(
      ['videoId', 'title', 'channel', 'afterSection', 'startSeconds', 'quote', 'caption', 'speaker', 'isStudio', 'isHook'],
      {
        videoId: str,
        title: str,
        channel: str,
        afterSection: { type: 'integer' },
        startSeconds: { type: 'integer' },
        quote: str,
        caption: str,
        speaker: str,
        isStudio: { type: 'boolean' },
        isHook: { type: 'boolean' },
      }
    ),
  }),
  imageBriefs: (d) => ({
    type: 'array',
    description: d,
    items: obj(
      ['placement', 'headline', 'subline', 'caption', 'alt', 'afterSection', 'photoQuery', 'eyebrow', 'statValue', 'statLabel'],
      {
        placement: { type: 'string', enum: ['thumbnail', 'body'] },
        headline: str,
        subline: str,
        eyebrow: str,
        statValue: str,
        statLabel: str,
        photoQuery: str,
        caption: str,
        alt: str,
        afterSection: { type: 'integer' },
      }
    ),
  }),
};

/** 문자열 하나로 끝나는 속성 (설명만 모드가 준다) */
const PLAIN = ['title', 'seoTitle', 'metaDescription', 'primaryKeyword', 'urlSlug', 'directAnswer', 'conclusion'];
/** 문자열 배열 속성 */
const PLAIN_ARR = ['secondaryKeywords', 'tags', 'keyTakeaways'];

/** 아티클 스키마의 속성 순서 — article.schema.json 실측 순서를 따른다 */
const ORDER = [
  'title', 'seoTitle', 'metaDescription', 'primaryKeyword', 'urlSlug', 'entities',
  'secondaryKeywords', 'tags', 'directAnswer', 'keyTakeaways', 'sections', 'faq',
  'conclusion', 'sources', 'embeds', 'imageBriefs',
];

/**
 * 스키마 하나를 만든다.
 * @param {object} spec
 * @param {Record<string,string>} spec.docs   속성 이름 → 설명. **전부 채워야 한다.**
 * @param {string[]} [spec.omit]              빼는 속성 (예: embeds 를 안 쓰는 모드)
 */
function build({ docs, omit = [] }) {
  const use = ORDER.filter((k) => !omit.includes(k));

  const missing = use.filter((k) => !String(docs[k] || '').trim());
  if (missing.length) {
    throw new Error(`설명이 빠진 속성: ${missing.join(', ')} — 모드가 100% 채워야 합니다`);
  }
  const unknown = Object.keys(docs).filter((k) => !ORDER.includes(k));
  if (unknown.length) {
    throw new Error(`모르는 속성에 설명이 있습니다: ${unknown.join(', ')}`);
  }

  const properties = {};
  for (const k of use) {
    if (PLAIN.includes(k)) properties[k] = { type: 'string', description: docs[k] };
    else if (PLAIN_ARR.includes(k)) properties[k] = { type: 'array', description: docs[k], items: { type: 'string' } };
    else properties[k] = SHAPES[k](docs[k]);
  }
  return { type: 'object', additionalProperties: false, required: use.slice(), properties };
}

/* ── 모드별 설명 ─────────────────────────────────────────────────────── */

/**
 * 드라마 회차 리캡 (`src/modes/drama.js`).
 *
 * 성격: 입력이 **작품명 + 회차**다. 자막이 없으므로 방영 정보·보도·공식 예고를
 * 취재해서 쓴다. 회차 리캡은 그 회차를 다 말하는 글이라 **스포일러가 전제**다.
 *
 * ⚠️ 영상(clip) 모드와 헷갈리지 말 것. 영상 모드는 유튜브 자막에서 장면을 뽑고,
 * 자동 자막이 인물 이름을 틀리게 받아써 **배우와 극중 인물이 섞이는 사고**가 났다
 * (§7-15). 드라마 모드는 그래서 자막을 근거로 삼지 않는다 — 출연진 표를 취재한다.
 */
const DRAMA = {
  omit: [],
  docs: {
    title:
      '글 제목. 형식: "<작품명> <N>회 줄거리 결말" 뒤에 이 회차의 축을 한 구절 붙인다. ' +
      '예: "○○ 12회 줄거리 결말, 8년 만의 재회가 뒤집은 것". 32자 내외. ' +
      '배우 이름을 극중 인물 이름 자리에 쓰지 않는다.',
    seoTitle:
      '검색엔진용 제목. 60자 이내. "<작품명> <N>회 줄거리 결말 <방송일> <방송사>" 처럼 ' +
      '검색어를 나열한다. 회차 번호를 반드시 넣는다 — 회차 리캡의 검색은 회차 단위로 일어난다.',
    metaDescription:
      '검색 결과 스니펫용 요약. 90~150자. 작품명·회차·방송일과 이 회차에서 벌어진 일의 ' +
      '결과를 담는다. "정리했다" 로 닫는다.',
    primaryKeyword: '이 글이 노리는 메인 검색 키워드 하나. "<작품명> <N>회" 형태가 기본이다.',
    urlSlug:
      "글 주소에 쓸 영문 슬러그. 소문자 영문·숫자·하이픈만. 3~6단어, 60자 이내. " +
      "작품 로마자 표기 + 회차 + ep 를 넣는다. 예: 'love-comes-episode-12-recap'",
    entities:
      '이 회차에 나온 **극중 인물**과 그 배우. nameKo 에는 **극중 이름**을 쓰고, role 에 ' +
      '"극중 인물 (배우 <배우명>)" 형태로 배우를 밝힌다. ' +
      '⚠️ nameKo 에 배우 이름을 쓰면 실존 인물이 하지 않은 일을 그 사람 이름으로 쓰게 된다 ' +
      '(2026-08-04 사고: 배우 안희연을 극중 인물로 적고 극중 사건을 그 이름에 붙였다). ' +
      '첫 번째 항목은 이 회차의 중심 인물이다. 확인하지 못한 이름은 넣지 않는다.',
    secondaryKeywords:
      '보조 키워드 및 롱테일 질의 5~10개. "<작품명> <N>회 다시보기", "<작품명> <극중이름>", ' +
      '"<작품명> 몇부작", "<작품명> 편성" 처럼 독자가 실제로 치는 형태로.',
    tags:
      '티스토리 태그 10~12개. 쉼표를 포함하지 않는다. 작품명·회차·방송사·극중 인물 이름을 ' +
      '섞고, 배우 이름도 넣는다(검색은 배우 이름으로도 일어난다). ' +
      '편성 형태를 태그로 쓸 때는 확인한 것만 쓴다 — 주말드라마를 일일드라마로 쓰면 틀린 태그다.',
    directAnswer:
      '이 회차에서 무엇이 일어났는지 2~4문장으로 즉시 답한다. 방송일과 회차를 밝히고, ' +
      '이 회차의 결과(관계가 어떻게 바뀌었나)를 결론까지 쓴다. 다음 회 예고는 여기 쓰지 않는다.',
    keyTakeaways:
      'GEO(생성형 검색)용 사실 요약 4~6개. 각 항목은 단독으로 인용 가능한 완결 문장이어야 한다. ' +
      '방송사·방송일·회차·편성처럼 **확인된 사실**을 넣고, 해석은 넣지 않는다. ' +
      '극중 사건은 극중 이름으로 쓴다.',
    sections:
      '본문 섹션 목록 6~8개. 각 섹션은 h2 하나에 해당한다. ' +
      '순서: 이 회차의 문을 여는 장면 → 방영 정보(표) → 줄거리 → 이 회차의 결정적 장면 → ' +
      '인물 관계의 변화 → 다음 회 예고 → 정리. ' +
      '소제목마다 **작품명과 회차를 넣는다** — "○○ 12회 줄거리" 가 독자가 치는 검색어다. ' +
      '표는 방영 정보(방송사·편성·회차·시청률)에만 쓴다.',
    faq: '자주 묻는 질문 5개. 실제 검색 질의처럼 쓰고("<작품명> <N>회 결말", "<작품명> 몇부작", ' +
      '"<작품명> 다음 회 언제"), 답변은 2~4문장으로 완결한다. 극중 이름으로 답한다.',
    conclusion:
      '마무리 3~5문장. 이 회차가 관계를 어디로 옮겼는지 정리하고, 다음 회에서 확인할 것을 한 줄 남긴다. ' +
      '시청률 예측이나 작품 평점 단정은 쓰지 않는다.',
    sources:
      '웹 검색으로 실제 확인한 출처만 넣는다. **출연진 표와 편성은 반드시 확인**한다 — ' +
      '방송사 공식 페이지, 위키백과, 리캡 보도를 쓴다. ' +
      '극중 이름과 배우 이름의 짝은 여기서 확인한 것만 본문에 쓴다. URL을 지어내지 않는다.',
    embeds:
      '방송사 **공식** 예고·하이라이트 영상 1~3개. 채널이 그 방송사 공식 채널인 것만 넣는다. ' +
      '제목에 작품명이 없으면 넣지 않는다. speaker·isStudio·isHook 은 이 모드에서 쓰지 않으므로 ' +
      'speaker 는 빈 문자열, isStudio·isHook 은 false 로 둔다.',
    imageBriefs:
      '이미지 브리프. 대표 1개(placement "thumbnail") + 본문 이미지. ' +
      'statValue / statLabel 은 항상 빈 문자열로 둔다 — 회차 리캡에 수치 카드는 맞지 않는다. ' +
      'caption 은 화면에서 확인한 사실만 쓴다. 방송 스틸이 없는 자리는 photoQuery 에 ' +
      '작품의 분위기를 나타내는 영어 장면어를 쓴다.',
  },
};

const SPECS = { drama: DRAMA };

/* ── 실행 ────────────────────────────────────────────────────────────── */

const [id, ...flags] = process.argv.slice(2);
if (!id || !SPECS[id]) {
  console.error(`사용법: node scripts/gen-schema.mjs <${Object.keys(SPECS).join('|')}> [--check]`);
  process.exit(1);
}

const schema = build(SPECS[id]);
const out = JSON.stringify(schema, null, 2) + '\n';
const file = path.join(SCHEMA_DIR, `${id}.schema.json`);

if (flags.includes('--check')) {
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (cur === out) console.log(`같습니다: ${id}.schema.json`);
  else {
    console.error(`다릅니다: ${id}.schema.json — node scripts/gen-schema.mjs ${id} 로 다시 쓰세요`);
    process.exit(1);
  }
} else {
  fs.writeFileSync(file, out, 'utf8');
  console.log(`썼습니다: src/schema/${id}.schema.json (속성 ${schema.required.length}개)`);
}
