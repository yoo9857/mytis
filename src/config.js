import fs from 'node:fs';
import { FILES, DIRS } from './paths.js';

/** 의존성 없는 최소 .env 파서 (스크립트에서도 쓴다 — book-today.mjs) */
export function loadEnvFile(file = FILES.env) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function deepMerge(base, override) {
  const result = { ...base };
  for (const [k, v] of Object.entries(override || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof base?.[k] === 'object') {
      result[k] = deepMerge(base[k], v);
    } else if (v !== undefined) {
      result[k] = v;
    }
  }
  return result;
}

const DEFAULTS = {
  blog: {
    name: '',
    // 카테고리 이름, 또는 "auto" (글 내용에 맞춰 자동 선택).
    // 빈 값이면 티스토리가 직전 글의 카테고리를 물려주므로 "카테고리 없음"으로 강제한다.
    category: '',
    // "auto" 가 확신하지 못했을 때 쓸 카테고리 (비우면 "카테고리 없음")
    categoryFallback: '',
    // 카테고리 이름 → 본문에서 찾을 낱말들. src/category.js 의 기본값에 더해진다.
    categoryAliases: {},
    visibility: 'public',
    acceptComment: true,
    publishMode: 'now',
    reserveAfterMinutes: 10,
    /* 발행 후 이 시간을 두고 **한 번 더** 공개 여부를 본다 (0 이면 끔).
     * 티스토리는 연속 발행을 스팸으로 보면 이미 올라간 글을 뒤에 내린다 —
     * 직후 200 만 보고 성공을 선언하면 "발행 완료" 가 거짓이 된다 (§ tistory.js). */
    verifySettleMs: 25_000,
    /* 직전 발행에서 이 시간이 지나지 않으면 **예약 발행로 돌린다** (pace.js).
     * 티스토리 연속 발행 캡차를 만나지 않기 위한 값이다 — 0 이면 끔.
     * 2026-08-05 실측: 한 시간 안 4연속 시도에서 4번 모두 캡차가 떴다. */
    minPublishGapMinutes: 45,
  },
  article: {
    language: 'ko',
    minChars: 3000,
    sectionCount: 7,
    tagCount: 8,
    faqCount: 5,
    tone: '친근하지만 근거를 분명히 대는 전문 정보 블로그 톤.',
    audience: '해당 주제를 처음 검색해 본 한국 일반 독자',
    extraInstructions: '',
  },
  /**
   * 네이버 블로그. 티스토리와 **별도 블록**으로 둔다.
   *
   * 왜 blog 블록에 섞지 않는가: 카테고리 이름·공개 범위 값·태그 상한이 서로 다르고
   * (네이버는 태그 30개, '이웃공개' 라는 제3의 공개 범위가 있다), 무엇보다
   * 한 플랫폼 설정을 고치다 다른 쪽을 조용히 바꿔 버리는 일을 막아야 한다.
   */
  naver: {
    blogId: '', // blog.naver.com/{여기}
    category: '', // 게시판(카테고리) 이름. "auto" 면 글 내용에 맞춰 고른다
    categoryFallback: '',
    categoryAliases: {},
    visibility: 'public', // 'public' | 'neighbor'(이웃공개) | 'private'
    allowComment: true,
    allowSearch: true, // '검색 허용' — 끄면 네이버 검색에 안 잡힌다
    tagCount: 10, // 네이버 상한은 30개
    publishMode: 'now',
    /* 사진 2장을 나란히 묶는 콜라주.
     * 여행 글에서는 끈다 — 참고 글 6편이 모두 콜라주 0개였다(learned.md 법칙 ⑨).
     * 사진이 주인공이므로 한 장씩 크게 세운다. */
    collage: false,
    /* '이 글의 핵심' 요약 목록. 맨 위 '한 줄 정리' 와 겹쳐 결론을 두 번 말하게 되므로
     * 네이버 글에서는 끈다 (2026-07-28 사용자 결정). 티스토리·JSON-LD 는 그대로 쓴다. */
    keyTakeaways: false,
  },
  news: {
    query: '한국 연예 뉴스',
    count: 5,
    hours: 24,
  },
  seo: {
    includeEmbeds: true,
    embedCount: 2, // 본문에 넣을 공식 영상 개수. 실제 현장 장면을 보여주는 핵심 수단
    includeJsonLd: true,
    includeTableOfContents: true,
    includeKeyTakeaways: true,
    includeFaq: true,
    includeSources: true,
  },
  images: {
    enabled: true,
    thumbnail: true,
    bodyImages: 2,
    brand: 'moneyti',
    width: 1200,
    height: 630,
    thumbSize: 1200, // 대표 이미지는 정사각 (티스토리 목록·공유 카드가 정사각으로 잘림)
    thumbLayout: 'clean', // 정보 최소화 · 우하단 심플 라벨
    bodyStyle: 'photo', // 'photo' = 텍스트 없는 사진 그대로 | 'card' = 텍스트 카드
    bodyAspects: ['3:2', '4:3', '3:4', '1:1', '2:3'], // 세로 사진도 섞이게
    background: 'photo', // 'photo' = 실사 사진 배경, 'gradient' = 그라디언트만
    scrim: 0.55, // 사진 위 어둡게 덮는 정도 (0~1). 글자 가독성용
    // 사진 색보정(룩). 출처가 다른 사진들의 톤을 통일한다. images.js 의 LOOKS 참고
    //   'none' | 'neutral' | 'canon'(따뜻·고채도) | 'film'
    //   'fuji'(클래식크롬 — 저채도·고콘트라스트) | 'fujiSoft'(감성·에어리)
    //   'velvia'(풍경 고채도) | 'eterna'(시네마 평탄)
    //   인스타 감성(소프트 글로우 포함): 'instaRosy'(살구·핑크) |
    //   'instaAiry'(민트·청량) | 'goldenHour'(해질녘 금빛)
    // 비교: node scripts/look-compare.mjs <사진…>
    look: 'neutral',
    /* 스톡 사진(Pexels·Unsplash·Openverse) 사용 여부.
     * **특정 장소를 다루는 글(여행·호텔·시설)에서는 false 로 끄세요.**
     * 그 장소가 아닌 아무 사진이 실려 독자를 속이게 됩니다 — photo.js 주석 참고. */
    stockPhotos: true,
    /* 눈으로 골라 둔 로컬 사진 폴더 (`out/photos/ig/<제목>/` 같은 곳).
     * 채우면 스톡 검색을 건너뛰고 이 폴더의 사진만 쓴다 — 여행·시설 글의 정답.
     * 어느 사진을 어느 자리에 쓸지는 `imageBriefs[].photo` 에 파일 이름으로 적는다.
     * ⚠️ 원저작자 사진이면 발행 허가가 아니다 — photo.js 의 localPhotoDir 주석 참고. */
    localPhotoDir: '',
    showCredit: true, // 사진 출처를 카드 구석에 표기
    style: 'trendy', // 'trendy'(팬 콘텐츠 감성) | 'editorial'(정보성 사설 톤) | 'mixed'
    layout: '', // 비우면 글마다 자동으로 다른 연출. 고정하려면 레이아웃 이름
    useStats: true, // 본문 핵심 수치를 카드에 표시
    photoTimeoutMs: 300000, // 사진 검색 제한 시간. 넘기면 그라디언트로 폴백
    usePersonPhotos: true, // 인물이 주제면 위키미디어 공용에서 실물 사진을 먼저 찾는다
    allowShareAlike: true, // CC BY-SA 사진 허용 여부. false 로 두면 CC BY·CC0·PD 만 사용
    palettes: [['#1e1b4b', '#4c1d95', '#7c3aed']],
  },
  buzz: {
    enabled: true, // 영상 글에서 커뮤니티 반응·목격담을 모아 프롬프트에 실어 준다
    count: 12,
  },
  social: {
    enabled: true,
    platforms: ['x', 'instagram'], // 최신 근황을 공식 게시물 임베드로 보여준다
    count: 2,
    maxAgeDays: 180, // 이보다 오래된 게시물은 '근황'이 아니다
    requirePhoto: true, // 사진 없는 글은 근황 사진 역할을 못 한다
    // 공식 계정은 codex 가 웹 검색으로 찾는다(풀오토). 아래는 그 결과를 덮는
    // 수동 예외용 — 인물명 → @핸들. 평소에는 비워 두면 된다.
    handles: {},
  },
  codex: {
    model: '', // 실제 codex CLI 에 넘길 모델명. 사진 검색·뉴스 탐색 등 모든 codex 호출에 쓰인다.
    reasoningEffort: 'medium',
    search: true,
    timeoutMs: 1200000,
    // 비우면 codex CLI 를 그대로 쓴다. 'deepseek' 로 두면 집필 단계만 DeepSeek API 직접
    // 호출로 바뀐다 — DeepSeek 는 codex 의 웹검색 도구가 없어 그 단계의 search 는 꺼진다.
    provider: '',
    deepseekModel: 'deepseek-v4-pro', // provider가 'deepseek'일 때만 쓰는, codex.model 과 분리된 값
  },
  browser: {
    headless: false,
    channel: 'chrome',
    slowMo: 50,
    timeoutMs: 60000,
    manualLoginWaitMs: 180000,
  },
};

