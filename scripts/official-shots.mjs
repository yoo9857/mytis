/**
 * 공식 채널 영상의 **장면 캡처**를 글의 사진 자리에 넣는다.
 *
 * ## 왜 필요한가
 *
 * 연예 소식 글(news 모드)의 사진은 갈 곳이 없다. 세 길이 다 막힌다:
 *  - 당사자 사진·언론사 보도사진 → §6 금지 (크롭·보정해도 2차적저작물)
 *  - 기사 페이지 스크래핑(`images.useSourcePhoto`) → 관련기사 썸네일까지 들어온다.
 *    실측(2026-08-05): 머니투데이 6장 중 1장이 **무관한 회의장 인물** 276×185
 *  - 스톡 → 검색어가 사안을 배신한다. 같은 날 실측:
 *    `Korean wedding ceremony venue` → **전통 혼례 사모관대**(30대 돌싱 커플 글에),
 *    그 뒤 얼굴을 뺀 검색어로 고쳤더니 **외국 웨딩홀**이 왔다
 *
 * 그래서 `clip` 모드가 쓰는 장면 캡처(`ytShot.js`)를 news 모드 글에도 손으로 넣는다.
 * news 모드의 `clipShots` 는 `false` 다 — §6 이 news 에서는 **임베드**를 택했기 때문이다.
 * 이 스크립트는 그 선택을 사람이 뒤집는 자리이고, **위험은 발행자가 진다.**
 *
 * ## 지켜야 할 것 (ytShot.js 머리말과 같다)
 *  - 영상 파일을 내려받지 않는다. 재생 화면을 찍는다
 *  - 화면의 로고·워터마크를 지우지 않는다
 *  - 해설에 필요한 최소한만 쓴다
 *  - `manifest.json` 에 **채널명을 크레딧으로** 남긴다 (본문 하단 '이미지 출처'에 자동 표기)
 *  - **공식 채널만.** 개인 가십 채널은 넣지 않는다 —
 *    실측: `28기 영자 영철` 검색 상위에 `갔다온탁형`·`처세9단 황관장` 이 섞였다(§7-3)
 *
 * ## 사용
 *
 *   node scripts/official-shots.mjs out/<글>.json \
 *     --video dDBlzqaKyfE --channel "촌장엔터테인먼트TV" --at 90,240,420 \
 *     --video 2maF4p3kY7k --channel "tvN STORY 티비엔 스토리" --at 60,150
 *
 * `--video/--channel/--at` 은 **세 개가 한 벌**이고 여러 벌을 줄 수 있다.
 * 캡처가 한 장도 안 나오면 아티클을 건드리지 않고 끝낸다(스톡을 남긴다).
 *
 * 끝난 뒤:  npm run repreview -- "out/<글>.json"
 */
import fs from 'node:fs';
import path from 'node:path';
import { captureFrames } from '../src/ytShot.js';
import { DIRS, safeSlug } from '../src/paths.js';

const argv = process.argv.slice(2);
const article = argv.find((a) => !a.startsWith('--'));
if (!article) {
  console.error('아티클 JSON 경로를 주세요.  예)  node scripts/official-shots.mjs out/글.json --video ID --channel "채널" --at 60,120');
  process.exit(1);
}

/** --video/--channel/--at 을 나온 순서대로 한 벌씩 묶는다. */
const jobs = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] !== '--video') continue;
  const videoId = argv[i + 1] || '';
  const ch = argv.indexOf('--channel', i);
  const at = argv.indexOf('--at', i);
  jobs.push({
    videoId,
    channel: (ch > -1 ? argv[ch + 1] : '') || '',
    secs: ((at > -1 ? argv[at + 1] : '') || '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0),
  });
}
if (!jobs.length || jobs.some((j) => !/^[A-Za-z0-9_-]{11}$/.test(j.videoId) || !j.channel || !j.secs.length)) {
  console.error('--video <11자 ID> --channel "<채널명>" --at <초,초> 를 한 벌로 주세요. 채널명은 크레딧에 쓰입니다.');
  process.exit(1);
}

const abs = path.isAbsolute(article) ? article : path.resolve(process.cwd(), article);
const a = JSON.parse(fs.readFileSync(abs, 'utf8'));
const slug = safeSlug(a.title || 'post', 'post');
const dest = path.join(DIRS.photos, 'ig', slug);
fs.mkdirSync(dest, { recursive: true });

const items = [];
let n = 0;

for (const job of jobs) {
  console.log(`\n== ${job.channel} · ${job.videoId} · ${job.secs.join('s, ')}s`);
  let shots = [];
  try {
    shots = await captureFrames(job.videoId, job.secs, { title: a.title || job.videoId, headless: true });
  } catch (err) {
    console.log(`  캡처 실패: ${err.message}`);
    continue;
  }
  for (const s of shots) {
    if (!s?.file || !fs.existsSync(s.file)) continue;
    n += 1;
    const ext = path.extname(s.file) || '.png';
    const name = `shot-${String(n).padStart(2, '0')}${ext}`;
    fs.copyFileSync(s.file, path.join(dest, name));
    items.push({
      n,
      file: name,
      source: 'youtube-official',
      videoId: job.videoId,
      channel: job.channel,
      atSeconds: s.sec,
      /* photo.js 는 manifest 의 credit 을 그대로 쓴다. 채널명이 크레딧이다. */
      credit: job.channel,
      photographer: job.channel,
      license: '공식 채널 화면 캡처',
      permalink: `https://www.youtube.com/watch?v=${job.videoId}&t=${s.sec}s`,
      alt: '',
    });
    console.log(`  ✓ ${name}  ${s.sec}s`);
  }
}

if (!items.length) {
  console.log('\n캡처된 장면이 없습니다 — 아티클을 건드리지 않습니다(스톡을 그대로 둡니다).');
  console.log('원인은 대개 셋입니다: 영상이 비공개/연령제한 · 그 구간이 로드되지 않음 · Chrome 채널 미설치.');
  process.exit(1);
}

fs.writeFileSync(
  path.join(dest, 'manifest.json'),
  JSON.stringify(
    {
      title: a.title || '',
      note: '공식 채널 영상의 화면 캡처다. 제작사 저작물이므로 해설에 필요한 최소한만 쓰고 채널명을 크레딧으로 남긴다.',
      count: items.length,
      items,
    },
    null,
    2
  ) + '\n',
  'utf8'
);

/* 브리프 순서(대표 → 본문)대로 앞에서부터 채운다. 남는 자리는 스톡이 맡는다. */
a.photoDir = path.relative(process.cwd(), dest).replace(/\\/g, '/');
(a.imageBriefs || []).forEach((b, i) => {
  if (items[i]) b.photo = items[i].file;
});
fs.writeFileSync(abs, JSON.stringify(a, null, 2) + '\n', 'utf8');

console.log(`\n캡처 ${items.length}장 → ${a.photoDir}`);
for (const b of a.imageBriefs || []) console.log(`  sec${b.afterSection}  ${b.photo || '(스톡 유지)'}`);
console.log(`\n다음:  npm run repreview -- "${article}"`);
