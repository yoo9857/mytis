import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DIRS, stamp, safeSlug } from './paths.js';
import { log, fmtDuration } from './log.js';
import { blogUrls, validateForPublish } from './config.js';
import { writeArticle, saveArticle } from './codexWriter.js';
import { fillEmbeds } from './youtube.js';
import { fillSocialEmbeds } from './socialEmbed.js';
import { MODE_LABEL, detectMode, can } from './mode.js';
import { renderImages } from './images.js';
import { buildHtml, previewDocument } from './html.js';
import { launchBrowser, firstPage, saveSession } from './browser.js';
import { ensureLoggedIn } from './kakaoLogin.js';
import { publishPost } from './tistory.js';

/** 렌더링된 이미지들을 업로드 순서대로 정렬하고 자리표시자를 부여한다. */
/**
 * 영상 글에서 사진으로 만들 장면 수의 상한.
 *
 * 잘 되는 리뷰 블로그 6편 실측: **본문 100자당 사진 1장** (2,500자에 25장).
 * 6편 중 5편이 101~105자/장으로 거의 기계적으로 일정했다.
 * 사진이 적으면 글이 벽처럼 보여 중간에 이탈한다.
 */
const MAX_CLIP_SHOTS = 20;

/**
 * 캡처할 장면을 고른다.
 *
 * 스튜디오 컷을 걸러내는 것이 핵심이다. 스튜디오 MC·패널 장면에는 **출연자가
 * 화면에 없어서**, 캡처하면 글과 무관한 사람이 사진으로 실린다.
 *
 * > 2026-07-28 실측: 제목이 "23기 영숙의 침묵" 인 글의 대표 사진에
 * > 출연자도 아닌 **스튜디오 MC** 가 나왔다.
 *
 * 그리고 **주인공이 말하는 장면을 맨 앞으로** 보낸다. 첫 장면이 대표 이미지가
 * 되는데, 제목의 주인공이 대표 사진에 없으면 글이 무너진다.
 */
function pickScenes(article) {
  const lead = (article.entities || [])[0];
  const leadName = (lead?.nameKo || lead?.nameEn || '').trim();

  const all = (article.embeds || [])
    .map((e) => ({
      sec: Math.max(0, parseInt(e.startSeconds, 10) || 0),
      caption: e.caption || e.quote || '',
      afterSection: e.afterSection,
      speaker: (e.speaker || '').trim(),
      isStudio: !!e.isStudio,
    }))
    .filter((s) => s.sec > 0);

  const usable = all.filter((s) => !s.isStudio);
  if (all.length && !usable.length) {
    log.warn('장면이 전부 스튜디오 컷이라 캡처를 건너뜁니다 (출연자가 화면에 없습니다).');
    return [];
  }
  if (usable.length < all.length) {
    log.debug(`스튜디오 컷 ${all.length - usable.length}개 제외 (출연자가 화면에 없음)`);
  }

  const byTime = usable.slice().sort((a, b) => a.sec - b.sec);
  const chosen = byTime.slice(0, MAX_CLIP_SHOTS);

  /* 대표 이미지가 될 첫 장면은 주인공이 말하는 것으로. 나머지는 시간순 그대로. */
  if (leadName) {
    const i = chosen.findIndex((s) => s.speaker && s.speaker.includes(leadName));
    if (i > 0) {
      const [leadScene] = chosen.splice(i, 1);
      chosen.unshift(leadScene);
      log.debug(`대표 장면을 ${leadName} 이(가) 말하는 ${leadScene.sec}초로 앞당깁니다.`);
    } else if (i < 0) {
      log.warn(
        `${leadName} 이(가) 말하는 장면이 없어 대표 사진에 주인공이 안 나올 수 있습니다.`
      );
    }
  }
  return chosen;
}

/**
 * 장면 캡처를 본문 이미지로 배치하고, 임베드는 맨 아래 하나만 남긴다.
 *
 * 왜 이렇게 하나: 장면마다 유튜브 플레이어를 박으면 글이 무거워지고 읽는
 * 흐름이 끊긴다. 사진이 그 장면을 대신 보여주고, 영상은 "직접 확인하고 싶은
 * 독자" 를 위한 출처로 맨 끝에 하나만 두는 편이 읽기 좋다.
 *
 * 첫 장면은 대표 이미지, 나머지는 각자 원래 임베드가 있던 자리에 들어간다.
 * 캡션에는 codex 가 쓴 장면 설명과 시각을 함께 남긴다 — 어느 대목인지
 * 독자가 알 수 있어야 하고, 출처 표기이기도 하다.
 */
