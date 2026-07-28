/**
 * 인스타 게시물의 사진을 원본 해상도로 수집한다 — **글 제목 폴더 하나에 모은다.**
 *
 * 왜 필요한가: 여행 글의 사진 기준(장소·아이템·히트 요소·감성)은 **스톡으로 충족되지
 * 않는다.** 스톡 검색은 "아무 사우나", "두바이 호텔" 을 물어온다. 그 장소의 사진은
 * 그 장소에 가 본 사람이 올린 것뿐이라, 후보를 눈으로 고르려면 먼저 내려받아야 한다.
 *
 * 사진은 게시물별로 흩어지면 못 고른다. 글 한 편에 쓸 후보는 **제목 폴더 하나**에
 * 번호를 이어 붙여 모으고, 어느 게시물의 몇 번째였는지는 `manifest.json` 이 기억한다.
 *
 * ⚠️ **수집 ≠ 발행 허가.** 내려온 사진은 원저작자 것이다. 개인 계정 사진을 블로그에
 * 올리면 저작권 문제가 된다. 이 스크립트는 **후보를 눈으로 확인하기 위한** 것이고,
 * 실제 게시는 (a) 임베드/`oglink`, (b) 공식·라이선스 사진, (c) 작성자 허락 중 하나로 간다.
 * `.claude/skills/naver-travel-post/references/laqua-embeds.md` 참고.
 *
 * 함정 ①  `/embed/` 는 **브라우저 UA 를 보내면** 600KB JS 앱 페이지가 온다.
 *          UA 를 빼야 파싱 가능한 마크업이 온다 (HANDOVER 함정 ⑪).
 * 함정 ②  마크업의 `<img>` 는 **캐러셀 첫 장만** 담는다. 전체 컷은 `contextJSON`
 *          안 `edge_sidecar_to_children` 에 있다. 정규식으로 이미지 URL 을 긁으면
 *          같은 사진의 크기 변형 12개를 컷 12장으로 착각한다.
 * 함정 ③  `display_resources` 는 **크기순 정렬이 아니다.** 1440 → 150 으로 내려가다
 *          1080 정사각 크롭이 다시 붙는다. `slice(-1)` 을 쓰면 150x150 을 받는다.
 *          픽셀 수로 골라야 한다.
 * 함정 ④  `?img_index=N` 은 **뷰어 파라미터**다 (1-based). URL 을 복사한 시점에 보던
 *          컷일 뿐 "좋은 컷" 이 아니다 — 수집은 항상 전체를 받고 눈으로 고른다.
 *
 *   node scripts/ig-photos.mjs --title "스파 라쿠아" <주소1> <주소2> ...
 *   node scripts/ig-photos.mjs <주소>                제목 없으면 shortcode 폴더
 *   node scripts/ig-photos.mjs --title "스파 라쿠아" <주소3>    같은 폴더에 이어 담긴다
 *   node scripts/ig-photos.mjs --title "…" <주소> --dry        받지 않고 목록만
 */
import fs from 'node:fs';
import path from 'node:path';
import { DIRS, safeSlug } from '../src/paths.js';

const argv = process.argv.slice(2);
/** `--키 값` 을 읽는다. indexOf 가 -1 이면 argv[0](주소)을 값으로 잡아 버리므로 확인이 필요하다 */
function opt(name) {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 ? argv[at + 1] || '' : '';
}
const dry = argv.includes('--dry');
const title = opt('title');
const outArg = opt('out');
/** 옵션 값(--title 뒤의 문자열)까지 주소로 오해하지 않게 걸러 낸다 */
const optValues = new Set(
  argv.flatMap((a, i) => (a.startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--') ? [argv[i + 1]] : []))
);
const targets = argv.filter((a) => !a.startsWith('--') && !optValues.has(a));

if (!targets.length) {
  console.error('사용: node scripts/ig-photos.mjs [--title "글 제목"] <주소 또는 shortcode> [주소…] [--out 폴더] [--dry]');
  process.exit(1);
}

/** 제목이 있으면 제목 폴더 하나에 모으고, 없으면 게시물별 폴더로 떨어진다 */
const baseDir = path.resolve(outArg || path.join(DIRS.photos, 'ig'));
const folder = title ? safeSlug(title) : safeSlug(parseCode(targets[0]));
const outDir = path.join(baseDir, folder);
const manifestPath = path.join(outDir, 'manifest.json');

function parseCode(s) {
  return s.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)?.[1] || s;
}

/** `"key":"…"` 의 값을 이스케이프 규칙대로 끝까지 읽어 문자열로 되돌린다 */
function extractQuoted(src, key) {
  const at = src.indexOf(`"${key}":"`);
  if (at < 0) return null;
  const from = at + key.length + 4; // 여는 따옴표 다음
  let i = from;
  for (; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src[i] === '"') break;
  }
  return JSON.parse(src.slice(from - 1, i + 1)); // 따옴표째로 파싱 → 이스케이프 해제
}

/** 게시물 존재 확인 — 공식 oEmbed 는 토큰 없이 동작하고 없는 글엔 400 을 준다 */
async function oembedStatus(code) {
  const r = await fetch(
    'https://graph.facebook.com/v25.0/instagram_oembed?' +
      new URLSearchParams({ url: `https://www.instagram.com/p/${code}/` })
  );
  return r.status;
}

