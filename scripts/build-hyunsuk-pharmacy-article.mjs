import fs from 'node:fs';
import path from 'node:path';

const outFile = path.resolve('out/20260825-24기-현숙-건대-약국-개국.json');
const emptyTable = () => ({ caption: '', headers: [], rows: [] });

const sourceUrl = 'https://blog.naver.com/happytigers/224389062450';
const sourceImage = 'https://mblogthumb-phinf.pstatic.net/MjAyNjA4MjRfMjcg/MDAxNzg3NTgzNDg0MDA0.sWuDSS--fv71cvSRB-i9q0iKVoObohvgYaNM0o-oIeQg.EiuqL4UHYe9E8OLKsfR8_RVNc3TVrz_AoOh8TAzZHZYg.JPEG/02.jpg?type=w800';
const sourceImages = [
  'https://image.xportsnews.com/contents/images/upload/article/2025/0227/1740633594453469.jpg',
  'https://image.xportsnews.com/contents/images/upload/article/2025/0227/1740633715901469.jpg',
  'https://image.xportsnews.com/contents/images/upload/article/2025/0227/1740633745628721.jpg',
  'https://photo.newsen.com/news_photo/2025/01/09/202501090613241710_1.jpg',
];

const origins = {
  [sourceImage]: { publisher: '네이버 블로그 | 한방오리의 2030 문과생 인생역전', pageUrl: sourceUrl },
  [sourceImages[0]]: { publisher: '엑스포츠뉴스', pageUrl: 'https://www.xportsnews.com/article/1967064' },
  [sourceImages[1]]: { publisher: '엑스포츠뉴스', pageUrl: 'https://www.xportsnews.com/article/1967064' },
  [sourceImages[2]]: { publisher: '엑스포츠뉴스', pageUrl: 'https://www.xportsnews.com/article/1967064' },
  [sourceImages[3]]: { publisher: '뉴스엔', pageUrl: 'https://www.newsen.com/news_view.php?uid=202501090613241710' },
};