function applyClipShotLayout(article, cfg, scenes, shots) {
  const bySec = new Map(shots.map((s) => [s.sec, s]));
  const got = scenes.filter((s) => bySec.has(s.sec));
  if (!got.length) return;

  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const sectionCount = Math.max(1, (article.sections || []).length);
  const oldThumb = (article.imageBriefs || []).find((b) => b.placement === 'thumbnail') || {};

  /* 본문 사진은 **반드시 시간순**으로 실려야 한다.
   *
   * codex 는 장면을 주제별로 묶어 afterSection 을 매기기 때문에, 그대로 두면
   * 21분 얘기를 하다가 18분으로 되돌아간다. 독자는 바로 걸린다.
   *
   * > 2026-07-28 실측 — 광수 글의 사진 배치:
   * >   [2] 21:06 → [3] **18:45** → 29:24 → [6] 46:25 → [7] **40:14**
   * >   두 번 뒤로 감겼다.
   *
   * 그래서 codex 의 afterSection 을 쓰지 않고 **시간순으로 균등 배분**한다.
   *
   * codex 값을 살리면서 뒤로 못 가게 눌러 보기도 했는데, 이상치 하나가
   * 뒤따르는 장면을 전부 끌고 갔다. 위 사례에서 40:14(7번 섹션 지정) 하나 때문에
   * 그 뒤 7장이 모두 7번으로 몰리고 5·6번 섹션은 사진이 사라졌다.
   *
   * 섹션 자체를 시간순으로 쓰게 지시하고 있으므로(prompt.js 의 서사 규칙),
   * 균등 배분이면 내용과도 대체로 맞고 사진이 고르게 퍼진다. */
  const body = got.slice(1).sort((a, b) => a.sec - b.sec);
  const placed = body.map((s, i) => ({
    ...s,
    at: Math.min(sectionCount, Math.max(1, Math.ceil(((i + 1) * sectionCount) / (body.length + 1)))),
  }));

  article.imageBriefs = [
    {
      placement: 'thumbnail',
      headline: oldThumb.headline || article.title,
      subline: oldThumb.subline || '',
      eyebrow: oldThumb.eyebrow || '',
      statValue: oldThumb.statValue || '',
      statLabel: oldThumb.statLabel || '',
      photoQuery: '',
      caption: '',
      alt: `${article.title} — ${mmss(got[0].sec)} 장면`,
      afterSection: 0,
    },
    ...placed.map((s) => ({
      placement: 'body',
      headline: '',
      subline: '',
      eyebrow: '',
      statValue: '',
      statLabel: '',
      photoQuery: '',
      caption: `${mmss(s.sec)} ${s.caption}`.trim(),
      alt: `${article.title} — ${mmss(s.sec)} 장면`,
      afterSection: s.at,
    })),
  ];

  // 캡처 파일도 같은 순서로 맞춘다 (photo.js 가 슬롯 순서대로 가져간다)
  article.clipShots = [got[0], ...placed].map((s) => shots.find((x) => x.sec === s.sec)).filter(Boolean);

  /* 본문 슬롯 수를 장면 수에 맞춘다.
   *
   * ⚠️ `cfg.images.bodyImages` 를 고치면 안 된다. cfg 는 `loadConfig()` 가
   * 캐시해 둔 **단일 객체**이고 큐 모드는 같은 객체로 글을 연달아 만든다.
   * 영상 글 하나가 5장면이면 그 뒤 기사 글들까지 본문 이미지가 4장이 되어
   * 설정이 조용히 오염된다. 그래서 이 글에만 붙는 값으로 넘긴다. */
  article.bodyImageCount = Math.max(0, got.length - 1);

  /* 임베드는 맨 아래 하나만. 글 전체를 아우르는 첫 장면부터 재생되게 한다.
   * afterSection 이 섹션 범위를 벗어나면 html.js 가 본문 끝에 몰아 넣는다. */
  const first = article.embeds?.[0];
  if (first) {
    article.embeds = [{ ...first, afterSection: sectionCount + 1, caption: '', quote: '' }];
  }

  log.info(
    `장면 ${got.length}장을 본문 사진으로 배치하고, 영상 임베드는 맨 아래 1개만 남깁니다.`
  );
}

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

  /* 이 글이 어떤 용도인지는 writeArticle 이 이미 정해 두었다.
   * 단계마다 조건을 새로 세우지 말고 `can(mode, ...)` 로 물어본다 — mode.js 참고. */
  const mode = article.mode || detectMode(topic);
  log.debug(`용도: ${MODE_LABEL[mode]} 모드`);

  // 실제 장면은 공식 영상 임베드로 보여준다. 사진은 저작권 때문에 못 가져오지만
  // 임베드는 유튜브가 제공하는 기능이라 문제가 없고, 현장을 그대로 담는다.
  if (!can(mode, 'youtubeEmbeds')) {
    log.debug(
      `${MODE_LABEL[mode]} 모드 — 같은 영상의 장면 ${(article.embeds || []).length}개를 씁니다 (추가 영상 검색 생략)`
    );

    /* 임베드가 가리키는 그 순간을 이미지로도 남긴다.
     * 임베드는 본문에서 재생되지만 티스토리 목록·검색결과·공유 카드에는
     * 이미지가 필요하다. 시각은 codex 가 지어낸 값이 아니라
     * snapTimestamps 가 실제 자막 시각으로 검증·보정한 값이다. */
    if (can(mode, 'clipShots') && cfg.images.useClipShots !== false) {
      /* 장면마다 **사진 한 장씩**을 만든다.
       *
       * 예전에는 장면 수만큼 임베드를 본문에 흩뿌렸는데, 플레이어가 여러 개
       * 박히면 글이 무거워지고 읽는 흐름이 끊긴다. 사진이 그 자리를 대신하고,
       * 영상은 "직접 보고 싶은 사람" 을 위해 **맨 아래 하나만** 남긴다.
       *
       * 캡처 시각은 codex 가 지어낸 값이 아니라 snapTimestamps 가 실제 자막
       * 시각으로 검증·보정한 값이라 장면 설명과 어긋나지 않는다. */
      const scenes = pickScenes(article);

      if (scenes.length) {
        try {
          const { captureFrames } = await import('./ytShot.js');
          // 캡처는 항상 headless — 창을 띄우면 장면마다 브라우저가 깜빡인다
          const shots = await captureFrames(
            article.clipVideoId,
            scenes.map((s) => s.sec),
            { title: article.title, headless: true }
          );
          article.clipShots = shots;

          if (shots.length) {
            applyClipShotLayout(article, cfg, scenes, shots);
          }
        } catch (err) {
          log.warn(`장면 캡처 실패 — 스톡 사진으로 진행합니다: ${err.message.split('\n')[0]}`);
          article.clipShots = [];
        }
      }
    }
  } else {
    try {
      article.embeds = await fillEmbeds(article, cfg);
    } catch (err) {
      log.warn(`영상 임베드 확보 실패: ${err.message}`);
    }
  }

  /* 최신 근황은 공식 X·인스타 게시물 임베드로 보여준다.
   * 사진을 내려받아 올리면 저작권에 약관 위반까지 겹치지만, 임베드는
   * 원저작자 서버에서 렌더링되므로 문제가 없다. (socialEmbed.js 머리말 참고)
   *
   * 영상 글에서는 건너뛴다. 출연자가 방송용 이름을 쓰는 일반인인 경우가 많아
   * 공식 계정이 존재하지 않는다. (실측: '영숙·영철·영식·광수·옥순' 으로
   * 계정을 찾느라 codex 호출 1분을 버렸고 당연히 0건이었다) */
  if (can(mode, 'socialEmbeds')) {
    try {
      article.socialEmbeds = await fillSocialEmbeds(article, cfg);
    } catch (err) {
      log.warn(`SNS 근황 임베드 확보 실패: ${err.message}`);
      article.socialEmbeds = [];
    }
  } else {
    article.socialEmbeds = [];
    log.debug(`${MODE_LABEL[mode]} 모드 — 공식 SNS 근황 검색을 건너뜁니다.`);
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
      article, // 카테고리 자동 선택의 판단 근거
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
