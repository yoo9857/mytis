import fs from 'node:fs';
import { captureFrames } from '../src/ytShot.js';

const [articleFile, videoId] = process.argv.slice(2);
if (!articleFile || !videoId) {
  throw new Error('사용: node scripts/attach-youtube-shots.mjs <article.json> <videoId>');
}

const article = JSON.parse(fs.readFileSync(articleFile, 'utf8'));
const seconds = [5, 14, 23, 32, 41, 50, 59, 68, 77];
const shots = await captureFrames(videoId, seconds, { title: article.title, headless: true });
if (shots.length < 7) {
  throw new Error(`장면 캡처가 ${shots.length}/9장만 성공해 중단합니다.`);
}

article.clipVideoId = videoId;
article.clipUrl = `https://www.youtube.com/watch?v=${videoId}`;
article.clipChannel = 'Netflix Korea 넷플릭스 코리아';
article.clipShots = shots;
article.bodyImageCount = Math.max(0, shots.length - 1);
fs.writeFileSync(articleFile, JSON.stringify(article, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ articleFile, shots: shots.length, seconds: shots.map((s) => s.sec) }));
