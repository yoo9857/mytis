import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DIRS, FILES, stamp, safeSlug } from './paths.js';
import { log } from './log.js';
import { runCodexJson } from './codexWriter.js';
import { MODE, can } from './mode.js';
import { imageSize } from './imageSize.js';

/**
 * 이미지 카드의 배경으로 쓸 "실사 사진"을 확보한다.
 *
 * 1순위: Pexels 공식 API      (PEXELS_API_KEY 있을 때. 가장 빠르고 정확)
 * 2순위: Openverse 공식 API   (키 불필요. 상업적 이용 가능 라이선스만 필터링)
 * 3순위: codex CLI 웹 검색     (위 둘이 실패했을 때)
 * 전부 실패하면 사진 없이 그라디언트 배경으로 폴백한다.
 *
 * 검색어는 글 생성 단계에서 받아온 imageBriefs[].photoQuery(영어)를 씁니다.
 */

/** codex 가 직접 URL 을 줄 때만 적용하는 화이트리스트 (지어낸 URL 방지) */
const CODEX_ALLOWED_HOSTS = [
  'images.unsplash.com',
  'plus.unsplash.com',
  'images.pexels.com',
  'cdn.pixabay.com',
  'pixabay.com',
];

const MIN_BYTES = 15_000;
const MAX_BYTES = 12_000_000;

function hostAllowed(url, hosts) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** 사진을 내려받고 실제 이미지인지 검증한다. */
async function download(url, dest, timeoutMs = 25_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/jpeg,image/png,*/*',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) throw new Error(`이미지가 아님 (content-type: ${type})`);

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < MIN_BYTES) throw new Error(`파일이 너무 작음 (${buf.length}바이트)`);
    if (buf.length > MAX_BYTES) throw new Error(`파일이 너무 큼 (${buf.length}바이트)`);

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    return { file: dest, bytes: buf.length, contentType: type };
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url, { headers = {}, timeoutMs = 15_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'moneyti-tistory-autopost/1.0', Accept: 'application/json', ...headers },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 인물 사진 소스: 위키미디어 공용.
 * 연예인 실물 사진을 상업 이용·재가공이 허용되는 라이선스로만 가져온다.
 * NC(비영리)·ND(변경금지) 라이선스는 블로그 수익화와 재가공에 걸리므로 제외한다.
 */
function commonsLicenseOk(shortName) {
  const s = String(shortName || '').toLowerCase();
  if (!s) return false;
  if (/\bnc\b|-nc|noncommercial|non-commercial/.test(s)) return false;
  if (/\bnd\b|-nd|noderiv|no-deriv/.test(s)) return false;
  return /cc0|public domain|^pd|cc by/.test(s);
}

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 커먼즈에 올라온 연예인 사진 상당수는 광고 스틸·포스터·앨범 커버라
 * 광고주 로고와 전화번호가 이미지에 박혀 있다. 썸네일로 쓰면 남의 광고를 실어주는 꼴이라 걸러낸다.
 */
const UNUSABLE_PATTERN =
  /\b(ad|ads|advert\w*|commercial|cf|poster|billboard|banner|logo|screenshot|teaser|album\s*cover|cover\s*art|magazine\s*cover)\b|광고|포스터|배너|로고|스크린샷|티저|앨범\s*커버|자켓/i;

/** 행사·공연 현장 사진일수록 좋다 */
const PREFERRED_PATTERN =
  /\b(concert|live|stage|performance|festival|award|press|interview|red\s*carpet|fan\s*meeting|showcase|airport)\b|공연|콘서트|무대|시상|기자|간담회|행사/i;

/**
 * 검색어가 **그 사람에 관한 사진**을 물어왔는지 확인한다.
 *
 * 커먼즈 검색은 낱말만 맞으면 무엇이든 준다. 라이선스·크기·광고 필터를 다 통과하는데
 * 사람이 아닌 것이 섞인다 — 특히 **성씨가 지명과 같을 때** 그렇다.
 *
 * > 2026-08-01 실측 — `Keigo Higashino` 검색 결과 10건이 전부 사람이 아니었다:
 * >   東野駅(Higashino station) 사진 6장 · 東野초등학교 2장 ·
 * >   동명이인(피겨 임원 Ayako Higashino) 1장. 전부 CC BY 이고 800px 이상이라
 * >   기존 필터를 통과했고, `isPerson: true` 로 표시됐다.
 * >   (히가시노 게이고 본인 사진은 커먼즈에 **없다** — 없는 게 정답이었다)
 *
 * → 이름의 **모든 낱말**이 파일명이나 설명에 있어야 통과시킨다. 성씨만 걸린 것은 버린다.
 *   §7-3 의 동명이인(황정민 아나운서)보다 한 겹 더 나쁜 경우라 코드로 막는다.
 */
function nameMatches(name, haystack) {
  /* 이름과 대상 문자열을 **같은 방식으로** 정규화한다 — 한쪽만 특수문자를 떼면
   * 로마자 이름의 하이픈에서 어긋난다.
   * > 실측: "Hwang Jung-min" → 토큰 "jungmin" 이 파일명 "Hwang Jung-Min" 과
   * >   맞지 않아 **본인 사진이 탈락**했다. */
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '');
  const hay = norm(haystack);
  const parts = String(name || '')
    .toLowerCase()
    .split(/[\s,]+/)
    .map(norm)
    /* 2글자 이하 토큰(이니셜·조사)은 아무 데나 걸리므로 판정에서 뺀다.
     * 한글 이름은 짧아도 통째로 쓴다 (예: "은희경"). */
    .filter((s) => s.length >= 3 || /[가-힣]/.test(s));
  if (!parts.length) return false;
  return parts.every((p) => hay.includes(p));
}

