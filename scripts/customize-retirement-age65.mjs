import fs from 'node:fs';
import path from 'node:path';

const articleFile = process.argv[2];
if (!articleFile) throw new Error('article JSON path is required');

const abs = path.resolve(articleFile);
const article = JSON.parse(fs.readFileSync(abs, 'utf8'));

article.sourceUrl = 'https://blog.naver.com/hwre7774/224383345440';
article.title = '정년연장 65세 언제부터? 2026년 현재 확정된 내용과 준비 방법';
article.seoTitle = '정년연장 65세 언제부터? 시행 시기·출생연도·국민연금 정리';
article.metaDescription = '2026년 8월 현재 법정 최저 정년은 60세 이상입니다. 65세 정년 시행 시기의 확정 여부, 출생연도별 국민연금 수령 나이, 최대 5년 소득 공백 준비 순서를 공식 자료로 확인합니다.';
article.asOf = '2026-08-24';
article.photoDir = 'out/photos/generated/retirement-age-65-20260824';
article.bodyImageCount = 4;
article.imageBriefs = [
  {
    placement: 'thumbnail',
    headline: '정년연장 65세\n언제부터?',
    subline: '2026년 현재 확정된 기준',
    caption: '',
    alt: '정년연장 65세 시행 시기와 현행 법정 정년을 설명하는 썸네일',
    afterSection: 0,
    photoQuery: '',
    photo: '01-thumbnail.png',
    eyebrow: '2026 정년 기준',
    statValue: '',
    statLabel: '',
  },
  {
    placement: 'body',
    headline: '현행 기준부터 확인',
    subline: '',
    caption: '정년연장 기사보다 현행 법령과 회사 취업규칙을 먼저 확인합니다.',
    alt: '중장년 근로자가 회사 취업규칙과 법령 자료를 확인하는 장면',
    afterSection: 1,
    photoQuery: '',
    photo: '02-current-rule-check.png',
    eyebrow: '', statValue: '', statLabel: '', noText: true,
  },
  {
    placement: 'body',
    headline: '정년연장과 재고용의 차이',
    subline: '',
    caption: '기존 근로관계를 이어가는 정년연장과 새 계약을 맺는 재고용은 다른 제도입니다.',
    alt: '같은 직무를 계속하는 경우와 인사 담당자와 재고용 계약을 협의하는 경우 비교',
    afterSection: 2,
    photoQuery: '',
    photo: '03-extension-vs-reemployment.png',
    eyebrow: '', statValue: '', statLabel: '', noText: true,
  },
  {
    placement: 'body',
    headline: '내 국민연금 개시 연령 확인',
    subline: '',
    caption: '출생연도와 가입기간을 같이 확인해야 노령연금 시작 시점을 알 수 있습니다.',
    alt: '중장년 부부가 태블릿으로 국민연금 정보를 확인하고 체크리스트를 작성하는 장면',
    afterSection: 4,
    photoQuery: '',
    photo: '04-pension-checklist.png',
    eyebrow: '', statValue: '', statLabel: '', noText: true,
  },
  {
    placement: 'body',
    headline: '정년과 연금 사이 소득 공백',
    subline: '',
    caption: '1969년생 이후는 현행 최저 정년 60세와 노령연금 개시 65세 사이를 따로 계산해야 합니다.',
    alt: '퇴직 후 국민연금 개시 전까지 소득 공백을 달력과 생활비로 계산하는 장면',
    afterSection: 5,
    photoQuery: '',
    photo: '05-income-gap.png',
    eyebrow: '', statValue: '', statLabel: '', noText: true,
  },
];

fs.writeFileSync(abs, `${JSON.stringify(article, null, 2)}\n`, 'utf8');
console.log(abs);
