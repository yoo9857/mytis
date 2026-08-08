#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ensureDirs, DIRS, FILES } from './paths.js';
import { log } from './log.js';
import { loadConfig, blogUrls, naverUrls, validateForPublish } from './config.js';
import { runTopic, generate, publish, publishToNaver, mapImages, PLATFORM_LABEL } from './run.js';
import { launchBrowser, firstPage, saveSession } from './browser.js';
import { ensureLoggedIn, isLoggedIn, discoverBlog, genericUrls } from './kakaoLogin.js';
import {
  ensureLoggedIn as naverEnsureLoggedIn,
  isLoggedIn as naverIsLoggedIn,
  discoverBlogId,
  genericUrls as naverGenericUrls,
} from './naverLogin.js';
import { probeEditor } from './tistory.js';
import { probeEditor as probeNaverEditor } from './naver.js';
import { verifySelectors } from './verifySelectors.js';
import { renderImages } from './images.js';
import { buildHtml } from './html.js';
import { resolveCodex, isUrl } from './codexWriter.js';
import { discoverNews } from './newsFeed.js';
import { discoverRadar, saveRadar } from './radar.js';
import * as queue from './queue.js';

const HELP = `
티스토리 자동 글쓰기 · 자동 발행

  npm run login                        브라우저를 열어 티스토리(카카오) 로그인 · 세션 저장
  npm run post -- "주제"                주제로 글 생성 → 이미지 → 즉시 발행
  npm run post -- "기사URL"             기사를 읽고 출처를 밝힌 자체 해설 글로 발행
  npm run draft -- "주제 또는 기사URL"   발행 없이 글과 미리보기만 생성
  npm run publish -- out/xxx.json      이미 생성한 아티클을 발행
  npm run queue                        topics.txt 에서 하나를 꺼내 발행 (스케줄러용)
  npm run queue -- --count 3           연속으로 3개 발행
  npm run verify                       로그인 셀렉터 점검 (계정 없이 실행 가능)
  npm run probe                        에디터 구조 덤프 (셀렉터가 깨졌을 때 진단)
  npm run doctor                       설정·환경 점검

  영화 (티스토리 Cinematic)
  npm run post -- "영화: 제목 (감독)"        영화 정보·줄거리·결말 글 → 티스토리 발행
  npm run draft -- "영화: 제목 (감독)"       발행 없이 초안만
       --spoiler / --no-spoiler        결말을 밝힐지 (기본값은 config.json 의 movie.spoiler)
                                       개봉 직후 신작은 --no-spoiler, 구작은 --spoiler

  오늘 뭐 읽지? (네이버 책 시리즈)
  npm run book                         알라딘 월간 문학 베스트에서 오늘의 책 선정 → 초안 생성
                                       (검토 뒤 npm run publish -- out/<글>.json --naver)

  네이버 블로그
  npm run login:naver                  네이버 로그인 · 세션 저장 · 블로그 아이디 자동 탐지
  npm run probe:naver                  네이버 에디터 구조 덤프 (셀렉터 확정용)
  npm run post -- "주제" --naver         네이버에만 발행
  npm run post -- "주제" --both          티스토리 + 네이버 (글은 한 번만 생성)
  npm run publish -- out/xxx.json --naver   이미 만든 아티클을 네이버에 발행

  뉴스 소재 수집
  npm run news                         최신 기사를 훑어 소재 후보를 보여줌
  npm run news -- --add                찾은 기사를 topics.txt 큐에 추가
  npm run news -- --add --now          찾은 기사 중 1위를 바로 발행
  npm run news -- "아이돌 컴백" --count 8   분야와 개수 지정

  선점 레이더 — 터진 것을 쫓지 않고 터질 것을 먼저 잡는다
  npm run radar                        앞으로 공표된 일정을 훑어 발행 시점을 계산
  npm run radar -- --days 14           탐색 창을 14일로
  npm run radar -- "넷플릭스 공개" --count 8
                                       ● 지금 / ◐ 임박 / ○ 대기·아직 로 표시된다
                                       결과는 radar.json 에 누적된다 (성과 되먹임 자리)

  기타
  node src/cli.js topics add "주제1" "https://기사url"    큐에 추가
  node src/cli.js topics list                            큐 상태 보기

  공통 옵션
  --headless        브라우저를 숨기고 실행 (무인 실행용)
  --show            브라우저를 띄워서 실행
  --no-publish      생성까지만 하고 발행하지 않음
  --private         이번 실행만 비공개로 발행 (테스트용)
  --public          이번 실행만 공개로 발행
  --platform <이름>  tistory (기본) · naver · both
  --naver           --platform naver 와 같음
  --both            --platform both 와 같음
  --verbose         상세 로그 (codex 진행 상황 포함)
  --no-images       생성 이미지를 만들지 않음 (사진을 직접 붙일 글)
  --collage         네이버 사진 자동 묶기 (기본 꺼짐 — 보통은 imageBriefs[].group 으로 지정)
  --category <이름>  이번 실행만 카테고리 지정 (config 전역값을 뒤집지 않는다)
  --reserve-at <시각> 티스토리 예약 발행 (예: 2026-08-07T18:00:00+09:00)
  --force           모드 출력 규격 위반을 무시하고 발행 (권하지 않음 — 규격을 고치세요)

  규격 검사
  npm run gate -- out/xxx.json         모드 출력 규격 대조 (발행하지 않음)
  npm run gate -- out/xxx.json --fix   기계적으로 고칠 수 있는 것만 고쳐 저장
`;

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--headless') flags.headless = true;
    else if (a === '--show') flags.headless = false;
    else if (a === '--no-publish') flags.noPublish = true;
    // 발행 간격을 무시하고 즉시 발행 (캡차가 뜰 수 있다 — pace.js 참고)
    else if (a === '--now') flags.now = true;
    else if (a === '--verbose' || a === '-v') flags.verbose = true;
    else if (a === '--count') flags.count = Number(argv[++i]) || 1;
    else if (a.startsWith('--count=')) flags.count = Number(a.split('=')[1]) || 1;
    else if (a === '--hours') flags.hours = Number(argv[++i]) || 24;
    else if (a.startsWith('--hours=')) flags.hours = Number(a.split('=')[1]) || 24;
    /* 선점 레이더의 탐색 창(일). **값을 받는 플래그는 반드시 여기 등록해야 한다** —
     * 맨 아래 `startsWith('--')` 폴백이 미등록 플래그를 `true` 로 삼키고, 뒤따르는
     * 숫자는 positional 로 새어 질의에 붙는다.
     * > 2026-08-04 실측: `--days 21` 이 `days=true` 가 되고 로그가 "앞으로 true일" 로
     * >   찍혔다. 질의는 "…아이돌 컴백 21" 이 됐다. 조용히 틀리는 종류다. */
    else if (a === '--days') flags.days = Number(argv[++i]) || 21;
    else if (a.startsWith('--days=')) flags.days = Number(a.split('=')[1]) || 21;
    else if (a === '--private') flags.visibility = 'private';
    else if (a === '--public') flags.visibility = 'public';
    else if (a === '--visibility') flags.visibility = argv[++i];
    else if (a.startsWith('--visibility=')) flags.visibility = a.split('=')[1];
    else if (a === '--platform') flags.platform = argv[++i];
    else if (a.startsWith('--platform=')) flags.platform = a.split('=')[1];
    /* 스포일러는 **작품마다 답이 다르다** — 개봉 직후 신작은 스포 X 가 맞고, 구작은
     * "황해 결말" 처럼 결말 검색 수요가 커서 스포 O 가 맞다. config 전역 토글만
     * 있으면 매번 뒤집고 되돌리는 것을 잊는다. */
    /* 사진을 직접 붙일 글(현장 사진이 있는 후기 등)에서는 생성 이미지를 끈다.
     * 스톡·그라디언트 카드가 섞이면 본인 사진과 톤이 어긋난다. */
    else if (a === '--no-images') flags.noImages = true;
    /* 네이버 사진 자동 묶기. 기본은 꺼져 있다 — 관계없는 두 장이 나란히 붙으면 둘 다
     * 죽기 때문이다(naverDoc.js). 연관 있는 컷은 `imageBriefs[].group` 으로 지정하는 것이
     * 정석이고, 이 플래그는 "아무렇게나 묶어도 되는 글" 을 위한 예외다. */
    else if (a === '--collage') flags.collage = true;
    /* 카테고리는 글 성격마다 다르다 — config 전역값(`오늘 뭐 읽지?`)이 책 시리즈에
     * 맞춰져 있어서, 다른 글을 낼 때마다 설정을 뒤집고 되돌리는 것을 잊는다. */
    else if (a === '--category') flags.category = argv[++i];
    else if (a.startsWith('--category=')) flags.category = a.split('=')[1];
    else if (a === '--reserve-at') flags.reserveAt = argv[++i];
    else if (a.startsWith('--reserve-at=')) flags.reserveAt = a.slice('--reserve-at='.length);
    else if (a === '--force') flags.force = true;
    else if (a === '--spoiler') flags.spoiler = true;
    else if (a === '--no-spoiler') flags.spoiler = false;
    else if (a === '--naver') flags.platform = 'naver';
    else if (a === '--both') flags.platform = 'both';
    else if (a.startsWith('--')) flags[a.slice(2)] = true;
    else positional.push(a);
  }
  return { flags, positional };
}

