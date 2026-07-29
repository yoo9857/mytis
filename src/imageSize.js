import fs from 'node:fs';
import { log } from './log.js';

/**
 * 이미지 파일의 실제 픽셀 크기를 헤더에서 읽는다 (JPEG · PNG · WebP).
 *
 * 왜 필요한가: 언론사 사진은 660~780px 인 경우가 흔한데, 카드를 1200px 로
 * 렌더링하면 CSS 가 `background-size: cover` 로 늘려 눈에 띄게 뭉개진다.
 * 원본보다 크게 만들지 않으려면 원본 크기를 알아야 한다.
 *
 * 왜 별 모듈인가: 사진을 **받는** 쪽(photo.js)과 **그리는** 쪽(images.js)이
 * 둘 다 크기를 봐야 한다. images.js 가 photo.js 를 가져오므로 photo.js 에서
 * images.js 를 가져오면 순환이 되고, photo.js 만 쓰는 스크립트가
 * playwright 까지 끌어오게 된다.
 */
export function imageSize(file) {
  try {
    const b = fs.readFileSync(file);
    // PNG
    if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
      return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    }
    // JPEG — SOFn 마커에서 크기를 읽는다
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    // WebP
    const v = b.indexOf('VP8');
    if (v > 0) {
      const tag = b.slice(v, v + 4).toString();
      if (tag === 'VP8X') {
        return { w: (b.readUIntLE(v + 8, 3) & 0xffffff) + 1, h: (b.readUIntLE(v + 11, 3) & 0xffffff) + 1 };
      }
      if (tag === 'VP8L') {
        const bits = b.readUInt32LE(v + 9);
        return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
      }
      return { w: b.readUInt16LE(v + 14) & 0x3fff, h: b.readUInt16LE(v + 16) & 0x3fff };
    }
  } catch (err) {
    log.debug(`이미지 크기 확인 실패 (${file}): ${err.message}`);
  }
  return { w: 0, h: 0 };
}