async function fromWikimedia(query, { allowShareAlike = true, mustMatch = '' } = {}) {
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: query,
      gsrnamespace: '6', // File:
      gsrlimit: '12',
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      iiurlwidth: '1600',
      format: 'json',
      origin: '*',
    });

  const data = await getJson(url, { headers: { 'User-Agent': 'moneyti-tistory-autopost/1.0' } });
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];

  const allowSA = allowShareAlike !== false;

  return pages
    .filter((p) => /\.(jpe?g|png|webp)$/i.test(p.title || ''))
    .map((p) => {
      const ii = p.imageinfo?.[0];
      if (!ii) return null;
      const meta = ii.extmetadata || {};
      const license = meta.LicenseShortName?.value || '';
      if (!commonsLicenseOk(license)) return null;
      if (!allowSA && /-sa|sharealike|share-alike/i.test(license)) return null;
      // 가로가 긴 사진을 선호하되 세로 사진도 배경으로는 쓸 수 있다
      if ((ii.width || 0) < 800) return null;

      const title = String(p.title || '').replace(/^File:/, '');
      const desc = stripTags(meta.ImageDescription?.value);
      const haystack = `${title} ${desc}`;

      if (UNUSABLE_PATTERN.test(haystack)) {
        log.debug(`인물 사진 제외 (광고·포스터류): ${title.slice(0, 60)}`);
        return null;
      }

      /* 그 사람 사진이 맞는지 — 이름의 모든 낱말이 파일명·설명에 있어야 한다.
       * 없으면 버린다. 인물 사진 0장이 엉뚱한 사진 1장보다 낫다. */
      if (mustMatch && !nameMatches(mustMatch, haystack)) {
        log.debug(`인물 사진 제외 (이름 불일치 '${mustMatch}'): ${title.slice(0, 60)}`);
        return null;
      }

      return {
        url: ii.thumburl || ii.url,
        source: 'wikimedia',
        pageUrl: ii.descriptionurl || '',
        photographer: stripTags(meta.Artist?.value) || '위키미디어 공용',
        license,
        description: desc || title,
        portrait: (ii.thumbheight || 0) > (ii.thumbwidth || 1),
        score: PREFERRED_PATTERN.test(haystack) ? 1 : 0,
        trusted: true,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

/** 1순위: Pexels 공식 API */
async function fromPexels(query, apiKey) {
  const url =
    'https://api.pexels.com/v1/search?' +
    new URLSearchParams({ query, per_page: '5', orientation: 'landscape', size: 'large' });
  const data = await getJson(url, { headers: { Authorization: apiKey } });
  return (data.photos || []).map((p) => ({
    url: p.src?.large2x || p.src?.large || p.src?.original,
    source: 'pexels',
    pageUrl: p.url || '',
    photographer: p.photographer || '',
    description: p.alt || query,
    trusted: true,
  }));
}

/** Unsplash 공식 API (무료 키 필요) */
async function fromUnsplash(query, apiKey) {
  const url =
    'https://api.unsplash.com/search/photos?' +
    new URLSearchParams({ query, per_page: '5', orientation: 'landscape', content_filter: 'high' });
  const data = await getJson(url, { headers: { Authorization: `Client-ID ${apiKey}` } });
  return (data.results || []).map((p) => ({
    url: p.urls?.regular || p.urls?.full,
    source: 'unsplash',
    pageUrl: p.links?.html || '',
    photographer: p.user?.name || '',
    description: p.alt_description || query,
    trusted: true,
  }));
}

/** Pixabay 공식 API (무료 키 필요) */
async function fromPixabay(query, apiKey) {
  const url =
    'https://pixabay.com/api/?' +
    new URLSearchParams({
      key: apiKey,
      q: query,
      image_type: 'photo',
      orientation: 'horizontal',
      safesearch: 'true',
      min_width: '1200',
      per_page: '5',
    });
  const data = await getJson(url);
  return (data.hits || []).map((p) => ({
    url: p.largeImageURL || p.webformatURL,
    source: 'pixabay',
    pageUrl: p.pageURL || '',
    photographer: p.user || '',
    description: p.tags || query,
    trusted: true,
  }));
}

/**
 * Openverse 공식 API (키 불필요, 상업적 이용 가능 라이선스만).
 * 필터를 좁히면 결과가 0건이 되는 경우가 많아 조건을 느슨하게 둔다.
 */
async function fromOpenverse(query) {
  const url =
    'https://api.openverse.org/v1/images/?' +
    new URLSearchParams({
      q: query,
      license_type: 'commercial,modification',
      mature: 'false',
      page_size: '12',
    });
  const data = await getJson(url);
  return (data.results || [])
    .filter((r) => r.url && (r.width ?? 1200) >= 1000)
    .map((r) => ({
      url: r.url,
      source: `openverse/${r.source || ''}`,
      pageUrl: r.foreign_landing_url || '',
      photographer: r.creator || '',
      description: r.title || query,
      license: r.license || '',
      trusted: true,
    }));
}

/** 3순위: codex 웹 검색 */
async function fromCodex(article, queries, count, cfg) {
  const prompt = `당신은 블로그 글에 쓸 실사 사진을 찾는 이미지 리서처입니다.

# 글 정보
제목: ${article.title}
핵심 키워드: ${article.primaryKeyword}

# 찾아야 할 장면 (슬롯 순서대로)
${queries.map((q, i) => `${i}. ${q}`).join('\n')}

# 할 일
웹 검색으로 위 장면에 해당하는 실사 사진의 **직접 이미지 URL**을 찾으세요. 총 ${count + 3}장 목표.

# 규칙 (반드시 지킬 것)
1. Unsplash, Pexels, Pixabay 세 곳에서만 찾으세요. 세 곳 모두 상업적 이용이 무료로 허용됩니다.
   뉴스·블로그·기업 홈페이지·구글 이미지의 사진은 절대 쓰지 마세요. 저작권 문제가 생깁니다.
2. url 필드는 브라우저 주소창에 넣으면 이미지 파일 자체가 뜨는 주소여야 합니다.
   - 올바름: https://images.pexels.com/photos/210574/pexels-photo-210574.jpeg
   - 올바름: https://images.unsplash.com/photo-1554224155-1696413565d3
   - 틀림:   https://unsplash.com/photos/abc123        (HTML 페이지)
   - 틀림:   https://www.pexels.com/photo/xxx-210574/  (HTML 페이지)
   허용 도메인: images.unsplash.com, plus.unsplash.com, images.pexels.com, cdn.pixabay.com
3. **URL을 추측하거나 지어내지 마세요.** 검색 결과에서 실제로 본 주소만 넣으세요.
   확실하지 않으면 그 사진은 빼세요. 개수를 채우는 것보다 정확한 게 훨씬 중요합니다.
   유효한 URL을 하나도 못 찾았으면 photos 를 빈 배열로 두세요.
4. 가로가 긴 사진(landscape), 폭 1200px 이상.
5. 사진 위에 흰 글씨를 얹습니다. 전체가 하얗게 밝은 사진보다 중간~어두운 톤이 좋습니다.
6. forSlot 은 위 슬롯 번호에 맞추세요.

# 출력
파일을 만들지 말고 지정된 JSON 스키마에 맞는 JSON 객체 하나만 최종 응답으로 반환하세요.`;

  const result = await runCodexJson({
    prompt,
    schemaFile: FILES.photosSchema,
    cfg,
    search: true,
    // 사진은 부가 요소이므로 오래 붙들지 않는다. 실패하면 그라디언트로 넘어간다.
    timeoutMs: Math.min(cfg.codex.timeoutMs, cfg.images.photoTimeoutMs || 300_000),
  });

  return (result?.photos || [])
    .filter((p) => p && typeof p.url === 'string' && p.url.trim())
    .map((p) => ({ ...p, trusted: false }));
}

/** 슬롯별 검색어를 뽑는다. photoQuery(영어)가 최우선. */
function slotQueries(article, slots) {
  const briefs = [
    ...(article.imageBriefs || []).filter((b) => b.placement === 'thumbnail'),
    ...(article.imageBriefs || []).filter((b) => b.placement === 'body'),
  ];

  const queries = [];
  for (let i = 0; i < slots; i++) {
    const q = briefs[i]?.photoQuery?.trim();
    // 한글이 섞여 있으면 스톡 사진 검색이 안 되므로 버린다
    if (q && !/[ㄱ-ㅎ가-힣]/.test(q)) queries.push(q);
    else queries.push('');
  }

  // 비어 있는 슬롯은 범용 검색어로 채운다
  const generic = ['korean office desk laptop', 'person using smartphone', 'city street daytime'];
  return queries.map((q, i) => q || generic[i % generic.length]);
}

/**
 * 슬롯 개수만큼 실사 배경 사진을 확보해서 로컬 파일로 내려받는다.
 * @returns {Promise<Array<{file:string,credit:string,pageUrl:string,description:string}|null>>}
 *          슬롯 순서대로. 확보 실패한 슬롯은 null.
 */
/**
 * 확보한 사진들 중 **같은 사진**을 찾아 슬롯을 비운다 (dHash 비교).
 * 자세한 이유와 임계값 근거는 `scripts/dupe_photos.py` 머리말에 있다.
 */
async function dropVisualDupes(result) {
  const filled = result.map((r, i) => ({ r, i })).filter((x) => x.r?.file);
  if (filled.length < 2) return;

  try {
    const { spawn } = await import('node:child_process');
    const script = path.join(DIRS.root, 'scripts', 'dupe_photos.py');
    const out = await new Promise((resolve, reject) => {
      // 한글 경로는 argv 를 거치면 깨진다 → stdin 으로 UTF-8 로 넘긴다
      const p = spawn('python', [script], { windowsHide: true });
      let buf = '';
      const timer = setTimeout(() => {
        p.kill();
        reject(new Error('시간 초과'));
      }, 60_000);
      p.stdout.on('data', (d) => (buf += d));
      p.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      p.on('close', () => {
        clearTimeout(timer);
        try {
          resolve(JSON.parse(buf.trim().split('\n').pop()));
        } catch (e) {
          reject(e);
        }
      });
      p.stdin.write(filled.map((x) => x.r.file).join('\n'), 'utf8');
      p.stdin.end();
    });

    /* 넘긴 순서의 **순번**으로 받는다 — 경로로 받으면 한글이 cp949 로 깨져
     * 대조가 전부 빗나간다 (찾아 놓고도 안 버렸다. dupe_photos.py 머리말 참고). */
    for (const [badAt, keepAt, dist] of out?.dupes || []) {
      const bad = filled[badAt];
      const keep = filled[keepAt];
      if (!bad || !result[bad.i]) continue;
      /* 장면 캡처끼리는 기준을 훨씬 조입니다. 임계값 16 은 보도사진 실측
       * (같은 포스터 12 / 다른 사진 최소 22)인데, 같은 영상의 캡처는 색보정·
       * 인물·구도가 같아 **다른 장면끼리도 거리가 좁다.**
       * > 2026-07-30 실측 — 김부장 리캡: 23:40 과 37:08 (14분 떨어진 다른
       * > 장면, 둘 다 어두운 얼굴 클로즈업)이 거리 16 으로 걸려 삭제됐다.
       * 진짜 중복(같은 장면을 두 번 캡처)은 인코딩까지 같아 거리가 한 자릿수다. */
      const bothClips =
        result[bad.i]?.source === 'clip-shot' && result[keep?.i]?.source === 'clip-shot';
      if (bothClips && dist > 6) {
        log.debug(`장면 캡처 유사(거리 ${dist})지만 다른 장면으로 보고 둡니다 (슬롯 ${bad.i}↔${keep?.i})`);
        continue;
      }
      log.debug(
        `같은 사진이라 슬롯 ${bad.i} 를 비웁니다 (슬롯 ${keep?.i ?? '?'} 와 거리 ${dist})`
      );
      fs.rmSync(result[bad.i].file, { force: true });
      result[bad.i] = null;
    }
  } catch (err) {
    log.debug(`사진 중복 검사 생략: ${String(err.message).slice(0, 70)}`);
  }
}

export async function fetchBackgrounds(article, cfg, slots) {
  const result = new Array(slots).fill(null);
  if (slots <= 0) return result;
  if ((cfg.images.background || 'gradient') !== 'photo') return result;

  const queries = slotQueries(article, slots);
  log.step(`실사 배경 사진 ${slots}장 확보`);
  log.debug(`검색어: ${queries.map((q, i) => `[${i}] ${q}`).join(' · ')}`);

  fs.mkdirSync(DIRS.photos, { recursive: true });
  const prefix = `${stamp()}-${safeSlug(article.title, 'bg')}`;
  const used = new Set();

  /**
   * 같은 사진인지 판별할 키.
   *
   * 언론사는 한 장을 크기별 변형으로 내보낸다.
   *   SSC_20260727171258.jpg.webp      (og:image)
   *   SSC_20260727171258_V.jpg.webp    (본문 — 같은 사진)
   * URL 전체로 비교하면 이 둘이 다른 사진으로 보여 **같은 컷이 두 번 실린다.**
   * 그래서 파일명에서 확장자와 크기 변형 접미사를 떼고 비교한다.
   */
  function photoKey(url) {
    try {
      const name = new URL(url).pathname.split('/').pop() || '';
      return name
        .replace(/\.(jpe?g|png|webp|avif|gif)(\.(jpe?g|png|webp|avif))?$/i, '')
        .replace(/([_-])(v|l|s|m|t|org|orig|big|small|thumb|\d{2,4}x\d{2,4})$/i, '')
        .toLowerCase();
    } catch {
      return String(url).split('?')[0];
    }
  }

  /**
   * 여러 컷을 위아래(또는 좌우)로 이어붙인 **합성본**을 걸러낸다.
   *
   * 대표 이미지는 얼굴 개수로 합성본을 피하지만(아래 pickBestThumb), 본문 사진은
   * 그 검사를 거치지 않아 그대로 실린다. 합성본은 본문에서도 쓸 수 없다 —
   * 방송사 로고와 자막이 층마다 박혀 있고, 세로로 길어 모바일에서 한 컷이
   * 화면을 다 먹는다.
   *
   * > 2026-07-29 실측 — 나솔 29기 정숙 기사: 300x893(0.34) 사진이 본문 5번째로
   * > 들어갔다. SBS Plus 로고와 자막이 박힌 방송 캡처 4장을 세로로 이어붙인
   * > 것이었다.
   *
   * 한계값은 인스타 스토리(9:16 = 0.56)는 살리고 3단 이상 합성본만 자르게 잡았다.
   * 가로로 이어붙인 것도 같은 이유로 자른다.
   */
  function looksLikeMontage(file) {
    const { w, h } = imageSize(file);
    if (!w || !h) return false; // 크기를 못 읽으면 판단하지 않는다
    const aspect = w / h;
    if (aspect < 0.5) return `세로로 이어붙임 (${w}x${h}, 비율 ${aspect.toFixed(2)})`;
    if (aspect > 3) return `가로로 이어붙임 (${w}x${h}, 비율 ${aspect.toFixed(2)})`;
    return false;
  }

  /** 후보 목록에서 하나를 골라 슬롯에 내려받는다. */
  async function tryFill(slot, candidates) {
    if (result[slot]) return true; // 이미 채워진 슬롯은 건드리지 않는다
    for (const cand of candidates) {
      if (!cand?.url) continue;
      const key = photoKey(cand.url);
      if (used.has(key)) continue;
      if (!cand.trusted && !hostAllowed(cand.url, CODEX_ALLOWED_HOSTS)) {
        log.debug(`제외 (허용되지 않은 도메인): ${String(cand.url).slice(0, 80)}`);
        continue;
      }

      const ext = (cand.url.match(/\.(jpe?g|png|webp|avif)(\?|$)/i)?.[1] || 'jpg').toLowerCase();
      const dest = path.join(DIRS.photos, `${prefix}-bg${slot}.${ext}`);
      try {
        const got = await download(cand.url, dest);

        /* 완전히 같은 파일이 다른 주소로 들어오는 경우는 해시로 막는다.
         * 크기·크롭만 다른 같은 사진은 이걸로 못 잡으므로, 모든 슬롯을 채운 뒤
         * `dropVisualDupes` 가 내용을 비교해 한 번 더 걸러낸다. */
        const contentKey = crypto.createHash('md5').update(fs.readFileSync(got.file)).digest('hex');
        if (used.has(contentKey)) {
          fs.rmSync(got.file, { force: true });
          log.debug(`같은 파일이라 건너뜁니다: ${String(cand.url).slice(0, 70)}`);
          continue;
        }
        const montage = looksLikeMontage(got.file);
        if (montage) {
          fs.rmSync(got.file, { force: true });
          used.add(key); // 같은 사진을 다른 슬롯에서 또 받지 않는다
          log.debug(`제외 (합성본): ${montage} · ${String(cand.url).slice(0, 70)}`);
          continue;
        }

        used.add(contentKey);
        used.add(key);
        result[slot] = {
          file: got.file,
          credit: [cand.photographer, cand.license || cand.source?.split('/')[0]]
            .filter(Boolean)
            .join(' · '),
          photographer: cand.photographer || '',
          license: cand.license || '',
          source: cand.source || '',
          pageUrl: cand.pageUrl || '',
          description: cand.description || '',
          isPerson: cand.source === 'wikimedia',
        };
        log.debug(
          `슬롯 ${slot}: ${path.basename(got.file)} ` +
            `(${Math.round(got.bytes / 1024)}KB, ${cand.source})`
        );
        return true;
      } catch (err) {
        log.debug(`다운로드 실패 → 다음 후보: ${err.message} (${cand.url.slice(0, 70)})`);
      }
    }
    return false;
  }

  /* --- 최우선: 원문 기사의 대표 이미지 (images.useSourcePhoto) ------------
   *
   * ⚠️ 저작권 주의 — 기본값은 꺼져 있다.
   *
   * 여기서 쓰는 것은 언론사가 **공유용으로 스스로 노출하는 og:image** 한 장이다
   * (기사 본문의 사진 갤러리를 긁는 것이 아니다). 그래도 언론사 보도사진은
   * 저작권이 있으며, 이 옵션을 켜는 것은 HANDOVER §6 의 방침을 뒤집는 것이다.
   * 국내 법무법인이 이미지 역검색으로 적발해 청구하는 사례가 있고,
   * 애드센스가 붙은 블로그가 표적이 된다. **발행자가 위험을 감수하는 선택이다.**
   *
   * 켜는 경우 최소한 지켜야 할 것:
   *   - 매체명과 원문 링크를 크레딧으로 남긴다 (아래에서 자동 처리)
   *   - 사진 위에 다른 문구를 얹어 원 사진처럼 보이게 하지 않는다
   */
  /** 대표로 쓸 만한 사진 고르기 (OpenCV). 없거나 실패하면 예외를 던진다. */
  async function pickBestThumb(files) {
    const { spawn } = await import('node:child_process');
    const script = path.join(DIRS.root, 'scripts', 'pick_face_frame.py');
    return new Promise((resolve, reject) => {
      // 한글 경로는 argv 를 거치면 Windows 에서 깨진다 → stdin 으로 UTF-8 로 넘긴다
      const p = spawn('python', [script, '--thumb'], { windowsHide: true });
      let out = '';
      const timer = setTimeout(() => { p.kill(); reject(new Error('시간 초과')); }, 60_000);
      p.stdin.write(Buffer.from(files.join('\n'), 'utf8'));
      p.stdin.end();
      p.stdout.on('data', (d) => (out += d));
      p.on('error', (e) => { clearTimeout(timer); reject(e); });
      p.on('close', () => {
        clearTimeout(timer);
        try { resolve(JSON.parse(out.trim().split('\n').pop())); }
        catch { reject(new Error('선별 결과를 읽지 못했습니다')); }
      });
    });
  }

  /* --- 최우선: 영상 소재 글의 장면 캡처 (article.clipShots) ----------------
   *
   * 영상 글에서 독자가 보고 싶은 것은 스톡 사진이 아니라 **그 장면**이다.
   * 임베드가 같은 장면을 재생해 주지만, 목록·검색결과·공유 카드에는
   * 이미지가 필요하므로 캡처를 대표·본문 이미지로 쓴다.
   *
   * ⚠️ 캡처는 제작사 저작물이다. `ytShot.js` 머리말의 원칙을 지킨다 —
   *    해설에 필요한 최소한만, 로고·워터마크를 지우지 않고, 채널명을 크레딧으로 남긴다.
   *    켜고 끄는 것은 `images.useClipShots` (기본 켜짐, 영상 글에서만 동작).
   */
  const mode = article.mode || MODE.TOPIC;

  /* --- 최우선: 눈으로 골라 둔 로컬 사진 폴더 (images.localPhotoDir) --------
   *
   * 여행 글에서 스톡 사진은 기준을 통과하지 못한다. 실측에서 스톡은 "아무 사우나",
   * "두바이 호텔" 을 물어왔다 — 장소·아이템·히트 요소는 정의상 **그 장소의 사진**
   * 이어야 하기 때문이다. 그래서 사람이 먼저 후보를 모으고(`scripts/ig-photos.mjs`)
   * 눈으로 고른 뒤, 그 폴더를 여기로 넘긴다.
   *
   * 어느 사진을 어느 슬롯에 쓸지는 아티클이 정한다 — `imageBriefs[].photo` 에
   * **파일 이름**을 적는다. 적지 않은 슬롯은 폴더 순서대로 남은 사진이 들어간다.
   * 크레딧은 폴더의 `manifest.json`(수집기가 남긴 shortcode·owner·permalink)에서
   * 되짚는다. 파일명만으로는 출처를 알 수 없다.
   *
   * ⚠️ 저작권 — 이 폴더의 사진은 **원저작자 것**이다. 수집은 후보를 눈으로 고르기
   *    위한 것이고 발행 허가가 아니다(manifest.json 의 note). 실제 게시는
   *    ① 임베드/oglink ② 공식·라이선스 사진 ③ 작성자 허락 중 하나로 가야 한다.
   *    이 옵션을 켜는 것은 프리뷰로 배치를 확인하기 위한 용도이며,
   *    그대로 발행하는 위험은 발행자가 진다.
   */
  /* 아티클이 지정한 폴더(`article.photoDir`)가 설정값보다 우선한다.
   * 아티클 JSON 하나만 넘겨도 사진이 따라오게 하려는 것이다 —
   * `node src/cli.js publish out/<글>.json --naver` 로 같은 사진이 다시 실린다. */
  const localDir = article.photoDir || cfg.images.localPhotoDir;
  if (localDir && fs.existsSync(localDir)) {
    const names = fs
      .readdirSync(localDir)
      .filter((n) => /\.(jpe?g|png|webp)$/i.test(n))
      .sort();
    let manifest = {};
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(localDir, 'manifest.json'), 'utf8'));
    } catch {
      log.debug('로컬 사진 폴더에 manifest.json 이 없습니다 — 크레딧을 비웁니다.');
    }
    const byFile = new Map((manifest.items || []).map((it) => [it.file, it]));

    // 슬롯 순서 = 대표 먼저, 그다음 본문 (slotQueries 와 같은 순서)
    const briefs = [
      ...(article.imageBriefs || []).filter((b) => b.placement === 'thumbnail'),
      ...(article.imageBriefs || []).filter((b) => b.placement === 'body'),
    ];
    const taken = new Set();
    const pick = (slot) => {
      const b = briefs[slot];
      const want = b?.photo;
      if (want) {
        const hit = names.find((n) => n === want || n === path.basename(want));
        if (hit) return hit;
        log.warn(`로컬 사진을 찾지 못했습니다: ${want} (슬롯 ${slot})`);
      }
      /* **혼합 모드** — photoQuery 가 있는 슬롯은 검색(원문 사진·스톡)으로 채우려는
       * 슬롯이다. 여기서 로컬 파일을 순차로 먹어 버리면 지정 카드가 자리를 뺏긴다.
       * > 2026-07-29 실측 — 책 글에 카드 2장(photo 지정)만 로컬로 두었는데,
       * > 대표·본문1 이 폴더를 먼저 소진해 카드 슬롯이 그라디언트로 대체됐다. */
      if (b?.photoQuery?.trim()) return null;
      return names.find((n) => !taken.has(n));
    };

    log.warn(
      `로컬 사진 ${names.length}장을 이미지로 사용합니다 (${path.basename(localDir)}). ` +
        '원저작자 사진입니다 — 발행 허가가 아니며 위험은 발행자가 집니다.'
    );
    for (let slot = 0; slot < slots; slot++) {
      const name = pick(slot);
      if (!name) continue; // 이 슬롯은 다른 경로(원문 사진·스톡)가 채운다 — 다음 슬롯은 계속 본다
      taken.add(name);
      const it = byFile.get(name) || {};
      /* 크레딧은 사진의 출처에 따라 다르게 만든다.
       *   위키미디어 공용 → 저작자 + 라이선스 (CC 는 표기가 의무다)
       *   인스타          → @계정
       * 카드 구석에 얹는 `credit` 은 ASCII 만 쓴다 — 한글·일본어 저작자명은
       * 본문 하단 '이미지 출처' 에 그대로 남는다(`photographer`). */
      const isWm = it.source === 'wikimedia';
      /* manifest 가 크레딧을 **직접 적어 두면 그대로 쓴다.**
       * 위키미디어(저작자+라이선스)와 인스타(@계정) 두 모양만 있었는데,
       * 책 글에는 서점 상품컷(예스24·알라딘)과 우리가 만든 카드가 들어온다 —
       * 어느 쪽도 owner/permalink 로는 표현되지 않아 크레딧이 통째로 비었다. */
      const who = it.photographer || (isWm ? it.author || '작자 미상' : it.owner ? `@${it.owner}` : '');
      const license = it.license || (isWm ? 'Wikimedia Commons' : it.permalink ? 'Instagram' : '');
      result[slot] = {
        file: path.join(localDir, name),
        credit:
          it.credit ||
          (isWm
            ? [license, 'Wikimedia Commons'].filter(Boolean).join(' · ')
            : [who, license].filter(Boolean).join(' · ')),
        photographer: who,
        license,
        source: 'local-photo',
        pageUrl: it.permalink || '',
        description: briefs[slot]?.alt || it.alt || '',
        isPerson: false,
      };
      log.debug(`슬롯 ${slot}: ${name}${who ? ` (${who}${isWm ? ` · ${license}` : ''})` : ''}`);
    }
    if (result.some(Boolean)) log.ok(`로컬 사진 ${result.filter(Boolean).length}장 사용`);
    return result; // 로컬 폴더를 쓸 때는 스톡 검색으로 섞지 않는다
  }

  /* 원문 사진이 전부 합성본일 때 대표 자리를 비워 인물 사진에 양보한다.
   * 인물 사진도 못 구하면 이 함수로 되돌린다 (아래 press/person 단계 참고). */
  let restoreThumb = null;
  const clipShots = article.clipShots || [];
  if (can(mode, 'clipShots') && cfg.images.useClipShots !== false && clipShots.length) {
    log.warn(
      `영상 장면 캡처 ${clipShots.length}장을 이미지로 사용합니다 (${article.clipChannel || '유튜브'}). ` +
        '방송 화면은 제작사 저작물입니다 — 위험은 발행자가 집니다.'
    );
    /* 영화 모드는 **대표를 예고편 캡처로 쓰지 않는다.**
     *
     * 대표는 목록·검색결과·공유 카드의 얼굴이다. 예고편의 한 프레임은 그 영화를
     * 대표하지 못한다 — 배급사가 그 일을 위해 만든 것이 **공식 포스터·키아트**다.
     *
     * > 2026-08-01 실측: 캡처가 대표를 차지해 스파이더맨 글의 대표 이미지가
     * >   **퍼니셔(존 번설) 클로즈업**이 됐다. 얼굴이 가장 크게 잡힌 프레임을
     * >   골랐으니 규칙대로였지만, 주인공이 아니었다.
     *
     * 슬롯 0 을 비워 두면 아래 `sourcePhoto` 단계(배급사 키아트)가 채운다. */
    const clipStart = mode === MODE.MOVIE ? 1 : 0;
    for (let slot = clipStart; slot < slots && slot - clipStart < clipShots.length; slot++) {
      const s = clipShots[slot - clipStart];
      if (!s?.file || !fs.existsSync(s.file)) continue;
      result[slot] = {
        file: s.file,
        // 카드 위 크레딧은 ASCII 만 (한글은 본문 하단 '이미지 출처'에 남는다)
        credit: 'YouTube capture',
        photographer: 'YouTube',
        license: 'broadcast still',
        source: 'clip-shot',
        pageUrl: article.clipUrl || '',
        description: `${article.clipChannel || '유튜브'} · ${Math.floor(s.sec / 60)}:${String(
          Math.round(s.sec % 60)
        ).padStart(2, '0')} 장면`,
        isPerson: true, // 인물이 담긴 장면이므로 얼굴 기준으로 크롭 위치를 잡는다
      };
      log.debug(`슬롯 ${slot}: ${path.basename(s.file)} (장면 ${s.sec}초)`);
    }
    if (result.some(Boolean)) {
      log.ok(`장면 캡처 ${result.filter(Boolean).length}장 사용`);
      /* 로컬 사진 분기와 같다 — **스톡 검색으로 섞지 않는다.**
       *
       * 캡처가 몇 장 빠져도 그 자리는 비워 두고 그라디언트로 간다.
       * 영상 글에서 독자가 보려는 것은 '그 장면' 이고, 스톡은 정의상 그 장면이 아니다.
       *
       * > 2026-08-01 실측: 18장 중 2장이 중복 판정으로 지워졌는데(264초·593초)
       * > `clipShots` 에는 경로가 남아 있어, 발행 때 그 2칸을 **스톡으로 채우려**
       * > codex 검색이 돌았다. 나는솔로 출연자를 다룬 캡션 옆에 무관한 스톡 인물
       * > 사진이 실릴 수 있었다 (§7-3 ③ 과 같은 실패).
       *
       * 클립 모드는 sourcePhoto·relatedArticlePhotos 가 모두 false 이고, 방송용
       * 가명을 쓰는 출연자라 위키미디어 인물 검색도 성과가 없다 — 여기서 끝내는 것이
       * 맞다. 부족한 장면은 캡처를 다시 뜨는 것으로 해결한다. */
      const filled = result.filter(Boolean).length;
      /* 영화 모드는 **대표 한 칸만** 아래 단계(배급사 공식 키아트)에 넘긴다.
       * 본문은 캡처로 다 채웠으므로 스톡이 끼어들 자리가 없다. */
      if (mode === MODE.MOVIE && !result[0]) {
        log.info('대표 자리는 배급사 공식 포스터에 넘깁니다 (예고편 프레임은 대표가 아니다).');
      } else {
        if (filled < slots) {
          log.info(`장면 ${slots - filled}칸이 비었습니다 — 스톡으로 채우지 않고 그라디언트로 둡니다.`);
        }
        return result;
      }
    }
  }

  const sourcePool = [article.sourceImage, ...(article.sourceImages || [])].filter(Boolean);
  if (can(mode, 'sourcePhoto') && cfg.images.useSourcePhoto === true && sourcePool.length) {
    const publisher = article.sourcePublisher || '원문 기사';
    log.warn(
      `원문 기사 사진을 사용합니다 (images.useSourcePhoto=true · ${publisher} · 후보 ${sourcePool.length}장). ` +
        '언론사 보도사진은 저작권이 있습니다 — 위험은 발행자가 집니다.'
    );
    // 사진 위 크레딧은 한글을 쓰지 않는다(카드 위 한글 표기 금지).
    // 매체 도메인은 항상 ASCII 라 그대로 쓸 수 있고, 한글 매체명은
    // 본문 하단 '이미지 출처' 목록에만 남는다.
    let host = '';
    try {
      host = new URL(article.sourceUrl || sourcePool[0]).hostname.replace(/^www\.|^m\./, '');
    } catch {
      host = publisher;
    }
    /**
     * 더 크고 덜 압축된 원본을 먼저 시도한다.
     *
     * 언론사는 목록·본문용으로 축소본을 내보낸다. 실측(서울En):
     *   SSC_..._V.jpg.webp  660x503  123KB   ← 기사 본문에 박힌 것
     *   SSC_....jpg.webp    760x580  167KB   ← _V 를 떼면 더 큼
     *   SSC_....jpg         760x580  380KB   ← .webp 도 떼면 압축이 훨씬 덜 됨
     *
     * 축소본을 받아 1200px 로 늘리면 눈에 띄게 뭉개진다.
     * 그래서 화질 좋은 순서로 후보를 만들어 먼저 걸리는 것을 쓴다.
     */
    const upgrade = (url) => {
      const noV = url.replace(/_[VLS](\.[a-z]+)/i, '$1');
      return [...new Set([
        noV.replace(/\.webp$/i, ''),  // 가장 큼 + 압축 적음
        noV,
        url.replace(/\.webp$/i, ''),
        url,                          // 최후 폴백: 원래 주소
      ])];
    };
    // 기사에는 로고·아이콘·기자 프로필 같은 작은 이미지가 섞여 있다.
    // 파일 크기로 1차 거르고, 대표 선별에서 해상도로 한 번 더 거른다.
    /* `/img/bn/` 은 알라딘 프로모션 배너다 — 2026-07-29 실측: 헤일메리 글 수확
     * 9장 중 6장이 컬처패스·신간알림 광고 배너였다. 서점 상품 페이지를 sources 에
     * 넣기 시작하면서 생긴 새 노이즈라 경로로 거른다. */
    const looksTiny = (u) => /(logo|icon|profile|badge|btn_|sprite|blank|\/img\/bn\/|banner)/i.test(u);
    const asCandidate = (url) => ({
      url,
      trusted: true, // 도메인 화이트리스트를 우회한다(원문 기사 한 곳뿐)
      source: 'source-article',
      photographer: host, // 카드에 얹히는 표기 — ASCII
      license: 'press photo',
      pageUrl: article.sourceUrl || '',
      description: `${publisher} 기사 사진`,
    });

    /* 인물 기사는 같은 사진을 반복하지 않고 **서로 다른 컷**을 쓴다.
     * tryFill 이 이미 쓴 URL 을 used 로 걸러 주므로, 슬롯마다 앞에서부터
     * 남은 후보를 넘기면 자연히 다른 사진이 들어간다. */
    for (let slot = 0; slot < slots; slot++) {
      if (result[slot]) continue;
      await tryFill(
        slot,
        sourcePool.filter((u) => !looksTiny(u)).flatMap((u) => upgrade(u).map(asCandidate))
      );
    }

    /* 대표 이미지(슬롯 0)만 다시 고른다.
     *
     * 언론사 og:image 는 한 사람을 두세 컷으로 붙인 **합성본**인 경우가 많다.
     * 대표 이미지에는 제목 글자가 얹히므로, 합성본을 쓰면 이음새 위에 글씨가
     * 걸쳐 얼굴 사이에 글자가 끼는 모양이 된다(2026-07-27 실측).
     *
     * → 받아 둔 사진들 중 **얼굴 하나가 크게 잡힌 단독 컷**을 대표로 올린다.
     *   얼굴이 여러 개면 합성본일 가능성이 높아 감점된다.
     *   파이썬/OpenCV 가 없으면 조용히 기존 순서를 유지한다.
     */
    const pressShots = result.map((r, i) => ({ r, i })).filter((x) => x.r?.source === 'source-article');
    if (pressShots.length > 1) {
      try {
        const scored = await pickBestThumb(pressShots.map((x) => x.r.file));

        /* 최고점이 아니라 **얼굴 하나만 잡힌 후보** 중 최고점을 고른다.
         * 대표 이미지에는 제목이 얹히므로 단독 컷이어야 한다. 점수만 보면
         * 합성본이 뽑히고, 그러면 합성본을 피하려는 이 교체가 무의미해진다. */
        const solos = (scored?.all || []).filter((c) => (c.faces || 0) === 1);
        const best = solos.length ? solos[0] : scored;
        if (solos.length) {
          log.debug(`단독 컷 후보 ${solos.length}개 중 최고점을 대표로 검토합니다.`);
        }

        // 파이썬은 고른 경로를 `best`/`path` 키로 돌려준다.
        // 경로 문자열은 인코딩·구분자 때문에 그대로 안 맞을 수 있어 파일명으로 비교한다.
        const bestPath = best?.path || best?.best || '';
        const bestName = bestPath ? path.basename(bestPath) : '';
        const hit = pressShots.find((x) => path.basename(x.r.file) === bestName);
        if (!hit) log.debug(`대표 후보를 찾지 못했습니다 (best=${bestName || '없음'})`);
        /* 교체는 **확실히 더 나을 때만** 한다.
         * - 얼굴이 아주 작으면(3% 미만) 오탐이거나 배경 인물이라 대표로 못 쓴다.
         * - **얼굴이 2개 이상이면 그것도 합성본이다.** 합성본을 피하려고 교체하는데
         *   또 합성본을 고르면 아무 의미가 없다.
         *
         * > 2026-07-28 실측 — 소지섭 기사:
         * > "슬롯 5 ← 얼굴 2개, 최대 3.7% (기존 슬롯 0 은 합성본일 가능성)" 으로
         * > 교체했는데, 바꿔 넣은 것도 위아래로 두 컷을 이어붙인 합성본이었다.
         * > 이음새 위에 제목이 얹혀 얼굴 사이에 글자가 끼었다.
         *
         * 애매하면 원래 대표(보통 og:image)를 그대로 두는 편이 안전하다. */
        const solo = (best?.faces || 0) === 1;
        const bigEnough = (best?.biggest || 0) >= 3;
        const strong = solo && bigEnough;
        if (hit && !strong) {
          log.debug(
            `대표 교체 안 함 — ${!solo ? `얼굴 ${best?.faces}개(합성본 의심)` : `얼굴이 작음 (${best?.biggest || 0}%)`}`
          );
        }
        if (hit && strong && hit.i !== 0 && result[0]) {
          log.debug(
            `대표 이미지 교체: 슬롯 ${hit.i} ← 얼굴 ${best.faces}개, 최대 ${best.biggest}% ` +
              `(기존 슬롯 0 은 합성본일 가능성)`
          );
          const tmp = result[0];
          result[0] = result[hit.i];
          result[hit.i] = tmp;
        }

        /* 원문 사진에 **단독 컷이 하나도 없으면** 대표 자리를 비운다.
         *
         * 언론사는 한 사람을 두세 컷으로 붙인 합성본을 og:image 로 내보내는 일이
         * 많아, 후보 전부가 합성본인 경우가 생긴다. 그때는 어느 것을 골라도
         * 이음새 위에 제목이 얹힌다.
         *
         * > 2026-07-28 실측 — 소지섭 기사: 후보 5장의 얼굴 수가 2·2·6·6·0 개로
         * > 단독 컷이 없었다. 위아래로 이어붙인 사진 가운데에 제목이 걸쳐
         * > 두 얼굴 사이에 글자가 끼었다.
         *
         * 슬롯 0 을 비워 두면 뒤따르는 위키미디어 인물 사진 단계가 채운다
         * (인물 사진은 단독 컷이다). 인물 사진도 못 구하면 아래에서 되돌린다. */
        if (!solos.length && result[0]) {
          const freed = result[0];
          result[0] = null;
          restoreThumb = () => {
            if (!result[0]) {
              result[0] = freed;
              log.debug('대표 자리를 되돌립니다 — 단독 컷 대체 사진을 못 구했습니다.');
            }
          };
          log.debug('원문 사진에 단독 컷이 없어 대표 자리를 비웁니다 (인물 사진에 양보).');
        }
      } catch (err) {
        log.debug(`대표 이미지 얼굴 선별 생략: ${err.message.slice(0, 80)}`);
      }
    }

    const got = result.filter((r) => r?.source === 'source-article').length;
    log.ok(`원문 기사 사진 ${got}장 사용 (${host})`);
  }

  // --- 0순위: 인물 사진 (위키미디어 공용) ---------------------------------
  // 연예 글처럼 주인공이 사람인 경우, 스톡 사진보다 실물 사진이 훨씬 강하다.
  /* nameEn 이 있는 인물만 검색한다.
   *
   * 프롬프트는 nameEn 을 "**위키백과·위키미디어 공용에 실제로 등재된** 로마자 표기"로
   * 정의하고, 확실하지 않으면 비우라고 지시한다. 즉 **빈 nameEn 은
   * '위키미디어에 없는 사람'이라는 신호**다.
   *
   * 예전에는 `nameEn || nameKo` 로 한글 이름까지 폴백했다. 그래서 나는 솔로처럼
   * 일반인이 방송 활동명(정숙·영호·순자)으로 나오는 글에서 위키미디어를
   * "정숙" 으로 검색해 **전혀 상관없는 사람 사진과 한자 문서 이미지**가 들어갔다.
   * (2026-07-27 실측)
   */
  const people = (article.entities || []).filter((e) => (e.nameEn || '').trim());
  if (cfg.images.usePersonPhotos !== false && people.length) {
    log.info(`인물 사진 검색: ${people.map((p) => p.nameKo || p.nameEn).join(', ')}`);

    /* 대표 이미지(슬롯 0)에는 인물 사진을 쓰지 않는다.
     *
     * 위키미디어 인물 검색은 "이름 + concert/performance" 로만 찾으므로
     * 사실상 **공연 무대 사진**이 걸린다. 그런데 대표 이미지에는 글의
     * 헤드라인이 얹힌다. 그래서 시구 기사에 "메츠 시구, 8-3 승리" 라는
     * 글자와 콘서트 사진이 겹쳐 나오는 일이 실제로 벌어졌다(2026-07-27).
     *
     * 대표 이미지는 자기가 얹은 문구와 맞아야 하므로, 글이 지정한
     * photoQuery(장면 검색어)를 쓰도록 슬롯 0 은 비워 두고
     * 인물 사진은 텍스트가 없는 본문 슬롯(1번부터)에만 넣는다.
     *
     * images.personPhotoOnThumb: true 로 두면 예전처럼 대표에도 쓴다.
     */
    const startSlot = cfg.images.personPhotoOnThumb === true ? 0 : 1;
    for (let slot = startSlot; slot < Math.min(slots, startSlot + people.length); slot++) {
      const person = people[Math.min(slot - startSlot, people.length - 1)];
      const name = person.nameEn || person.nameKo;
      /* mustMatch — 검색 결과가 실제로 이 사람 사진인지 검사한다 (nameMatches 주석 참고) */
      const opts = { allowShareAlike: cfg.images.allowShareAlike !== false, mustMatch: name };
      // 공연 현장 사진이 잘 걸리도록 검색어를 넓혀가며 시도한다
      for (const q of [`${name} concert`, `${name} performance`, name]) {
        try {
          if (await tryFill(slot, await fromWikimedia(q, opts))) break;
        } catch (err) {
          log.debug(`위키미디어 실패 (${q}): ${err.message}`);
        }
      }
    }
    const got = result.filter(Boolean).length;
    if (got) log.ok(`인물 사진 ${got}장 확보 (위키미디어 공용 · 상업 이용 가능 라이선스)`);
    else log.info('라이선스가 열린 인물 사진을 찾지 못해 스톡 사진으로 진행합니다.');
  }

  /* 합성본을 피해 비워 둔 대표 자리를 인물 사진이 채웠는지 확인한다.
   * 못 채웠으면 원문 사진을 되돌린다 — 빈 자리로 두면 그라디언트가 나와
   * 합성본보다 더 나쁘다. */
  if (restoreThumb) {
    if (result[0]) log.debug('대표 이미지를 단독 컷 인물 사진으로 채웠습니다.');
    restoreThumb();
    restoreThumb = null;
  }

  /* --- 스톡 사진을 쓸지 결정한다 -----------------------------------------
   *
   * ⚠️ **특정 장소를 다루는 글에서는 스톡 사진을 쓰면 안 된다.**
   *
   * 스톡 티어는 원래 연예 글용 설계다. 거기서는 사진이 '분위기' 역할이라
   * 무관해도 티가 나지 않았다. 그런데 여행·시설 글은 **그 장소**를 보여줘야 한다.
   * `japanese sauna wooden interior` 로 검색해 나온 아무 사우나 사진은,
   * 라쿠아 글에서는 독자를 속이는 사진이다.
   *
   * > 2026-07-28 실측 — 스파 라쿠아 글에 사진 15장을 채웠더니:
   * >   원문 라쿠아 페이지 9장 (실제 시설) ✅
   * >   Unsplash·Pexels 3장 — 라쿠아가 아닌 아무 온천·거리 사진 ❌
   * >   Openverse 1장 — **두바이 소피텔 호텔** ❌ (도쿄 스파 글이다)
   * >   그라디언트 카드 2장 — 사진을 아예 못 찾음
   *
   * 무관한 사진으로 자리를 채우는 것보다 **실물 9장이 낫다.**
   * 부족한 자리는 공식 SNS 게시물 임베드로 메운다.
   *
   * `images.stockPhotos: false` 로 끈다. 주제 글(재테크·생활정보)처럼 특정 장소가
   * 없는 글에서는 스톡이 여전히 맞으므로 기본값은 켜 둔다. */
  const useStock = cfg.images.stockPhotos !== false;
  if (!useStock) {
    const got = result.filter(Boolean).length;
    log.info(
      `스톡 사진을 쓰지 않습니다 (images.stockPhotos: false). 확보 ${got}/${slots}장 — ` +
        '특정 장소 글에서는 무관한 스톡 사진보다 비우는 편이 낫습니다.'
    );
    return result;
  }

  // --- 1순위: 무료 스톡 API (키가 있는 것부터) ----------------------------
  const apiTiers = [
    ['Pexels', cfg.secrets.pexelsApiKey, fromPexels],
    ['Unsplash', cfg.secrets.unsplashApiKey, fromUnsplash],
    ['Pixabay', cfg.secrets.pixabayApiKey, fromPixabay],
  ].filter(([, key]) => key);

  for (const [name, key, fn] of apiTiers) {
    for (let slot = 0; slot < slots; slot++) {
      if (result[slot]) continue;
      try {
        await tryFill(slot, await fn(queries[slot], key));
      } catch (err) {
        log.debug(`${name} 실패 (${queries[slot]}): ${err.message}`);
      }
    }
  }

  // --- 2순위: codex 웹 검색 (Pexels 원본 URL 을 잘 찾아온다) --------------
  let missing = result.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0);
  if (missing.length) {
    log.info(`codex 웹 검색으로 사진 ${missing.length}장을 찾는 중...`);
    try {
      const viaCodex = await fromCodex(article, queries, missing.length, cfg);
      log.debug(`codex 후보 ${viaCodex.length}건`);
      /* **그 슬롯을 위해 찾은 후보만** 쓴다.
       *
       * 예전에는 맞는 후보가 없으면 다른 슬롯의 후보(rest)로 채웠다. 빈 슬롯보다
       * 낫다는 판단이었지만, 슬롯의 캡션·alt 는 검색어를 전제로 쓰여 있어서
       * **사진과 글이 어긋난다.**
       *
       * > 2026-07-30 실측 — 황정민 글: '뒷모습 커플'(관계 정리) 자리에 그린스크린
       * > 뉴스 스튜디오가, '라이브 마이크' 자리에 외국인 스트리머 얼굴이 들어갔다.
       * > 캡션은 여전히 원래 검색어를 설명하고 있었다.
       *
       * 틀린 사진이 실리는 쪽이 비어 있는 쪽보다 나쁘다 (§ 설계 원칙). */
      for (const slot of missing) {
        await tryFill(slot, viaCodex.filter((p) => p.forSlot === slot));
      }
      const dropped = viaCodex.filter((p) => !missing.includes(p.forSlot)).length;
      if (dropped) log.debug(`슬롯이 다른 codex 후보 ${dropped}건은 쓰지 않습니다 (캡션과 어긋남).`);
    } catch (err) {
      log.warn(`codex 사진 검색 실패: ${err.message}`);
    }
  }

  // --- 3순위: Openverse (키 불필요 폴백) ----------------------------------
  missing = result.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0);
  for (const slot of missing) {
    try {
      await tryFill(slot, await fromOpenverse(queries[slot]));
    } catch (err) {
      log.debug(`Openverse 실패 (${queries[slot]}): ${err.message}`);
    }
  }

  /* 같은 사진이 두 번 실리는 것을 **내용으로** 걸러낸다.
   *
   * 파일명·URL 로는 못 잡는다. 같은 사진을 여러 매체가 서로 다른 크기·크롭으로
   * 배포하기 때문이다 (실측: 김부장 포스터가 640x360 잘린 것과 1000x700 온전한
   * 것으로 들어와 본문에 두 번 실렸다).
   *
   * 파이썬/OpenCV 가 없으면 조용히 넘어간다 — 중복이 남는 편이 글이 안 나오는
   * 것보다 낫다. */
  await dropVisualDupes(result);

  const ok = result.filter(Boolean).length;
  if (ok === slots) log.ok(`실사 배경 ${ok}장 확보`);
  else if (ok > 0) log.warn(`실사 배경 ${ok}/${slots}장 확보 — 나머지는 그라디언트로 처리합니다.`);
  else log.warn('실사 배경을 하나도 받지 못했습니다. 그라디언트 배경으로 진행합니다.');

  return result;
}