/**
 * `--platform` 값을 발행 대상 목록으로 바꾼다.
 *
 * 기본은 티스토리다 — 네이버를 붙였다고 기존 명령의 동작이 바뀌면 안 된다.
 */
function resolvePlatforms(flags) {
  const raw = String(flags.platform || 'tistory').toLowerCase();
  if (raw === 'both' || raw === 'all') return ['tistory', 'naver'];
  const list = raw
    .split(/[,+]/)
    .map((s) => s.trim())
    .filter((s) => ['tistory', 'naver'].includes(s));
  if (!list.length) {
    throw new Error(
      `알 수 없는 플랫폼: "${flags.platform}". tistory · naver · both 중에서 고르세요.`
    );
  }
  return [...new Set(list)];
}

function applyFlags(cfg, flags) {
  if (flags.headless !== undefined) cfg.browser.headless = flags.headless;
  if (flags.visibility && ['public', 'protected', 'private'].includes(flags.visibility)) {
    cfg.blog.visibility = flags.visibility;
    // 네이버는 값 이름이 다르다 — 'protected' 는 없고 '이웃공개' 계열이 그 자리다
    cfg.naver.visibility = flags.visibility === 'protected' ? 'neighbor' : flags.visibility;
  }
  if (flags.category) {
    cfg.naver = { ...cfg.naver, category: flags.category };
    cfg.blog = { ...cfg.blog, category: flags.category };
  }
  /* 두 플랫폼 모두 같은 스위치를 쓴다 — 기본은 한 장씩, 켜면 짝으로 묶는다. */
  if (flags.collage) {
    cfg.naver = { ...cfg.naver, collage: true };
    cfg.blog = { ...cfg.blog, collage: true };
  }
  if (flags.noImages) {
    cfg.images = { ...cfg.images, enabled: false, thumbnail: false, bodyImages: 0 };
  }
  if (flags.reserveAt) {
    const when = new Date(flags.reserveAt);
    if (!Number.isFinite(when.getTime())) {
      throw new Error(`예약 시각 형식이 올바르지 않습니다: ${flags.reserveAt}`);
    }
    if (when.getTime() <= Date.now()) {
      throw new Error(`예약 시각은 현재보다 뒤여야 합니다: ${flags.reserveAt}`);
    }
    cfg.blog = { ...cfg.blog, publishMode: 'reserve', reserveAt: when.toISOString() };
  }
  if (flags.spoiler !== undefined) {
    cfg.movie = { ...(cfg.movie || {}), spoiler: flags.spoiler };
  }
  /* runTopic 은 flags 를 못 본다 — 규격 무시 여부를 cfg 로 실어 보낸다. */
  if (flags.force) cfg.forceContract = true;
  if (flags.verbose) {
    cfg.verbose = true;
    log.setVerbose(true);
  }
  return cfg;
}

