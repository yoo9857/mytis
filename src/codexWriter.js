import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DIRS, FILES, stamp, safeSlug } from './paths.js';
import { log, fmtDuration } from './log.js';
import { buildArticlePrompt, buildNewsPrompt, buildClipPrompt, buildBookPrompt } from './prompt.js';
import { MODE, MODE_LABEL, detectMode, resolveMode, can } from './mode.js';

/** 주제 문자열이 기사 URL 인지 판별한다. */
export function isUrl(text) {
  return /^https?:\/\/\S+$/i.test(String(text || '').trim());
}

/** codex 실행 파일 위치를 찾는다. 네이티브 exe 를 우선해서 shell 인용 문제를 피한다. */
export function resolveCodex() {
  if (process.env.CODEX_BIN && fs.existsSync(process.env.CODEX_BIN)) {
    return { cmd: process.env.CODEX_BIN, shell: false };
  }

  const isWin = process.platform === 'win32';
  const exe = isWin ? 'codex.exe' : 'codex';
  const platPkg = {
    win32: { x64: 'codex-win32-x64', arm64: 'codex-win32-arm64' },
    darwin: { x64: 'codex-darwin-x64', arm64: 'codex-darwin-arm64' },
    linux: { x64: 'codex-linux-x64', arm64: 'codex-linux-arm64' },
  }[process.platform]?.[process.arch];

  const roots = [];
  if (process.env.APPDATA) roots.push(path.join(process.env.APPDATA, 'npm', 'node_modules'));
  if (process.env.npm_config_prefix) {
    roots.push(path.join(process.env.npm_config_prefix, 'node_modules'));
    roots.push(path.join(process.env.npm_config_prefix, 'lib', 'node_modules'));
  }
  roots.push('/usr/local/lib/node_modules', '/usr/lib/node_modules');

  for (const root of roots) {
    if (!platPkg) break;
    const vendorRoot = path.join(root, '@openai', 'codex', 'node_modules', '@openai', platPkg, 'vendor');
    if (!fs.existsSync(vendorRoot)) continue;
    for (const triple of fs.readdirSync(vendorRoot)) {
      const candidate = path.join(vendorRoot, triple, 'bin', exe);
      if (fs.existsSync(candidate)) return { cmd: candidate, shell: false };
    }
  }

  // PATH 상의 codex 를 shell 로 실행 (Windows 에서는 codex.cmd)
  return { cmd: isWin ? 'codex.cmd' : 'codex', shell: true };
}

/** 텍스트에서 최상위 JSON 객체를 안전하게 추출한다. */
export function extractJson(text) {
  if (!text) throw new Error('codex 응답이 비어 있습니다.');
  let s = text.trim();

  // ```json ... ``` 펜스 제거
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  try {
    return JSON.parse(s);
  } catch {
    /* 아래에서 괄호 균형으로 재시도 */
  }

  const start = s.indexOf('{');
  if (start < 0) throw new Error('codex 응답에서 JSON 을 찾지 못했습니다.');
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return JSON.parse(s.slice(start, i + 1));
      }
    }
  }
  throw new Error('codex 응답의 JSON 이 완결되지 않았습니다.');
}

