import fs from 'node:fs';
import path from 'node:path';
import { DIRS, FILES, stamp, safeSlug } from './paths.js';
import { log } from './log.js';
import { runCodexJson } from './codexWriter.js';

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

async function fromWikimedia(query, { allowShareAlike = true } = {}) {
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

  /** 후보 목록에서 하나를 골라 슬롯에 내려받는다. */
  async function tryFill(slot, candidates) {
    if (result[slot]) return true; // 이미 채워진 슬롯은 건드리지 않는다
    for (const cand of candidates) {
      if (!cand?.url) continue;
      const key = cand.url.split('?')[0];
      if (used.has(key)) continue;
      if (!cand.trusted && !hostAllowed(cand.url, CODEX_ALLOWED_HOSTS)) {
        log.debug(`제외 (허용되지 않은 도메인): ${String(cand.url).slice(0, 80)}`);
        continue;
      }

      const ext = (cand.url.match(/\.(jpe?g|png|webp|avif)(\?|$)/i)?.[1] || 'jpg').toLowerCase();
      const dest = path.join(DIRS.photos, `${prefix}-bg${slot}.${ext}`);
      try {
        const got = await download(cand.url, dest);
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

  // --- 0순위: 인물 사진 (위키미디어 공용) ---------------------------------
  // 연예 글처럼 주인공이 사람인 경우, 스톡 사진보다 실물 사진이 훨씬 강하다.
  const people = (article.entities || []).filter((e) => e.nameEn || e.nameKo);
  if (cfg.images.usePersonPhotos !== false && people.length) {
    log.info(`인물 사진 검색: ${people.map((p) => p.nameKo || p.nameEn).join(', ')}`);
    // 대표 이미지(슬롯 0)에 주인공 사진을 우선 배치한다
    for (let slot = 0; slot < Math.min(slots, people.length + 1); slot++) {
      const person = people[Math.min(slot, people.length - 1)];
      const name = person.nameEn || person.nameKo;
      const opts = { allowShareAlike: cfg.images.allowShareAlike !== false };
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
      for (const slot of missing) {
        const preferred = viaCodex.filter((p) => p.forSlot === slot);
        const rest = viaCodex.filter((p) => p.forSlot !== slot);
        await tryFill(slot, [...preferred, ...rest]);
      }
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

  const ok = result.filter(Boolean).length;
  if (ok === slots) log.ok(`실사 배경 ${ok}장 확보`);
  else if (ok > 0) log.warn(`실사 배경 ${ok}/${slots}장 확보 — 나머지는 그라디언트로 처리합니다.`);
  else log.warn('실사 배경을 하나도 받지 못했습니다. 그라디언트 배경으로 진행합니다.');

  return result;
}