/** .env 의 특정 키를 갱신한다 (없으면 추가). */
function updateEnvFile(key, value) {
  let text = fs.existsSync(FILES.env) ? fs.readFileSync(FILES.env, 'utf8') : '';
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  text = re.test(text) ? text.replace(re, line) : `${text.replace(/\s*$/, '')}\n${line}\n`;
  fs.writeFileSync(FILES.env, text, 'utf8');
}

async function cmdLogin(cfg) {
  cfg.browser.headless = false; // 로그인은 반드시 화면을 띄운다

  // 블로그 주소를 아직 몰라도 로그인은 할 수 있다. 로그인 후에 찾아낸다.
  let urls;
  let knowsBlog = true;
  try {
    urls = blogUrls(cfg);
  } catch {
    knowsBlog = false;
    urls = genericUrls();
    log.info('블로그 주소가 아직 없습니다. 로그인 후 자동으로 찾겠습니다.');
  }

  const ctx = await launchBrowser(cfg);
  try {
    const page = await firstPage(ctx);
    await ensureLoggedIn(page, cfg, urls, { interactive: true });
    await saveSession(ctx, cfg);

    if (!knowsBlog) {
      const name = await discoverBlog(page);
      if (name) {
        updateEnvFile('TISTORY_BLOG', name);
        log.ok(`블로그를 찾았습니다: ${name}.tistory.com — .env 에 저장했습니다.`);
      } else {
        log.warn(
          '블로그 주소를 자동으로 찾지 못했습니다. .env 의 TISTORY_BLOG 를 직접 채워주세요.'
        );
      }
    }

    log.ok('세션이 profile/ 에 저장되었습니다. 이제 --headless 무인 실행이 가능합니다.');
  } finally {
    await new Promise((r) => setTimeout(r, 1500));
    await ctx.close().catch(() => {});
  }
}

/**
 * 네이버 로그인 · 세션 저장.
 *
 * 카카오와 같은 흐름이지만 세션 파일이 따로 저장된다(profile/session-naver.json).
 * 캡차·2단계 인증이 뜨면 열린 브라우저에서 직접 통과시켜야 한다.
 */
async function cmdLoginNaver(cfg) {
  cfg.browser.headless = false; // 로그인은 반드시 화면을 띄운다

  let urls;
  let knowsBlog = true;
  try {
    urls = naverUrls(cfg);
  } catch {
    knowsBlog = false;
    urls = naverGenericUrls();
    log.info('네이버 블로그 아이디가 아직 없습니다. 로그인 후 자동으로 찾겠습니다.');
  }

  const ctx = await launchBrowser(cfg);
  try {
    const page = await firstPage(ctx);
    await naverEnsureLoggedIn(page, cfg, urls, { interactive: true });
    await saveSession(ctx, cfg, 'naver');

    if (!knowsBlog) {
      const id = await discoverBlogId(page, cfg);
      if (id) {
        updateEnvFile('NAVER_BLOG', id);
        log.ok(`블로그를 찾았습니다: blog.naver.com/${id} — .env 에 저장했습니다.`);
      } else {
        log.warn('블로그 아이디를 자동으로 찾지 못했습니다. .env 의 NAVER_BLOG 를 직접 채워주세요.');
      }
    }

    log.ok('네이버 세션이 profile/ 에 저장되었습니다.');
  } finally {
    await new Promise((r) => setTimeout(r, 1500));
    await ctx.close().catch(() => {});
  }
}

/** 네이버 에디터 구조 덤프 — 셀렉터를 추측하지 않고 실측으로 확정하기 위한 도구 */
async function cmdProbeNaver(cfg) {
  cfg.browser.headless = false;
  const urls = naverUrls(cfg);
  const ctx = await launchBrowser(cfg);
  try {
    const page = await firstPage(ctx);
    await naverEnsureLoggedIn(page, cfg, urls, { interactive: true });
    await saveSession(ctx, cfg, 'naver');
    await probeNaverEditor(page, urls);
  } finally {
    await new Promise((r) => setTimeout(r, 1000));
    await ctx.close().catch(() => {});
  }
}

async function cmdPost(cfg, topic, flags) {
  if (!topic) {
    throw new Error(
      '주제 또는 기사 URL 을 입력하세요.\n' +
        '  예)  npm run post -- "2026년 청년도약계좌 조건"\n' +
        '  예)  npm run post -- "https://enews.imbc.com/News/RetrieveNewsInfo/512756"\n' +
        '  예)  npm run post -- "주제" --naver           (네이버에만)\n' +
        '  예)  npm run post -- "주제" --both            (티스토리 + 네이버)'
    );
  }
  const platforms = resolvePlatforms(flags);
  if (!flags.noPublish) log.info(`발행 대상: ${platforms.map((p) => PLATFORM_LABEL[p]).join(' + ')}`);
  await runTopic(topic, cfg, { publish: !flags.noPublish, platforms });
}

