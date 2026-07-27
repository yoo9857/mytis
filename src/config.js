import fs from 'node:fs';
import { FILES, DIRS } from './paths.js';

/** 의존성 없는 최소 .env 파서 */
function loadEnvFile(file) {
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
    category: '',
    visibility: 'public',
    acceptComment: true,
    publishMode: 'now',
    reserveAfterMinutes: 10,
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
    showCredit: true, // 사진 출처를 카드 구석에 표기
    style: 'trendy', // 'trendy'(팬 콘텐츠 감성) | 'editorial'(정보성 사설 톤) | 'mixed'
    layout: '', // 비우면 글마다 자동으로 다른 연출. 고정하려면 레이아웃 이름
    useStats: true, // 본문 핵심 수치를 카드에 표시
    photoTimeoutMs: 300000, // 사진 검색 제한 시간. 넘기면 그라디언트로 폴백
    usePersonPhotos: true, // 인물이 주제면 위키미디어 공용에서 실물 사진을 먼저 찾는다
    allowShareAlike: true, // CC BY-SA 사진 허용 여부. false 로 두면 CC BY·CC0·PD 만 사용
    palettes: [['#1e1b4b', '#4c1d95', '#7c3aed']],
  },
  codex: {
    model: '',
    reasoningEffort: 'medium',
    search: true,
    timeoutMs: 1200000,
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

  const env = { ...loadEnvFile(FILES.env), ...process.env };

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
  if (env.TISTORY_CATEGORY) cfg.blog.category = env.TISTORY_CATEGORY;
  if (env.MONEYTI_HEADLESS === '1') cfg.browser.headless = true;
  if (env.MONEYTI_HEADLESS === '0') cfg.browser.headless = false;

  cfg.secrets = {
    kakaoId: env.KAKAO_ID || '',
    kakaoPw: env.KAKAO_PW || '',
    pexelsApiKey: env.PEXELS_API_KEY || '',
    unsplashApiKey: env.UNSPLASH_ACCESS_KEY || '',
    pixabayApiKey: env.PIXABAY_API_KEY || '',
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