/** codex exec 를 한 번 실행하고 마지막 메시지를 문자열로 돌려준다. */
function runCodexExec({ prompt, schemaFile, cfg, timeoutMs, search }) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(DIRS.tmp, { recursive: true });
    const outFile = path.join(DIRS.tmp, `codex-out-${stamp()}-${process.pid}.json`);
    const { cmd, shell } = resolveCodex();
    const limit = timeoutMs ?? cfg.codex.timeoutMs;
    const useSearch = search ?? cfg.codex.search;

    const args = [
      'exec',
      '--skip-git-repo-check',
      '-C',
      DIRS.tmp,
      '-s',
      'read-only',
      '-c',
      'approval_policy="never"',
      '--output-schema',
      schemaFile,
      '-o',
      outFile,
    ];
    // 웹 검색은 exec 에서 --search 가 아니라 config 키로 켠다
    if (useSearch) args.push('-c', 'tools.web_search=true');
    if (cfg.codex.model) args.push('-m', cfg.codex.model);
    if (cfg.codex.reasoningEffort) {
      args.push('-c', `model_reasoning_effort="${cfg.codex.reasoningEffort}"`);
    }
    args.push('-'); // 프롬프트는 stdin 으로

    log.debug(`codex 실행: ${cmd} ${args.join(' ')}`);

    const child = spawn(cmd, args, {
      shell,
      cwd: DIRS.tmp,
      windowsHide: true,
      env: { ...process.env, RUST_LOG: process.env.RUST_LOG || 'error' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killedByTimeout = false;

    const timer = setTimeout(() => {
      killedByTimeout = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* noop */
      }
    }, limit);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      stdout += d;
      if (cfg.verbose) process.stdout.write(d);
    });
    child.stderr.on('data', (d) => {
      stderr += d;
      if (cfg.verbose) process.stderr.write(d);
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`codex 실행 실패 (${cmd}): ${err.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (killedByTimeout) {
        return reject(new Error(`codex 타임아웃 (${fmtDuration(limit)} 초과)`));
      }
      let last = '';
      if (fs.existsSync(outFile)) {
        last = fs.readFileSync(outFile, 'utf8');
        try {
          fs.unlinkSync(outFile);
        } catch {
          /* noop */
        }
      }
      if (!last && code !== 0) {
        const tail = (stderr || stdout).split('\n').slice(-25).join('\n');
        return reject(new Error(`codex 종료 코드 ${code}\n${tail}`));
      }
      if (!last) {
        const tail = stdout.split('\n').slice(-25).join('\n');
        return reject(new Error(`codex 가 최종 메시지를 남기지 않았습니다.\n${tail}`));
      }
      resolve(last);
    });

    child.stdin.write(prompt, 'utf8');
    child.stdin.end();
  });
}

/** 임의의 스키마로 codex 를 한 번 호출하고 파싱된 JSON 을 돌려준다. */
export async function runCodexJson({ prompt, schemaFile, cfg, timeoutMs, search }) {
  const last = await runCodexExec({ prompt, schemaFile, cfg, timeoutMs, search });
  return extractJson(last);
}

/**
 * 영상 제목·자막에서 프로그램명·기수·출연자 이름을 추려낸다.
 *
 * 커뮤니티 검색에 **기수가 반드시 필요**하기 때문이다. 기수 없이 이름만으로
 * 찾으면 다른 기수의 동명이인이 쏟아진다 (buzz.js 머리말 참고).
 *
 * 나는솔로 계열은 출연자가 고정된 가명을 쓰므로 그 목록으로 잡아낸다.
 * 다른 프로그램이면 이름을 못 찾아 빈 배열이 되고, 그때는 프로그램+기수로만 찾는다.
 */
const SOLO_ALIASES = [
  '영수', '영호', '영식', '영철', '광수', '상철', '경수', '동수',
  '영자', '정숙', '순자', '영숙', '옥순', '현숙', '정순', '영옥',
];

function guessShow(clip) {
  const hay = `${clip?.title || ''} ${clip?.channel || ''}`;
  const program = /나는\s*솔로|나솔/.test(hay) ? '나는솔로' : (clip?.title || '').split(/[\[\]|·]/)[0].trim();
  const season = hay.match(/(\d+)\s*기/)?.[1] || '';
  const text = `${hay} ${clip?.transcript || ''}`;
  const names = SOLO_ALIASES.filter((n) => text.includes(n));
  return { program, season, names };
}

/** 스키마 결과를 안전한 형태로 다듬는다 (누락 필드 보정). */
function normalizeArticle(raw, { topic, cfg }) {
  const arr = (v) => (Array.isArray(v) ? v : []);
  const str = (v) => (typeof v === 'string' ? v.trim() : '');

  const sections = arr(raw.sections)
    .map((s) => ({
      heading: str(s?.heading),
      paragraphs: arr(s?.paragraphs).map(str).filter(Boolean),
      bullets: arr(s?.bullets).map(str).filter(Boolean),
      table: {
        caption: str(s?.table?.caption),
        headers: arr(s?.table?.headers).map(str),
        rows: arr(s?.table?.rows).map((r) => arr(r).map(str)),
      },
      callout: str(s?.callout),
    }))
    .filter((s) => s.heading && (s.paragraphs.length || s.bullets.length || s.table.rows.length));

  const tags = arr(raw.tags)
    .map((t) => str(t).replace(/[#,"']/g, '').trim())
    .filter(Boolean)
    .slice(0, Math.max(1, cfg.article.tagCount));

  // 유튜브 ID 는 정확히 11자리. 형식이 어긋나면 지어낸 값일 가능성이 높아 버린다.
  const embeds = arr(raw.embeds)
    .map((e) => ({
      videoId: str(e?.videoId).replace(/^.*[?&]v=/, '').replace(/^.*youtu\.be\//, '').slice(0, 11),
      title: str(e?.title),
      channel: str(e?.channel),
      afterSection: Number.isFinite(e?.afterSection) ? Number(e.afterSection) : 1,
      // 장면 지정 재생 — 실제 자막에 있는 시각인지는 ytClip.snapTimestamps 가 검증한다
      startSeconds: Number.isFinite(e?.startSeconds) ? Math.max(0, Number(e.startSeconds)) : 0,
      quote: str(e?.quote),
      caption: str(e?.caption),
    }))
    .filter((e) => /^[A-Za-z0-9_-]{11}$/.test(e.videoId));

  const imageBriefs = arr(raw.imageBriefs)
    .map((b) => ({
      placement: b?.placement === 'thumbnail' ? 'thumbnail' : 'body',
      headline: str(b?.headline),
      subline: str(b?.subline),
      caption: str(b?.caption),
      alt: str(b?.alt),
      afterSection: Number.isFinite(b?.afterSection) ? Number(b.afterSection) : 0,
      photoQuery: str(b?.photoQuery),
      eyebrow: str(b?.eyebrow),
      statValue: str(b?.statValue),
      statLabel: str(b?.statLabel),
    }))
    .filter((b) => b.headline);

  // 주제가 기사 URL 이면 제목·키워드 폴백으로 쓰면 안 된다
  const fromNews = isUrl(topic);
  const title = str(raw.title) || (fromNews ? '제목 없음' : topic);

  return {
    topic,
    sourceUrl: fromNews ? topic : '',
    title,
    seoTitle: str(raw.seoTitle) || title,
    metaDescription: str(raw.metaDescription),
    urlSlug: str(raw.urlSlug)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70),
    primaryKeyword: str(raw.primaryKeyword) || (fromNews ? title : topic),
    entities: arr(raw.entities)
      .map((e) => ({ nameKo: str(e?.nameKo), nameEn: str(e?.nameEn), role: str(e?.role) }))
      .filter((e) => e.nameKo || e.nameEn),
    secondaryKeywords: arr(raw.secondaryKeywords).map(str).filter(Boolean),
    tags,
    directAnswer: str(raw.directAnswer),
    keyTakeaways: arr(raw.keyTakeaways).map(str).filter(Boolean),
    sections,
    faq: arr(raw.faq)
      .map((f) => ({ question: str(f?.question), answer: str(f?.answer) }))
      .filter((f) => f.question && f.answer),
    conclusion: str(raw.conclusion),
    sources: arr(raw.sources)
      .map((s) => ({
        title: str(s?.title),
        url: str(s?.url),
        publisher: str(s?.publisher),
        date: str(s?.date),
      }))
      .filter((s) => /^https?:\/\//i.test(s.url)),
    embeds,
    imageBriefs,
    generatedAt: new Date().toISOString(),
  };
}

function articleCharCount(article) {
  const parts = [
    article.directAnswer,
    ...article.keyTakeaways,
    ...article.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...s.bullets, s.callout]),
    ...article.faq.flatMap((f) => [f.question, f.answer]),
    article.conclusion,
  ];
  return parts.join('').length;
}

/**
 * 주제 하나로 아티클 JSON 을 생성한다.
 * 결과가 빈약하면 한 번 더 시도한다.
 */
export async function writeArticle({ topic, cfg }) {
  /* 책 글은 스키마를 따로 쓴다 — **필드 설명이 프롬프트와 싸우면 스키마가 이긴다.**
   * article.schema.json 의 heading 설명("질문형 또는 명사구")과 callout 설명
   * ("팁이나 주의사항") 때문에, 프롬프트에서 아무리 금지해도 질문형 소제목과
   * 조언형 callout 이 계속 나왔다 (2026-07-29 · 6차 시도까지 재발 —
   * 이 라우팅 자체가 한 번 조용히 빠져서 6차도 옛 스키마로 나갔다).
   * codex 는 --output-schema 의 description 을 프롬프트보다 강하게 따른다. */
  const schemaFile = detectMode(topic) === MODE.BOOK ? FILES.bookSchema : FILES.articleSchema;
  if (!fs.existsSync(schemaFile)) {
    throw new Error(`아티클 스키마를 찾을 수 없습니다: ${schemaFile}`);
  }
  log.debug(`스키마: ${path.basename(schemaFile)}`);

  const fromNews = isUrl(topic);
  const maxAttempts = 2;
  let lastErr = null;

  // 유튜브 주소면 '영상 소재' 모드 — 자막을 읽어 장면별 임베드를 만든다
  const { parseYouTube, fetchClip, snapTimestamps } = await import('./ytClip.js');
  const videoId = fromNews ? parseYouTube(topic) : null;
  let clip = null;
  if (videoId) {
    clip = await fetchClip(topic);
    if (!clip?.lines?.length) {
      log.warn('자막을 못 읽어 영상 소재 모드를 쓸 수 없습니다. 일반 기사 모드로 진행합니다.');
      clip = null;
    }
  }

  /* 여기서 모드가 확정된다 (유튜브 주소여도 자막이 없으면 기사 모드로 내려간다).
   * 이후 단계는 조건을 새로 세우지 말고 `can(mode, ...)` 로 물어보세요 — mode.js 참고. */
  const mode = resolveMode(topic, clip);

  // 기사 기반이면 본문을 먼저 추출해 프롬프트에 실어 보낸다
  let source = null;
  if (mode === MODE.NEWS) {
    const { fetchArticle } = await import('./fetchArticle.js');
    source = await fetchArticle(topic, cfg);
  }

  /* 영상 글은 **방송 밖 반응**을 미리 모아 프롬프트에 실어 준다.
   *
   * codex 에게 "커뮤니티를 찾아보라" 고만 하면 잘 못 찾는다. 검색 결과에
   * 다른 기수 같은 이름이 섞여 들어오기 때문이다 (buzz.js 머리말 참고).
   * 그래서 기수까지 대조한 목록을 우리가 만들어 넘긴다. */
  let buzz = '';
  if (mode === MODE.CLIP && cfg.buzz?.enabled !== false) {
    try {
      const { collectBuzz, buzzBlock } = await import('./buzz.js');
      const { program, season, names } = guessShow(clip);
      const items = await collectBuzz({
        program,
        season,
        names,
        limit: cfg.buzz?.count ?? 12,
      });
      buzz = buzzBlock(items);
    } catch (err) {
      log.debug(`방송 밖 반응 수집 실패: ${err.message.split('\n')[0]}`);
    }
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const started = Date.now();
    log.step(
      `codex 로 글 생성 중 (시도 ${attempt}/${maxAttempts}) · ${MODE_LABEL[mode]} 모드` +
        `${cfg.codex.search ? ' · 웹검색 ON' : ''}${cfg.codex.model ? ` · ${cfg.codex.model}` : ''}`
    );
    log.info(`${fromNews ? '소재 기사' : '주제'}: ${topic}`);
    log.info('검색과 집필에 수 분이 걸립니다. 기다려 주세요...');

    try {
      let prompt = clip
        ? buildClipPrompt({ clip, cfg, buzz })
        : fromNews
          ? buildNewsPrompt({ url: topic, cfg, source })
          : buildArticlePrompt({ topic, cfg });
      if (attempt > 1 && lastErr) {
        prompt += `\n\n# 재시도 사유\n직전 시도 결과가 기준에 못 미쳤습니다: ${lastErr}\n이번에는 분량과 섹션 수를 반드시 채우세요.`;
      }

      const last = await runCodexExec({ prompt, schemaFile, cfg });
      const raw = extractJson(last);
      const article = normalizeArticle(raw, { topic, cfg });

      /* ⚠️ 모드는 **모든 글에** 붙여야 한다.
       *
       * 영상 글에만 붙였더니 기사 글이 photo.js 에서 `article.mode || MODE.TOPIC`
       * 으로 **주제 모드로 판정**됐고, 주제 모드는 `sourcePhoto: false` 라
       * 원문 기사 사진을 통째로 버렸다.
       *
       * > 2026-07-28 실측 — 소지섭 금 선물 기사:
       * > 원문에 사진이 3장 있었는데 하나도 쓰지 않고, 대신 스톡 사진
       * > "gold bar calculator desk", "tropical airport luggage beach" 가 실렸다.
       * > 인물도 사건도 없는 사진이 글의 얼굴이 됐다.
       *
       * mode.js 로 판단을 한곳에 모은 뒤에도 **값을 심는 것을 빼먹으면** 같은
       * 사고가 난다. 새 모드를 추가할 때 이 줄을 잊지 마세요. */
      article.mode = mode;
      // 책 글은 사진이 많아야 한다 — 프롬프트(bodyImages+2)와 렌더 수를 맞춘다
      if (mode === MODE.BOOK) article.bodyImageCount = cfg.images.bodyImages + 2;

      // 영상 소재 글: 지어낸 타임스탬프를 실제 자막 시각으로 스냅하고,
      // 자막에 없는 지점은 0(처음부터)으로 되돌린다.
      if (clip) {
        // 영상 소재 글의 임베드는 '같은 영상의 여러 장면'이다.
        // youtube.js 의 fillEmbeds 가 다른 영상을 덧붙이면 글이 어긋난다.
        article.fromClip = true;
        article.mode = MODE.CLIP;
        article.clipVideoId = clip.videoId;
        // 장면 캡처를 쓸 때 크레딧으로 남길 출처 (photo.js 의 clip-shot 분기)
        article.clipChannel = clip.channel || '';
        article.clipUrl = `https://www.youtube.com/watch?v=${clip.videoId}`;
        article.embeds = snapTimestamps(
          (article.embeds || []).map((e) => ({ ...e, videoId: clip.videoId })),
          clip
        );
        for (const e of article.embeds) {
          log.ok(`장면 ${Math.floor(e.startSeconds / 60)}:${String(e.startSeconds % 60).padStart(2, '0')} — ${e.caption || e.quote || ''}`.slice(0, 90));
        }
      }

      // 기사 기반 글은 원문 출처가 반드시 남아 있어야 한다
      if (fromNews && !article.sources.some((s) => s.url === topic)) {
        article.sources.unshift({
          title: article.title,
          url: topic,
          publisher: '원문 기사',
          date: '',
        });
        log.debug('원문 기사 출처를 sources 맨 앞에 추가했습니다.');
      }

      // 원문 기사의 대표 이미지(og:image)와 매체명을 아티클에 실어 둔다.
      // images.useSourcePhoto 가 켜져 있을 때 photo.js 가 이걸 대표 이미지로 쓴다.
      if (fromNews && (source?.image || source?.images?.length)) {
        article.sourceImage = source.image || '';
        // 본문 사진까지 넘긴다. 인물 기사는 서로 다른 컷 여러 장을 쓰는 편이 낫다.
        article.sourceImages = (source.images || []).map((i) => i.url);
        article.sourcePublisher = source.publisher || '';
        article.sourceUrl = topic;
        log.debug(
          `원문 사진 확보: 대표 ${source.image ? 1 : 0}장 · 본문 ${(source.images || []).length}장`
        );
      }

      /* 소재 기사 한 곳만으로는 사진이 부족하다.
       *
       * codex 가 sources 에 넣은 다른 기사들도 **같은 사안을 다룬 최신 기사**라
       * 저마다 그 인물의 최근 사진을 싣고 있다. 여기서 더 긁어오면
       * "코요태 옛날 단체사진 + 헬스장 스톡" 같은 무관한 그림을 피할 수 있다.
       *
       * 기사 한 곳당 브라우저를 한 번 띄우므로 개수를 제한한다.
       *
       * ⚠️ **영상 소재 글(clip)에서는 하지 않는다.**
       * 영상 글의 주제는 그 영상의 장면이고, sources 에 담긴 기사들은 배경조사용
       * 참고 자료일 뿐이라 사안이 다르다. 그 사진을 쓰면 글과 어긋난다.
       *
       * > 2026-07-28 실측 — 나는솔로 23기 라이벌 데이트 영상 글:
       * > codex 가 배경조사로 인용한 '23기 여출연자 스펙' 기사에서 사진을 긁어와
       * > **전혀 다른 영상의 썸네일**("아빠가 사주셨죠")이 대표 이미지가 됐다.
       * > 그 위에 "말의 순서가 남긴 간격" 헤드라인이 얹혀 글과 완전히 따로 놀았다.
       * > (HANDOVER ⑦-4 와 같은 구조의 사고다)
       *
       * 영상 글의 이미지는 `ytShot.captureFrames` 가 잡는 장면 캡처를 쓴다.
       * 판단은 mode.js 의 CAPABILITIES 가 한다 — 여기서 따로 조건을 세우지 마세요. */
      if (
        can(mode, 'relatedArticlePhotos') &&
        cfg.images?.useSourcePhoto === true &&
        (article.sourceImages?.length || 0) < 6 &&
        article.sources?.length > 1
      ) {
        const { fetchArticle } = await import('./fetchArticle.js');
        const extra = article.sources
          .map((s) => s.url)
          .filter((u) => u && u !== topic && /^https?:\/\//.test(u))
          .slice(0, 3);

        for (const url of extra) {
          if ((article.sourceImages?.length || 0) >= 8) break;
          try {
            const s = await fetchArticle(url, cfg, 300);
            const got = [s?.image, ...(s?.images || []).map((i) => i.url)].filter(Boolean);
            if (got.length) {
              article.sourceImages = [...(article.sourceImages || []), ...got];
              log.debug(`추가 출처 사진 ${got.length}장: ${new URL(url).hostname}`);
            }
          } catch (err) {
            log.debug(`추가 출처 사진 실패 (${url.slice(0, 50)}): ${err.message.slice(0, 60)}`);
          }
        }
        if (article.sourceImages?.length) {
          log.ok(`관련 기사에서 사진 ${article.sourceImages.length}장 확보`);
        }
      }

      const chars = articleCharCount(article);
      log.debug(`생성 결과: 섹션 ${article.sections.length}개 · 본문 ${chars}자 · 태그 ${article.tags.length}개`);

      if (article.sections.length < 3) {
        lastErr = `섹션이 ${article.sections.length}개뿐입니다`;
        if (attempt < maxAttempts) {
          log.warn(`${lastErr} — 다시 시도합니다.`);
          continue;
        }
      }
      if (chars < cfg.article.minChars * 0.5) {
        lastErr = `본문이 ${chars}자로 목표(${cfg.article.minChars}자)에 크게 못 미칩니다`;
        if (attempt < maxAttempts) {
          log.warn(`${lastErr} — 다시 시도합니다.`);
          continue;
        }
        log.warn(`${lastErr} — 그대로 진행합니다.`);
      }

      /* 조사 오류는 지시문으로 두 번 연속 새어나갔다 — 규칙이 기계적이라 코드가 잡는다.
       * 고치지는 않는다(사람 이름 오탐이 있다). 발행 전에 눈으로 확인할 목록만 남긴다. */
      const { findParticleErrors, findMonotoneEndings, articleText } = await import('./lintKo.js');
      const particleErrs = findParticleErrors(articleText(article));
      if (particleErrs.length) {
        log.warn(`조사가 의심되는 곳 ${particleErrs.length}군데 — 발행 전에 확인하세요.`);
        for (const e of particleErrs.slice(0, 8)) {
          log.warn(`  ${e.phrase} → ${e.suggest}   …${e.context}…`);
        }
      }
      // 같은 어미 3연타 — "기계적, AI 같다"의 첫 신호 (2026-07-29 독자 지적)
      const mono = findMonotoneEndings(article);
      if (mono.length) {
        log.warn(`같은 어미가 3문장 이상 이어지는 문단 ${mono.length}개 — 리듬을 확인하세요.`);
        for (const m of mono.slice(0, 4)) log.warn(`  섹션${m.section} "…${m.ending}." 연타: ${m.sample}…`);
      }

      article.charCount = chars;
      log.ok(
        `글 생성 완료 (${fmtDuration(Date.now() - started)}) · ` +
          `섹션 ${article.sections.length} · ${chars}자 · 출처 ${article.sources.length}건`
      );
      return article;
    } catch (err) {
      lastErr = err.message;
      if (attempt < maxAttempts) {
        log.warn(`글 생성 실패: ${err.message} — 다시 시도합니다.`);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`글 생성 실패: ${lastErr}`);
}

/** 아티클 JSON 을 out/ 에 저장하고 경로를 돌려준다. */
export function saveArticle(article) {
  fs.mkdirSync(DIRS.out, { recursive: true });
  const file = path.join(DIRS.out, `${stamp()}-${safeSlug(article.title)}.json`);
  fs.writeFileSync(file, JSON.stringify(article, null, 2), 'utf8');
  log.info(`아티클 저장: ${file}`);
  return file;
}