/**
 * 선점 레이더 — 앞으로 공표된 일정을 잡아 **발행 시점을 계산**한다 (src/radar.js).
 *
 * `news` 와 무엇이 다른가: `news` 는 이미 보도된 것을 훑고, 이쪽은 **아직 일어나지
 * 않은 것**을 훑는다. 실측이 그쪽을 가리켰다 — 재혼 황후는 공개 전에 올린 글이 떴다.
 *
 * 큐(`topics.txt`)에 자동으로 넣지 않는다. 큐는 URL 을 받아 기사 모드로 돌리는
 * 물건이고, 레이더 결과는 모드가 섞여 있다(영화·주제·기사). 그래서 실행 문자열을
 * 찍어 주고 사람이 고른다 — 오늘 드라마 글에서 본 대로 **잘못된 모드로 자동 발행되면
 * 형식은 완벽하고 내용만 틀린 글**이 나온다.
 */
async function cmdRadar(cfg, args, flags) {
  const query = args.filter((a) => !isUrl(a)).join(' ') || cfg.radar?.query || '';
  const days = flags.days || cfg.radar?.days || 21;
  const count = flags.count || cfg.radar?.count || 12;

  const events = await discoverRadar({ cfg, query, days, count });
  if (!events.length) {
    process.exitCode = 1;
    return;
  }

  saveRadar(events);

  const now = events.filter((e) => e.verdict === '지금' || e.verdict === '임박');
  log.info('');
  if (now.length) {
    log.ok(`지금 써야 하는 것 ${now.length}건 — 위 목록의 ● ◐ 표시`);
  } else {
    log.info('오늘 당장 써야 하는 일정은 없습니다. 발행 권장일이 오면 다시 올라옵니다.');
  }
  log.info('radar.json 의 outcome 을 채우면 리드타임을 실측으로 교정할 수 있습니다.');
}

async function cmdNews(cfg, args, flags) {
  const query = args.filter((a) => !isUrl(a)).join(' ') || cfg.news?.query || '한국 연예 뉴스';
  const count = flags.count || cfg.news?.count || 5;
  const hours = flags.hours || cfg.news?.hours || 24;

  const items = await discoverNews({ cfg, query, count, hours });
  if (!items.length) {
    process.exitCode = 1;
    return;
  }

  if (flags.add) {
    const added = queue.addTopics(items.map((i) => i.url));
    log.ok(`큐에 ${added.length}건 추가 (중복 ${items.length - added.length}건 제외)`);
  }

  if (flags.now) {
    const top = items[0];
    log.banner(`바로 발행: ${top.title}`);
    try {
      const res = await runTopic(top.url, cfg, { publish: !flags.noPublish });
      if (flags.add) queue.markDone(top.url, res.result?.postUrl || res.result?.url || '');
    } catch (err) {
      if (flags.add) queue.markFailed(top.url, err.message);
      throw err;
    }
  } else if (!flags.add) {
    log.info('');
    log.info('큐에 넣으려면  npm run news -- --add');
    log.info('바로 발행하려면 npm run news -- --add --now');
  }
}

