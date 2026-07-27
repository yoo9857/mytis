import { FILES } from './paths.js';
import { log } from './log.js';
import { runCodexJson } from './codexWriter.js';

/**
 * codex 웹 검색으로 최신 기사를 훑어 블로그 소재 후보를 뽑는다.
 * 결과는 topics.txt 에 URL 로 넣어 큐로 돌릴 수 있다.
 */
export async function discoverNews({ cfg, query, count = 5, hours = 24 }) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const q = query || cfg.news?.query || '한국 연예 뉴스';

  const prompt = `당신은 조회수가 잘 나오는 이슈 블로그의 편집장입니다.
오늘 발행할 글의 소재를 고르기 위해 최신 뉴스를 훑는 중입니다.

# 오늘 날짜
${dateStr}

# 찾을 분야
${q}

# 할 일
웹 검색으로 **최근 ${hours}시간 이내**에 보도된 기사 중, 블로그 소재로 쓸 만한 것을 ${count + 4}건 찾으세요.

# 고르는 기준
1. **검색 수요가 생길 사안**: 사람들이 실제로 포털에 검색할 만한 인물·작품·사건.
2. **아직 포화되지 않은 것**: 이미 블로그 글이 수백 개 쏟아진 주제는 heatScore 를 낮게 주세요.
   막 터졌거나, 곧 후속이 나올 사안이 좋습니다.
3. **정리할 거리가 있는 것**: 수치·순위·시간순 경과처럼 표로 만들 수 있는 정보가 있으면 좋습니다.
4. **각도가 나오는 것**: 원 기사에 없는 배경·맥락·비교를 더할 수 있어야 합니다. angle 에 그 각도를 쓰세요.

# 피할 것
- 확인되지 않은 루머, 사생활 추측, 열애설 같은 미확인 사안
- 미성년자 관련 민감 사안
- 판결 전 범죄 사안을 단정적으로 다뤄야 하는 소재
- 특정인을 깎아내리는 것 말고는 쓸 내용이 없는 소재

# 규칙
- url 은 검색으로 실제 확인한 기사 주소만. **절대 지어내지 마세요.**
  확실하지 않으면 그 항목을 빼세요. 개수를 채우는 것보다 정확한 게 중요합니다.
- 같은 사안을 다룬 기사가 여러 개면 가장 원본에 가깝고 내용이 충실한 것 하나만 넣으세요.
- heatScore 가 높은 순으로 정렬해서 반환하세요.

# 출력
파일을 만들지 말고 지정된 JSON 스키마에 맞는 JSON 객체 하나만 최종 응답으로 반환하세요.`;

  log.step(`최신 기사 탐색: ${q} (최근 ${hours}시간)`);

  const result = await runCodexJson({
    prompt,
    schemaFile: FILES.newsfeedSchema,
    cfg,
    search: true,
    timeoutMs: Math.min(cfg.codex.timeoutMs, 600_000),
  });

  const items = (result?.items || [])
    .filter((i) => i && /^https?:\/\//i.test(String(i.url || '')))
    .sort((a, b) => (b.heatScore || 0) - (a.heatScore || 0))
    .slice(0, count);

  if (!items.length) {
    log.warn('쓸 만한 기사를 찾지 못했습니다.');
    return [];
  }

  log.ok(`기사 ${items.length}건 확보`);
  for (const it of items) {
    log.info(`  [${String(it.heatScore ?? '--').padStart(3)}] ${it.title}`);
    log.info(`        ${it.publisher || '?'} · ${it.publishedAt || '시각 미상'}`);
    log.info(`        ${it.url}`);
    if (it.angle) log.info(`        각도: ${it.angle}`);
  }
  return items;
}
