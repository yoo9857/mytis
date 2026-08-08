import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file) throw new Error('article json path required');
const article = JSON.parse(fs.readFileSync(file, 'utf8'));
const sourceUrl = 'https://blog.naver.com/PostView.naver?blogId=candyami97&logNo=224371798478';
const photoDir = path.resolve('out/yuna-photos');
const photos = fs.readdirSync(photoDir).filter((n) => /^yuna-\d+\.(jpe?g|png|webp)$/i.test(n)).sort();
if (photos.length < 8) throw new Error(`Yuna photos: ${photos.length}`);

article.topic = 'ITZY 유나 중국 여행 데님 화보';
article.sourceUrl = sourceUrl;
article.title = 'ITZY 유나, 중국 여행서 완성한 데님 스타일…타고난 골반 라인 눈길';
article.seoTitle = article.title;
article.metaDescription = 'ITZY 유나가 중국 여행 중 공개한 데님 스타일 사진을 정리했습니다. 여행지 분위기와 자연스러운 포즈, 데님 착장의 포인트를 사진과 함께 살펴봅니다.';
article.urlSlug = 'itzy-yuna-china-travel-denim-style';
article.primaryKeyword = 'ITZY 유나';
article.secondaryKeywords = ['유나 여행 사진', '유나 데님 패션', 'ITZY 유나 근황', '유나 중국 여행'];
article.tags = ['ITZY', '유나', '유나여행사진', '데님패션', '아이돌근황', '여행화보', '유나근황', '중국여행'];
article.angle = '원문에 공개된 여행 사진을 중심으로 유나의 데님 스타일과 사진 속 분위기를 정리한다.';
article.place = '중국 여행지';
article.asOf = '2026-08-09';
article.sourcePublisher = '현꿀 : 오늘의 드레스코드';
article.sourceImage = photos[0];
article.sourceImages = photos;
article.sourceImageOrigins = photos.map((photo) => ({ file: photo, sourceUrl }));
article.photoDir = photoDir;
article.bodyImageCount = 8;
article.imageBriefs = [
  { placement: 'thumbnail', photo: photos[0], headline: 'ITZY 유나 여행 데님 스타일', subline: '중국 여행 사진으로 보는 자연스러운 분위기', alt: '중국 여행 중 데님 스타일을 선보인 ITZY 유나', afterSection: 0, noText: true },
  ...photos.slice(1, 9).map((photo, i) => ({
    placement: 'body', photo, headline: '', subline: '', caption: `사진 ${i + 2}. 여행지에서 포착된 유나의 데님 스타일`, alt: `여행지에서 데님 스타일을 선보인 ITZY 유나 사진 ${i + 2}`, afterSection: Math.min(i + 1, 5), noText: true,
  })),
];
article.sections = [
  { heading: '여행지에서 공개한 유나의 근황', answer: '', paragraphs: ['ITZY 유나가 여행지에서 촬영한 사진을 공개하며 팬들의 관심을 모았습니다. 화려하게 꾸민 무대 위 모습과 달리, 이번 사진에서는 여행지의 분위기를 즐기는 자연스러운 표정과 포즈가 돋보입니다.', '원문에 공개된 사진은 중국 여행 중 남긴 스냅 형식으로, 장소의 색감과 유나의 데님 착장이 함께 담겼습니다.'], bullets: [], table: { caption: '', headers: [], rows: [] }, callout: '' },
  { heading: '데님 하나로 완성한 여행 패션', answer: '', paragraphs: ['이번 스타일의 중심은 데님입니다. 상의와 하의를 과하게 꾸미기보다 실루엣과 소재감을 살려 여행지에서도 부담 없이 소화할 수 있는 분위기를 만들었습니다.', '캐주얼한 데님에 간결한 소품을 더한 구성이어서 일상 여행룩으로 참고하기에도 좋습니다. 사진마다 포즈와 시선이 달라 같은 착장도 여러 분위기로 보입니다.'], bullets: [], table: { caption: '', headers: [], rows: [] }, callout: '' },
  { heading: '사진마다 달라지는 분위기', answer: '', paragraphs: ['사진 속 유나는 거리와 실내 공간을 오가며 다양한 장면을 보여줍니다. 가까운 거리에서 찍은 셀카부터 전신 실루엣을 담은 사진까지 구성이 이어져 데님 스타일의 전체적인 균형을 확인할 수 있습니다.', '특히 자연광과 여행지의 배경이 어우러지면서 화보처럼 정돈된 인상을 줍니다.'], bullets: [], table: { caption: '', headers: [], rows: [] }, callout: '' },
  { heading: '팬들이 주목한 포인트', answer: '', paragraphs: ['공개 직후 사진에는 많은 반응이 이어졌습니다. 팬들은 유나의 근황뿐 아니라 꾸밈을 덜어낸 여행 패션, 편안한 표정, 사진마다 달라지는 분위기에 주목했습니다.', '다만 원문에서 확인되는 내용은 사진과 게시물 설명을 중심으로 한 근황 공유이므로, 확인되지 않은 일정이나 사생활을 덧붙여 해석하지 않는 것이 적절합니다.'], bullets: [], table: { caption: '', headers: [], rows: [] }, callout: '' },
  { heading: '유나 여행 사진으로 보는 스타일 정리', answer: '', paragraphs: ['이번 사진의 핵심은 데님을 중심에 둔 간결한 여행 스타일입니다. 편안한 소재와 자연스러운 포즈, 여행지 배경이 어우러져 과하지 않은데도 인상적인 장면을 만들었습니다.', '공개된 사진을 통해 확인되는 유나의 근황과 스타일을 정리하면, 일상적인 착장도 배경과 자세에 따라 충분히 화보처럼 연출할 수 있다는 점입니다.'], bullets: [], table: { caption: '', headers: [], rows: [] }, callout: '' },
  { heading: '일상에서 참고할 수 있는 데님 코디', answer: '', paragraphs: ['유나의 사진에서 참고할 부분은 아이템을 많이 더하지 않았다는 점입니다. 데님 특유의 질감이 살아 있도록 다른 요소는 간결하게 두고, 신발과 가방처럼 움직임에 필요한 소품을 중심으로 조합했어요.', '여행을 준비할 때에도 사진 속 구성처럼 활동성을 먼저 생각한 뒤 색감의 균형을 맞추면 좋습니다. 같은 데님이라도 셔츠를 걸치거나 액세서리를 바꾸면 전혀 다른 인상을 만들 수 있죠.', '무엇보다 사진에 담긴 표정과 자세가 착장의 분위기를 완성합니다. 옷의 브랜드나 가격보다 자신에게 편한 실루엣을 고르는 것이 여행 사진을 자연스럽게 만드는 핵심이에요.'], bullets: [], table: { caption: '', headers: [], rows: [] }, callout: '' },
];
article.conclusion = 'ITZY 유나의 이번 여행 사진은 데님을 활용한 편안한 스타일과 여행지의 자연스러운 분위기가 잘 어우러진 사례입니다. 원문에 공개된 사진을 중심으로 근황과 패션 포인트를 확인할 수 있습니다.';
article.relatedPosts = article.relatedPosts || [];
for (const section of article.sections) {
  section.paragraphs = section.paragraphs.map((p) => p.replace(/습니다\./g, '죠.').replace(/입니다\./g, '예요.'));
}
article.charCount = JSON.stringify(article.sections).length;
fs.writeFileSync(file, JSON.stringify(article, null, 2), 'utf8');
console.log(`updated ${file}: ${photos.length} photos, ${article.imageBriefs.length} image briefs`);