async function cmdPublishFile(cfg, file, flags = {}) {
  if (!file) throw new Error('아티클 JSON 경로를 입력하세요.  예)  npm run publish -- out/xxx.json');
  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) throw new Error(`파일을 찾을 수 없습니다: ${abs}`);

  const article = JSON.parse(fs.readFileSync(abs, 'utf8'));
  log.info(`아티클 로드: ${article.title}`);

  /* 발행 직전 안전망 — 생성 직후에만 검사하면 **손으로 고친 문장**이 검사 없이
   * 나간다 (검토 루프에서 JSON 을 직접 편집하는 일이 많다). 경고만 하고 막지는 않는다. */
  try {
    const { findParticleErrors, findMonotoneEndings, articleText, articleNames } = await import('./lintKo.js');
    const pe = findParticleErrors(articleText(article), { names: articleNames(article) });
    for (const e of pe.slice(0, 5)) log.warn(`조사 의심: ${e.phrase} → ${e.suggest}   …${e.context}…`);
    const mono = findMonotoneEndings(article);
    for (const m of mono.slice(0, 3)) log.warn(`어미 3연타(섹션${m.section}): …${m.ending}. — ${m.sample}…`);
  } catch {
    /* lint 실패로 발행을 막지 않는다 */
  }

  /* 모드 **출력 규격** 대조 — 형식이 글마다 흔들리는 것을 여기서 끊는다.
   *
   * 산문 규칙(캡션·사진 수·밀도·소제목)은 어겨져도 아무 소리가 안 났고, 그래서 매번
   * 사람에게 확인을 받았다. 확인받는 순간 그 글만의 형식이 된다 (사용자 지적 2026-08-01).
   * 규격은 각 모드 파일의 `contract` 가 갖고 있고 값은 실측에서 뽑았다.
   *
   * `막음` 항목이 있으면 발행하지 않는다. 규격이 틀렸다고 판단하면 `--force` 로 넘기고,
   * **그때는 규격을 고치는 것이 맞다** — 넘기는 습관이 들면 게이트가 없는 것과 같다. */
  const { assertContract } = await import('./contract.js');
  assertContract(article, { force: flags.force === true, log });

  /* 영상 글의 **큰따옴표 인용을 자막과 기계 대조**한다.
   *
   * 자동 자막에서 딴 인용은 축자성이 없고, 모델이 어절을 주워 문장을 만들기도 한다.
   * > 2026-08-01: "영호가 가장 꼴찌예요" 의 낱말이 자막 888자에 흩어져 있었다.
   * 실존 인물의 발언이라 조용히 나가면 안 된다 — 경고만 하고 막지는 않는다. */
  if (article.mode === 'clip' && article.clipVideoId) {
    try {
      const { verifyQuotes, quoteReport } = await import('./verifyQuotes.js');
      const subFile = path.join(DIRS.tmp, 'subs', `${article.clipVideoId}.ko.json3`);
      if (fs.existsSync(subFile)) {
        const j = JSON.parse(fs.readFileSync(subFile, 'utf8'));
        const transcript = (j.events || [])
          .filter((e) => e.segs)
          .map((e) => e.segs.map((x) => x.utf8).join(''))
          .join(' ');
        const { total, missing, rebuilt } = quoteReport(verifyQuotes(article, transcript));
        for (const r of missing) log.warn(`인용이 자막에 없습니다 (${r.where}): "${r.quote}"${r.reason ? ` — ${r.reason}` : ''}`);
        for (const r of rebuilt) log.info(`인용 재구성 (${r.where}): "${r.quote}" — 자막 조각 경계. 화면과 대조하세요`);
        if (!missing.length) log.ok(`인용 ${total}건 자막 대조 통과`);
      } else {
        log.warn('자막 캐시가 없어 인용을 대조하지 못했습니다.');
      }
    } catch (err) {
      log.debug(`인용 대조 실패: ${err.message.split('\n')[0]}`);
    }
  }

  /* '오늘 뭐 읽지?' 시리즈 연결 — 직전에 발행한 책의 링크를 글 끝에 잇는다.
   * 시리즈는 이어 읽게 만들어야 시리즈다 (내부 링크는 검색에도 좋다).
   * 주소는 books.done.txt 에서 읽는다 (발행 성공 시 아래에서 기록). */
  if (article.mode === 'book' && !article.prevBook && fs.existsSync('books.done.txt')) {
    const lines = fs.readFileSync('books.done.txt', 'utf8').split('\n').filter((l) => l.includes('->'));
    const prev = lines
      .map((l) => l.match(/\]\s*(.+?)\s*->\s*(https?:\S+)/))
      .filter(Boolean)
      .filter((m) => !String(article.title).includes(m[1]))
      .pop();
    if (prev) {
      article.prevBook = { title: prev[1], url: prev[2] };
      log.info(`시리즈 연결: 지난 책 『${prev[1]}』`);
    }
  }

  const platforms = resolvePlatforms(flags);
  /* 모드가 선언한 플랫폼과 어긋나면 경고한다 (막지는 않는다) —
   * 영화 글은 티스토리, 책 글은 네이버를 전제로 규칙이 짜여 있다. */
  try {
    const { platformOk, MODE_LABEL } = await import('./mode.js');
    const md = article.mode || 'topic';
    for (const p of platforms) {
      if (!platformOk(md, p)) log.warn(`${MODE_LABEL[md]} 모드는 ${PLATFORM_LABEL[p]} 를 전제로 만들어지지 않았습니다 — 레이아웃·규칙이 어긋날 수 있습니다.`);
    }
  } catch { /* 경고 실패로 발행을 막지 않는다 */ }
  log.info(`발행 대상: ${platforms.map((p) => PLATFORM_LABEL[p]).join(' + ')}`);

  /* 사진이 고정되지 않은 글은 **프리뷰와 다른 사진으로 나갈 수 있다.**
   * 아래 renderImages 가 photoQuery 로 스톡을 **다시 검색**하기 때문이다.
   * 네이버는 발행 후 수정이 안 되니 미리 알려 준다 (2026-08-03). */
  if (!article.photoDir) {
    const searched = (article.imageBriefs || []).filter((b) => b.photoQuery?.trim()).length;
    if (searched) {
      log.warn(
        `사진 ${searched}장이 발행 직전에 **다시 검색**됩니다 — 검토한 사진과 다를 수 있습니다. ` +
          '고정하려면: npm run repreview -- "<글>.json" --pin'
      );
    }
  }

  const rendered = await renderImages(article, cfg);
  const ordered = [rendered.thumbnail, ...rendered.body].filter(Boolean);
  const imageFiles = ordered.map((i) => i.file);
  const imageMeta = ordered.map((img, idx) => ({
    alt: img.alt || '',
    caption: idx === 0 ? '' : img.caption || '',
    afterSection: idx === 0 ? 0 : img.afterSection,
    // 아티클이 지정한 배치 — 문단 위치와 사진 묶음(imageGroup)
    afterParagraph: idx === 0 ? null : img.afterParagraph ?? null,
    group: idx === 0 ? '' : img.group || '',
  }));
  const credits = ordered.map((i) => i.background).filter((b) => b && (b.photographer || b.credit));

  /* 연속 발행 캡차를 **만나지 않게** 간격을 지킨다.
   *
   * 티스토리는 짧은 간격의 발행을 스팸으로 보고 지도 캡차를 띄운다. 캡차는 사람이
   * 풀어야 하므로 무인 실행이 그 자리에서 끊긴다 (2026-08-05: 4연속 시도 4번 발생).
   * 간격이 모자라면 즉시 발행을 포기하고 **예약 발행**으로 돌린다 — 티스토리 기능이라
   * 캡차와 무관하다. `--now` 로 강제할 수 있다. */
  const { applyPacing, recordPublish } = await import('./pace.js');
  /* ⚠️ 간격은 **플랫폼별로** 본다.
   *
   * 처음에는 티스토리 기록 하나로 판단했다. 그래서 티스토리에 올린 직후 네이버에
   * 올리려 하면 네이버 발행이 예약으로 밀렸다 — 두 곳은 캡차 정책이 다르고 기록도
   * 따로여야 한다 (2026-08-05 실측: 명상록 네이버 발행이 티스토리 기록 35분 때문에
   * 11분 예약으로 바뀌었다).
   *
   * 캡차가 실제로 확인된 곳은 티스토리뿐이므로, 네이버에는 간격을 걸지 않는다.
   * 네이버에서도 같은 현상이 실측되면 그때 `minPublishGapMinutes` 를 플랫폼별로 나눈다. */
  if (platforms.includes('tistory')) {
    applyPacing(cfg, 'tistory', cfg.blog.name, { force: flags.now === true });
  }

  const results = {};
  for (const platform of platforms) {
    if (platform === 'tistory') {
      /* ⚠️ 이 모양을 **여기서 다시 만들지 않는다.** `run.js` 의 `mapImages` 가 만든다.
       * > 2026-08-03: 여기 복사본이 있어서, mapImages 에 `isStepCard` 를 넣어도
       * > 이 경로만 표시를 빠뜨렸다. 같은 것을 두 곳에서 만들면 한쪽은 반드시 낡는다. */
      const { withPlaceholders: images } = mapImages(rendered);
      const html = buildHtml(article, { cfg, images, imageCredits: credits });
      results.tistory = await publish({ article, html, imageFiles }, cfg);
    } else {
      results.naver = await publishToNaver({ article, imageFiles, imageMeta, credits }, cfg);
    }
  }

  for (const [platform, r] of Object.entries(results)) {
    log.ok(`${PLATFORM_LABEL[platform]} 발행 완료: ${r.postUrl || r.url}`);
    // 다음 발행의 간격 계산 근거 — 성공한 것만 기록한다
    if (platform === 'tistory') recordPublish('tistory', cfg.blog.name);
  }

  /* 책 발행 성공 → books.done.txt 의 해당 줄에 주소를 기록한다.
   * 다음 책이 "지난 책" 으로 이 글을 잇는 재료가 된다 (topics.done.txt 방식). */
  const naverUrl = results.naver?.postUrl || results.naver?.url;
  if (article.mode === 'book' && naverUrl && fs.existsSync('books.done.txt')) {
    const lines = fs.readFileSync('books.done.txt', 'utf8').split('\n');
    const at = lines.findIndex(
      (l) => !l.includes('->') && l.trim() && String(article.title).includes(l.replace(/^\[[^\]]*\]\s*/, '').replace(/\s*\(.*?\)\s*/g, '').trim())
    );
    if (at >= 0) {
      lines[at] = `${lines[at]} -> ${naverUrl}`;
      fs.writeFileSync('books.done.txt', lines.join('\n'));
      log.debug(`books.done.txt 에 주소 기록: ${naverUrl}`);
    } else {
      /* 줄이 없으면 **새로 붙인다.**
       *
       * 이 블록은 `npm run book` 이 미리 써 둔 줄에 주소만 채우도록 되어 있었다.
       * 그래서 **사람이 책을 직접 지정하면 아무 기록도 남지 않았다** —
       * 다음에 같은 책을 또 고를 수 있다는 뜻이다.
       *
       * > 2026-08-02 발각 — 사용자가 지정한 『책 읽고 싶어서 회사를 그만뒀습니다』를
       * > 발행했는데 done 목록에 남지 않았다. 2026-07-31 에 이미 한 번,
       * > 커밋되지 않은 done 목록 때문에 발행한 책을 다시 고른 적이 있다(§7-4).
       * > **중복 판단의 근거가 되는 목록에 빠지는 경로가 있으면 그 목록을 못 믿는다.** */
      const { todayStr } = await import('./paths.js');
      const title = String(article.topic || article.title || '')
        .split('\n')[0]
        .replace(/^책\s*:\s*/, '')
        .split(/\s+—\s+/)[0]
        .trim();
      const text = fs.readFileSync('books.done.txt', 'utf8').replace(/\s*$/, '');
      fs.writeFileSync('books.done.txt', `${text}\n[${todayStr()}] ${title} -> ${naverUrl}\n`);
      log.ok(`books.done.txt 에 새 줄로 기록: ${title}`);
    }
  }
}

