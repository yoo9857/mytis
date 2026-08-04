import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DIRS, stamp, safeSlug } from './paths.js';
import { log, fmtDuration } from './log.js';
import { blogUrls, naverUrls, validateForPublish, validateNaverForPublish } from './config.js';
import { writeArticle, saveArticle } from './codexWriter.js';
import { fillEmbeds } from './youtube.js';
import { fillSocialEmbeds } from './socialEmbed.js';
import { MODE, MODE_LABEL, detectMode, can } from './mode.js';
import { renderImages } from './images.js';
import { buildHtml, previewDocument } from './html.js';
import { launchBrowser, firstPage, saveSession } from './browser.js';
import { ensureLoggedIn } from './kakaoLogin.js';
import { ensureLoggedIn as naverEnsureLoggedIn } from './naverLogin.js';
import { publishPost } from './tistory.js';
import { publishPost as naverPublishPost } from './naver.js';

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
/**
 * 영화 모드 — **공식 예고편**에서 캡처할 시각을 정한다.
 *
 * 자막이 없으므로 장면의 뜻을 알 수 없다. 그래서 캡션을 만들지 않고
 * (`caption: ''`) 예고편 길이에 걸쳐 고르게 뜬다.
 *
 * 앞뒤 여유를 두는 이유: 예고편의 맨 앞은 배급사 로고, 맨 끝은 타이틀 카드와
 * 개봉일 자막이라 장면이 아니다.
 */
async function trailerScenes(article, cfg) {
  const ok = (article.embeds || []).filter((e) => /^[A-Za-z0-9_-]{11}$/.test(e.videoId || ''));
  if (!ok.length) {
    log.info('공식 예고편을 찾지 못해 장면 캡처를 건너뜁니다.');
    return [];
  }

  /* **한국 배급사 채널을 먼저 쓴다.**
   *
   * 같은 영화의 공식 예고편이 나라마다 따로 올라온다. 그런데 각국 채널은
   * 그 나라 자막을 화면에 **박아서** 내보낸다 — 캡처하면 그 글자가 그대로 실린다.
   *
   * > 2026-08-01 실측: 채널 이름이 "소니 픽처스 영화" 여서 한국 채널로 보였는데
   * >   캡처에 **일본어 자막**("試練を乗り越えたクモは")이 박혀 나왔다.
   * >   앞선 시도들에서는 호주·영국 채널이 걸렸다.
   *
   * 그래서 채널명·제목에 '코리아/KR/한국' 표식이 있는 것을 먼저 고르고,
   * 없으면 **제목이 한글인 것**을 고른다. 그것도 없으면 첫 번째를 쓴다. */
  const KR_CHANNEL = /코리아|korea|\bkr\b|한국/i;
  const HANGUL = /[가-힣]/;
  const FOREIGN_CHANNEL = /japan|jp\b|日本|ジャパン|australia|\buk\b|india|latin|brasil|españa|france/i;
  const pick =
    ok.find((e) => KR_CHANNEL.test(e.channel || '')) ||
    ok.find((e) => HANGUL.test(e.title || '') && !FOREIGN_CHANNEL.test(e.channel || '')) ||
    ok[0];
  const vid = pick.videoId;

  article.clipVideoId = vid;
  const em = pick;
  article.clipChannel = em.channel || '공식 예고편';
  if (!KR_CHANNEL.test(em.channel || '')) {
    log.warn(
      `예고편 채널이 한국 공식이 아닐 수 있습니다 (${em.channel || '이름 없음'}) — ` +
        '캡처에 다른 나라 자막이 박혀 있는지 확인하세요.'
    );
  }
  article.clipUrl = `https://www.youtube.com/watch?v=${vid}`;

  let dur = 0;
  try {
    const { videoDuration } = await import('./ytClip.js');
    dur = (await videoDuration?.(vid)) || 0;
  } catch {
    /* 길이를 못 얻으면 예고편 표준 길이로 가정한다 */
  }
  if (!dur) dur = 150; // 예고편은 대개 2~2분 30초

  const want = Math.max(4, Math.min(cfg.images.bodyImages + 3, 12));
  const head = Math.round(dur * 0.12); // 배급사 로고 구간을 건너뛴다
  const tail = Math.round(dur * 0.9); // 타이틀 카드 전까지
  const span = Math.max(1, tail - head);
  const secs = Array.from({ length: want }, (_, i) => head + Math.round((span * (i + 1)) / (want + 1)));

  log.info(`공식 예고편에서 장면 ${want}장을 캡처합니다 (${dur}초 · ${article.clipChannel}).`);
  return [...new Set(secs)].map((sec, i) => ({
    sec,
    caption: '', // 자막이 없다 — 추측해서 쓰지 않는다
    quote: '',
    afterSection: 0, // applyClipShotLayout 이 고르게 흩뿌린다
    speaker: '',
    isStudio: false,
    isHook: i === Math.floor(want / 3), // 앞쪽 1/3 지점을 대표 후보로
  }));
}

