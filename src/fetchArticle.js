import { chromium } from 'playwright';
import { log } from './log.js';

/**
 * 기사 URL 에서 본문 텍스트와 메타데이터를 뽑아낸다.
 *
 * codex 는 샌드박스 안에서 돌기 때문에 셸로 URL 을 직접 받을 수 없다.
 * 그래서 우리가 Playwright 로 페이지를 열어 본문만 추려서 프롬프트에 실어 보낸다.
 * 광고·관련기사·추천 링크 같은 잡음을 걷어내는 게 핵심이다.
 */

const NOISE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'nav',
  'header',
  'footer',
  'aside',
  'form',
  'ins',
  '.ad',
  '[class*="banner"]',
  '[class*="advert"]',
  '[class*="sponsor"]',
  '[class*="related"]',
  '[class*="recommend"]',
  '[class*="comment"]',
  '[class*="share"]',
  '[class*="sns"]',
  '[id*="ad-"]',
  '[id*="taboola"]',
  '[id*="outbrain"]',
];

/** 페이지 안에서 실행되는 본문 추출기 */
function extractInPage(noiseSelectors) {
  const clean = (s) =>
    String(s || '')
      .replace(/ /g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const meta = (name) =>
    document
      .querySelector(
        `meta[property="${name}"], meta[name="${name}"], meta[itemprop="${name}"]`
      )
      ?.content?.trim() || '';

  // 잡음 제거
  for (const sel of noiseSelectors) {
    for (const el of document.querySelectorAll(sel)) el.remove();
  }

  // 본문 후보: 문단 텍스트가 가장 많이 뭉쳐 있는 컨테이너
  const candidates = [
    ...document.querySelectorAll('article, main, [itemprop="articleBody"], .article_content, #content, .news_txt, [class*="article"], [class*="content"], [class*="body"]'),
  ];

  let best = null;
  let bestScore = 0;
  for (const el of candidates) {
    const paras = [...el.querySelectorAll('p, br')].length;
    const text = el.innerText || '';
    // 문단이 있고 길이가 긴 컨테이너에 가점. 링크 비중이 높으면 감점.
    const links = [...el.querySelectorAll('a')].length;
    const score = text.length + paras * 40 - links * 60;
    if (score > bestScore && text.length > 200) {
      bestScore = score;
      best = el;
    }
  }

  const bodyText = clean(best ? best.innerText : document.body?.innerText || '');

  /* 본문에 실린 사진들.
   * 로고·아이콘·프로필·광고를 걸러내려고 실제 렌더 크기로 판별한다.
   * (기사 사진은 보통 가로 400px 이상이다) */
  const scope = best || document.body;
  const bodyImages = [...(scope?.querySelectorAll('img') || [])]
    .map((img) => {
      const src =
        img.currentSrc ||
        img.src ||
        img.getAttribute('data-src') ||
        img.getAttribute('data-original') ||
        '';
      return {
        url: src,
        w: img.naturalWidth || img.width || 0,
        h: img.naturalHeight || img.height || 0,
        alt: (img.alt || '').trim().slice(0, 120),
      };
    })
    .filter((i) => /^https?:\/\//.test(i.url))
    .filter((i) => i.w >= 400 && i.h >= 260)                 // 썸네일·아이콘 제외
    .filter((i) => !/logo|icon|profile|badge|banner|ad[-_]/i.test(i.url))
    .filter((i, idx, arr) => arr.findIndex((x) => x.url.split('?')[0] === i.url.split('?')[0]) === idx)
    .slice(0, 8);

  return {
    title: clean(meta('og:title') || document.querySelector('h1')?.innerText || document.title),
    publisher: clean(meta('og:site_name') || location.hostname),
    publishedAt: clean(
      meta('article:published_time') || meta('datePublished') || meta('pubdate')
    ),
    description: clean(meta('og:description') || meta('description')),
    // 언론사가 공유용으로 스스로 노출하는 대표 이미지.
    // images.useSourcePhoto 를 켜면 대표 이미지로 쓴다(§ 저작권 주의 — HANDOVER 참고).
    image: clean(meta('og:image') || meta('twitter:image')),
    // 기사 본문에 실린 사진들 (대표 이미지 다음으로 쓴다).
    // 인물 기사는 같은 사진을 반복하지 않고 서로 다른 컷을 쓰는 게 낫다.
    images: bodyImages,
    text: bodyText,
  };
}

/**
 * @param {string} url
 * @param {object} cfg
 * @param {number} [maxChars] 프롬프트에 실을 최대 길이
 * @returns {Promise<{url,title,publisher,publishedAt,description,text}|null>}
 */
export async function fetchArticle(url, cfg, maxChars = 12_000) {
  let browser = null;
  try {
    log.step('기사 본문 읽는 중');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      locale: 'ko-KR',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
    });
    page.setDefaultTimeout(30_000);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40_000 });
    await page.waitForTimeout(1500);

    const info = await page.evaluate(extractInPage, NOISE_SELECTORS);

    if (!info.text || info.text.length < 150) {
      log.warn(`기사 본문을 충분히 추출하지 못했습니다 (${info.text?.length || 0}자).`);
      return { url, ...info, text: info.text || '' };
    }

    const text = info.text.length > maxChars ? `${info.text.slice(0, maxChars)}\n…(이하 생략)` : info.text;

    log.ok(
      `기사 추출 완료: "${info.title.slice(0, 40)}" · ${info.publisher} · 본문 ${info.text.length.toLocaleString()}자`
    );
    return { url, ...info, text };
  } catch (err) {
    log.warn(`기사 읽기 실패 (${err.message}) — codex 웹 검색에만 의존합니다.`);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