async function cmdQueue(cfg, { count = 1, noPublish }) {
  const st = queue.status();
  if (!st.pending.length) {
    log.warn(`topics.txt 에 처리할 주제가 없습니다. (완료 ${st.done} · 실패 ${st.failed})`);
    return;
  }
  log.info(`대기 중인 주제 ${st.pending.length}개 · 이번 실행에서 ${Math.min(count, st.pending.length)}개 처리`);

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < count; i++) {
    const topic = queue.nextTopic();
    if (!topic) {
      log.info('큐가 비었습니다.');
      break;
    }
    try {
      const res = await runTopic(topic, cfg, { publish: !noPublish });
      queue.markDone(topic, res.result?.postUrl || res.result?.url || '');
      ok++;
    } catch (err) {
      log.error(`실패 [${topic}]: ${err.message}`);
      queue.markFailed(topic, err.message);
      fail++;
    }
    if (i < count - 1) {
      log.info('다음 글까지 30초 대기...');
      await new Promise((r) => setTimeout(r, 30_000));
    }
  }

  log.banner(`큐 처리 결과: 성공 ${ok} · 실패 ${fail}`);
  if (fail > 0 && ok === 0) process.exitCode = 1;
}

async function cmdProbe(cfg) {
  cfg.browser.headless = false;
  const urls = blogUrls(cfg);
  const ctx = await launchBrowser(cfg);
  try {
    const page = await firstPage(ctx);
    await ensureLoggedIn(page, cfg, urls, { interactive: true });
    await probeEditor(page, urls);
  } finally {
    await ctx.close().catch(() => {});
  }
}

async function cmdTopics(args) {
  const [sub, ...rest] = args;
  if (sub === 'add') {
    const added = queue.addTopics(rest);
    log.ok(`주제 ${added.length}개 추가: ${added.join(' / ') || '(중복 제외됨)'}`);
    return;
  }
  const st = queue.status();
  log.info(`대기 ${st.pending.length} · 완료 ${st.done} · 실패 ${st.failed}`);
  st.pending.forEach((t, i) => log.info(`  ${String(i + 1).padStart(2)}. ${t}`));
}

/**
 * 유튜브 소재·장면 캡처에 필요한 외부 도구를 점검한다.
 *
 * 이것들이 없으면 조용히 실패하거나 403 만 뜨고 원인을 알기 어렵다.
 * (실제로 JS 런타임 하나 때문에 한참 헤맸다 — HANDOVER 참고)
 * 기사 기반 글쓰기에는 필요 없으므로 안내만 하고 실패로 세지 않는다.
 */
