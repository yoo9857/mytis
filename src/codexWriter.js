import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DIRS, FILES, stamp, safeSlug } from './paths.js';
import { log, fmtDuration } from './log.js';
import {
  buildArticlePrompt,
  buildNewsPrompt,
  buildClipPrompt,
  buildBookPrompt,
  buildMoviePrompt,
  buildEconPrompt,
  buildDramaPrompt,
} from './prompt.js';
import { MODE, MODE_LABEL, MODES, detectMode, resolveMode, can, bodyImageCount } from './mode.js';

/** 주제 문자열이 기사 URL 인지 판별한다. */
export function isUrl(text) {
  return /^https?:\/\/\S+$/i.test(String(text || '').trim());
}

/**
 * 관련 기사에서 같은 인물·기수 사진을 먼저 고른다.
 * 기사 첫 이미지라는 이유만으로 다른 출연자 사진을 가져오지 않게 alt를 함께 본다.
 */
export function rankRelatedArticlePhotos(fetched, { entityNames = [], season = '' } = {}) {
  const clean = (v) => String(v || '').replace(/\s+/g, '').toLowerCase();
  const names = entityNames.map(clean).filter((x) => x.length >= 2);
  const rows = [
    ...(fetched?.images || []).map((img, i) => ({
      url: img?.url,
      alt: img?.alt || '',
      width: Number(img?.w || 0),
      height: Number(img?.h || 0),
      order: i,
    })),
    { url: fetched?.image, alt: fetched?.title || '', width: 0, height: 0, order: 999 },
  ].filter((x) => /^https?:\/\//i.test(String(x.url || '')));

  for (const row of rows) {
    const text = clean(`${row.alt} ${fetched?.title || ''}`);
    row.score = (names.some((name) => clean(row.alt).includes(name)) ? 100 : 0) +
      (season && text.includes(clean(season)) ? 25 : 0) +
      (/나는solo|나는솔로|나솔/i.test(text) ? 15 : 0) +
      (row.width >= 600 || row.height >= 600 ? 5 : 0) - row.order / 100;
  }
  rows.sort((a, b) => b.score - a.score);
  const seen = new Set();
  return rows.filter((row) => {
    const key = String(row.url).replace(/^https?:\/\/[^/]+\/(?:thumb\/[^?]+\?fname=)?/i, '').split('?')[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 모델이 entities 를 비워도 관련 기사 사진 검색에 쓸 좁은 식별어를 복구한다.
 *
 * 연예 기사 스키마에서 entities 는 선택 필드라 종종 빈 배열로 온다. 예전 코드는
 * 그때 primaryKeyword 전체(예: "합숙맞선2 안도윤 권예찬")를 한 덩어리로만
 * 비교했다. 관련 기사 제목에는 그 문자열 전체가 그대로 들어 있지 않으므로 이미
 * 확보한 SBS 기사들까지 전부 탈락했고, 원문 사진 2장만 남아 발행이 막혔다.
 *
 * primaryKeyword 는 모델이 검색 핵심어만 공백으로 나눈 값이라 제목 전체보다
 * 잡음이 적다. entities 의 이름과 이 토큰을 함께 쓰되, 기사 제목에 흔한 상태어는
 * 제외한다. 반환값은 뒤에서 실제 source 제목과 다시 대조하므로 웹 전체를 느슨하게
 * 검색하는 용도로 쓰이지 않는다.
 */
export function relatedPhotoIdentityTerms(article = {}) {
  const stop = new Set([
    '근황', '충격', '포착', '실화', '최종', '선택', '포기', '직진', '결말',
    '방송', '공개', '논란', '반전', '이유', '사진', '기사', '프로필',
  ]);
  const entityTerms = (article.entities || []).flatMap((entity) => {
    const full = String(entity?.nameKo || '').trim();
    const last = full.split(/\s+/).filter(Boolean).pop() || '';
    return [full, last];
  });
  const keywordTerms = String(article.primaryKeyword || '')
    .split(/[^0-9A-Za-z가-힣]+/)
    .filter(Boolean);

  return [...new Set([...entityTerms, ...keywordTerms]
    .map((term) => String(term).replace(/\s+/g, '').trim())
    .filter((term) => term.length >= 2 && !stop.has(term)))];
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

/**
 * codex exec 를 한 번 실행하고 마지막 메시지를 문자열로 돌려준다.
 *
 * `images` 를 주면 `-i` 로 그림을 함께 올린다 (codex exec 의 `--image`). 발행을 막는
 * 틀린그림찾기 화면을 읽는 데 쓴다 — `wrongPicture.js`.
 */
function runCodexExec({ prompt, schemaFile, cfg, timeoutMs, search, images = [] }) {
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
    /* 그림은 실제로 있는 파일만 올린다 — 없는 경로를 주면 codex 가 시작하지 못한다. */
    for (const image of images) {
      if (image && fs.existsSync(image)) args.push('-i', image);
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

/**
 * 섹션마다 사진을 1~2장씩 골고루 넣어 규격(사진 수)을 넘기는 버릇을 자른다.
 *
 * DeepSeek 는 지시문을 강하게 고쳐도(2026-08-13 실측 2회 연속 동일 실패) afterSection
 * 범위를 "구간마다 채우라"는 뜻으로 읽고 12장을 만든다. contract.js 의 autoFix 는 사진
 * 수를 일부러 건드리지 않는데(어떤 사진을 버릴지는 내용 판단이라서) — 이 버릇은 매번 같은
 * 모양(섹션당 1장 먼저, 그다음 같은 섹션에 한 장 더)이라 **어떤 걸 남길지가 아니라 몇 장을
 * 남길지의 문제**다.
 *
 * **2026-08-19 — provider 게이트를 뗐다.** 원래 이 트리밍은 provider==='deepseek' 일
 * 때만 켰다. "codex 는 본문 N개 지시를 지킨다"는 전제였는데, 아래 호출부 주석이 이미
 * "codex 는 알아서 덜 쓰는 편이라 안 드러났을 뿐"이라고 유보를 달아 뒀었다.
 * 이날 gpt-5.6-terra 가 뉴스 모드에서 정확히 같은 모양으로 12장(섹션 1~7 한 장씩 +
 * 1·3·5·7 에 한 장 더)을 냈다. 전제가 틀렸으므로 모델을 가리지 않는다.
 */
export function trimImageBriefs(article, bodyImages) {
  const briefs = article.imageBriefs || [];
  if (!briefs.length) return;
  const thumbnail = briefs.find((b) => b.placement === 'thumbnail');
  const body = briefs.filter((b) => b !== thumbnail);

  const bySectionFirst = [];
  const seenSections = new Set();
  for (const b of body) {
    if (seenSections.has(b.afterSection)) continue;
    seenSections.add(b.afterSection);
    bySectionFirst.push(b);
  }
  const leftovers = body.filter((b) => !bySectionFirst.includes(b));
  const kept = [...bySectionFirst, ...leftovers].slice(0, bodyImages);

  article.imageBriefs = thumbnail ? [thumbnail, ...kept] : kept;
  /* 렌더 단계(images.js)가 imageBriefs 개수가 아니라 이 필드를 읽는다 — 자르고
   * 여기를 안 맞추면 사진 검색은 여전히 옛 개수(11장)를 요청한다. */
  article.bodyImageCount = kept.length;
}

/** 임의의 스키마로 codex 를 한 번 호출하고 파싱된 JSON 을 돌려준다. */
export async function runCodexJson({ prompt, schemaFile, cfg, timeoutMs, search, images }) {
  const last = await runCodexExec({ prompt, schemaFile, cfg, timeoutMs, search, images });
  return extractJson(last);
}

/**
 * DeepSeek Chat Completions API 를 직접 호출한다 (codex CLI 를 거치지 않는다).
 *
 * codex CLI(0.147.0+)는 wire_api="responses" 만 지원하고, DeepSeek 는 구형
 * Chat Completions 만 지원해서 codex 의 model_provider 로는 붙일 수 없다
 * (github.com/openai/codex/discussions/7782). 그래서 이 경로만 fetch 로 직접 호출한다.
 *
 * DeepSeek 는 json_schema 강제 모드가 없다(response_format 은 "json_object" 뿐).
 * 그래서 스키마를 프롬프트 본문에 그대로 실어 보내고, 기존 `extractJson` 으로 파싱한다.
 */
async function runDeepSeekExec({ prompt, schemaFile, cfg, timeoutMs }) {
  const apiKey = cfg.secrets?.deepseekApiKey;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY 가 .env 에 없습니다.');

  const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
  const fullPrompt =
    `${prompt}\n\n# 출력 형식\n` +
    '다른 말 없이, 아래 JSON 스키마를 정확히 따르는 JSON 객체 하나만 응답하세요.\n\n' +
    JSON.stringify(schema);

  const limit = timeoutMs ?? cfg.codex.timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limit);

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.codex.deepseekModel || 'deepseek-v4-pro',
        messages: [{ role: 'user', content: fullPrompt }],
        response_format: { type: 'json_object' },
        /* reasoning_content 와 최종 답변이 max_tokens 를 나눠 쓴다. 기본값에 맡기면
         * 추론에 예산을 다 쓰고 본문이 짧게 끊긴다 (2026-08-13 실측: 3000자 지시에 2500자).
         *
         * 16000 은 기사 모드에서 부족했다 — 2026-08-19, MC몽 도박 폭로 기사로 2회 연속
         * "JSON 이 완결되지 않았습니다". 한국어 3,000자대 본문에 imageBriefs·FAQ·표까지
         * 실린 JSON 은 그 자체로 6~8천 토큰이고, 앞에서 추론이 예산을 먼저 먹는다. */
        max_tokens: 32000,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`DeepSeek API 오류 ${res.status}: ${text.slice(0, 500)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    const finish = data?.choices?.[0]?.finish_reason;

    /* codex 경로는 응답을 tmp 에 남기는데(runCodexExec) 이 경로는 남기지 않아,
     * 파싱이 깨졌을 때 무엇이 왔는지 볼 방법이 없었다. 같은 자리에 남긴다. */
    try {
      fs.mkdirSync(DIRS.tmp, { recursive: true });
      fs.writeFileSync(
        path.join(DIRS.tmp, `deepseek-out-${stamp()}-${process.pid}.json`),
        content ?? '',
        'utf8',
      );
    } catch { /* 로그 실패가 집필을 막지는 않는다 */ }

    if (!content) throw new Error('DeepSeek 응답이 비어 있습니다 (json_mode 빈 응답은 알려진 이슈).');
    if (finish === 'length') {
      throw new Error(
        `DeepSeek 응답이 max_tokens 에서 잘렸습니다 (finish_reason=length, ${content.length}자). ` +
          'codexWriter 의 max_tokens 를 올리거나 지시문을 줄여야 합니다.',
      );
    }
    return content;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`DeepSeek 타임아웃 (${fmtDuration(limit)} 초과)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
function normalizeArticle(raw, { topic, cfg, mode = '' }) {
  const arr = (v) => (Array.isArray(v) ? v : []);
  const str = (v) => (typeof v === 'string' ? v.trim() : '');

  const sections = arr(raw.sections)
    .map((s) => ({
      heading: str(s?.heading),
      /* `answer` — 소제목 바로 아래 **한 줄 답**. html.js 가 굵은 한 줄로 그린다.
       * 목차로 건너온 독자가 문단을 읽지 않고도 자기 자리인지 알게 하는 장치다
       * (사용자 지적 2026-08-06 · 검사는 contract.js 의 sectionsMissingAnswer). */
      answer: str(s?.answer),
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

  /* 태그 상한은 **모드 규격**을 따른다.
   *
   * ⚠️ 예전에는 `cfg.article.tagCount`(=8)로 잘랐다. 그래서 모델이 16개를 만들어도
   * 8개만 남았고, 규격이 10~16을 요구하는 모드는 **매번 경고가 찍혔다.**
   * 지시문을 고쳐도 스키마를 고쳐도 8개였던 이유가 여기였다 —
   * learned.md 가 "태그는 안 붙었다" 며 규격 하한을 올린 것은 증상 대응이었다.
   * > 2026-08-03 발각: 책·영화 모드 규격 [10,16] · 지시문 "12~16개" · 결과 8개. */
  const tagMax = MODES[mode]?.contract?.tags?.[1] || Math.max(1, cfg.article.tagCount);
  const tags = arr(raw.tags)
    .map((t) => str(t).replace(/[#,"']/g, '').trim())
    .filter(Boolean)
    .slice(0, tagMax);

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
      /* 영상 모드의 **장면 판정 세 필드.** 스키마가 required 로 요구하고 지시문이
       * 요청하는데 여기 한 줄이 없어 **조용히 버려지고 있었다** — CLAUDE.md 가
       * 경고한 그 고장이다. `doctor` 는 아티클 **최상위** 키만 대조하므로
       * embeds 안쪽은 보지 못했다 (§7-15).
       *
       * > 2026-08-04 발각 — 이 셋이 비어서 죽어 있던 경로 3개:
       * >  ① speaker  → `pickScenes` 의 대표 장면 승격이 **한 번도 작동하지 않았다.**
       * >     "…말하는 장면이 없어 대표 사진에 주인공이 안 나올 수 있습니다" 경고가
       * >     주인공이 실제로 말하는 글에서도 **매번** 찍혔다.
       * >  ② isStudio → 스튜디오 컷 제외 필터가 아무것도 걸러내지 못했다.
       * >  ③ isHook   → 대표 후보 pool 이 늘 전체가 되어, "의미 판단은 AI(isHook),
       * >     화면 검증은 코드(얼굴 크기)" 설계가 **얼굴 크기 하나로** 주그러졌다.
       * >     지시문은 isHook 설명에 16줄을 쓰고 있었다. */
      speaker: str(e?.speaker),
      isStudio: e?.isStudio === true,
      isHook: e?.isHook === true,
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
      .map((e) => ({
        nameKo: str(e?.nameKo),
        nameEn: str(e?.nameEn),
        role: str(e?.role),
        /* 역사 인물·고인은 공식 SNS 가 존재할 수 없다 — 찾으면 그건 팬 계정이다.
         * > 2026-08-03: 세네카(기원후 65년 사망) 글에 @seneca_theyounger 가
         * > '공식 근황' 으로 붙었다. FAN_PATTERN 은 이름 변형이라 못 걸렀다. */
        historical: e?.historical === true,
      }))
      .filter((e) => e.nameKo || e.nameEn),
    secondaryKeywords: arr(raw.secondaryKeywords).map(str).filter(Boolean),
    tags,
    /* ⚠️ **여기에 없는 키는 버려진다.** 이 함수는 고정된 모양을 만들기 때문에
     * 스키마에 필드를 추가해도 여기 한 줄을 안 넣으면 아티클에 남지 않는다.
     *
     * > 2026-08-01 발각 — `spoiler` 는 영화 스키마 required 에 처음부터 있었는데
     * > 발행된 글 두 편 모두 그 키가 없었다. 제목의 "(스포 O)" 표기는 지시문이
     * > 시켜서 됐던 것이고, 필드는 한 번도 통과한 적이 없다. `angle` 도 같았다.
     * > 이 함정은 `npm run doctor` 의 스키마-정규화 대조가 잡는다(modes/index.js). */
    angle: str(raw.angle),
    /* 네이버 글감 > 장소 카드에 쓸 **네이버 지도 등재 장소명**.
     * 지어내면 검색이 비어 카드가 안 붙는다 — 확인한 이름만. */
    place: str(raw.place),
    spoiler: raw.spoiler === true,
    /* 경제 모드 전용 두 필드 (src/schema/econ.schema.json).
     *
     * `asOf` — 이 글에 실린 수치·제도의 기준 시점. 금리·세율·한도는 바뀌므로
     * 기준일이 없는 숫자는 독자를 속인다.
     * `figures` — 본문 수치와 출처·기준일의 짝. 여기 올릴 수 없는 숫자는 본문에도
     * 쓰지 않는다는 규칙을 기계가 셀 수 있게 만든 것이다(contract.figures).
     *
     * 다른 모드에서는 빈 값으로 남는다 — 스키마에 없으니 모델이 채우지 않는다. */
    asOf: str(raw.asOf),
    /* `airDate` — 드라마 모드의 방송일. `contract.sourcesAfterAirDate` 가 이 날짜를
     * `sources[].date` 와 대조해 **그 회차를 실제로 취재했는지** 막는다.
     * 표 안에만 있으면 코드가 읽을 수 없어서 따로 받는다. 이 한 줄이 없으면
     * 모델이 채운 값이 조용히 버려지고 검사가 "방송일 없음" 으로 전부 막는다. */
    airDate: str(raw.airDate),
    figures: arr(raw.figures)
      .map((f) => ({
        label: str(f?.label),
        value: str(f?.value),
        source: str(f?.source),
        asOf: str(f?.asOf),
      }))
      /* 출처 없는 수치는 **버린다.** 남겨 두면 표에 빈 칸으로 실려서,
       * 근거를 대겠다고 만든 표가 근거가 없다는 증거가 된다. */
      .filter((f) => f.label && f.value && f.source)
      /* **가상 사례의 숫자를 기관 출처로 내보내지 않는다.**
       *
       * > 2026-08-03 실측: 주담대 글에서 `가상 사례 담보가치 = 10억원 [금융위원회]`,
       * > `가상 사례 LTV 산출액 = 7억원 [금융위원회]` 가 나왔다. 금융위원회는
       * > 그런 사례를 발표한 적이 없다. **모델이 자기가 만든 예시에 기관 이름을 붙인 것**이다.
       *
       * 계산 예시는 글에 필요하다(지시문이 시킨다). 다만 그 숫자는 본문에서 조건과 함께
       * 보여주는 것이고, `figures` 는 **기관이 정한 값**만 담는 자리다. 출처를 대겠다고
       * 만든 표에 거짓 출처가 한 줄 섞이면 표 전체를 믿을 수 없다. */
      .filter((f) => !/가상|예시|사례|가정|시뮬|만약/.test(f.label)),
    /* `cards` — 본문에 넣을 정보 카드. infographic.js 가 정사각 이미지로 그린다.
     * 이미지 검색 키워드가 아니라 **카드에 들어갈 글**이다 (참고: dampick 분석,
     * learned.md 2026-08-03 — 그쪽 카드도 템플릿에 글자를 채운 것이었다). */
    cards: arr(raw.cards)
      .map((c) => ({
        type: c?.type === 'columns' ? 'columns' : 'reasons',
        title: str(c?.title),
        afterSection: Number.isFinite(c?.afterSection) ? Math.max(1, Number(c.afterSection)) : 1,
        items: arr(c?.items)
          .map((it) => ({ label: str(it?.label), text: str(it?.text) }))
          .filter((it) => it.label),
      }))
      // 제목이 없거나 항목이 2개 미만이면 카드가 아니다 — 그리면 빈 틀만 나온다
      .filter((c) => c.title && c.items.length >= 2)
      /**
       * 상한은 **모드 규격**(`modes/<id>.js` 의 `contract.cards`)이 갖는다.
       *
       * 전에는 `.slice(0, 2)` 로 박혀 있었다. 그래서 경제 모드가 규격을 3~5 로 올린 뒤
       * **모델이 3개를 내도 코드가 2개로 잘랐고**, 게이트는 자기가 자른 결과를 보고
       * "cards 2개 (규격 3~5)" 라고 다섯 번 보고했다. 지시문·스키마를 두 번 고치며
       * 모델을 의심했는데 원인은 이 줄이었다 (2026-08-04, §7-19).
       *
       * ⚠️ 규격을 올릴 때 이 줄을 함께 볼 필요는 없다 — 규격에서 읽는다. 대신
       * **새 필드에 상한을 손으로 박지 말 것.** 상한은 규격 한 곳에만 둔다.
       */
      .slice(0, MODES[mode]?.contract?.cards?.[1] ?? 2),
    /* `checkSites` — 독자가 직접 열어 확인할 기관 조회 페이지. html.js 가 링크 카드로 그린다.
     * 참고 글 분석에서 나온 것이다: "확인하세요" 와 **확인할 주소를 주는 것**은 다르다
     * (learned.md 2026-08-03, hye_life 집 구하기 — 인터넷등기소·중개업정보 링크). */
    checkSites: arr(raw.checkSites)
      .map((s) => ({ name: str(s?.name), url: str(s?.url), why: str(s?.why) }))
      // 주소가 없거나 형식이 아니면 버린다 — 막힌 링크는 없는 것보다 나쁘다
      .filter((s) => s.name && /^https?:\/\//i.test(s.url)),
    /* `relatedPosts` — **이 블로그의 이전 글**로 가는 링크. html.js 가 '이어 읽기' 로 그린다.
     *
     * 왜 필드인가: 같은 주제를 여러 편으로 나눠 쓰면 검색에서 서로를 끌어올리는데,
     * 그 연결이 산문 안에 있으면 렌더가 없어서 **주소가 화면에 남거나 사라진다**
     * (rich() 는 굵게만 태그로 바꾼다 — 링크는 일부러 열지 않았다).
     *
     * 앞 글에서 뒤 글로는 걸 수 없다 — **발행된 글은 수정할 수 없다.**
     * 그래서 연결은 늘 새 글 → 옛 글 한 방향이고, 이 필드는 그 방향만 담는다. */
    relatedPosts: arr(raw.relatedPosts)
      .map((p) => ({ title: str(p?.title), url: str(p?.url), why: str(p?.why) }))
      .filter((p) => p.title && /^https?:\/\//i.test(p.url))
      // 셋을 넘기면 글 끝이 링크 목록이 된다 — 이어 읽기는 다음 한두 편이면 된다
      .slice(0, 3),
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

/**
 * `normalizeArticle` 이 실제로 만들어 내는 **최상위 키 목록**.
 *
 * 스키마 required 와 이 목록을 대조하면, 스키마에만 있고 아티클까지 오지 못하는
 * 필드를 찾을 수 있다 (`npm run doctor`). 목록을 손으로 옮겨 적지 않고 빈 입력으로
 * 한 번 돌려서 얻는다 — 옮겨 적으면 그것부터 낡는다.
 */
export function articleShapeKeys(cfg) {
  return Object.keys(normalizeArticle({}, { topic: '점검', cfg }));
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
  /* 스키마는 **모드 선언에서** 읽는다 (src/modes/<id>.js 의 schemaFile).
   * 예전에는 여기 삼항식으로 하드코딩돼 있었고, 모드를 추가할 때마다 이 줄을
   * 같이 고쳐야 했다 — 잊으면 새 모드가 article.schema.json 으로 나간다. */
  const detected = detectMode(topic);
  const schemaFile = path.join(DIRS.schema, MODES[detected]?.schemaFile || 'article.schema.json');
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
    const useDeepSeek = cfg.codex.provider === 'deepseek';
    log.step(
      `${useDeepSeek ? 'DeepSeek' : 'codex'} 로 글 생성 중 (시도 ${attempt}/${maxAttempts}) · ${MODE_LABEL[mode]} 모드` +
        `${useDeepSeek ? ' · 웹검색 불가' : cfg.codex.search ? ' · 웹검색 ON' : ''}` +
        `${useDeepSeek ? ` · ${cfg.codex.deepseekModel}` : cfg.codex.model ? ` · ${cfg.codex.model}` : ''}`
    );
    log.info(`${fromNews ? '소재 기사' : '주제'}: ${topic}`);
    log.info('검색과 집필에 수 분이 걸립니다. 기다려 주세요...');

    try {
      /* 지시문은 **모드로** 고른다.
       *
       * ⚠️ 예전에는 `clip / fromNews / else` 세 갈래였다. 그래서 `buildBookPrompt` 는
       * import 되어 있는데 **한 번도 호출되지 않았다** — 책 글이 연예 이슈 톤의
       * `buildArticlePrompt` 로 쓰였고, 책다운 것은 스키마(book.schema.json)뿐이었다.
       *
       * > 2026-08-01 발견: 그래서 BOOK_VOICES·'읽은 척 금지'·섹션 7개 구조가
       * > 모델에 닿은 적이 없었다. "스키마가 프롬프트를 이긴다" 로 보였던 현상의
       * > 절반은 **프롬프트가 아예 없었기 때문**이다.
       *
       * mode.js 가 모드를 정하므로 여기서 조건을 새로 세우지 말고 mode 로 분기한다. */
      let prompt;
      if (mode === MODE.CLIP) prompt = buildClipPrompt({ clip, cfg, buzz });
      else if (mode === MODE.ECON) prompt = buildEconPrompt({ topic, cfg });
      else if (mode === MODE.BOOK) prompt = buildBookPrompt({ topic, cfg });
      else if (mode === MODE.MOVIE) prompt = buildMoviePrompt({ topic, cfg, spoiler: cfg.movie?.spoiler !== false });
      else if (mode === MODE.DRAMA) prompt = buildDramaPrompt({ topic, cfg });
      else if (mode === MODE.NEWS) prompt = buildNewsPrompt({ url: topic, cfg, source });
      else prompt = buildArticlePrompt({ topic, cfg });
      if (attempt > 1 && lastErr) {
        prompt += `\n\n# 재시도 사유\n직전 시도 결과가 기준에 못 미쳤습니다: ${lastErr}\n이번에는 분량과 섹션 수를 반드시 채우세요.`;
      }

      const last = useDeepSeek
        ? await runDeepSeekExec({ prompt, schemaFile, cfg })
        : await runCodexExec({ prompt, schemaFile, cfg });
      const raw = extractJson(last);
      const article = normalizeArticle(raw, { topic, cfg, mode });

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
      /* 렌더할 본문 사진 수를 심는다 — **지시문이 요청한 수와 같은 값**이다.
       *
       * 예전에는 이 줄이 **책 모드에만** 있었고 값도 `+2` 였다. 지시문은 그 사이
       * `+4` 로 바뀌었고(주석은 "+2" 로 남아 있었다) 경제 모드는 `+2` 를 요청하는데
       * 심는 줄이 아예 없었다. 그래서 `images.js` 가 앞에서부터 slice 하며
       * **뒤쪽 브리프를 버렸다** — 사라지는 것은 마지막 절의 사진이다.
       * 게이트는 사진 총수만 세므로 이것을 보지 못했다 (2026-08-04 발각).
       *
       * 이제 값은 모드 선언(`bodyImageDelta`) 한 곳에 있다.
       * 영상·영화 모드는 뒤이어 `run.js: applyClipShotLayout` 이 실제 캡처 수로
       * 덮어쓴다 — 그 모드의 사진 수는 장면이 정한다. */
      article.bodyImageCount = bodyImageCount(mode, cfg);
      {
        /* bodyImageDelta(모드 선언)가 요청하는 개수와 contract.photos(규격 상한)가
         * 어긋나는 모드가 있다 — 예: topic 은 본문 11개를 요청하는데 규격은 9개(대표
         * 포함)까지만 허용한다 (2026-08-13 발견). 그래서 트리밍 기준은
         * bodyImageCount 가 아니라 **규격의 상한**이어야 한다. */
        const { contractOf } = await import('./contract.js');
        const maxTotal = contractOf(mode).photos[1];
        trimImageBriefs(article, Math.max(0, maxTotal - 1));
      }

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
        /* 사진마다 **그 사진이 실린 기사**를 기록한다.
         *
         * 아래에서 관련 기사 사진을 같은 배열에 이어 붙이므로, URL 만 남기면
         * 어느 매체 것인지가 사라진다. 그러면 photo.js 가 전부 소재 기사의
         * 매체로 표기해 **OSEN 사진이 entertain.naver.com 으로 찍힌다.**
         * 보도사진은 출처 표기가 유일한 완화책인데, 틀린 매체를 적는 것은
         * 안 적는 것보다 나쁘다 (2026-08-05 실측 — 이민 1주기 글). */
        article.sourceImageOrigins = Object.fromEntries(
          [source.image, ...(source.images || []).map((i) => i.url)]
            .filter(Boolean)
            .map((u) => [u, { publisher: source.publisher || '', pageUrl: topic }])
        );
        article.sourceImageMeta = Object.fromEntries(
          [
            source.image ? { url: source.image, alt: source.title || article.title } : null,
            ...(source.images || []),
          ]
            .filter((x) => x?.url)
            .map((x) => [x.url, { alt: x.alt || '', width: x.w || 0, height: x.h || 0 }])
        );
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
        (article.sourceImages?.length || 0) < 10 &&
        article.sources?.length > 1
      ) {
        const { fetchArticle } = await import('./fetchArticle.js');
        /* 사안을 다룬 기사 사진은 **구조적으로 글과 관련이 있다.** 여기서 넉넉히
         * 모아 두면 뒤의 스톡·검색 티어를 부를 일이 줄어든다 — 그 티어들이
         * 무관한 사진을 넣는 지점이다 (2026-08-05 실측: 제니퍼 로렌스·주윤발).
         * 기사 한 곳당 브라우저를 한 번 띄우므로 개수는 계속 제한한다. */
        // A source can substantiate background facts without being about the people or
        // event in this post. Only collect photos from sources whose title names a
        // declared entity (or the article's main keyword).
        const inferredTerms = relatedPhotoIdentityTerms(article);
        const subjects = [
          article.primaryKeyword,
          ...inferredTerms,
          ...(article.entities || []).flatMap((e) => [e.nameKo, e.nameEn]),
        ]
          .map((s) => String(s || '').replace(/\s+/g, '').trim())
          .filter((s) => s.length >= 2);
        /* 출연자 이름은 기사마다 프로그램 표기가 달라진다.
         * 예: entity 는 "나는 SOLO 15기 영숙"인데 관련 기사 제목은
         * "'나는솔로' 15기 영철♥영숙"이다. 전체 문자열 포함만 보면 같은 사안의
         * SBS·머니투데이 사진을 전부 버리고 원문 2장만 남는다.
         * 모델이 이미 sources 로 고른 기사 안에서만 검사하므로, 한글 이름의 마지막
         * 토큰(영숙·광수 등)도 좁은 보조 키로 허용한다. */
        const entityNames = [...new Set([...(article.entities || [])
          .map((e) => String(e.nameKo || '').trim().split(/\s+/).filter(Boolean).pop() || '')
          .map((s) => s.replace(/[^0-9A-Za-z가-힣]/g, ''))
          .filter((s) => s.length >= 2), ...inferredTerms])];
        const identityText = `${article.primaryKeyword || ''} ${article.title || ''}`.replace(/\s+/g, '');
        const season = identityText.match(/(\d{1,2}기)/)?.[1] || '';
        const isSoloTitle = (title) => /나는\s*solo|나는솔로|나솔/i.test(String(title || '').replace(/\s+/g, ''));
        const isSameSeries = (source) => {
          const title = String(source?.title || '').replace(/\s+/g, '');
          return !!season && title.includes(season) && isSoloTitle(title);
        };
        const isSameSubject = (source) => {
          const title = String(source?.title || '').replace(/\s+/g, '');
          return subjects.some((subject) => title.includes(subject)) ||
            entityNames.some((name) => title.includes(name)) ||
            isSameSeries(source);
        };
        const extra = article.sources
          .filter((s) => isSameSubject(s))
          .map((s) => s.url)
          .filter((u) => u && u !== topic && /^https?:\/\//.test(u))
          .slice(0, 5);

        for (const url of extra) {
          if ((article.sourceImages?.length || 0) >= 12) break;
          try {
            const s = await fetchArticle(url, cfg, 300);
            /* **기사당 3장까지만** 받는다.
             *
             * `fetchArticle` 의 images 는 기사 사진만이 아니다 — 페이지의 광고와
             * 관련기사 썸네일이 섞여 있다. 앞쪽(og:image + 본문 첫 사진)이 실제
             * 기사 사진일 확률이 높고, 뒤로 갈수록 페이지 장식물이다.
             *
             * > 2026-08-05 실측 — 김우빈 '기프트' 글: 기사 4곳에서 15장을 받았더니
             * > mk.co.kr 후보에 **속옷 광고 사진**과 사안과 무관한 배우 사진이 있었고,
             * > 그게 본문 카드로 들어갔다. 많이 받는 것이 손해였다. */
            const ranked = rankRelatedArticlePhotos(s, { entityNames, season }).slice(0, 4);
            const got = ranked.map((x) => x.url);
            if (got.length) {
              article.sourceImages = [...(article.sourceImages || []), ...got];
              // 이 사진들의 출처는 소재 기사가 아니라 이 기사다 — 사진별로 남긴다.
              article.sourceImageOrigins = {
                ...(article.sourceImageOrigins || {}),
                ...Object.fromEntries(
                  got.map((u) => [u, { publisher: s?.publisher || '', pageUrl: url }])
                ),
              };
              article.sourceImageMeta = {
                ...(article.sourceImageMeta || {}),
                ...Object.fromEntries(ranked.map((x) => [x.url, {
                  alt: x.alt || '', width: x.width || 0, height: x.height || 0,
                }])),
              };
              log.debug(`추가 출처 사진 ${got.length}장: ${new URL(url).hostname}`);
            }
          } catch (err) {
            log.debug(`추가 출처 사진 실패 (${url.slice(0, 50)}): ${err.message.slice(0, 60)}`);
          }
        }

        /* 모델이 근거 기사로 고른 sources 는 사진 공급용 목록이 아니다. 같은 회차의
         * 팩트가 있어도 제목에 인물명이 없으면 사진 후보가 2~3장에 그칠 수 있다.
         * 실제 관련 사진이 4장 미만일 때만 웹 검색을 한 번 더 해 동일 기수·인물의
         * 보도기사를 찾는다. 결과 기사도 위의 isSameSubject 검사를 다시 통과해야 한다. */
        if ((article.sourceImages?.length || 0) < 8) {
          try {
            /* 특정 프로그램을 하드코딩하지 않는다. 예전의 `나는 SOLO` 접두사는
             * 합숙맞선·배우·가수 기사까지 엉뚱한 검색으로 보내 사진 보강을 막았다. */
            const query = [...new Set([
              article.primaryKeyword,
              ...entityNames.slice(0, 2),
              season,
              '사진 기사',
            ].filter(Boolean))].join(' ');
            const found = await runCodexJson({
              prompt: `웹 검색으로 "${query}"와 정확히 같은 기수·인물을 다룬 한국 보도기사 6건을 찾으세요. 다른 기수의 동명 출연자는 제외하세요. URL은 실제로 확인한 기사만 newsfeed 스키마에 맞춰 반환하세요.`,
              schemaFile: FILES.newsfeedSchema,
              cfg,
              search: true,
              timeoutMs: Math.min(cfg.codex.timeoutMs, 300_000),
            });
            const known = new Set([topic, ...(article.sources || []).map((s) => s.url)]);
            for (const candidate of (found?.items || []).filter(isSameSubject)) {
              if ((article.sourceImages?.length || 0) >= 12) break;
              if (!candidate?.url || known.has(candidate.url)) continue;
              known.add(candidate.url);
              try {
                const s = await fetchArticle(candidate.url, cfg, 300);
                if (!isSameSubject({ title: s?.title || candidate.title })) continue;
                const ranked = rankRelatedArticlePhotos(s, { entityNames, season }).slice(0, 5);
                const got = ranked.map((x) => x.url);
                if (!got.length) continue;
                article.sourceImages = [...(article.sourceImages || []), ...got];
                article.sourceImageOrigins = {
                  ...(article.sourceImageOrigins || {}),
                  ...Object.fromEntries(got.map((u) => [u, {
                    publisher: s?.publisher || candidate.publisher || '',
                    pageUrl: candidate.url,
                  }])),
                };
                article.sourceImageMeta = {
                  ...(article.sourceImageMeta || {}),
                  ...Object.fromEntries(ranked.map((x) => [x.url, {
                    alt: x.alt || '', width: x.width || 0, height: x.height || 0,
                  }])),
                };
                log.debug(`추가 검색 사진 ${got.length}장: ${new URL(candidate.url).hostname}`);
              } catch (err) {
                log.debug(`추가 검색 기사 실패: ${err.message.slice(0, 60)}`);
              }
            }
          } catch (err) {
            log.warn(`관련 사진 추가 검색 실패: ${err.message.split('\n')[0]}`);
          }
        }
        if (article.sourceImages?.length) {
          log.ok(`관련 기사에서 사진 ${article.sourceImages.length}장 확보`);
        }
      }

      /* 영화 모드 — **배급사 키아트(포스터) 한 장만** 좁게 가져온다.
       *
       * 위 블록을 그대로 쓸 수 없다. 배급사·마블 공식 페이지는 한 페이지에 여러 작품
       * 사진이 섞여 있어 `relatedArticlePhotos` 를 false 로 둘 수밖에 없었는데
       * (§7-7 ⑥ — 어벤저스 둠스데이 단체 사진이 스파이더맨 글에 실렸다),
       * 그렇게 끄면 **포스터 수집 경로까지 함께 막힌다.**
       *
       * > 2026-08-01 실측 — 그래서 대표 이미지가 감독의 위키미디어 사진이 됐고,
       * > 결국 소니 포스터를 손으로 받아 photoDir 로 고정했다. 자동으로 돌릴 수 없다.
       *
       * 좁히는 방법: **모양과 이름 두 가지를 함께** 본다.
       *   · 세로로 긴 것만 (포스터는 2:3 계열이고 스틸·단체 사진은 가로다)
       *   · 파일 이름이나 alt 에 poster/키아트 표시가 있거나 작품명이 박힌 것
       * og:image 는 쓰지 않는다 — 대개 가로 몽타주이고 다른 작품이 섞인다.
       *
       * 그래도 남의 작품 포스터가 걸릴 수 있으니 **찾은 것을 로그에 남긴다.**
       * 발행 전에 사람이 본다는 전제가 이 모드의 안전망이다. */
      if (can(mode, 'posterPhoto') && !(article.sourceImages?.length || 0) && article.sources?.length) {
        const { fetchArticle } = await import('./fetchArticle.js');
        const filmTitle = String(topic)
          .replace(/^영화\s*:\s*/, '')
          .replace(/\s*\(.*$/, '')
          .trim();
        const POSTER_WORD = /poster|keyart|key[-_]?art|메인포스터|포스터/i;
        const found = [];
        for (const url of article.sources
          .map((s) => s.url)
          .filter((u) => u && /^https?:\/\//.test(u))
          .slice(0, 4)) {
          if (found.length >= 3) break;
          try {
            const s = await fetchArticle(url, cfg, 300);
            for (const img of s?.images || []) {
              if (found.length >= 3) break;
              const portrait = img.h >= img.w * 1.2;
              if (!portrait) continue;
              const named = POSTER_WORD.test(`${img.url} ${img.alt}`);
              const titled = filmTitle && img.alt.includes(filmTitle);
              if (named || titled) found.push({ ...img, from: new URL(url).hostname });
            }
          } catch (err) {
            log.debug(`포스터 수집 실패 (${url.slice(0, 50)}): ${err.message.slice(0, 60)}`);
          }
        }
        if (found.length) {
          article.sourceImages = found.map((f) => f.url);
          log.ok(`배급사 포스터 후보 ${found.length}장 (세로 비율 + 이름 확인)`);
          for (const f of found) log.info(`  ${f.w}×${f.h} · ${f.from} · ${f.alt || '설명 없음'}`);
          log.warn('발행 전에 이 포스터가 이 작품의 것인지 눈으로 확인하세요.');
        } else {
          log.warn(
            '배급사 포스터를 찾지 못했습니다 — 대표 이미지가 인물 사진으로 갈 수 있습니다. ' +
              '공식 포스터를 손으로 받아 photoDir 로 고정하세요.'
          );
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
      const { findParticleErrors, findMonotoneEndings, articleText, articleNames } = await import('./lintKo.js');
      const particleErrs = findParticleErrors(articleText(article), { names: articleNames(article) });
      if (particleErrs.length) {
        log.warn(`조사가 의심되는 곳 ${particleErrs.length}군데 — 발행 전에 확인하세요.`);
        for (const e of particleErrs.slice(0, 8)) {
          log.warn(`  ${e.phrase} → ${e.suggest}   …${e.context}…`);
        }
      }
      /* 같은 어미 3연타 — "기계적, AI 같다"의 첫 신호 (2026-07-29 독자 지적).
       *
       * ⚠️ 예전에는 **경고만** 했다. 그래서 같은 문제가 세 번 연속 그대로 나갔다.
       * > 2026-08-01 실측 — 영화 모드 초안 3편: 종결이 100% · 99% · 100% 로
       * >   "…니다." 였다. 경고는 매번 찍혔지만 아무도 막지 않았다.
       *
       * 분량·섹션 수와 같은 급으로 **재시도 사유**로 올린다. 문체는 고쳐 쓰기가
       * 쉬우므로 한 번 더 요청하는 값이 크다. */
      const mono = findMonotoneEndings(article);
      if (mono.length) {
        log.warn(`같은 어미가 3문장 이상 이어지는 문단 ${mono.length}개 — 리듬을 확인하세요.`);
        for (const m of mono.slice(0, 4)) log.warn(`  섹션${m.section} "…${m.ending}." 연타: ${m.sample}…`);
        /* `section: 0` 이 "글 전체 분포" 항목이다 (문단 안 3연타는 section >= 1).
         * 재시도는 전체 도배일 때만 — 문단 하나의 연타로 4분을 다시 쓰는 것은 과하다. */
        const whole = mono.find((m) => m.section === 0);
        if (whole && attempt < maxAttempts) {
          /* **먼저 코드로 고쳐 본다. 그래도 안 되면 재시도한다.**
           *
           * `~습니다` → `~죠` 는 뜻이 바뀌지 않는 기계적 변환이라 `endings.js` 가
           * 이미 한다(아래 `autoFix`). 그런데 순서가 거꾸로여서, 고칠 수 있는 문제로
           * codex 를 한 번 더 불렀다 — 아래 주석도 "재시도는 4분을 더 태우고 결과도
           * 나아지지 않았다" 고 적어 두었다.
           *
           * > 2026-08-05 실측 — 근로장려금 글: 시도 1 이 종결 검사로 버려지고,
           * >   시도 2 에서 **codex 사용량 한도**에 걸려 글이 아예 나오지 않았다.
           * >   고칠 수 있는 문제 때문에 쓸 수 있는 초안을 잃었다.
           *
           * 그래서 여기서 교정을 먼저 돌린다. 기준 밑으로 내려가면 그대로 쓰고,
           * 못 내려가면 그때 재시도한다 (호출 한 번을 아낀다). */
          const { autoFix: fixNow } = await import('./contract.js');
          const fixed = fixNow(article, mode);
          const still = findMonotoneEndings(article).find((m) => m.section === 0);
          if (!still) {
            for (const line of fixed) log.info(`자동 교정 — ${line}`);
            log.ok('종결 단조를 코드로 고쳤습니다 — 재시도하지 않습니다 (codex 호출 1회 절약).');
          } else {
            lastErr =
              '글 전체가 한 종결로 끝납니다(단조로워 AI 가 쓴 것처럼 읽힙니다). ' +
              '경어체 안에서 ~입니다 / ~이죠 / ~합니다 / 명사 종결을 섞고, ' +
              '한 종결이 전체의 60% 를 넘지 않게 하세요';
            log.warn(`${lastErr} — 코드 교정으로도 기준 밑으로 내려가지 않아 다시 시도합니다.`);
            continue;
          }
        }
      }

      /* 재시도까지 하고도 안 되면 **코드가 섞는다.**
       *
       * 재시도는 4분을 더 태우고 결과도 나아지지 않았다 (황해: 재시도 포함
       * 10분 30초를 쓰고 93%). 그런데 `~습니다` → `~죠` 는 뜻이 바뀌지 않는
       * 기계적 변환이라 사람이 할 이유가 없다 — 지난 글은 손으로 20곳을 고쳤다.
       * 안전한 형태만 바꾸고 큰따옴표 안은 건드리지 않는다 (endings.js 머리말). */
      /* 이미지를 끈 글은 **브리프도 비운다.**
       * 모델은 지시문에 "본문 0개" 라고 적어도 대표 브리프 하나는 내놓는 일이 있다.
       * 그 한 장 때문에 "사진을 쓰는 글" 로 판정돼 사진 규격에 막히고, 렌더도 안 되니
       * 아무 데도 쓰이지 않는 값이 남는다. 여기서 끊는다. */
      if (cfg.images?.enabled === false) {
        if (article.imageBriefs?.length) {
          log.info(`이미지를 끈 글이라 imageBriefs ${article.imageBriefs.length}개를 비웠습니다.`);
        }
        article.imageBriefs = [];
        article.bodyImageCount = 0;
      }

      const { autoFix, checkContract, formatViolations } = await import('./contract.js');
      for (const line of autoFix(article, mode)) log.info(`자동 교정 — ${line}`);
      /* 교정 뒤에도 남은 것을 여기서 보여 준다. 발행 게이트(cli.js)가 다시 대조하지만,
       * 초안 단계에서 알아야 사람이 손볼 수 있다. */
      const { violations } = checkContract(article, mode);
      for (const line of formatViolations(violations)) log.warn(`규격 — ${line}`);

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
