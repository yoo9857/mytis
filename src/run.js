import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DIRS, stamp, safeSlug } from './paths.js';
import { log, fmtDuration } from './log.js';
import { blogUrls, validateForPublish } from './config.js';
import { writeArticle, saveArticle } from './codexWriter.js';
import { fillEmbeds } from './youtube.js';
import { renderImages } from './images.js';
import { buildHtml, previewDocument } from './html.js';
import { launchBrowser, firstPage, saveSession } from './browser.js';
import { ensureLoggedIn } from './kakaoLogin.js';
import { publishPost } from './tistory.js';

/** 렌더링된 이미지들을 업로드 순서대로 정렬하고 자리표시자를 부여한다. */
function mapImages(rendered) {
  const ordered = [rendered.thumbnail, ...rendered.body].filter(Boolean);
  const files = ordered.map((i) => i.file);

  const withPlaceholders = {
    thumbnail: rendered.thumbnail
      ? { placeholder: '{{IMAGE_0}}', alt: rendered.thumbnail.alt, caption: '' }
      : null,
    body: rendered.body.map((b, i) => ({
      placeholder: `{{IMAGE_${(rendered.thumbnail ? 1 : 0) + i}}}`,
      alt: b.alt,
      caption: b.caption,
      afterSection: b.afterSection,
    })),
  };

  const withLocalSrc = {
    thumbnail: rendered.thumbnail
      ? { src: pathToFileURL(rendered.thumbnail.file).href, alt: rendered.thumbnail.alt }
      : null,
    body: rendered.body.map((b) => ({
      src: pathToFileURL(b.file).href,
      alt: b.alt,
      caption: b.caption,
      afterSection: b.afterSection,
    })),
  };

  // CC 라이선스 사진은 저작자 표기가 의무 — 본문 하단에 남길 목록
  const credits = ordered
    .map((i) => i.background)
    .filter((b) => b && (b.photographer || b.credit));

  return { files, withPlaceholders, withLocalSrc, credits };
}

/**
 * 주제 → 글 생성 → 이미지 생성 → HTML 조립.  발행은 하지 않는다.
 */
export async function generate(topic, cfg) {
  log.banner('1단계 · 글 생성');
  const article = await writeArticle({ topic, cfg });

  // 실제 장면은 공식 영상 임베드로 보여준다. 사진은 저작권 때문에 못 가져오지만
  // 임베드는 유튜브가 제공하는 기능이라 문제가 없고, 현장을 그대로 담는다.
  try {
    article.embeds = await fillEmbeds(article, cfg);
  } catch (err) {
    log.warn(`영상 임베드 확보 실패: ${err.message}`);
  }

  const articleFile = saveArticle(article);

  log.banner('2단계 · 이미지 생성');
  const rendered = await renderImages(article, cfg);
  const images = mapImages(rendered);

  log.banner('3단계 · HTML 조립');
  const html = buildHtml(article, {
    cfg,
    images: images.withPlaceholders,
    imageCredits: images.credits,
  });
  const preview = previewDocument(
    article,
    buildHtml(article, { cfg, images: images.withLocalSrc, imageCredits: images.credits })
  );

  fs.mkdirSync(DIRS.out, { recursive: true });
  const previewFile = path.join(DIRS.out, `${stamp()}-${safeSlug(article.title)}.preview.html`);
  fs.writeFileSync(previewFile, preview, 'utf8');

  log.ok(`HTML ${html.length.toLocaleString()}자 · 미리보기: ${previewFile}`);

  return { article, articleFile, rendered, images, html, previewFile };
}

/**
 * 이미 만들어진 아티클을 티스토리에 발행한다.
 */
export async function publish({ article, html, imageFiles }, cfg) {
  const problems = validateForPublish(cfg);
  if (problems.length) {
    // 계정 정보가 없어도 저장된 프로필 세션으로 발행 가능할 수 있으므로 경고만 남긴다
    for (const p of problems) log.warn(p);
    if (!cfg.blog.name || cfg.blog.name === 'CHANGE-ME') {
      throw new Error('블로그 주소가 없어 발행할 수 없습니다.');
    }
  }

  const urls = blogUrls(cfg);
  log.banner('4단계 · 티스토리 발행');
  log.info(`대상 블로그: ${urls.host}`);

  const ctx = await launchBrowser(cfg);
  try {
    const page = await firstPage(ctx);
    await ensureLoggedIn(page, cfg, urls);
    // 쿠키가 갱신됐을 수 있으니 다시 저장해 다음 무인 실행에 대비한다
    await saveSession(ctx, cfg);

    const result = await publishPost(page, urls, cfg, {
      title: article.title,
      html,
      imageFiles,
      tags: article.tags,
      urlSlug: article.urlSlug,
    });

    if (!result.ok) {
      throw new Error(result.reason || '발행에 실패했습니다.');
    }
    return result;
  } finally {
    // 브라우저 종료 전 세션이 디스크에 flush 되도록 잠시 대기
    await new Promise((r) => setTimeout(r, 1200));
    await ctx.close().catch(() => {});
  }
}

/**
 * 주제 하나를 끝까지(생성 → 발행) 처리한다.
 */
export async function runTopic(topic, cfg, { publish: doPublish = true } = {}) {
  const started = Date.now();
  log.banner(`주제: ${topic}`);

  const gen = await generate(topic, cfg);

  if (!doPublish) {
    log.banner('완료 (초안만 생성)');
    log.ok(`아티클: ${gen.articleFile}`);
    log.ok(`미리보기: ${gen.previewFile}`);
    log.info(`소요 시간: ${fmtDuration(Date.now() - started)}`);
    return { ...gen, published: false };
  }

  const result = await publish(
    { article: gen.article, html: gen.html, imageFiles: gen.images.files },
    cfg
  );

  log.banner('완료');
  log.ok(`제목: ${gen.article.title}`);
  log.ok(`태그: ${gen.article.tags.join(', ')}`);
  if (result.postUrl) log.ok(`발행 주소: ${result.postUrl}`);
  else log.ok(`발행 완료 (${result.url})`);
  log.info(`소요 시간: ${fmtDuration(Date.now() - started)}`);

  return { ...gen, published: true, result };
}