async function checkYoutubeDeps() {
  const { spawn } = await import('node:child_process');
  const probe = (cmd, args) =>
    new Promise((resolve) => {
      const p = spawn(cmd, args, { windowsHide: true });
      let out = '';
      const done = (v) => resolve(v);
      const t = setTimeout(() => { p.kill(); done(null); }, 12_000);
      p.stdout.on('data', (d) => (out += d));
      p.on('error', () => { clearTimeout(t); done(null); });
      p.on('close', (c) => { clearTimeout(t); done(c === 0 ? out.trim() : null); });
    });

  const [ytdlp, py] = await Promise.all([
    probe('yt-dlp', ['--version']),
    probe('python', ['-c', 'import cv2,numpy;print(cv2.__version__)']),
  ]);

  // PATH 에 있거나 .tmp/ffmpeg 아래에 풀어 뒀거나 둘 중 하나면 된다
  const localFf = (() => {
    const base = path.join(DIRS.tmp, 'ffmpeg');
    if (!fs.existsSync(base)) return false;
    const stack = [base];
    while (stack.length) {
      const dir = stack.pop();
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      const names = entries.map((e) => e.name);
      if (names.includes('ffprobe.exe') || names.includes('ffprobe')) return true;
      for (const e of entries) if (e.isDirectory()) stack.push(path.join(dir, e.name));
    }
    return false;
  })();
  const ffprobe = localFf || (await probe('ffprobe', ['-version'])) ? '있음' : '없음';
  const nodeMajor = Number(process.versions.node.split('.')[0]);

  const parts = [
    `yt-dlp ${ytdlp || '없음'}`,
    `opencv ${py || '없음'}`,
    `ffmpeg/ffprobe ${ffprobe}`,
    `Node ${process.versions.node}`,
  ];
  log.info(`유튜브 기능 준비물: ${parts.join(' · ')}`);

  const missing = [];
  if (!ytdlp) missing.push('yt-dlp');
  if (!py) missing.push('opencv-python-headless');
  if (ffprobe === '없음') missing.push('ffmpeg + ffprobe');
  if (nodeMajor < 22) missing.push(`Node 22 이상 (현재 ${nodeMajor})`);

  if (missing.length) {
    log.info(
      `  → 영상 소재·장면 캡처를 쓰려면 필요합니다: ${missing.join(', ')}. ` +
        '`pip install -r requirements.txt` 와 HANDOVER 2-1-1 을 보세요. ' +
        '(기사 기반 글쓰기는 이것 없이도 동작합니다)'
    );
  }
}