const article = {
  topic: sourceUrl,
  sourceUrl,
  title: '나솔 24기 현숙, 건대 약국 개국과 17시간 영업의 의미',
  seoTitle: '나솔 24기 현숙 건대 약국 개국, 365일 17시간 영업 정리',
  metaDescription: '나는 솔로 24기 현숙이 장성의 페이약사에서 서울 건대 인근 개국약사로 옮긴 과정과 오전 8시부터 새벽 1시까지라는 약국 영업시간의 정확한 의미를 정리했습니다.',
  urlSlug: 'solo-24-hyunsuk-konkuk-pharmacy',
  primaryKeyword: '나솔 24기 현숙 약국',
  entities: [
    { nameKo: '나는 SOLO 24기 현숙', nameEn: '', role: '방송 출연자·약사', historical: false },
  ],
  secondaryKeywords: ['24기 현숙 건대 약국', '나솔사계 24기 현숙', '24기 현숙 직업', '24기 현숙 근황', '건대 심야 약국', '현숙 약국 영업시간', '페이약사 개국약사'],
  tags: ['24기현숙', '나솔24기현숙', '현숙약국', '건대약국', '건대입구약국', '나솔사계', '나는솔로', '약국개국', '심야약국', '연예뉴스'],
  angle: '방송에서 공개된 개국 사실과 약국 안내 영업시간을 구분해, 장성 페이약사에서 서울 개국약사로 바뀐 근황을 과장 없이 정리한다.',
  place: '서울 건대입구 인근',
  spoiler: false,
  asOf: '2026-08-25',
  airDate: '2026-08-06',
  figures: [],
  cards: [],
  checkSites: [],
  relatedPosts: [],
  directAnswer: '24기 현숙은 서울 건대입구 인근에서 개인 약국을 운영합니다. 안내 시간은 오전 8시부터 새벽 1시까지, 하루 17시간이며 365일 운영을 표방합니다. 다만 이는 매장 영업시간으로, 현숙 개인이 매일 17시간 근무한다는 뜻은 아닙니다.',
  keyTakeaways: [
    '24기 현숙은 2026년 8월 방송에서 서울로 이사해 혼자 지내며 개인 약국을 운영한다고 밝혔다.',
    '소재 글이 확인한 약국 안내 영업시간은 오전 8시부터 새벽 1시까지로 하루 17시간이다.',
    '365일 운영 표시는 약국의 운영 방침이며 현숙 개인의 실제 근무표는 공개되지 않았다.',
    '24기 출연 당시 장성에서 일하던 페이약사였던 현숙은 이후 서울의 개국약사로 업무 형태를 바꿨다.',
  ],
  sections: [
    {
      heading: '24기 현숙 건대 약국, 방송에서 확인된 근황',
      answer: '',
      paragraphs: [
        '24기 현숙의 가장 큰 변화는 근무지가 아니라 일하는 방식입니다. 2026년 8월 6일 방송된 ‘나는 SOLO, 그 후 사랑은 계속된다’에서 그는 서울로 올라와 혼자 지내고 있으며 개인 약국을 열어 운영 중이라고 밝혔습니다. 조선비즈가 다음 날 전한 방송 내용에서도 같은 사실이 확인됩니다.',
        '약국 개업 자체는 방송 복귀보다 앞서 알려졌습니다. 2026년 3월 보도에는 24기 동료 출연자가 약국을 방문한 모습과 개업 소식이 소개됐습니다. 따라서 이번 방송은 갑자기 생긴 계획의 발표라기보다 이미 시작한 일을 본인이 다시 설명한 장면에 가깝습니다.',
        '소재 글은 위치를 건대 앞이라고 정리했습니다. 이 글에서는 출연자의 근황을 설명하는 데 필요한 지역 단위까지만 다루고 약국 상호나 상세 주소는 적지 않습니다. 방송 출연자의 일터가 알려졌더라도 개인적인 방문을 부추길 이유는 없기 때문입니다.',
      ],
      bullets: ['2026년 8월 방송에서 서울 거주와 개인 약국 운영 공개', '2026년 3월에도 약국 개업 관련 보도 등장', '상호·상세 주소·매출·인력 정보는 이 글에서 제외'],
      table: emptyTable(),
      callout: '공개된 근황과 사적인 일터 방문은 다른 문제입니다. 약국의 구체 주소나 상호는 다루지 않습니다.',
    },
    {
      heading: '오전 8시부터 새벽 1시, 숫자로 보면 하루 17시간',
      answer: '',
      paragraphs: [
        '소재 글에 소개된 약국 안내 시간은 오전 8시부터 다음 날 새벽 1시까지입니다. 시작과 종료 시각의 차이는 17시간입니다. 여기에 365일 운영 문구가 붙으면서 일반적인 주간 영업 약국과 다른 인상이 만들어졌습니다.',
        '건대입구 일대는 대학가와 상업시설, 늦은 시간까지 움직이는 유동인구가 겹치는 지역입니다. 이 위치에서 심야 시간까지 문을 연다는 것은 낮 시간뿐 아니라 퇴근 후나 야간에 약이 필요한 이용자까지 운영 대상으로 삼았다는 뜻으로 읽을 수 있습니다.',
        '다만 영업시간과 약사 개인의 근무시간은 구분해야 합니다. 교대 인력이나 휴무 방식은 공개 자료에서 확인되지 않았습니다. ‘365일 17시간 영업’은 약국 운영 정보를 요약한 표현이고, 현숙이 혼자 하루도 쉬지 않고 일한다고 단정할 근거는 없습니다.',
      ],
      bullets: [],
      table: {
        caption: '공개된 약국 운영 정보와 해석 범위',
        headers: ['항목', '확인된 내용', '단정할 수 없는 내용'],
        rows: [
          ['영업시간', '오전 8시~새벽 1시', '현숙 개인의 실제 출퇴근 시각'],
          ['운영일', '365일 운영 안내', '개인 휴무 여부와 교대 방식'],
          ['지역', '건대입구 인근', '매출·방문객·상권 성과'],
        ],
      },
      callout: '매장 운영시간 17시간을 곧바로 한 사람의 노동시간 17시간으로 바꾸어 읽으면 사실이 달라집니다.',
    },
    {
      heading: '장성 페이약사에서 서울 개국약사로',
      answer: '',
      paragraphs: [
        '24기 방송 당시 현숙은 전남 장성의 병원 안 약국에서 일하는 약사로 소개됐습니다. 이번 근황에서는 서울에서 본인 약국을 운영하는 개국약사로 바뀌었습니다. 같은 약사 면허를 기반으로 하지만 고용된 근무자에서 사업 운영 책임자로 역할이 달라진 셈입니다.',
        '장성에서 서울 건대입구 인근으로 옮긴 것도 생활 기반의 변화입니다. 방송에서 그는 서울에 올라와 혼자 산다고 설명했습니다. 지역 이동과 개업, 독립이 비슷한 시기에 맞물리며 24기 때와는 전혀 다른 생활 리듬이 만들어졌습니다.',
      ],
      bullets: [],
      table: emptyTable(),
      callout: '',
    },
    {
      heading: '과거 ‘돈 욕심’ 이미지와 지금의 개업을 같이 보면',
      answer: '',
      paragraphs: [
        '24기 방송에서는 일과 수입에 관한 대화가 현숙의 이미지에 큰 영향을 줬습니다. 상대 출연자와 개원 및 소득을 두고 의견이 엇갈리면서, 짧은 대화가 ‘돈을 중요하게 보는 사람’이라는 인상으로 압축됐습니다.',
        '현숙은 2025년 2월 방송 후 인터뷰에서 자신이 돈에만 몰두하는 사람처럼 비친 부분을 해명했습니다. 가족과 보내는 시간 역시 중요하며, 약국 일은 가족과 시간을 보내는 방식과 수입이 함께 따라오는 일이라는 취지였습니다.',
        '현재 공개된 사실만 놓고 보면 현숙은 당시 대화에서 꺼냈던 개업 가능성을 현실로 옮겼습니다. 그 동기를 돈 하나로 좁히거나, 긴 영업시간을 성격 평가의 근거로 사용하는 것은 확인된 범위를 넘어섭니다.',
      ],
      bullets: [],
      table: emptyTable(),
      callout: '방송 편집으로 형성된 인상보다 당사자가 공개한 설명과 이후 확인된 행동을 나란히 보는 편이 정확합니다.',
    },
    {
      heading: '나솔사계 복귀에서 달라진 모습',
      answer: '',
      paragraphs: [
        '나솔사계 복귀 장면에서 현숙은 서울 독립 이후 달라진 옷차림도 언급했습니다. 24기 때의 단정한 이미지가 부모의 조언을 반영한 결과였다는 설명과 함께, 이번에는 자신의 취향이 더 드러난 모습으로 등장했습니다.',
        '일에서도 비슷한 변화가 보입니다. 이전에는 병원 안 약국의 근무 약사였지만 지금은 영업시간과 운영 방향을 정하는 위치에 섰습니다. 외형의 변화와 직업 형태의 변화가 모두 ‘스스로 선택하는 범위가 넓어졌다’는 한 축으로 이어집니다.',
      ],
      bullets: [],
      table: emptyTable(),
      callout: '',
    },
    {
      heading: '24기 현숙 약국 근황, 어디까지 사실로 볼까',
      answer: '',
      paragraphs: [
        '확실한 결론은 네 가지입니다. 현숙은 서울로 거처를 옮겼고, 건대입구 인근에 개인 약국을 열었으며, 방송에서 운영 사실을 직접 밝혔습니다. 소재 글이 확인한 안내 시간은 오전 8시부터 새벽 1시까지이고 365일 운영을 표방합니다.',
        '반대로 확인되지 않은 것도 분명합니다. 현숙 개인이 매일 17시간 일하는지, 몇 명이 교대하는지, 약국 매출이 얼마인지, 방송 인지도가 실제 영업에 어느 정도 영향을 줬는지는 공개 자료만으로 알 수 없습니다.',
        '따라서 ‘충격 영업시간’이라는 제목을 읽을 때는 숫자와 사람을 분리해야 합니다. 17시간은 약국이 문을 여는 시간이고, 개인의 노동시간이나 삶의 만족도를 뜻하는 수치가 아닙니다.',
      ],
      bullets: ['확인: 서울 이주와 개인 약국 운영', '확인: 건대입구 인근, 오전 8시~새벽 1시 안내', '미확인: 개인 근무표·직원 수·매출·방송 효과'],
      table: emptyTable(),
      callout: '영업시간은 확인하되 개인의 근무시간과 수입은 추정하지 않는 것이 이번 근황을 읽는 기준입니다.',
    },
  ],
  faq: [
    { question: '나솔 24기 현숙의 직업은 무엇인가요?', answer: '약사입니다. 24기 출연 당시에는 전남 장성의 병원 안 약국에서 근무하는 것으로 소개됐고, 현재는 서울 건대입구 인근에서 개인 약국을 운영한다고 밝혔습니다.' },
    { question: '24기 현숙 약국 영업시간은 몇 시까지인가요?', answer: '소재 글이 소개한 안내 기준으로 오전 8시부터 다음 날 새벽 1시까지입니다. 하루 17시간에 해당하며 365일 운영을 표방하지만, 방문 전에는 실제 영업 여부를 별도로 확인할 필요가 있습니다.' },
    { question: '24기 현숙이 매일 17시간 혼자 근무하나요?', answer: '그렇게 확인된 바는 없습니다. 17시간은 약국의 영업시간이며 현숙 개인의 근무표, 교대 인력, 휴무 방식은 공개되지 않았습니다.' },
    { question: '24기 현숙은 왜 서울로 올라왔나요?', answer: '방송에서 서울로 이사해 혼자 지내고 개인 약국을 운영한다는 근황은 밝혔지만, 이주의 모든 이유를 구체적으로 공개한 것은 아닙니다. 개업과 서울 생활이 함께 시작됐다는 정도로 보는 것이 안전합니다.' },
    { question: '24기 현숙 약국의 정확한 위치와 상호는 어디인가요?', answer: '이 글은 출연자의 일터에 불필요한 방문을 유도하지 않기 위해 건대입구 인근이라는 공개된 지역 정보만 다룹니다. 상호와 상세 주소는 싣지 않습니다.' },
  ],
  conclusion: '나솔 24기 현숙은 장성의 페이약사에서 서울의 개국약사로 옮겼습니다. 약국은 오전 8시부터 새벽 1시까지 365일 운영을 안내합니다. 그러나 17시간을 현숙 개인의 근무시간이나 수입으로 해석할 근거는 없습니다. 핵심은 자신의 일의 구조를 직접 선택하는 위치로 이동했다는 점입니다.',
  sources: [
    { title: '1년 6개월 만에 건대 개국, 나솔 24기 현숙 영업시간 충격', url: sourceUrl, publisher: '네이버 블로그 | 한방오리의 2030 문과생 인생역전', date: '2026-08-25' },
    { title: '\'43년째 모솔\' 7기 옥순→"약국 개업" 24기 현숙…\'나솔사계\', 솔로남녀 12인 공개', url: 'https://biz.chosun.com/entertainment/tv/2026/08/07/GE3DANTGGFTDINBRGQ2WGZRXGQ/?outputType=amp', publisher: '조선비즈', date: '2026-08-07' },
    { title: '\'나솔\' 24기 현숙, 약국 개업…"실물이 더 예뻐" 후기 등장', url: 'https://news.nate.com/view/20260317n17650', publisher: '티브이데일리·네이트뉴스', date: '2026-03-17' },
    { title: '24기 약사 현숙 해명 "돈에 그렇게 미쳐있지 않아, 얘기 안 하는 거로"', url: 'https://www.xportsnews.com/article/1967064', publisher: '엑스포츠뉴스', date: '2025-02-27' },
    { title: '24기 현숙 “약사 수입 만족 안 돼 부업, 자식 많이 낳고파”', url: 'https://www.newsen.com/news_view.php?uid=202501090613241710', publisher: '뉴스엔', date: '2025-01-09' },
    { title: '나솔사계 24기 현숙 근황 정리, 건대 약국 위치와 솔직한 솔로민박 출사표', url: 'https://write.daplus.co.kr/content/entertainment/%EB%82%98%EC%86%94%EC%82%AC%EA%B3%84-24%EA%B8%B0-%ED%98%84%EC%88%99-%EA%B7%BC%ED%99%A9-%EC%A0%95%EB%A6%AC-%EA%B1%B4%EB%8C%80-%EC%95%BD%EA%B5%AD-%EC%9C%84%EC%B9%98%EC%99%80-%EC%86%94%EC%A7%81%ED%95%9C-%EC%86%94%EB%A1%9C%EB%AF%BC%EB%B0%95-%EC%B6%9C%EC%82%AC%ED%91%9C-1283', publisher: '다플', date: '2026-08-07' },
  ],
  embeds: [],
  imageBriefs: [
    { placement: 'thumbnail', headline: '건대 개국, 17시간', subline: '24기 현숙의 달라진 일상', caption: '', alt: '나솔 24기 현숙 건대 약국 개국과 하루 17시간 영업시간', afterSection: 0, photoQuery: '', eyebrow: '최근 근황', statValue: '17시간', statLabel: '하루 영업시간' },
    { placement: 'body', headline: '서울에서 새 출발', subline: '개인 약국 운영 공개', caption: '24기 현숙은 서울로 이사해 개인 약국을 운영한다고 방송에서 밝혔다.', alt: '나솔사계 24기 현숙의 서울 이주와 개인 약국 운영 근황', afterSection: 1, photoQuery: '', eyebrow: '방송 확인', statValue: '2026년', statLabel: '개업 근황' },
    { placement: 'body', headline: '오전 8시~새벽 1시', subline: '매장 영업시간 기준', caption: '소재 글에 소개된 약국 안내 시간은 오전 8시부터 새벽 1시까지다.', alt: '24기 현숙 약국 오전 8시부터 새벽 1시까지 영업시간', afterSection: 2, photoQuery: '', eyebrow: '운영 시간', statValue: '17시간', statLabel: '문 여는 시간' },
    { placement: 'body', headline: '페이약사에서 개국', subline: '장성에서 서울 건대로', caption: '근무 약사에서 약국 운영 책임자로 일의 형태가 달라졌다.', alt: '24기 현숙이 장성 페이약사에서 서울 개국약사로 바뀐 과정', afterSection: 3, photoQuery: '', eyebrow: '직업 변화', statValue: '1년 6개월', statLabel: '방송 사이' },
    { placement: 'body', headline: '영업과 근무는 다르다', subline: '개인 근무표는 비공개', caption: '약국의 영업시간만으로 현숙 개인의 근무시간을 단정할 수 없다.', alt: '24기 현숙 약국 영업시간과 개인 근무시간을 구분한 설명', afterSection: 6, photoQuery: '', eyebrow: '팩트 체크', statValue: '365일', statLabel: '운영 안내' },
  ],
  generatedAt: new Date().toISOString(),
  mode: 'news',
  bodyImageCount: 8,
  sourceImage,
  sourceImages,
  sourcePublisher: '네이버 블로그 | 한방오리의 2030 문과생 인생역전',
  sourceImageOrigins: origins,
  sourceImageMeta: {
    [sourceImage]: { alt: '나솔사계에 출연한 24기 현숙', width: 800, height: 419 },
    [sourceImages[0]]: { alt: '24기 현숙 방송 화면', width: 653, height: 355 },
    [sourceImages[1]]: { alt: '24기 현숙이 일과 수입에 관해 말한 방송 화면', width: 531, height: 1522 },
    [sourceImages[2]]: { alt: '24기 현숙이 출연한 방송 후 인터뷰 화면', width: 627, height: 682 },
    [sourceImages[3]]: { alt: '병원 내 약국에서 근무하는 약사라고 소개한 24기 현숙', width: 600, height: 341 },
  },
  socialEmbeds: [],
};

fs.writeFileSync(outFile, JSON.stringify(article, null, 2), 'utf8');
console.log(outFile);
