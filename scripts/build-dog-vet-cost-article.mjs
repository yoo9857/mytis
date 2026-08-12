import fs from 'node:fs';

const baseFile = process.argv[2];
const outFile = process.argv[3];
if (!baseFile || !outFile) throw new Error('base and output paths required');
const a = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
const table = () => ({ caption: '', headers: [], rows: [] });

Object.assign(a, {
  topic: '친구 강아지를 무료로 돌보다 발생한 응급 병원비 부담',
  sourceUrl: 'https://n.news.naver.com/mnews/article/014/0005560521',
  title: '친구 강아지 봐주다 병원비 40만원…이 돈, 누가 내야 할까요?',
  seoTitle: '친구 강아지 병원비 40만원, 견주에게 청구할 수 있을까',
  metaDescription: '친구의 강아지를 무료로 돌보다 초콜릿 섭취 사고로 응급 병원비를 먼저 냈다면 누가 부담해야 할까요. 비용상환 근거와 과실 판단, 꼭 남겨야 할 증거를 정리했습니다.',
  urlSlug: 'friend-dog-emergency-vet-cost',
  primaryKeyword: '친구 강아지 병원비',
  entities: [],
  secondaryKeywords: ['강아지 돌봄 사고', '반려견 병원비 청구', '위임 필요비 상환', '무상 반려견 돌봄', '강아지 초콜릿 응급실', '동물병원 영수증', '반려견 돌봄 체크리스트'],
  tags: ['반려견병원비', '강아지돌봄', '반려동물사고', '생활법률', '비용분담', '동물병원', '초콜릿중독', '친구관계', '영수증보관', '생활경제'],
  angle: '', place: '', spoiler: false, asOf: '2026-08-12', airDate: '', figures: [], cards: [], checkSites: [], relatedPosts: [],
  directAnswer: '친구의 부탁으로 강아지를 돌보다 응급진료에 필요한 병원비를 먼저 냈다면 견주에게 비용 상환을 요구해 볼 근거가 있습니다. 민법 제688조는 위임사무 처리에 필요한 비용을 지출한 수임인의 상환청구를 규정합니다. 다만 돌봄을 맡은 사람에게 보관상 부주의가 있었는지, 진료가 실제로 필요했는지에 따라 전액 또는 일부 부담으로 결론이 달라질 수 있습니다.',
  keyTakeaways: [
    '응급진료비는 강아지를 보호하기 위해 불가피하게 쓴 필요비인지가 먼저 판단됩니다.',
    '부탁을 받고 돌본 관계가 위임으로 인정되면 민법 제688조의 비용상환 문제가 될 수 있습니다.',
    '무료 돌봄이라고 책임이 전혀 없는 것은 아니며, 민법 제695조의 주의의무도 함께 살펴야 합니다.',
    '진료비 영수증, 세부내역서, 통화·메시지, 먹은 제품과 현장 사진을 바로 보관해야 합니다.',
    '비용을 요구할 때는 잘잘못부터 따지기보다 사고 경위와 지출 내역을 먼저 공유하는 편이 좋습니다.'
  ],
  sections: [
    {
      heading: '열흘간 봐주던 강아지, 무슨 일이 있었나',
      paragraphs: [
        '파이낸셜뉴스가 전한 사연에서 A씨는 친구 부탁으로 열흘간 강아지를 돌봤습니다. 새벽에 주방 소리를 듣고 나가 보니 강아지가 서랍에서 꺼낸 초콜릿을 약 3분의 1 먹은 상태였다고 합니다.',
        'A씨는 곧바로 24시간 동물병원으로 이동해 구토 처치와 엑스레이 검사를 받게 했고 약 40만원을 결제했습니다. 견주에게 상황은 알렸지만 비용 이야기가 나오지 않아 고민에 빠졌죠.',
        '초콜릿은 강아지에게 독성이 있습니다. 먹은 종류와 양, 체중에 따라 위험이 달라지므로 의심되면 일반적인 민간요법보다 동물병원에 즉시 연락하는 것이 우선입니다.'
      ], bullets: ['먹은 제품 포장과 남은 양 확보', '강아지 체중과 섭취 추정 시각 확인', '동물병원에 먼저 전화하고 지시에 따라 이동'], table: table(),
      callout: '초콜릿을 먹었다면 비용 다툼보다 강아지의 안전 확보와 수의사 상담이 먼저입니다.'
    },
    {
      heading: '병원비를 견주에게 요구할 수 있을까요?',
      paragraphs: [
        '친구가 강아지 돌봄을 부탁하고 A씨가 받아들였다면, 법적으로는 사무 처리를 맡긴 위임 관계가 문제 될 수 있습니다. 민법 제688조는 수임인이 위임사무 처리에 필요한 비용을 지출했다면 위임인에게 상환을 청구할 수 있도록 정하고 있습니다.',
        '응급진료가 객관적으로 필요했다면 견주에게 영수증과 함께 상환을 요청할 여지가 큽니다. 사전에 병원비 부담을 따로 약속하지 않았다고 돌봄 제공자가 전부 내는 것은 아닙니다.',
        '실제 판단에서는 두 사람의 약속, 강아지 습성에 관한 설명, 사고 뒤 연락과 진료 과정까지 함께 봅니다.'
      ], bullets: [], table: {
        caption: '비용 부담을 가르는 핵심', headers: ['확인할 점', '살펴볼 내용'], rows: [
          ['돌봄 약속', '기간·방법·주의사항을 어떻게 정했는지'],
          ['진료 필요성', '응급진료와 검사·처치가 합리적이었는지'],
          ['주의 정도', '위험한 식품을 보관하고 출입을 관리한 방식'],
          ['견주의 설명', '식탐이나 과거 사고를 미리 알렸는지']
        ]
      }, callout: '“친구니까 말 못 한다”보다 필요한 비용의 내역을 먼저 정확히 공유하는 것이 출발점입니다.'
    },
    {
      heading: '무료로 봐줬다면 책임도 없어질까요?',
      paragraphs: [
        '호의로 무료 돌봄을 했다고 해서 어떤 상황에서도 책임이 사라지는 것은 아닙니다. 민법 제695조는 보수 없이 보관을 맡은 사람도 자기 재산을 다루는 것과 같은 주의를 기울여야 한다고 규정합니다.',
        '위험한 식품을 쉽게 닿는 곳에 뒀거나 견주의 경고를 무시했다면 돌봄 제공자의 과실이 쟁점이 됩니다. 반대로 서랍 속 식품을 예상하기 어려운 방식으로 꺼냈고 견주가 식탐을 알리지 않았다면 판단은 달라질 수 있습니다.',
        '전액이나 반반이라는 답을 미리 정할 수는 없습니다. 필요비와 각자의 부주의를 함께 따져야 합니다.'
      ], bullets: ['문을 열어 둔 이유와 당시 환경', '초콜릿 보관 장소', '견주가 알려준 식습관과 주의사항', '발견 후 병원에 간 시간'], table: table(),
      callout: '무료 돌봄이라는 사실은 중요한 사정이지만, 그 자체가 모든 비용과 책임의 답은 아닙니다.'
    },
    {
      heading: '병원에서 이 자료는 꼭 챙기세요',
      paragraphs: [
        '사고가 발생하면 진료비 영수증만 받지 말고 세부 진료내역서와 수의사의 설명도 함께 정리하세요. 어떤 처치가 왜 필요했는지를 보여줘야 비용상환을 요청할 때 오해를 줄일 수 있습니다.',
        '제품 포장과 남은 양, 발견 장소를 사진으로 남기고 연락 시각도 보관하세요. 문자로 사고 경위와 병원 안내를 공유하면 양쪽이 같은 사실을 확인하기 쉽습니다.',
        '보호자와 연락이 닿지 않는 응급상황이라면 병원의 판단과 안내를 기록해 두세요.'
      ], bullets: ['진료비 영수증과 세부내역서', '제품 포장·남은 양·현장 사진', '견주에게 보낸 문자와 통화기록', '수의사가 설명한 치료 필요성'], table: table(),
      callout: '기억은 달라지지만 영수증과 메시지는 남습니다.'
    },
    {
      heading: '친구에게는 이렇게 말하는 편이 낫습니다',
      paragraphs: [
        '첫 문장부터 “누구 잘못”을 꺼내기보다 사고와 지출 사실부터 전달하세요.',
        '그다음 “강아지를 위한 필요비라 우선 결제했는데 비용을 어떻게 정리하면 좋을지 이야기하고 싶다”고 요청하면 됩니다. 전액 상환을 요청하되 상대가 돌봄상 과실을 제기한다면 당시 주의사항과 보관 상황을 놓고 차분히 확인하세요.',
        '합의한 금액과 지급일은 문자로 남기세요. 다툼이 커지면 법률상담으로 개별 사실관계를 검토할 수 있습니다.'
      ], bullets: [], table: table(),
      callout: '비용 요구는 공격이 아니라, 대신 지출한 필요비를 자료와 함께 정리하는 절차입니다.'
    },
    {
      heading: '다음 돌봄 전에는 다섯 가지만 적어두세요',
      paragraphs: [
        '맡기기 전에 주치의와 24시간 병원, 보험 여부, 응급진료 한도, 결제 방법을 한 장에 적어 두세요.',
        '사료와 간식 양뿐 아니라 먹으면 안 되는 식품, 서랍이나 문을 여는 습관, 분리불안과 공격성도 알려야 합니다. 동물등록 정보와 이동장, 목줄, 복용약을 한곳에 두면 응급 이동이 빨라집니다.',
        '돌봄 제공자는 위험 식품과 약품을 닿지 않는 곳으로 옮기고 쓰레기통과 방문도 점검해야 합니다.'
      ], bullets: ['주치의·야간병원 연락처', '응급진료 동의 범위', '병원비 결제·상환 방법', '식습관과 금지 식품', '보험·등록·복용약 정보'], table: table(),
      callout: '미리 적은 한 장이 응급상황의 시간과 친구 사이의 갈등을 함께 줄입니다.'
    },
    {
      heading: '40만원보다 먼저 정리할 결론',
      paragraphs: [
        '이 사례에서 돌봄 제공자가 병원비 상환을 요구하는 것 자체를 무리하다고 보기는 어렵습니다. 강아지를 살피는 과정에서 생긴 불가피한 필요비라면 견주가 부담할 근거가 있기 때문입니다.',
        '다만 초콜릿 보관과 출입 관리의 부주의는 별도 문제입니다. 자료를 공유하고 사실관계를 확인한 뒤 부담을 정하는 편이 현실적입니다.',
        '무엇보다 강아지가 위험한 음식을 먹었을 때는 비용 합의보다 즉시 동물병원에 연락하는 것이 먼저입니다.'
      ], bullets: [], table: table(), callout: ''
    }
  ],
  faq: [
    { question: '친구 강아지 병원비를 먼저 냈다면 돌려받을 수 있나요?', answer: '돌봄 부탁이 위임 관계로 인정되고 응급진료비가 필요한 비용이었다면 민법 제688조에 따라 상환을 요구할 여지가 있습니다. 다만 돌봄 제공자의 과실과 약속 내용에 따라 금액은 달라질 수 있습니다.' },
    { question: '무료로 강아지를 봐준 사람도 책임이 있나요?', answer: '무료라는 이유만으로 모든 주의의무가 없어지지는 않습니다. 민법 제695조는 보수 없이 보관을 맡은 사람도 자기 재산과 같은 주의를 기울이도록 정합니다.' },
    { question: '병원비를 반반 내는 것이 법적 기준인가요?', answer: '반반은 법에 정해진 기준이 아닙니다. 필요한 진료비인지, 각자 어떤 정보를 알고 어떤 주의를 했는지를 따져 전액 또는 일부 부담이 정해질 수 있습니다.' },
    { question: '강아지가 초콜릿을 먹으면 집에서 토하게 해도 되나요?', answer: '임의로 토하게 하지 말고 제품 종류와 양, 강아지 체중, 먹은 시간을 확인해 동물병원에 즉시 연락하세요. 수의사의 지시에 따라 응급병원으로 이동하는 것이 안전합니다.' },
    { question: '견주에게 비용을 말할 때 무엇을 보내야 하나요?', answer: '사고 경위와 발견 시각, 진료비 영수증, 세부내역서, 수의사의 설명을 함께 보내세요. 감정적인 책임 공방보다 객관적인 지출과 치료 필요성부터 공유하는 편이 좋습니다.' }
  ],
  conclusion: '친구의 강아지를 돌보다 대신 낸 응급 병원비라면 견주에게 상환을 요청해 볼 수 있습니다. 다만 사고를 막기 위해 각자가 어떤 정보를 주고 어떤 주의를 했는지에 따라 부담은 달라질 수 있습니다. 영수증과 메시지를 남기고 차분히 비용을 협의하세요. 다음 돌봄 전에는 응급병원과 결제 방법까지 한 장에 적어 두는 것이 가장 확실한 예방입니다.',
  sources: [
    { title: '강아지 대신 봐줬다가 병원비 40만원…견주 친구에게 청구해도 될까요?', url: 'https://n.news.naver.com/mnews/article/014/0005560521', publisher: '파이낸셜뉴스', date: '2026-08-12' },
    { title: '민법 제681조 수임인의 선관의무', url: 'https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1026990639', publisher: '국가법령정보센터', date: '2026-03-17' },
    { title: '민법 제688조 수임인의 비용상환청구권 등', url: 'https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0688&lsiSeq=284415&urlMode=lsScJoRltInfoR', publisher: '국가법령정보센터', date: '2026-03-17' },
    { title: '민법 제695조 무상수치인의 주의의무', url: 'https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1006005137', publisher: '국가법령정보센터', date: '2026-03-17' },
    { title: 'Chocolate Toxicosis in Animals', url: 'https://www.merckvetmanual.com/toxicology/food-hazards/chocolate-toxicosis-in-animals', publisher: 'Merck Veterinary Manual', date: '2026-02' },
    { title: "Leave Chocolate Out of Rover's Celebrations", url: 'https://www.fda.gov/animal-veterinary/animal-health-literacy/leave-chocolate-out-rovers-celebrations', publisher: 'U.S. FDA', date: '2024-05' }
  ],
  embeds: [], socialEmbeds: [], sourcePublisher: '파이낸셜뉴스', sourceImage: '', sourceImages: [], sourceImageOrigins: {},
  photoDir: 'out/photos/generated/dog-vet-cost-20260812', bodyImageCount: 4,
  imageBriefs: [
    { placement: 'thumbnail', headline: '병원비 40만원, 누가 낼까', subline: '친구 강아지 봐주다 생긴 응급비용', caption: '', alt: '동물병원에서 강아지를 안고 병원비 영수증을 확인하는 여성', afterSection: 0, photoQuery: '', eyebrow: '생활 법률', statValue: '', statLabel: '', photo: '00-thumb.png', noText: false },
    { placement: 'body', headline: '', subline: '', caption: '강아지가 초콜릿을 먹었다면 먹은 제품과 양을 확인하고 동물병원에 즉시 연락해야 합니다.', alt: '주방에서 초콜릿을 발견하고 강아지를 보호하며 병원에 전화하는 모습', afterSection: 1, photoQuery: '', eyebrow: '', statValue: '', statLabel: '', photo: '01-accident.png', noText: true },
    { placement: 'body', headline: '', subline: '', caption: '영수증과 세부내역서, 통화와 메시지 기록은 진료 필요성과 지출을 설명하는 자료가 됩니다.', alt: '동물병원 영수증과 휴대전화 메시지를 함께 정리하는 모습', afterSection: 4, photoQuery: '', eyebrow: '', statValue: '', statLabel: '', photo: '02-evidence.png', noText: true },
    { placement: 'body', headline: '', subline: '', caption: '잘잘못보다 사고 경위와 진료비 내역을 먼저 공유하면 비용 협의가 한결 수월합니다.', alt: '두 친구가 반려견 병원비 내역을 차분히 확인하는 모습', afterSection: 5, photoQuery: '', eyebrow: '', statValue: '', statLabel: '', photo: '03-talk.png', noText: true },
    { placement: 'body', headline: '', subline: '', caption: '돌봄 전에는 병원 연락처와 응급진료 동의 범위, 결제 방법을 함께 적어 두는 것이 좋습니다.', alt: '강아지를 맡기기 전 사료 약 이동장과 돌봄 체크리스트를 확인하는 모습', afterSection: 6, photoQuery: '', eyebrow: '', statValue: '', statLabel: '', photo: '04-checklist.png', noText: true }
  ],
  generatedAt: new Date().toISOString(), mode: 'news'
});

delete a.charCount;
fs.writeFileSync(outFile, JSON.stringify(a, null, 2) + '\n', 'utf8');