function pickScenes(article) {
  const lead = (article.entities || [])[0];
  const leadName = (lead?.nameKo || lead?.nameEn || '').trim();

  const all = (article.embeds || [])
    .map((e) => ({
      sec: Math.max(0, parseInt(e.startSeconds, 10) || 0),
      caption: e.caption || e.quote || '',
      quote: (e.quote || '').trim(), // 대표 이미지 헤드라인으로 쓴다
      afterSection: e.afterSection,
      speaker: (e.speaker || '').trim(),
      isStudio: !!e.isStudio,
      isHook: !!e.isHook, // 대표 이미지 후보 (applyClipShotLayout 이 씀)
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
/**
 * 장면 캡처의 alt 를 만든다.
 *
 * 예전에는 `${제목} — ${시각} 장면` 한 틀이었다. 그래서 **19장의 alt 가
 * 시각만 다른 같은 문장**이었다 — 검색에도 쓸모없고, 화면 낭독기로 듣는 사람에게는
 * 아무 정보가 없다 (2026-08-01 지적).
 *
 * 캡션이 있으면 그것을 쓴다. 캡션은 그 대목이 무엇인지 말하므로 alt 의 일과 같다.
 */
function clipAlt(title, sec, caption) {
  const mm = `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
  const c = String(caption || '').trim();
  return c ? `${c} — ${title} ${mm}` : `${title} — ${mm} 장면`;
}

function applyClipShotLayout(article, cfg, scenes, shots) {
  const isMovie = article.mode === MODE.MOVIE;
  const bySec = new Map(shots.map((s) => [s.sec, s]));
  let got = scenes.filter((s) => bySec.has(s.sec));
  if (!got.length) return;

  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const sectionCount = Math.max(1, (article.sections || []).length);
  const oldThumb = (article.imageBriefs || []).find((b) => b.placement === 'thumbnail') || {};

  /* 대표 이미지는 **얼굴이 가장 크게 잡힌 장면**으로 고른다.
   *
   * 시간순 첫 장면으로 고정했더니 그 장면에 얼굴이 없으면 그대로 실렸다.
   *
   * > 2026-07-28 실측 — 광수 글:
   * > 첫 장면(5:46)이 "강렬한 빨간색 바지 입고 등장" 자막이 붙은 컷이라
   * > 카메라가 바지를 잡고 있었다. **얼굴 없이 몸통만 나온 사진**이
   * > 대표 이미지가 되고 그 위에 "눈물 뒤의 직진" 헤드라인이 얹혔다.
   *
   * 대표 이미지는 목록·검색결과·공유 카드에서 글의 얼굴이 된다. 시간 순서보다
   * 사람이 보이는 쪽이 훨씬 중요하다. 본문 사진은 그대로 시간순을 지킨다.
   * 얼굴이 아예 없으면(예: 풍경 위주 영상) 원래대로 첫 장면을 쓴다. */
  const faceScore = (s) => {
    const shot = shots.find((x) => x.sec === s.sec);
    return (shot?.biggest || 0) * 10 + (shot?.faces || 0);
  };

  /* 후보는 codex 가 isHook 으로 지목한 장면들 — 감정이 터지거나 얼굴이 크게
   * 잡히거나 정면으로 부딪히는 대목이다. 그중에서 실제로 얼굴이 가장 크게
   * 잡힌 컷을 코드가 고른다. **의미 판단은 AI, 화면 검증은 코드**로 나눈다.
   * isHook 이 하나도 없으면 전체에서 얼굴 기준으로 고른다. */
  const hooks = got.filter((s) => s.isHook);
  const pool = hooks.length ? hooks : got;
  const best = pool.reduce((a, b) => (faceScore(b) > faceScore(a) ? b : a), pool[0]);

  if (best && best !== got[0] && faceScore(best) > 0) {
    got = [best, ...got.filter((s) => s !== best)];
    const shot = shots.find((x) => x.sec === best.sec);
    log.debug(
      `대표 이미지: ${mmss(best.sec)} ` +
        `(${hooks.length ? `화제 장면 ${hooks.length}개 중` : '전체 중'} ` +
        `얼굴 ${shot?.faces}개 · 최대 ${shot?.biggest}%)`
    );
  } else if (!hooks.length) {
    log.debug('codex 가 화제 장면(isHook)을 지목하지 않아 얼굴 크기로만 골랐습니다.');
  }

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
  /* 본문 사진을 섹션에 나눈다 — **1·2·2·1 리듬**으로 묶는다.
   *
   * 예전에는 섹션마다 한 장씩 고르게 흩뿌렸다. 그래서 `html.js` 의 2열 묶기가
   * 발동할 조건(같은 섹션에 2장 이상)이 아예 만들어지지 않았다.
   * > 2026-08-01 실측: 캡처 6장이 S1~S6 에 한 장씩 들어가 2열 묶음이 0 개였다.
   *
   * 사진을 많이 쓰는 글에서 한 장씩 세우면 글이 끝없이 길어진다 —
   * 리듬으로 묶으면 같은 장수로도 글이 짧고 보기 좋아진다 (사용자 요구 2026-08-01). */
  const RHYTHM = [1, 2, 2, 1];
  const groups = [];
  {
    let i = 0;
    let r = 0;
    while (i < body.length) {
      const take = Math.min(RHYTHM[r % RHYTHM.length], body.length - i);
      groups.push(body.slice(i, i + take));
      i += take;
      r++;
    }
  }

  /* 묶음을 섹션에 **고르게** 나눈다.
   *
   * 예전에는 묶음 하나에 섹션 하나를 썼다(묶음마다 sec++). 묶음이 섹션보다 많으면
   * `Math.min(sectionCount, sec)` 이 남은 묶음을 전부 **마지막 섹션에 쏟았다.**
   *
   * > 2026-08-04 실측 — 사랑이 온다 4화: 캡처 18장(본문 17)에 섹션 7개.
   * >   묶음 11개 중 5개가 7번으로 몰려 마지막 절 하나에 사진 8장이 붙었고,
   * >   6:45~10:14 장면이 전혀 다른 대목("뒤따른 사람의 오해") 아래로 들어갔다.
   *
   * `photoDensity` 는 글 전체 평균이라 이 몰림을 잡지 못한다 — 그 글은 규격을
   * 통과했다. 묶음 수를 섹션 수로 나눠 배분하면 장면이 섹션보다 훨씬 많아도
   * 고르게 퍼지고, body 가 시간순이므로 순서도 그대로 유지된다. */
  const placed = [];
  groups.forEach((g, gi) => {
    const at = Math.min(sectionCount, 1 + Math.floor((gi * sectionCount) / groups.length));
    for (const s of g) placed.push({ ...s, at });
  });

  /* 대표 이미지 헤드라인은 codex 가 쓴 것을 그대로 쓴다.
   *
   * 한때 **선택된 장면의 대사**로 덮어썼는데, 사진과는 정확히 맞았지만
   * 대사만 덜렁 얹히니 궁금증이 없었다. 클릭을 만드는 건 "무슨 말을 했나" 가
   * 아니라 "왜 그랬을까" 다. 궁금증 문구는 특정 장면이 아니라 글 전체를
   * 가리키므로 어느 사진에 얹혀도 어긋나지 않는다.
   * (문구 품질은 prompt.js 의 headline 우선순위가 담당한다) */
  article.imageBriefs = [
    {
      placement: 'thumbnail',
      headline: oldThumb.headline || article.title,
      subline: oldThumb.subline || '',
      eyebrow: oldThumb.eyebrow || '',
      statValue: oldThumb.statValue || '',
      statLabel: oldThumb.statLabel || '',
      /* 영화 모드는 대표를 **배급사 공식 포스터**가 채운다(photo.js 의 clipStart).
       * 그래서 alt·photoQuery 를 캡처 기준으로 쓰면 거짓이 된다.
       * > 2026-08-01 실측: 대표 alt 가 "… — 0:58 장면" 인데 실제 이미지는
       * >   위키미디어 인물 사진이었다. §7-3 ③ 과 같은 어긋남이다. */
      photoQuery: isMovie ? oldThumb.photoQuery || '' : '',
      caption: '',
      alt: isMovie ? oldThumb.alt || article.title : clipAlt(article.title, got[0].sec, got[0].caption),
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
      /* 캡션에 시각(`21:27`)을 붙이지 않는다.
       * 사진마다 숫자가 앞에 붙으면 독자가 읽는 흐름을 끊는다. 어느 대목인지는
       * 사진과 앞뒤 문단이 이미 말해 준다. 시각은 alt 에만 남겨 둔다. */
      caption: s.caption,
      alt: clipAlt(article.title, s.sec, s.caption),
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

/**
 * `renderImages` 결과를 각 소비자의 모양으로 옮겨 담는다.
 *
 * ⚠️ **표시(flag)를 빠뜨리지 마세요.** buildHtml 은 여기서 담아 준 것만 봅니다.
 * `isStepCard` 를 안 옮기면 대표 이미지가 절차 카드인데도 본문에 HTML 흐름도가
 * 또 그려집니다 (같은 6줄이 그림과 글로 두 번).
 *
 * > 2026-08-03: 이 함수를 고치고도 같은 증상이 남았다. `cli.js` 가 **이 함수를 쓰지 않고
 * > 같은 코드를 복사해** 갖고 있었기 때문이다. 호출 지점이 넷이었다
 * > (cli.js · run.js 두 곳 · scripts/repreview.mjs). 복사본을 지우고 여기로 모았다.
 */
export function mapImages(rendered) {
  const ordered = [rendered.thumbnail, ...rendered.body].filter(Boolean);
  const files = ordered.map((i) => i.file);

  /** 표시는 한 곳에서 만든다 — 세 모양이 서로 어긋나지 않게 */
  const thumbFlags = { isStepCard: rendered.thumbnail?.isStepCard === true };
  const bodyFlags = (b) => ({ isInfoCard: b.isInfoCard === true });

  const withPlaceholders = {
    thumbnail: rendered.thumbnail
      ? { placeholder: '{{IMAGE_0}}', alt: rendered.thumbnail.alt, caption: '', ...thumbFlags }
      : null,
    body: rendered.body.map((b, i) => ({
      placeholder: `{{IMAGE_${(rendered.thumbnail ? 1 : 0) + i}}}`,
      alt: b.alt,
      caption: b.caption,
      afterSection: b.afterSection,
      ...bodyFlags(b),
    })),
  };

  const withLocalSrc = {
    thumbnail: rendered.thumbnail
      ? { src: pathToFileURL(rendered.thumbnail.file).href, alt: rendered.thumbnail.alt, ...thumbFlags }
      : null,
    body: rendered.body.map((b) => ({
      src: pathToFileURL(b.file).href,
      alt: b.alt,
      caption: b.caption,
      afterSection: b.afterSection,
      ...bodyFlags(b),
    })),
  };

  // CC 라이선스 사진은 저작자 표기가 의무 — 본문 하단에 남길 목록
  const credits = ordered
    .map((i) => i.background)
    .filter((b) => b && (b.photographer || b.credit));

  /* `files` 와 **같은 순서**의 캡션·배치 정보.
   * 네이버는 HTML 자리표시자를 쓸 수 없어(에디터에 HTML 입구가 없다) 업로드한
   * 이미지 컴포넌트를 코드가 직접 본문 사이에 끼운다. 그때 이 배열을 참조한다. */
  const meta = ordered.map((img, idx) => ({
    alt: img.alt || '',
    caption: idx === 0 ? '' : img.caption || '', // 대표 이미지에는 캡션을 달지 않는다
    afterSection: idx === 0 ? 0 : img.afterSection,
    // 아티클이 지정한 배치 — 문단 위치와 사진 묶음(imageGroup)
    afterParagraph: idx === 0 ? null : img.afterParagraph ?? null,
    group: idx === 0 ? '' : img.group || '',
  }));

  return { files, withPlaceholders, withLocalSrc, credits, meta };
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
    /* **임베드의 출처가 없는 모드에서는 비운다.**
     *
     * 이 분기는 원래 "추가 영상 검색만 건너뛴다" 였다. 그래서 모델이 `embeds` 에
     * 유튜브를 써넣으면 **그대로 살아서 발행됐다.** 영상 모드는 embeds 가 곧
     * 장면 목록이라 남겨야 하지만(clipShots), 책·경제 모드는 그 자리에 들어올
     * 정당한 영상이 없다.
     *
     * > 2026-08-04 실측 — 『유럽 도시 기행 1』 책 글에 **YTN 유튜브 임베드**가
     * >   붙어 있었다. `book.contract.embeds: [0,0]` 이 경고로 가리켰지만 막지는
     * >   않으므로, 사람이 로그를 넘겨 읽으면 그대로 나간다.
     *
     * 판단 기준은 `clipShots` 다 — 캡처를 쓰는 모드만 embeds 를 장면으로 쓴다. */
    if (!can(mode, 'clipShots') && (article.embeds || []).length) {
      log.info(
        `${MODE_LABEL[mode]} 모드는 영상 임베드를 쓰지 않습니다 — ` +
          `모델이 넣은 ${article.embeds.length}개를 비웁니다.`
      );
      article.embeds = [];
    }
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
      /* 영화 모드는 **공식 예고편**에서 캡처한다.
       *
       * 입력이 유튜브 URL 이 아니므로 `clipVideoId` 가 없다 — codex 가 찾아 둔
       * `embeds[].videoId`(공식 예고편)를 쓴다. 자막이 없어서 `pickScenes` 의
       * 자막 기반 시각도 쓸 수 없으므로 **예고편 길이에 걸쳐 균등 분포**로 뜬다.
       *
       * ⚠️ 캡션을 만들지 않는다. 자막이 없으니 "누가 무슨 말을 하는 대목" 을 알 수 없고,
       * 추측해서 쓰면 §7-6 ② 의 "정지 화면이 보여줄 수 없는 캡션" 이 된다. */
      const scenes = mode === MODE.MOVIE ? await trailerScenes(article, cfg) : pickScenes(article);

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

  /* 장면 캡처는 **임베드 검색과 독립된 단계**다.
   *
   * ⚠️ 예전에는 캡처가 `if (!can(mode,'youtubeEmbeds'))` **안에** 들어 있었다.
   * 클립 모드는 임베드를 검색하지 않으므로 그 안에 있어도 됐지만,
   * 영화 모드는 `youtubeEmbeds: true` 라 **else 로 빠져 캡처가 아예 실행되지 않았다.**
   * > 2026-08-01 실측: 예고편 캡처를 붙였는데 `clipShots: 0` 이었고 위키미디어
   * >   인물 사진이 그 자리를 채웠다. 로그에 '장면 캡처' 줄이 아예 없었다.
   *
   * 그래서 조건을 하나만 본다 — `can(mode, 'clipShots')`. 새 모드가 캡처를 켜면
   * 여기로 바로 들어온다. */
  if (can(mode, 'clipShots') && cfg.images.useClipShots !== false && !(article.clipShots || []).length) {
    const scenes = mode === MODE.MOVIE ? await trailerScenes(article, cfg) : pickScenes(article);
    if (scenes.length) {
      try {
        const { captureFrames } = await import('./ytShot.js');
        const shots = await captureFrames(
          article.clipVideoId,
          scenes.map((s) => s.sec),
          { title: article.title, headless: true }
        );
        article.clipShots = shots;
        if (shots.length) applyClipShotLayout(article, cfg, scenes, shots);
      } catch (err) {
        log.warn(`장면 캡처 실패 — 사진 없이 진행합니다: ${err.message.split('\n')[0]}`);
        article.clipShots = [];
      }
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
 * 이미 만들어진 아티클을 **네이버 블로그**에 발행한다.
 *
 * 티스토리와 인자가 다르다 — `html` 을 받지 않는다.
 * 네이버 에디터에는 HTML 입구가 없어서 아티클 JSON 을 컴포넌트로 직접 조립한다
 * (`naverDoc.js`). 그래서 `html.js` 결과물은 네이버 경로에서 쓰이지 않는다.
 */
export async function publishToNaver({ article, imageFiles, imageMeta, credits }, cfg) {
  const problems = validateNaverForPublish(cfg);
  if (problems.length) {
    // 계정이 없어도 저장된 세션으로 발행될 수 있으므로 경고만 남긴다
    for (const p of problems) log.warn(p);
    if (!cfg.naver?.blogId) {
      throw new Error('네이버 블로그 아이디가 없어 발행할 수 없습니다.');
    }
  }

  const urls = naverUrls(cfg);
  log.banner('4단계 · 네이버 발행');
  log.info(`대상 블로그: blog.naver.com/${urls.blogId}`);

  const ctx = await launchBrowser(cfg);
  try {
    const page = await firstPage(ctx);
    await naverEnsureLoggedIn(page, cfg, urls);
    await saveSession(ctx, cfg, 'naver');

    const result = await naverPublishPost(page, urls, cfg, {
      article,
      imageFiles,
      imageMeta,
      credits,
    });
    if (!result.ok) throw new Error(result.reason || '발행에 실패했습니다.');
    return result;
  } finally {
    await new Promise((r) => setTimeout(r, 1200));
    await ctx.close().catch(() => {});
  }
}

/** 플랫폼 이름 → 발행 함수. 새 플랫폼을 붙일 때 여기만 늘리면 된다. */
const PUBLISHERS = {
  tistory: (gen, cfg) =>
    publish({ article: gen.article, html: gen.html, imageFiles: gen.images.files }, cfg),
  naver: (gen, cfg) =>
    publishToNaver(
      {
        article: gen.article,
        imageFiles: gen.images.files,
        imageMeta: gen.images.meta,
        credits: gen.images.credits,
      },
      cfg
    ),
};

export const PLATFORM_LABEL = { tistory: '티스토리', naver: '네이버 블로그' };

/**
 * 주제 하나를 끝까지(생성 → 발행) 처리한다.
 *
 * 글 생성은 플랫폼과 무관하게 **한 번만** 한다. codex 호출이 비싸기 때문이다.
 * 여러 플랫폼을 주면 같은 아티클을 각각의 방식으로 발행한다.
 */
export async function runTopic(topic, cfg, { publish: doPublish = true, platforms = ['tistory'] } = {}) {
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

  /* 모드 출력 규격 관문 — `npm run post` · `npm run queue` 가 지나는 길이다.
   * `npm run publish` 쪽(cli.js)과 **같은 함수**를 부른다. 두 벌로 두면 갈라진다. */
  const { assertContract } = await import('./contract.js');
  assertContract(gen.article, { force: cfg.forceContract === true, log });

  const targets = platforms.filter((p) => PUBLISHERS[p]);
  if (!targets.length) throw new Error(`발행할 플랫폼이 없습니다: ${platforms.join(', ')}`);

  const results = {};
  const failed = [];
  for (const platform of targets) {
    try {
      results[platform] = await PUBLISHERS[platform](gen, cfg);
    } catch (err) {
      /* 한 플랫폼이 실패해도 나머지는 발행한다.
       * 둘 다 실패하면 아래에서 예외를 던진다 — 조용히 성공한 척하지 않는다. */
      log.error(`${PLATFORM_LABEL[platform]} 발행 실패: ${err.message.split('\n')[0]}`);
      failed.push({ platform, error: err.message });
    }
  }

  log.banner('완료');
  log.ok(`제목: ${gen.article.title}`);
  log.ok(`태그: ${gen.article.tags.join(', ')}`);
  for (const [platform, r] of Object.entries(results)) {
    log.ok(`${PLATFORM_LABEL[platform]}: ${r.postUrl || r.url}`);
  }
  for (const f of failed) log.warn(`${PLATFORM_LABEL[f.platform]}: 실패 — ${f.error.split('\n')[0]}`);
  log.info(`소요 시간: ${fmtDuration(Date.now() - started)}`);

  if (!Object.keys(results).length) {
    throw new Error(`모든 플랫폼 발행이 실패했습니다: ${failed.map((f) => f.platform).join(', ')}`);
  }

  // 기존 호출부(큐·news)가 result.postUrl 을 읽으므로 첫 성공 결과를 그대로 노출한다
  const first = Object.values(results)[0];
  return { ...gen, published: true, result: first, results, failed };
}