let cached = null;

export function loadConfig({ reload = false } = {}) {
  if (cached && !reload) return cached;

  /* `.env` 파일 값과 프로세스 환경변수를 **따로 들고 있는다.**
   * 아래 "블로그를 갈아탔으면 카테고리를 물려주지 않는다" 판단에 둘의 구분이 필요하다. */
  const fileEnv = loadEnvFile(FILES.env);
  const env = { ...fileEnv, ...process.env };

  /**
   * 블로그를 명령줄에서 **다른 곳으로** 갈아탔는가.
   *
   * 티스토리가 두 개다(classic-m 연예 / eco-m 경제). `.env` 기본값은 classic-m 이고
   * 경제 글은 `TISTORY_BLOG=eco-m` 으로 갈아타 발행한다. 그런데 카테고리는
   * `.env` 의 `TISTORY_CATEGORY` 가 그대로 따라와서, **다른 블로그에 없는
   * 카테고리를 찾다가 실패한다.**
   *
   * > 2026-08-03 실측 사고: eco-m 에 부동산 글을 발행했는데 `.env` 의
   * > `TISTORY_CATEGORY=스타·연예인` 이 config.json 의 `"auto"` 를 덮어써서
   * > "카테고리 없음" 으로 나갔다. 발행 후에는 본문을 고칠 수 없다.
   */
  const blogSwitched =
    !!process.env.TISTORY_BLOG &&
    !!fileEnv.TISTORY_BLOG &&
    process.env.TISTORY_BLOG.trim() !== fileEnv.TISTORY_BLOG.trim();
  const naverSwitched =
    !!process.env.NAVER_BLOG &&
    !!fileEnv.NAVER_BLOG &&
    process.env.NAVER_BLOG.trim() !== fileEnv.NAVER_BLOG.trim();

  let fileCfg = {};
  if (fs.existsSync(FILES.config)) {
    try {
      fileCfg = JSON.parse(fs.readFileSync(FILES.config, 'utf8').replace(/^﻿/, ''));
    } catch (err) {
      throw new Error(`config.json 파싱 실패: ${err.message}`);
    }
  }

  const cfg = deepMerge(DEFAULTS, fileCfg);

  // .env 가 config.json 을 덮어씀
  if (env.TISTORY_BLOG) cfg.blog.name = env.TISTORY_BLOG;
  /* 블로그를 갈아탔으면 `.env` 의 카테고리는 **쓰지 않는다** (위 blogSwitched 주석).
   * 명령줄에서 카테고리를 직접 준 경우는 그것이 이긴다 — 사람이 명시한 것이다.
   * 둘 다 없으면 config.json 값이 남는다 (보통 "auto" — 글 내용으로 고른다). */
  const tistoryCategory = blogSwitched ? process.env.TISTORY_CATEGORY : env.TISTORY_CATEGORY;
  if (tistoryCategory) cfg.blog.category = tistoryCategory;
  if (env.NAVER_BLOG) cfg.naver.blogId = env.NAVER_BLOG;
  const naverCategory = naverSwitched ? process.env.NAVER_CATEGORY : env.NAVER_CATEGORY;
  if (naverCategory) cfg.naver.category = naverCategory;
  if (env.MONEYTI_HEADLESS === '1') cfg.browser.headless = true;
  if (env.MONEYTI_HEADLESS === '0') cfg.browser.headless = false;
  if (env.CODEX_PROVIDER) cfg.codex.provider = env.CODEX_PROVIDER;
  if (env.DEEPSEEK_MODEL) cfg.codex.deepseekModel = env.DEEPSEEK_MODEL;

  cfg.secrets = {
    kakaoId: env.KAKAO_ID || '',
    kakaoPw: env.KAKAO_PW || '',
    naverId: env.NAVER_ID || '',
    naverPw: env.NAVER_PW || '',
    pexelsApiKey: env.PEXELS_API_KEY || '',
    unsplashApiKey: env.UNSPLASH_ACCESS_KEY || '',
    pixabayApiKey: env.PIXABAY_API_KEY || '',
    deepseekApiKey: env.DEEPSEEK_API_KEY || '',
  };
  cfg.verbose = env.MONEYTI_VERBOSE === '1';
  cfg.profileDir = DIRS.profile;

  cached = cfg;
  return cfg;
}

