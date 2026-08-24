import test from 'node:test';
import assert from 'node:assert/strict';
import { rankRelatedArticlePhotos } from '../src/codexWriter.js';
import { orderSourcePhotoUrls } from '../src/photo.js';

test('관련 기사 사진은 같은 기수의 대상 인물 alt를 가장 먼저 고른다', () => {
  const ranked = rankRelatedArticlePhotos({
    title: '나는솔로 33기 여자 직업 공개',
    image: 'https://img.example/all.jpg',
    images: [
      { url: 'https://img.example/youngsook.jpg', alt: '나는솔로 33기 영숙', w: 800, h: 600 },
      { url: 'https://img.example/jeongsook.jpg', alt: '나는솔로 33기 정숙', w: 800, h: 600 },
    ],
  }, { entityNames: ['정숙'], season: '33기' });
  assert.equal(ranked[0].url, 'https://img.example/jeongsook.jpg');
});

test('보도사진만으로 장수를 채우면 경쟁 네이버 블로그 이미지를 제외한다', () => {
  const article = {
    title: '나는솔로 33기 정숙',
    primaryKeyword: '나는솔로 33기 정숙 직업',
    entities: [{ nameKo: '정숙' }],
    sourceImage: 'https://blogthumb.pstatic.net/card.jpg',
    sourceImages: [
      'https://press.example/one.jpg',
      'https://press.example/two.jpg',
      'https://press.example/three.jpg',
      'https://press.example/four.jpg',
    ],
    sourceImageOrigins: {
      'https://blogthumb.pstatic.net/card.jpg': { pageUrl: 'https://blog.naver.com/competitor/1' },
      'https://press.example/one.jpg': { pageUrl: 'https://news.example/1' },
      'https://press.example/two.jpg': { pageUrl: 'https://news.example/1' },
      'https://press.example/three.jpg': { pageUrl: 'https://news.example/2' },
      'https://press.example/four.jpg': { pageUrl: 'https://news.example/2' },
    },
    sourceImageMeta: {
      'https://press.example/two.jpg': { alt: '나는솔로 33기 정숙' },
    },
  };
  const urls = orderSourcePhotoUrls(article, 4);
  assert.equal(urls.length, 4);
  assert.equal(urls[0], 'https://press.example/two.jpg');
  assert.ok(!urls.some((url) => url.includes('blogthumb.pstatic.net')));
});

test('보도사진이 모자라면 블로그 사진은 최후 후보로만 남긴다', () => {
  const article = {
    sourceImage: 'https://blogthumb.pstatic.net/card.jpg',
    sourceImages: ['https://press.example/one.jpg'],
    sourceImageOrigins: {
      'https://blogthumb.pstatic.net/card.jpg': { pageUrl: 'https://blog.naver.com/competitor/1' },
      'https://press.example/one.jpg': { pageUrl: 'https://news.example/1' },
    },
  };
  assert.deepEqual(orderSourcePhotoUrls(article, 4), [
    'https://press.example/one.jpg',
    'https://blogthumb.pstatic.net/card.jpg',
  ]);
});
