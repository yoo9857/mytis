import fs from 'node:fs';
import path from 'node:path';

const source = path.resolve('out/20260814-장마철-피해-예방법-초안.md');
const target = path.resolve('out/20260814-장마철-주의사항-피해-예방법.json');
const md = fs.readFileSync(source, 'utf8');
const title = md.match(/^#\s+(.+)$/m)?.[1]?.trim() || '장마철 주의사항과 피해 예방법';

const clean = (s) => s
  .replace(/^[-*]\s+/gm, '')
  .replace(/^\d+\.\s+/gm, '')
  .replace(/^\|.*\|$/gm, '')
  .replace(/^---+$/gm, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const chunks = md.split(/^##\s+/m).slice(1);
const sections = chunks
  .filter((chunk) => !chunk.startsWith('자주 묻는 질문') && !chunk.startsWith('마무리'))
  .map((chunk) => {
    const [heading, ...rest] = chunk.split('\n');
    const body = clean(rest.join('\n'));
    const paragraphs = body.split(/\n\n+/).filter((p) => p && !p.startsWith('#'));
    return {
      heading: heading.trim(),
      answer: '',
      paragraphs,
      bullets: [],
      table: { caption: '', headers: [], rows: [] },
      callout: '',
    };
  });

const article = {
  topic: '경제: 장마철 주의사항과 피해 예방법',
  sourceUrl: '',
  title,
  seoTitle: '장마철 주의사항 총정리, 집·차량 침수와 감전·식중독 예방법',
  metaDescription: '장마철 주택과 차량 침수, 지하차도, 감전, 식중독, 곰팡이 예방법과 보험 접수 전 꼭 남겨야 할 증빙 자료를 한 번에 정리했습니다.',
  urlSlug: 'rainy-season-flood-safety-insurance-checklist',
  primaryKeyword: '장마철 주의사항',
  entities: [],
  secondaryKeywords: ['장마철 예방', '침수 피해 예방', '침수차 보험', '호우 행동요령', '감전 사고 예방', '식중독 예방', '풍수해보험'],
  tags: ['장마철주의사항', '장마철예방', '침수피해', '침수차', '호우행동요령', '감전사고예방', '식중독예방', '곰팡이제거', '자동차보험', '풍수해보험'],
  angle: '', place: '', spoiler: false, asOf: '2026-08-14', airDate: '', figures: [], cards: [], checkSites: [], relatedPosts: [],
  directAnswer: '장마철 피해를 줄이려면 비가 오기 전 배수구와 누수 지점, 지하차도 우회 경로, 보험 담보를 확인해야 합니다. 침수 도로에는 진입하지 말고, 이미 물이 찬 차량과 가전제품은 작동하지 마세요. 피해 직후에는 청소보다 사진·영상·영수증 확보가 먼저입니다.',
  keyTakeaways: [
    '지하차도와 침수 도로에 물이 차면 진입하지 않는다.',
    '침수된 차량은 시동과 전장 장치 작동을 피한다.',
    '분전함 주변이 젖었다면 직접 접근하지 않는다.',
    '침수수에 닿았거나 변질이 의심되는 식품은 먹지 않는다.',
    '복구 전 피해 범위와 물 높이, 제품 정보를 촬영한다.',
    '보상 여부는 담보·약관·사고 경위에 따라 달라지므로 보험사에 확인한다.'
  ],
  sections,
  faq: [
    { question: '침수된 차는 시동만 안 걸면 되나요?', answer: '전장 장치도 작동하지 말고 안전한 곳으로 대피한 뒤 보험사와 견인 업체에 연락하세요.' },
    { question: '전기 차단기는 무조건 직접 내려야 하나요?', answer: '분전함 주변이 젖었거나 이미 물이 차올랐다면 접근하지 마세요. 전기 차단보다 안전한 대피가 먼저입니다.' },
    { question: '침수 피해 사진은 어떻게 남겨야 하나요?', answer: '전체 상황과 손상 부위, 물이 찬 높이, 제품 정보가 보이게 사진과 영상을 남기고 발생 시각과 장소도 기록하세요.' },
    { question: '정전된 냉장고 식품은 다 버려야 하나요?', answer: '정전 시간·내부 온도·식품 종류에 따라 달라집니다. 침수수에 닿았거나 변질이 의심되는 식품은 먹지 마세요.' },
    { question: '자동차보험으로 침수 피해가 모두 보상되나요?', answer: '자기차량손해 담보 가입 여부와 약관, 사고 경위에 따라 달라집니다. 증권을 확인하고 보험사에 사고 상황을 그대로 알려 확인하세요.' }
  ],
  conclusion: '장마철 사고는 짧은 시간에 생기지만 복구와 보상에는 오랜 시간과 비용이 듭니다. 비가 오기 전 배수구·우회 경로·보험 담보를 확인하고, 호우 중에는 재산보다 안전한 대피를 먼저 선택하세요. 피해가 발생했다면 복구 전 증거를 충분히 남기고 보험사와 관할 기관에 접수하는 것이 추가 피해를 줄이는 방법입니다.',
  sources: [
    { title: '호우 국민행동요령', url: 'https://www.safekorea.go.kr/', publisher: '국민안전처', date: '2026-08-14' },
    { title: '식중독 예방 정보', url: 'https://www.foodsafetykorea.go.kr/', publisher: '식품안전나라', date: '2026-08-14' },
    { title: '보험 상품·약관 확인', url: 'https://fine.fss.or.kr/', publisher: '금융감독원 파인', date: '2026-08-14' }
  ],
  embeds: [],
  imageBriefs: [
    { placement: 'thumbnail', headline: '장마철 피해 막는 법', subline: '침수·감전·보험 체크리스트', caption: '', alt: '장마철 주의사항과 피해 예방법', afterSection: 0, photoQuery: 'heavy rain city street safety', eyebrow: '생활비 방어', statValue: '', statLabel: '' },
    { placement: 'body', headline: '비 오기 전 5분 점검', subline: '배수구·누수·중요 물품', caption: '', alt: '장마 전 집 배수구 점검', afterSection: 0, photoQuery: 'home drain cleaning rain', eyebrow: '주택 점검', statValue: '5분', statLabel: '사전 점검' },
    { placement: 'body', headline: '지하차도 진입 금지', subline: '물이 보이면 즉시 우회', caption: '', alt: '침수 도로와 지하차도 진입 금지', afterSection: 1, photoQuery: 'flooded road warning barrier', eyebrow: '호우 행동요령', statValue: '', statLabel: '' },
    { placement: 'body', headline: '침수차 재시동 금지', subline: '촬영 후 보험사·견인 연락', caption: '', alt: '침수 차량 재시동 금지와 보험 접수', afterSection: 2, photoQuery: 'car flooded street rain', eyebrow: '차량 침수', statValue: '', statLabel: '' },
    { placement: 'body', headline: '젖은 분전함 접근 금지', subline: '전기 차단보다 안전한 대피 먼저', caption: '', alt: '장마철 감전 사고 예방', afterSection: 3, photoQuery: 'electrical safety water warning', eyebrow: '감전 예방', statValue: '', statLabel: '' },
    { placement: 'body', headline: '청소 전 증거부터', subline: '사진·영상·영수증 보관', caption: '', alt: '침수 피해 보험 접수 증빙 자료', afterSection: 5, photoQuery: 'insurance documents smartphone photo', eyebrow: '보험 접수', statValue: '3가지', statLabel: '필수 증빙' }
  ],
  generatedAt: new Date().toISOString(),
  mode: 'econ',
  bodyImageCount: 5,
  socialEmbeds: []
};

article.charCount = JSON.stringify(article.sections).length;
fs.writeFileSync(target, `${JSON.stringify(article, null, 2)}\n`);
console.log(target);