/** 블로그 이름에서 admin URL 생성 */
export function blogUrls(cfg) {
  const name = (cfg.blog.name || '').trim();
  if (!name || name === 'CHANGE-ME') {
    throw new Error(
      '블로그 주소가 설정되지 않았습니다. config.json 의 blog.name 또는 .env 의 TISTORY_BLOG 를 채워주세요. ' +
        '(myblog.tistory.com 이면 myblog)'
    );
  }
  const host = name.includes('.') ? name : `${name}.tistory.com`;
  return {
    host,
    home: `https://${host}/`,
    newPost: `https://${host}/manage/newpost/`,
    manage: `https://${host}/manage/posts`,
    login: 'https://www.tistory.com/auth/login',
  };
}

/**
 * 네이버 블로그 URL 묶음.
 *
 * 글쓰기 주소는 후보를 둘 준다. 네이버가 신·구 경로를 둘 다 살려 두고 있고
 * 계정에 따라 한쪽이 리다이렉트로만 동작하는 경우가 있어서다.
 * 실제로 어느 쪽이 열리는지는 `npm run probe:naver` 로 확인한다.
 */
export function naverUrls(cfg) {
  const id = (cfg.naver?.blogId || '').trim().replace(/^https?:\/\/blog\.naver\.com\//, '').replace(/\/.*$/, '');
  if (!id) {
    throw new Error(
      '네이버 블로그 아이디가 없습니다. .env 의 NAVER_BLOG 또는 config.json 의 naver.blogId 를 채워주세요. ' +
        '(blog.naver.com/myblog 이면 myblog)'
    );
  }
  return {
    platform: 'naver',
    blogId: id,
    host: 'blog.naver.com',
    home: `https://blog.naver.com/${id}`,
    // 새 경로 → 구 경로 순으로 시도한다
    writeCandidates: [
      `https://blog.naver.com/${id}/postwrite`,
      `https://blog.naver.com/PostWriteForm.naver?blogId=${id}`,
    ],
    newPost: `https://blog.naver.com/${id}/postwrite`,
    manage: `https://admin.blog.naver.com/${id}`,
    /* `mode=form` 을 붙이지 않는다. 그걸 붙이면 **이미 로그인된 세션도** 로그인 폼을
     * 그대로 보여줘서, 자동화가 아무 일도 없는 폼 앞에서 대기 시간을 다 태운다. */
    login: 'https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fwww.naver.com',
  };
}

export function validateNaverForPublish(cfg) {
  const problems = [];
  if (!cfg.naver?.blogId) {
    problems.push('naver.blogId (config.json) 또는 NAVER_BLOG (.env) 가 비어 있습니다.');
  }
  if (!cfg.secrets.naverId || !cfg.secrets.naverPw) {
    problems.push(
      'NAVER_ID / NAVER_PW (.env) 가 비어 있습니다. 자동 로그인을 쓰지 않으려면 먼저 `npm run login:naver` 로 수동 로그인하세요.'
    );
  }
  return problems;
}

export function validateForPublish(cfg) {
  const problems = [];
  if (!cfg.blog.name || cfg.blog.name === 'CHANGE-ME') {
    problems.push('blog.name (config.json) 또는 TISTORY_BLOG (.env) 가 비어 있습니다.');
  }
  if (!cfg.secrets.kakaoId || !cfg.secrets.kakaoPw) {
    problems.push(
      'KAKAO_ID / KAKAO_PW (.env) 가 비어 있습니다. 자동 로그인을 쓰지 않으려면 먼저 `npm run login` 으로 수동 로그인하세요.'
    );
  }
  return problems;
}