/** 게시물 하나의 메타와 컷 목록을 읽는다 */
async function readPost(code) {
  const status = await oembedStatus(code);
  if (status !== 200) return { error: `oEmbed ${status} — 없는 게시물이거나 비공개` };
  // 함정 ①: UA 를 보내지 않는다
  const html = await (await fetch(`https://www.instagram.com/p/${code}/embed/captioned/`)).text();
  const raw = extractQuoted(html, 'contextJSON');
  if (!raw) return { error: 'contextJSON 없음 — 임베드 마크업이 바뀐 듯' };
  const media = JSON.parse(raw).gql_data?.shortcode_media;
  if (!media) return { error: 'shortcode_media 없음' };
  return {
    media,
    // 함정 ②: 캐러셀이면 children, 단일 사진이면 자기 자신
    cuts: media.edge_sidecar_to_children?.edges?.map((e) => e.node) || [media],
  };
}

// 이어 담기 — 같은 제목 폴더를 다시 부르면 번호를 이어 쓴다
let prev = { title, items: [], posts: [] };
if (fs.existsSync(manifestPath)) {
  try {
    prev = { ...prev, ...JSON.parse(fs.readFileSync(manifestPath, 'utf8')) };
  } catch {
    /* 깨진 manifest 는 새로 쓴다 */
  }
}
const items = [...(prev.items || [])];
// 예전 manifest 에 같은 게시물이 두 번 들어가 있을 수 있다 — 불러올 때 접는다
const posts = [...new Map((prev.posts || []).map((p) => [p.shortcode, p])).values()];
const seen = new Set(items.map((it) => `${it.shortcode}#${it.sourceIndex}`));
let n = items.reduce((m, it) => Math.max(m, it.n || 0), 0);

console.log(`폴더   ${outDir}${title ? `  (제목: ${title})` : ''}`);
if (items.length) console.log(`기존   ${items.length}장 — 이어서 담습니다`);
if (!dry) fs.mkdirSync(outDir, { recursive: true });

for (const target of targets) {
  const code = parseCode(target);
  /** 사용자가 가리킨 컷 (?img_index=N, 1-based) — 표시용으로만 쓴다 */
  const pointed = Number(target.match(/[?&]img_index=(\d+)/)?.[1] || 0);

  const { media, cuts, error } = await readPost(code);
  if (error) {
    console.error(`\n✗ ${code} — ${error}`);
    continue;
  }
  const owner = media.owner || {};
  const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || '';

  console.log(`\n▶ ${code} · ${media.__typename} · @${owner.username || '?'} (팔로워 ${owner.edge_followed_by?.count ?? '?'}${owner.is_verified ? ' · 인증' : ''})`);
  if (media.location?.name) console.log(`  위치 ${media.location.name}`);
  if (caption) console.log(`  캡션 ${caption.replace(/\s+/g, ' ').slice(0, 160)}`);
  console.log(`  컷 ${cuts.length}장${pointed ? ` (URL 이 가리킨 컷 #${pointed})` : ''}`);
  // 같은 제목 폴더를 다시 부르면 같은 게시물 메타가 두 번 들어간다 — 최신으로 갈아 끼운다
  const at = posts.findIndex((p) => p.shortcode === code);
  const meta = {
    shortcode: code,
    permalink: `https://www.instagram.com/p/${code}/`,
    owner: owner.username,
    followers: owner.edge_followed_by?.count,
    verified: !!owner.is_verified,
    location: media.location?.name || '',
    caption,
    pointedIndex: pointed || null,
    cuts: cuts.length,
  };
  if (at >= 0) posts[at] = meta;
  else posts.push(meta);

  for (let i = 0; i < cuts.length; i++) {
    const node = cuts[i];
    const src = i + 1;
    const key = `${code}#${src}`;
    if (seen.has(key)) {
      console.log(`  #${src}  이미 있음 — 건너뜁니다`);
      continue;
    }
    const mark = src === pointed ? ' ←' : '';

    // 함정 ③: 정렬을 믿지 않고 픽셀 수로 최대를 고른다
    const best = (node.display_resources || [])
      .slice()
      .sort((a, b) => b.config_width * b.config_height - a.config_width * a.config_height)[0];
    const url = best?.src || node.display_url;
    const dim = best
      ? `${best.config_width}x${best.config_height}`
      : `${node.dimensions?.width || '?'}x${node.dimensions?.height || '?'}`;

    if (node.is_video) {
      console.log(`  #${src}  영상 — 건너뜁니다${mark}`);
      continue;
    }
    if (dry) {
      console.log(`  #${src}  ${dim}${mark}`);
      continue;
    }

    const res = await fetch(url, { headers: { referer: 'https://www.instagram.com/' } });
    if (!res.ok) {
      console.log(`  #${src}  받기 실패 ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    n += 1;
    const name = `${folder}-${String(n).padStart(2, '0')}.jpg`;
    fs.writeFileSync(path.join(outDir, name), buf);
    seen.add(key);
    console.log(`  #${src} → ${name}  ${dim}  ${Math.round(buf.length / 1024)}KB${mark}`);
    if (node.accessibility_caption) console.log(`       alt: ${node.accessibility_caption.replace(/\s+/g, ' ').slice(0, 120)}`);
    items.push({
      n,
      file: name,
      shortcode: code,
      sourceIndex: src,
      pointed: src === pointed,
      owner: owner.username,
      permalink: `https://www.instagram.com/p/${code}/`,
      dim,
      bytes: buf.length,
      alt: node.accessibility_caption || '',
    });
  }
}

if (!dry) {
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        title: title || folder,
        folder,
        count: items.length,
        posts,
        items,
        note: '원저작자 사진. 후보 확인용 수집이며 발행 허가가 아니다.',
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`\n총 ${items.length}장 · ${outDir}`);
  console.log('⚠️  원저작자 사진입니다. 발행은 임베드/oglink·공식 사진·작성자 허락 중 하나로 가세요.');
}