async function cmdDoctor(cfg) {
  log.banner('환경 점검');
  let bad = 0;

  /* 모드 선언과 실제 지시문이 어긋난 곳을 먼저 잡는다.
   * 모드가 늘 때마다 규칙을 빼먹었고(영화 모드 두 곳), 라우팅이 빠져
   * buildBookPrompt 가 아예 호출되지 않은 적도 있다 (2026-08-01). */
  try {
    const { lintModes, ACTIVE, MODE } = await import('./mode.js');
    const {
      buildArticlePrompt,
      buildNewsPrompt,
      buildClipPrompt,
      buildBookPrompt,
      buildMoviePrompt,
      buildEconPrompt,
      buildDramaPrompt,
    } = await import('./prompt.js');
    /* ⚠️ 여기와 codexWriter.js 의 라우팅은 **한 쌍이다.** 한쪽만 고치면 doctor 가
     * 엉뚱한 지시문으로 대조해서, 규칙이 다 들어 있는 모드를 틀렸다고 말한다.
     * > 2026-08-03: 경제 모드를 붙이며 이쪽을 빼먹었고, 기사 모드 지시문과 대조되어
     * > 네 항목이 한꺼번에 틀렸다고 나왔다 (실제로는 라우팅 한 줄이 없던 것). */
    const build = (id) => {
      if (id === MODE.CLIP) return buildClipPrompt({ clip: { title: 't', videoId: 'v', lines: [] }, cfg });
      if (id === MODE.NEWS) return buildNewsPrompt({ url: 'https://example.com/a', cfg });
      if (id === MODE.BOOK) return buildBookPrompt({ topic: '책: 제목 — 저자', cfg });
      if (id === MODE.MOVIE) return buildMoviePrompt({ topic: '영화: 제목 (감독)', cfg });
      if (id === MODE.ECON) return buildEconPrompt({ topic: '경제: 주제', cfg });
      if (id === MODE.DRAMA) return buildDramaPrompt({ topic: '드라마: 제목 4회', cfg });
      return buildArticlePrompt({ topic: '주제', cfg });
    };
    /* 스키마 required 와 아티클 실제 모양을 함께 대조한다 — codexWriter 를
     * modes/index.js 에서 import 하면 순환 참조가 되므로 여기서 넘긴다. */
    const { articleShapeKeys } = await import('./codexWriter.js');
    const problems = lintModes({ buildPrompt: build, cfg, articleKeys: articleShapeKeys(cfg) });
    if (problems.length) {
      for (const p of problems) log.error(`모드 정합: ${p}`);
      bad += problems.length;
    } else {
      log.ok(`모드 정합 OK (${ACTIVE.map((m) => m.label).join(' · ')})`);
    }
  } catch (err) {
    log.error(`모드 점검 실패: ${err.message.split('\n')[0]}`);
    bad++;
  }

  const { cmd, shell } = resolveCodex();
  log.info(`codex 실행 파일: ${cmd}${shell ? ' (shell 경유)' : ''}`);
  if (shell) log.warn('네이티브 codex 바이너리를 못 찾아 PATH 경유로 실행합니다. 느릴 수 있습니다.');

  try {
    const urls = blogUrls(cfg);
    log.ok(`블로그: ${urls.host}`);
  } catch (err) {
    log.error(err.message);
    bad++;
  }

  if (cfg.secrets.kakaoId && cfg.secrets.kakaoPw) {
    log.ok(`카카오 계정: ${cfg.secrets.kakaoId.replace(/(.{2}).*(@.*)/, '$1***$2')}`);
  } else {
    log.warn('.env 에 KAKAO_ID / KAKAO_PW 가 없습니다. `npm run login` 으로 수동 로그인이 필요합니다.');
  }

  const hasProfile = fs.existsSync(path.join(cfg.profileDir, 'Default'));
  log.info(`저장된 브라우저 프로필: ${hasProfile ? '있음' : '없음 (첫 로그인 필요)'}`);

  log.info(`아티클 스키마: ${fs.existsSync(FILES.articleSchema) ? '정상' : '없음'}`);
  if (!fs.existsSync(FILES.articleSchema)) bad++;

  /* 유튜브 기능 준비물.
   * 기사 기반 글쓰기는 이것들 없이도 동작하므로 실패로 세지 않고 안내만 한다.
   * 새 컴퓨터에서 왜 영상 기능이 안 되는지 여기서 바로 알 수 있어야 한다. */
  await checkYoutubeDeps();

  const st = queue.status();
  log.info(`주제 큐: 대기 ${st.pending.length} · 완료 ${st.done} · 실패 ${st.failed}`);

  log.info(
    `설정: 공개=${cfg.blog.visibility} · 카테고리=${cfg.blog.category || '(미지정)'} · ` +
      `이미지=${cfg.images.enabled ? `기본 대표+본문${cfg.images.bodyImages}` : '없음'} · ` +
      `배경=${cfg.images.background === 'photo' ? '실사 사진' : '그라디언트'} · ` +
      `검색=${cfg.codex.search ? 'ON' : 'OFF'}`
  );
  /* 사진 수는 **모드마다 다르다.** 위 줄만 찍으면 "본문 5" 로 읽히는데 기사 글은
   * 8장을 쓴다. 값이 한 곳(모드 선언의 bodyImageDelta)에서 나오게 만든 뒤에도
   * 화면이 옛 숫자를 말하면 다음 사람이 그 숫자를 믿는다. */
  if (cfg.images.enabled) {
    const { ACTIVE, bodyImageCount } = await import('./mode.js');
    log.info(
      '모드별 사진: ' +
        ACTIVE.map((m) => {
          const n = bodyImageCount(m.id, cfg);
          const byShots = m.capabilities?.clipShots ? '(장면 캡처가 정한다)' : `${n + 1}장`;
          return `${m.label} ${byShots}`;
        }).join(' · ')
    );
  }
  if (cfg.images.enabled && cfg.images.background === 'photo') {
    if (cfg.secrets.pexelsApiKey) log.ok('배경 사진: Pexels API 사용 (빠름·정확)');
    else log.info('배경 사진: codex 웹 검색 사용 — PEXELS_API_KEY 를 넣으면 더 빠르고 정확합니다.');
  }

  if (hasProfile) {
    log.info('로그인 세션 유효성 확인 중...');
    try {
      const urls = blogUrls(cfg);
      const ctx = await launchBrowser(cfg, { headless: true });
      try {
        const page = await firstPage(ctx);
        const ok = await isLoggedIn(page, urls);
        if (ok) log.ok('로그인 세션 유효 — 무인 실행 준비 완료');
        else log.warn('로그인 세션 만료 — `npm run login` 실행을 권장합니다.');
      } finally {
        await ctx.close().catch(() => {});
      }
    } catch (err) {
      log.warn(`세션 확인 실패: ${err.message}`);
    }
  }

  if (bad) {
    log.error(`점검 실패 항목 ${bad}개`);
    process.exitCode = 1;
  } else {
    log.ok('점검 완료');
  }
}

async function main() {
  ensureDirs();
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const command = positional[0] || 'help';
  const rest = positional.slice(1);

  const cfg = applyFlags(loadConfig(), flags);
  if (cfg.verbose) log.setVerbose(true);

  switch (command) {
    case 'login':
      return cmdLogin(cfg);
    case 'post':
      return cmdPost(cfg, rest.join(' '), flags);
    case 'draft':
      return cmdPost(cfg, rest.join(' '), { ...flags, noPublish: true });
    case 'book': {
      /* '오늘 뭐 읽지?' 한 번에 — 오늘의 책을 고르고 초안까지 만든다.
       * **발행은 하지 않는다.** 검토(사진 큐레이션·카드·발췌 확인)는 사람이 한다
       * (publish-review-loop 원칙). 검토 뒤: npm run publish -- out/<글>.json --naver */
      const { execFileSync } = await import('node:child_process');
      const picked = execFileSync(process.execPath, ['scripts/book-today.mjs', '--pick', '--save'], {
        encoding: 'utf8',
      })
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('책:'))
        .pop();
      if (!picked) throw new Error('오늘의 책을 고르지 못했습니다 (scripts/book-today.mjs 확인).');
      log.ok(`오늘의 책: ${picked.replace(/^책\s*:\s*/, '')}`);
      return cmdPost(cfg, picked, { ...flags, noPublish: true });
    }
    case 'publish':
      return cmdPublishFile(cfg, rest[0], flags);
    case 'news':
      return cmdNews(cfg, rest, flags);
    case 'radar':
      return cmdRadar(cfg, rest, flags);
    case 'queue':
      return cmdQueue(cfg, { count: flags.count || 1, noPublish: flags.noPublish });
    case 'probe':
      return cmdProbe(cfg);
    case 'login:naver':
      return cmdLoginNaver(cfg);
    case 'probe:naver':
      return cmdProbeNaver(cfg);
    case 'verify': {
      const ok = await verifySelectors(cfg);
      if (!ok) process.exitCode = 1;
      return undefined;
    }
    case 'topics':
      return cmdTopics(rest);
    case 'doctor':
      return cmdDoctor(cfg);
    default:
      process.stdout.write(HELP);
      return undefined;
  }
}

main().catch((err) => {
  log.error(err.stack || err.message);
  process.exitCode = 1;
});
