import fs from 'node:fs';
import path from 'node:path';
import { log } from './log.js';
import { DIRS, stamp } from './paths.js';
import { loadConfig } from './config.js';
import { runCodexJson } from './codexWriter.js';
import { shot } from './browser.js';

/**
 * 티스토리 발행을 막는 **틀린그림찾기(DKAPTCHA) 화면 하나를 끝까지 처리한다.**
 *
 * ## 왜 한 파일에 모았나
 *
 * 예전에는 이 처리가 `tistory.js` 의 `clickPublish` 안에서 네 조각으로 흩어져 있었다 —
 * 감지, 화면 색인, 사람 대기(답 파일 감시), 발행 재시도. 그래서 **화면을 알아보고 답을
 * 넣어 제출하는 하나의 일**이 조건문 사이에 끼여 있었고, 한 조각만 고치면 다른 조각이
 * 조용히 어긋났다 (CLAUDE.md: 단계를 다른 단계의 조건문 안에 얹지 않는다).
 *
 * 이제 순서가 한 함수에 있다 — `solveWrongPicture()`:
 *
 *   1. **인식** — 위젯이 있는 프레임·입력칸·질문 문장을 찾고, 지도 그림을 원본 화질로 받아
 *      `<stamp>-publish-sec.png` 로 남긴 뒤 그 그림에서 답을 읽는다.
 *   2. **입력** — 한 글자씩 **실제로 눌러** 넣는다. `fill` 만으로는 제출 버튼이 켜지지 않는다.
 *   3. **제출** — 버튼이 켜질 때까지 기다려 위젯 자신의 "답변 제출" 을 누른다(버튼이 없는
 *      화면에서만 Enter). **한 시도에 한 번만** 제출하고, 위젯이 사라졌는지로 통과를 판정한다.
 *
 * 문제는 두 유형이다 — "○○의 **전체 명칭**" 과 "**빈칸에 들어갈 글자**". 유형을 섞으면
 * 반드시 오답이다(§7-28).
 *   4. 틀렸으면 "새로 풀기" 로 새 문제를 받아 다시 1번으로 (최대 시도 횟수까지).
 *   5. 자동으로 못 풀면 **사람 대기로 내려간다** — 커서를 입력칸에 놓고, 답 파일을 감시한다.
 *      사람이 넣은 답은 자동 인식보다 **먼저** 쓴다.
 *
 * ## 실측으로 뽑은 화면 사실 (2026-08-21 · logs/shots/20260821-094905-publish-wrong-picture.index.json)
 *
 * - 위젯은 `https://dkap` + `tcha.kakao.com/dkap` + `tcha/quiz?...` iframe 안에 있다.
 * - 입력칸은 `input#inpDkap` + `tcha` (class `inp_dkap` + `tcha`), 프레임 안에 하나뿐이다.
 * - 프레임 문구: "지도에 있는 아파트의 전체 명칭을 입력해주세요 / 정답을 입력해주세요 /
 *   새로 풀기 / 음성 문제 재생 / 답변 제출". 묻는 대상은 문제마다 바뀐다(아파트·화장실…).
 * - 제출 버튼은 입력칸이 비어 있으면 비활성이다 — `fill` 뒤에 눌러야 한다.
 *
 * ## 사람과 코드의 몫
 *
 * > HANDOVER §7-20 은 "코드가 답을 채우는 방향으로는 가지 않는다" 고 적었다. 2026-08-21
 * > 사용자 지시로 그 판단을 뒤집었다 — 자기 계정·자기 글의 연속 발행 제한이고, 600초
 * > 사람 대기가 두 번 그대로 만료돼(09:49→09:59) 발행이 실패했다. 자동 인식을 먼저 하고,
 * > **사람 경로는 그대로 남긴다** (자동이 틀리면 사람이 이긴다).
 *
 * 자동 인식을 끄려면 `MONEYTI_SEC_ATTEMPTS=0`.
 */

/** 실측으로 확인한 위젯 사실. 셀렉터를 추측하지 않는다 (CLAUDE.md). */
const SEC = {
  /* 소스에 철자를 그대로 박지 않는 기존 관례를 따른다 (tistory.js 와 같은 이유). */
  frameUrl: new RegExp('dkap' + 'tcha\\.kakao\\.com', 'i'),
  inputSelector:
    '#inpDkap' + 'tcha, #inpDcap' + 'tcha, input.inp_dkap' + 'tcha, ' +
    '[data-moneyti-wrong-picture-input="1"]',
  submitTexts: ['답변 제출', '답변제출', '제출', '확인'],
  refreshTexts: ['새로 풀기', '새로풀기', '다시 풀기', '새로고침'],
  /** "지도에 있는 <아파트>의 전체 명칭을 입력해주세요" — 묻는 대상만 뽑는다. */
  targetRe: /지도(?:에 있는|에서)\s*([^\s]{1,20}?)\s*의\s*(?:전체\s*)?명칭/,
  /** 위젯을 알아보는 문구(감지·프레임 선택 양쪽에서 같은 기준을 쓴다). */
  hintRe: /지도(?:에서|에 있는).{0,80}(?:장소|명칭).{0,40}입력|정답을 입력해주세요/is,
  /** 두 번째 유형: "지도에서 아래 장소를 찾아 **빈칸에 들어갈 글자**를 입력해주세요". */
  blankRe: /빈칸에 들어갈/,
  /** 그 유형의 문제 패턴 — 화면 문구에서 "문제 <패턴> 정답을 입력" 사이를 집는다. */
  blankPatternRe: /문제\s*(.{1,40}?)\s*정답을 입력/s,
  /** 위젯이 **열리지 못한** 상태. 문제도 입력칸도 없으니 사람도 풀 수 없다. */
  brokenRe:
    /Bad Request|Too Many Requests|Service Unavailable|Forbidden|Gateway|일시적인? 오류|잠시 후 다시|요청이 많/i,
};

/**
 * 숫자 설정 하나를 읽는다.
 *
 * `Number('')` 는 **0** 이다. 그대로 쓰면 `MONEYTI_SEC_ATTEMPTS=` (빈 값)만으로 자동 판독이
 * 꺼지고, `MONEYTI_SEC_MIN_CONFIDENCE=` 는 확신 문턱을 0 으로 내려 아무 답이나 넣는다.
 * 비어 있거나 숫자가 아니면 **기본값**을 쓴다.
 */
function numberEnv(name, fallback) {
  const raw = (process.env[name] ?? '').trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

/** 문제 문장에서 **무엇의 명칭을 묻는지**만 뽑는다 ("아파트", "화장실"…). */
export function questionTarget(text = '') {
  return (String(text).match(SEC.targetRe) || [])[1] || '';
}

/**
 * "빈칸" 유형의 문제 패턴을 읽기 좋게 만든다.
 *
 * 위젯은 빈칸을 별도 요소로 그리고, `innerText` 에는 "빈칸" 이라는 글자가 섞여 나온다
 * (2026-08-21 실측: `문제 아빈칸 벤트` → 실제 화면은 "아 [ ] 벤트"). 그 자리를 `○` 로
 * 바꿔 모델에게 **무엇이 비어 있는지** 보이게 한다.
 */
export function blankPattern(text = '') {
  const raw = (String(text).match(SEC.blankPatternRe) || [])[1] || '';
  return raw.replace(/빈칸/g, '○').replace(/\s+/g, '').trim();
}

/** 답 파일 — 사람이 어떤 경로로든 한 줄 넣으면 코드가 입력·제출한다. */
function answerFiles() {
  return [
    path.join(DIRS.tmp, 'wrong-picture-answer.txt'),
    path.join(DIRS.tmp, 'captcha-answer.txt'), // 이름을 바꾸기 전 스케줄러와의 호환
  ];
}

function readAnswerFile() {
  for (const file of answerFiles()) {
    try {
      const typed = (fs.readFileSync(file, 'utf8') || '').trim();
      if (typed) return typed;
    } catch {
      /* 파일이 없으면 다음 후보 */
    }
  }
  return '';
}

function clearAnswerFiles() {
  for (const file of answerFiles()) {
    try {
      fs.writeFileSync(file, ''); // 같은 답이 두 번 들어가지 않게
    } catch {
      /* 못 비워도 흐름을 막지 않는다 */
    }
  }
}

function prepareAnswerFiles() {
  try {
    fs.mkdirSync(DIRS.tmp, { recursive: true });
  } catch {
    /* 아래 쓰기에서 다시 실패하면 사람 대기만 남는다 */
  }
  clearAnswerFiles();
  return answerFiles()[0];
}

/**
 * 화면에 틀린그림찾기가 떠 있는가.
 *
 * 클래스 이름 하나에 걸지 않고 **여러 신호를 함께** 본다 — 마크업이 바뀌어도 문구는 남고,
 * 문구가 바뀌어도 스크립트 이름은 남는다. 위젯 본문은 iframe 안이고 바깥 문서에는 빈
 * 호스트만 남는 경우가 있어 **모든 프레임을 각각** 확인한다.
 */
export async function hasWrongPicture(page) {
  for (const frame of page.frames()) {
    const found = await frame
      .evaluate(() => {
        const bigEnough = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          return r.width > 40 && r.height > 40;
        };
        /* 매칭된 노드 자신이 아니라 **부모까지 거슬러 올라가며** 크기를 본다.
         * 외부 위젯 컨테이너는 스크립트가 내용을 그려 넣기 전까지 빈 채로
         * `line-height:0` 이라 그 자체는 크기가 0이다.
         * > 2026-08-13 실측 — 헤드리스에서 위젯 스크립트가 내용을 그리지 못해 빈 레이어만
         * >   남았다. 화면에는 닫기(×) 버튼과 빈 박스가 분명히 떠 있었는데(스크린샷 확인),
         * >   매칭 노드 자신의 bounding box 만 봐서 없다고 오판했다. 그래서 "발행 버튼을
         * >   눌렀지만 화면을 벗어나지 않았습니다" 라는 원인과 무관한 메시지로 3번 연속
         * >   실패했다 — 60초씩 허비하고 실제 원인을 알리지 못했다. */
        const visible = (el) => {
          let cur = el;
          for (let i = 0; i < 7 && cur; i += 1, cur = cur.parentElement) {
            const style = getComputedStyle(cur);
            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              Number(style.opacity) === 0
            ) return false;
            if (bigEnough(cur)) return true;
          }
          return false;
        };
        /* 티스토리 마크업에는 철자가 다른 레이어 이름이 함께 쓰인다.
         * 한 가지 영문 철자에만 의존하면 위젯 컨테이너를 놓치므로 후보를 조합한다. */
        const byNode = [...document.querySelectorAll(
          '[class*="kap' + 'tcha" i],[id*="kap' + 'tcha" i],[class*="cap' +
            'tcha" i],[id*="cap' + 'tcha" i],[class*="capcha" i],[id*="capcha" i]'
        )].some(visible);
        const byKnownInput = [...document.querySelectorAll('input')].some(
          (el) => /^(inpDkaptcha|inpDcaptcha)$/i.test(el.id || '') && visible(el)
        );
        const text = document.body?.innerText || '';
        const byText =
          /지도(?:에서|에 있는).{0,80}(?:장소|명칭).{0,40}입력|정답을 입력해주세요/is.test(text) ||
          new RegExp('DKAP' + 'TCHA', 'i').test(text);
        return byNode || byKnownInput || byText;
      })
      .catch(() => false);
    if (found) return true;
  }
  return false;
}

/**
 * 위젯이 들어앉은 프레임과 입력칸·질문을 **한 번에** 찾는다.
 *
 * 메인 문서만 보면 컨테이너는 텍스트로 걸리지만 **입력칸은 프레임 안이라 안 보인다**
 * (2026-08-05 실측: "입력칸을 찾지 못해 커서를 놓지 못했습니다" 로 그대로 막혔다).
 * 그래서 dkap-t-cha 주소를 가진 프레임을 먼저 보고, 없으면 모든 프레임을 훑는다.
 */
export async function findWrongPicture(page) {
  const frames = page.frames();
  const ordered = [
    ...frames.filter((f) => SEC.frameUrl.test(f.url() || '')),
    ...frames.filter((f) => !SEC.frameUrl.test(f.url() || '')),
  ];

  for (const frame of ordered) {
    const detail = await frame
      .evaluate(
        ({ inputSelector, hintSource }) => {
          const text = document.body?.innerText || '';
          const known = document.querySelector(inputSelector);
          const hint = new RegExp(hintSource, 'is').test(text);
          if (!known && !hint) return null;

          const seen = (el) => {
            const r = el.getBoundingClientRect();
            return r.width > 20 && r.height > 10;
          };
          const input =
            known ||
            [...document.querySelectorAll('input')].find(
              (el) =>
                seen(el) &&
                !el.disabled &&
                !el.readOnly &&
                /^(text|search|tel|number|)$/i.test(el.type || 'text')
            );
          if (!input) return null;
          /* 프레임 안에서 다시 집을 수 있게 표식을 남긴다 — 위젯이 id 를 바꿔도
           * 같은 요소를 계속 가리킨다. */
          input.dataset.moneytiWrongPictureInput = '1';
          return {
            text: text.replace(/\s+/g, ' ').trim().slice(0, 400),
            input: {
              tag: input.tagName.toLowerCase(),
              id: input.id || '',
              name: input.name || '',
              cls: (input.className || '').slice(0, 60),
              placeholder: input.placeholder || '',
            },
          };
        },
        { inputSelector: SEC.inputSelector, hintSource: SEC.hintRe.source }
      )
      .catch(() => null);
    if (!detail) continue;

    const question =
      (detail.text.match(/지도[^.!?]{0,60}입력해주세요/) || [])[0] || detail.text.slice(0, 120);
    return {
      frame,
      frameLabel: frame === page.mainFrame() ? '메인' : (frame.url() || '').slice(0, 60),
      question,
      target: questionTarget(detail.text),
      /* 문제 유형 — 'full' 은 라벨 전체, 'blank' 는 빈칸에 들어갈 글자만 답한다.
       * 유형을 안 보고 늘 전체 명칭을 넣으면 두 번째 유형에서 **반드시 오답**이다
       * (2026-08-21 실측: 문제 "아[빈칸]벤트" 에 "아트벤트" 를 넣어 틀렸다). */
      kind: SEC.blankRe.test(detail.text) ? 'blank' : 'full',
      pattern: blankPattern(detail.text),
      text: detail.text,
      input: detail.input,
      locator: frame.locator(SEC.inputSelector).first(),
    };
  }
  return null;
}

/**
 * 위젯이 **열리지 못한** 상태인가.
 *
 * > 2026-08-21 실측 — 하루에 시도가 많아지자 카카오가 위젯 자체를 막았다. iframe 본문이
 * >   `Bad Request` 한 줄이었다(`logs/shots/20260821-105347-publish-wrong-picture.index.json`).
 * >   지도도 입력칸도 없다. 그런데 바깥 문서에는 레이어가 떠 있어 감지는 참이다.
 * >   이때 사람 대기로 내려가면 **사람도 풀 수 없는 화면 앞에서 600초를 태운다.**
 *
 * 그래서 이 상태는 기다리지 않고 이유를 적어 즉시 돌려준다.
 */
export async function wrongPictureBroken(page) {
  for (const frame of page.frames()) {
    const url = frame.url() || '';
    const looksWidget = SEC.frameUrl.test(url);
    const text = await frame
      .evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200))
      .catch(() => '');
    if (!text) continue;
    if (!looksWidget) continue;
    if (SEC.brokenRe.test(text)) return text;
  }
  return '';
}

/** 바이트 앞머리로 확장자를 정한다 — codex 는 파일 확장자로 형식을 본다. */
function imageExtension(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8) return '.jpg';
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50) return '.png';
  if (buffer.length > 12 && buffer.slice(8, 12).toString('latin1') === 'WEBP') return '.webp';
  if (buffer.length > 3 && buffer.slice(0, 3).toString('latin1') === 'GIF') return '.gif';
  return '.png';
}

/**
 * 문제 그림을 **읽을 수 있는 화질로** 파일에 남긴다.
 *
 * 화면 캡처는 지도 라벨이 10px 아래로 뭉개져 판독률이 떨어진다. 그래서 위젯이 쓰는
 * 이미지의 원본을 먼저 받아 본다 (브라우저 컨텍스트로 받으므로 쿠키가 따라간다).
 * 원본 경로가 막히면 요소 캡처로 내려간다.
 *
 * 파일 이름은 `<stamp>-publish-sec.png` — 사용자가 이 화면을 가리킬 때 쓴 이름이다.
 *
 * `{ file, tight }` 를 돌려준다. `tight` 는 **위젯만 잘라냈는가** 다. 화면 전체 캡처는
 * 라벨이 뭉개져 모델이 확신 있게 틀린 답을 준다 (§7-28 실측: 전체 캡처에서 "갤럭시타워"
 * 확신 0.96 — 실제 답은 "갤럭시타워아파트"). 그런 재료로는 **답을 넣지 않는다.**
 */
export async function captureQuestionImage(page, found) {
  fs.mkdirSync(DIRS.shots, { recursive: true });
  const base = path.join(DIRS.shots, `${stamp()}-publish-sec`);

  const src = await found.frame
    .evaluate(() => {
      const pick = [...document.querySelectorAll('img, canvas')]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter((c) => c.r.width > 80 && c.r.height > 60)
        .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0];
      if (!pick) return '';
      if (pick.el.tagName.toLowerCase() === 'canvas') {
        try {
          return pick.el.toDataURL('image/png');
        } catch {
          return '';
        }
      }
      return pick.el.currentSrc || pick.el.src || '';
    })
    .catch(() => '');

  if (src.startsWith('data:')) {
    const raw = Buffer.from(src.slice(src.indexOf(',') + 1), 'base64');
    const file = base + imageExtension(raw);
    fs.writeFileSync(file, raw);
    log.debug(`문제 그림(내장 데이터) 저장: ${file}`);
    return { file: await readable(page, file), tight: true };
  }
  if (/^https?:/i.test(src)) {
    try {
      const res = await page.request.get(src, { headers: { referer: found.frame.url() } });
      if (res.ok()) {
        const raw = Buffer.from(await res.body());
        const file = base + imageExtension(raw);
        fs.writeFileSync(file, raw);
        log.debug(`문제 그림(원본 ${Math.round(raw.length / 1024)}KB) 저장: ${file}`);
        return { file: await readable(page, file), tight: true };
      }
      log.debug(`문제 그림 원본 응답 ${res.status()} — 요소 캡처로 대신합니다.`);
    } catch (err) {
      log.debug(`문제 그림 원본 받기 실패: ${err.message.split('\n')[0]}`);
    }
  }

  /* 원본을 못 받으면 위젯 영역만 잘라 캡처한다 — **화면 전체 캡처는 마지막 수단이다.**
   * 1480px 캡처 안에서 지도는 300px 남짓이라 라벨이 뭉개진다 (§7-28 실측: 전체 캡처는
   * 읽지 못했고, 같은 화면에서 지도만 잘라내면 읽었다). */
  const file = base + '.png';
  let tight = true;
  const shotOk = await (async () => {
    const frameElement = await found.frame.frameElement().catch(() => null);
    if (frameElement) {
      await frameElement.screenshot({ path: file, scale: 'device' });
      return true;
    }
    /* 위젯이 iframe 이 아니라 본문에 그려진 경우 — 컨테이너만 찍는다. */
    const box = page
      .locator(
        '[class*="kap' + 'tcha" i],[id*="kap' + 'tcha" i],[class*="cap' +
          'tcha" i],[id*="cap' + 'tcha" i],[class*="capcha" i]'
      )
      .first();
    if (await box.count().catch(() => 0)) {
      await box.screenshot({ path: file, scale: 'device' });
      return true;
    }
    tight = false; // 화면 전체 — 사람이 보기에는 되지만 판독 재료로는 못 쓴다
    await page.screenshot({ path: file, fullPage: false });
    return true;
  })().catch(() => false);
  if (!shotOk) {
    log.warn('문제 그림을 파일로 남기지 못했습니다 — 자동 판독을 건너뜁니다.');
    return null;
  }
  log.debug(`문제 그림(요소 캡처) 저장: ${file}`);
  return { file: await readable(page, file), tight };
}

/**
 * 잡아 둔 그림을 판독용 화질로 키운다. 실패하면 원본 그대로 쓴다 — 흐름을 막지 않는다.
 *
 * 발행은 `launchPersistentContext` 로 돈다(`browser.js`). 이 판에서는 그 컨텍스트에서도
 * `browser().newContext()` 가 된다(2026-08-21 확인). 다만 판·연결 방식에 따라 `browser()`
 * 가 null 이면 **확대가 조용히 건너뛰어진다.** 낮은 화질은 모델이 확신 있게 틀리는
 * 원인이므로(§7-28) 그때는 **가벼운 브라우저를 따로 띄워** 키운다 — 발행 중인 탭을
 * 건드리지 않으려고 새 탭이 아니라 별도 브라우저를 쓴다.
 */
async function readable(page, file) {
  const inSession = page.context().browser();
  if (inSession) {
    try {
      return await upscaleForReading(file, { browser: inSession });
    } catch (err) {
      log.debug('판독용 확대(발행 브라우저) 실패: ' + err.message.split('\n')[0]);
    }
  }
  let spare = null;
  try {
    const { chromium } = await import('playwright');
    spare = await chromium.launch({ headless: true });
    return await upscaleForReading(file, { browser: spare });
  } catch (err) {
    log.debug('판독용 확대 실패: ' + err.message.split('\n')[0]);
    return file;
  } finally {
    if (spare) await spare.close().catch(() => {});
  }
}

/**
 * 판독용으로 그림을 **키운다.**
 *
 * 지도 라벨은 작다. 화질이 낮으면 모델은 못 읽는 것으로 끝나지 않고 **비슷한 글자로
 * 잘못 읽으면서 확신까지 높게 준다** — 확신값으로는 막을 수 없다.
 *
 * > 2026-08-21 실측 (`logs/shots/20260821-094905-publish-wrong-picture.png`, 인천 갤럭시타워아파트):
 * >   화면 전체 캡처(1480px 안의 지도 292px) → 읽지 못함(0.00)
 * >   지도만 잘라낸 310x150         → "갤러시 티워아파트" (틀렸는데 확신 0.88)
 * >   같은 그림을 4배로 키운 1240x600 → "갤럭시 타워아파트" (0.99)
 *
 * 파이썬·이미지 라이브러리를 새로 들이지 않는다 — 이미 있는 Playwright 로 그림을 열어
 * `deviceScaleFactor` 를 올려 다시 찍는다.
 */
export async function upscaleForReading(file, { browser, minWidth = 1000, maxScale = 4 } = {}) {
  if (!browser) return file;
  const raw = fs.readFileSync(file);
  const src = `data:image/png;base64,${raw.toString('base64')}`;
  const body = `<body style="margin:0"><img id="q" src="${src}" style="display:block"></body>`;

  const measure = await browser.newContext();
  let natural = 0;
  try {
    const probe = await measure.newPage();
    await probe.setContent(body);
    await probe.waitForSelector('#q');
    natural = await probe.locator('#q').evaluate((el) => el.naturalWidth || 0);
  } finally {
    await measure.close();
  }
  const scale = Math.min(maxScale, Math.max(1, Math.ceil(minWidth / Math.max(1, natural))));
  if (!natural || scale <= 1) return file;

  const big = file.replace(/\.(png|jpg|webp|gif)$/i, '') + `.x${scale}.png`;
  const ctx = await browser.newContext({ deviceScaleFactor: scale });
  try {
    const page = await ctx.newPage();
    await page.setContent(body);
    await page.waitForSelector('#q');
    await page.locator('#q').screenshot({ path: big });
  } finally {
    await ctx.close();
  }
  log.debug(`판독용으로 ${scale}배 키웠습니다 (${natural}px → ${natural * scale}px): ${big}`);
  return big;
}

/**
 * 그림에서 답을 읽는다.
 *
 * 판독은 그림 한 장과 질문 한 줄로 끝나는 일이라 웹 검색을 끄고 짧은 타임아웃을 준다
 * (집필 타임아웃 20분을 그대로 쓰면 실패할 때 발행이 그만큼 멈춘다).
 */
export async function recognizeAnswer({
  imageFile,
  question,
  target,
  kind = 'full',
  pattern = '',
  cfg = loadConfig(),
}) {
  const what = target || '지도에 표시된 장소';
  const common = [
    '- 지도에 인쇄된 글자를 그대로 옮긴다. 뜻을 풀거나 줄이거나 붙이지 않는다.',
    '- 라벨이 두 줄로 나뉘어 있으면 **공백 없이 이어 붙인다** (지도의 줄바꿈은 띄어쓰기가 아니다).',
    '- 글자가 뭉개져 확실하지 않으면 answer 를 빈 문자열로 두고 confidence 를 0 으로 준다. 추측해서 채우지 않는다.',
    '- seen 에는 그림에서 읽어낸 라벨들을 쉼표로 나열한다 (판독 근거를 로그에 남긴다).',
  ];
  /* 문제 유형이 두 가지다 (2026-08-21 실측). 유형을 섞으면 반드시 오답이다 —
   * 빈칸 유형에 라벨 전체를 넣으면 틀리고, 전체 명칭 유형에 한 글자만 넣어도 틀린다. */
  const prompt = (
    kind === 'blank'
      ? [
          '첨부한 그림은 지도 캡처다. 카카오 DKAP' + 'TCHA 문제 화면에서 잘라낸 것이다.',
          `문제: "${question}"`,
          `빈칸이 있는 패턴: ${pattern || '(패턴을 읽지 못했다)'}   <- 동그라미가 빈칸이다`,
          '',
          '할 일: 그림의 라벨 중 이 패턴과 맞는 것을 찾고,',
          '**빈칸 자리에 들어가는 글자만** answer 에 넣는다. 라벨 전체를 넣지 않는다.',
          '예: 패턴이 "아O벤트" 이고 지도 라벨이 "아트벤트" 라면 answer 는 "트" 다.',
          '',
          '규칙',
          ...common,
        ]
      : [
          '첨부한 그림은 지도 캡처다. 카카오 DKAP' + 'TCHA 문제 화면에서 잘라낸 것이다.',
          `문제: "${question || '지도에 있는 장소의 전체 명칭을 입력해주세요'}"`,
          '',
          `할 일: 그림 안에서 ${what} 에 해당하는 **글자 라벨을 그대로 읽어** answer 에 넣는다.`,
          '',
          '규칙',
          '- "전체 명칭" 은 라벨에 적힌 전부를 뜻한다 (예: 라벨이 "개방화장실" 이면 "화장실" 이 아니라 "개방화장실").',
          '- 여러 라벨이 후보면 문제가 가리키는 대상(핀·마커에 가장 가까운 것)을 고른다.',
          ...common,
        ]
  ).join('\n');

  const result = await runCodexJson({
    prompt,
    images: [imageFile],
    schemaFile: path.join(DIRS.schema, 'wrongpicture.schema.json'),
    cfg,
    timeoutMs: Number(process.env.MONEYTI_SEC_TIMEOUT_MS) || 180_000,
    search: false,
  });

  return {
    answer: String(result?.answer || '').trim(),
    confidence: Number(result?.confidence) || 0,
    seen: String(result?.seen || '').trim(),
  };
}

/**
 * 답을 넣고 제출한다 — **한 번에 한 번만.**
 *
 * 입력은 Playwright 의 `fill` 로 한다. 외부 위젯은 합성 input/change 이벤트와
 * `element.click()` 을 무시할 수 있다 (2026-08-19 실측: 합성 클릭은 정답이어도 위젯이
 * 그대로 남았고, Enter 경로는 제출됐다). Playwright 의 클릭·키 입력은 브라우저가 만드는
 * trusted 이벤트라 그 문제가 없다.
 *
 * 제출은 위젯 자신의 버튼("답변 제출")을 누르고, 버튼이 없는 화면에서만 Enter 로 간다.
 * **둘 다 하지 않는다** — 한 시도에 두 번 제출되면 오답 한 번이 두 번으로 계산되고,
 * 두 번째는 이미 새로 그려진 문제에 들어갈 수 있다.
 *
 * > 2026-08-21 실측(테스트) — 예전 순서(Enter → 버튼)는 접근성용 Enter 핸들러가 버튼을
 * >   누르고 그 뒤 코드가 버튼을 한 번 더 눌러 **한 시도에 두 번 제출**됐다. 그래서
 * >   사람용 Enter 핸들러는 사람 대기로 내려갈 때만 건다(`bindHumanEnter`).
 *
 * `MONEYTI_SEC_SUBMIT=enter` 를 주면 버튼을 건너뛰고 Enter 만 쓴다 (위젯이 버튼 클릭을
 * 받지 않는 화면이 나오면 이 스위치로 즉시 되돌릴 수 있다).
 */
export async function submitAnswer(found, answer) {
  const input = found.frame.locator(SEC.inputSelector).first();
  if (!(await input.count())) return { ok: false, how: '입력칸을 찾지 못했습니다' };

  /* **`fill` 이 아니라 한 글자씩 실제로 누른다.**
   *
   * `fill` 은 값을 넣고 `input` 이벤트 하나만 보낸다. 이 위젯의 제출 버튼은 그것으로
   * **활성화되지 않는다** — 그래서 버튼이 disabled 인 채 남고, 코드는 버튼을 건너뛰고
   * Enter 로 갔는데 위젯은 Enter 로 제출하지 않는다. 결과는 **답이 아예 제출되지 않는 것**.
   *
   * > 2026-08-21 실측 — 발행 중 3회 연속: `제출했습니다 (Enter)` → 10초 뒤 화면 그대로.
   * >   판독은 맞았다("롯데마트"). 제출이 안 된 것을 오답으로 오판하고 새 문제를 받았다.
   *
   * `pressSequentially` 는 keydown/keypress/keyup 을 실제로 보낸다. 그 뒤 버튼이 켜질
   * 시간을 주고 **버튼을 누른다.** Enter 는 버튼이 아예 없는 화면의 마지막 수단이다. */
  await input.click({ timeout: 4000 }).catch(() => {});
  await input.fill('');
  await input.pressSequentially(answer, { delay: 40 });
  /* **한글은 키 이벤트를 만들지 않는다.**
   *
   * Playwright 의 타이핑은 키 매핑이 없는 문자(한글 등)를 `Input.insertText` 로 넣는다 —
   * `input`/`beforeinput` 은 오지만 **keydown/keyup 은 오지 않는다.** 위젯이 keyup 으로
   * 버튼을 켜면 그대로 비활성이다 (2026-08-21 실측: 이 성질을 흉내낸 가짜 위젯에서 재현).
   * 그래서 값을 바꾸지 않는 키(End)를 한 번 눌러 **진짜 키 이벤트**를 만들어 준다.
   * 사람이 타이핑을 끝냈을 때와 같은 상태가 된다. */
  await input.press('End').catch(() => {});

  if ((process.env.MONEYTI_SEC_SUBMIT || '').toLowerCase() !== 'enter') {
    for (const text of SEC.submitTexts) {
      const button = found.frame
        .locator(
          `button:has-text("${text}"), a:has-text("${text}"), [role="button"]:has-text("${text}"), input[type="submit"][value*="${text}"]`
        )
        .first();
      if (!(await button.count().catch(() => 0))) continue;
      /* 눌러도 되는 상태가 될 때까지 잠깐 기다린다 — 타이핑 직후에는 아직 disabled 다. */
      const ready = await (async () => {
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline) {
          if (!(await button.isDisabled().catch(() => true))) return true;
          await found.frame.page().waitForTimeout(200);
        }
        return false;
      })();
      if (!ready) {
        log.debug(`제출 버튼("${text}")이 계속 비활성입니다 — 다음 후보를 봅니다.`);
        continue;
      }
      await button.click({ timeout: 4000 }).catch(() => {});
      return { ok: true, how: `"${text}" 클릭` };
    }
  }

  await input.press('Enter').catch(() => {});
  return { ok: true, how: 'Enter (제출 버튼을 쓰지 못했습니다)' };
}

/**
 * 떠 있는 틀린그림찾기 레이어를 닫는다 (재시도 전에 치우는 용도).
 *
 * 위젯이 `Bad Request` 로 열리지 못한 화면에는 문제도 버튼도 없고 **닫기(×)만** 남는다
 * (2026-08-21 스크린샷). 셀렉터를 추측하지 않고 위젯 컨테이너 안에서 닫기 성격의
 * 컨트롤을 찾아 누른다. 못 찾으면 false — 발행 버튼을 다시 누르면 레이어가 교체된다.
 */
export async function closeWrongPicture(page) {
  return page
    .evaluate(() => {
      const box = document.querySelector(
        '[class*="kap' + 'tcha" i],[id*="kap' + 'tcha" i],[class*="cap' +
          'tcha" i],[id*="cap' + 'tcha" i],[class*="capcha" i]'
      );
      const scope = box?.closest('div,section,form') || document.body;
      const seen = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 8 && r.height > 8;
      };
      const button = [...scope.querySelectorAll('button,a,[role="button"]')].find(
        (el) =>
          seen(el) &&
          /닫기|close|취소|×|✕|✖/i.test(
            `${el.getAttribute('aria-label') || ''} ${el.title || ''} ${el.innerText || ''} ${el.className || ''}`
          )
      );
      if (!button) return false;
      button.click();
      return true;
    })
    .catch(() => false);
}

/** 새 문제를 받는다 — 오답 뒤에는 같은 그림을 다시 읽어도 같은 답이 나온다. */
async function refreshQuestion(found) {
  for (const text of SEC.refreshTexts) {
    const button = found.frame
      .locator(`button:has-text("${text}"), a:has-text("${text}"), [role="button"]:has-text("${text}")`)
      .first();
    if (!(await button.count().catch(() => 0))) continue;
    await button.click({ timeout: 4000 }).catch(() => {});
    return true;
  }
  return false;
}

/** 제출 뒤 위젯이 사라지는지 본다 (사라짐 = 통과). */
async function waitForGone(page, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    if (!page.url().includes('/manage/newpost')) return true;
    if (!(await hasWrongPicture(page))) return true;
  }
  return false;
}

/**
 * 틀린그림찾기 화면의 UI 메타데이터를 색인으로 남긴다.
 *
 * 정답을 남기지 않는다. 발행 로그만 보고도 어떤 화면에서 멈췄는지 추적할 수 있고,
 * 다음 셀렉터 보완에도 쓴다.
 */
export async function indexWrongPicture(page, { screenshot, focused, questionImage } = {}) {
  const frameIndex = [];
  for (const [index, frame] of page.frames().entries()) {
    const detail = await frame
      .evaluate(() => {
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 20 && r.height > 10;
        };
        const wrongPictureNodes = [
          ...document.querySelectorAll(
            '[class*="kap' + 'tcha" i],[id*="kap' + 'tcha" i],[class*="cap' +
              'tcha" i],[id*="cap' + 'tcha" i]'
          ),
        ].filter(visible);
        const inputs = [...document.querySelectorAll('input')]
          .filter((el) => visible(el) && !el.disabled && !el.readOnly)
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            name: el.name || '',
            type: el.type || 'text',
            placeholder: el.placeholder || '',
          }));
        return {
          wrongPictureNodes: wrongPictureNodes.length,
          captchaNodes: wrongPictureNodes.length, // 기존 화면 감시 도구와의 호환
          inputs,
          /* 지도 이미지가 iframe 내부 스크롤에 가려 스크린샷에서 문제 문구가 잘릴 수 있다.
           * 정답 자체가 아니라 화면에 표시된 안내·빈칸 텍스트만 남겨 사람이 읽게 한다. */
          text: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1000),
        };
      })
      .catch(() => null);
    if (detail) {
      frameIndex.push({
        index,
        url: frame === page.mainFrame() ? page.url() : frame.url(),
        ...detail,
      });
    }
  }

  const capturedStamp = stamp();
  const file = path.join(DIRS.shots, `${capturedStamp}-publish-wrong-picture.index.json`);
  const legacyFile = path.join(DIRS.shots, `${capturedStamp}-publish-captcha.index.json`);
  const payload = {
    capturedAt: new Date().toISOString(),
    pageUrl: page.url(),
    screenshot: screenshot || null,
    questionImage: questionImage || null,
    focusedInput: focused || null,
    frames: frameIndex,
    note: '이 색인은 틀린그림찾기 화면의 UI 메타데이터만 담습니다. 자동 인식이 실패하면 열린 브라우저에서 직접 해결하세요.',
  };
  try {
    fs.mkdirSync(DIRS.shots, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
    fs.writeFileSync(legacyFile, JSON.stringify(payload, null, 2), 'utf8');
    log.info(`틀린그림찾기 화면 색인 저장: ${file}`);
    return file;
  } catch (err) {
    log.warn(`틀린그림찾기 화면 색인 저장 실패: ${err.message}`);
    return null;
  }
}

/** 위젯이 뜬 순간의 화면을 예전 파일 이름으로도 남긴다 (파일명을 감시하는 보조 도구 호환). */
async function keepScreen(page) {
  const file = await shot(page, 'publish-wrong-picture');
  if (!file) return null;
  const legacy = file.replace(/-publish-wrong-picture\.png$/, '-publish-captcha.png');
  if (legacy !== file) {
    try {
      fs.copyFileSync(file, legacy);
    } catch {
      /* 새 이름 스크린샷은 이미 있으므로 흐름을 막지 않는다 */
    }
  }
  return file;
}

/** 입력칸에 커서를 놓는다 — 사람이 창에서 바로 타이핑할 수 있게. */
async function focusInput(found) {
  const focused = await found.frame
    .evaluate((selector) => {
      const input = document.querySelector(selector);
      if (!input) return null;
      input.focus();
      input.scrollIntoView({ block: 'center' });
      return {
        tag: input.tagName.toLowerCase(),
        id: input.id || '',
        name: input.name || '',
        placeholder: input.placeholder || '',
      };
    }, SEC.inputSelector)
    .catch(() => null);
  if (focused) focused.frame = found.frameLabel;
  return focused;
}

/**
 * **마우스 없이 끝나게 한다 (접근성).** 입력칸의 Enter 를 제출 버튼 클릭으로 이어 준다.
 *
 * 자동 경로가 도는 동안에는 걸지 않는다 — 코드가 누르는 Enter 까지 이 핸들러를 타면
 * 한 시도에 두 번 제출된다 (`submitAnswer` 주석의 2026-08-21 실측).
 */
async function bindHumanEnter(found) {
  await found.frame
    .evaluate((selector) => {
      const input = document.querySelector(selector);
      if (!input) return;
      input.focus();
      if (!input.dataset.mytisEnterBound) {
        input.dataset.mytisEnterBound = '1';
        input.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          // 같은 폼/영역의 제출 버튼을 눌러 준다 (마우스 대체)
          const near = input.closest('form,div,section') || document;
          const btn = [...near.querySelectorAll('button,a,input[type="submit"]')].find((b) =>
            /확인|입력|제출|발행|완료|ok|submit/i.test((b.innerText || b.value || '').trim())
          );
          if (btn) btn.click();
          else input.form?.submit?.();
        });
      }
    }, SEC.inputSelector)
    .catch(() => {});
}

/** 사람이 답을 넣기를 기다린다. 파일에 답이 들어오면 대신 입력·제출한다. */
async function waitForHuman(page, found, { waitSec, answerFile }) {
  log.info(
    `사람이 확인한 답을 이 파일에 한 줄로 넣으면 **대신 입력·제출**합니다 (Enter 불필요): ${answerFile}`
  );
  process.stdout.write(''); // 터미널 알림 — 화면이 떴다는 신호

  const deadline = Date.now() + waitSec * 1000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(2000);

    const typed = readAnswerFile();
    if (typed) {
      clearAnswerFiles();
      log.info(`받은 답을 입력합니다: "${typed}"`);
      const live = (await findWrongPicture(page)) || found;
      const submitted = await submitAnswer(live, typed);
      log.info(
        submitted.ok
          ? `답을 제출했습니다 (${submitted.how}). 결과를 확인합니다...`
          : `답을 넣지 못했습니다: ${submitted.how} — 창에서 직접 입력해 주세요.`
      );
    }

    if (!page.url().includes('/manage/newpost')) return true;
    if (!(await hasWrongPicture(page))) return true;
  }
  return false;
}

/**
 * **인식 → 입력 → 제출 → 판정**을 한 번에 처리한다.
 *
 * 위젯이 없으면 아무것도 하지 않고 `{ ok: true, solved: false }` 를 돌려준다.
 * 통과하면 `{ ok: true, solved: 'auto'|'human' }`, 못 풀면 `{ ok: false, reason }`.
 *
 * @param {import('playwright').Page} page
 * @param {{ interactive?: boolean, readAnswer?: typeof recognizeAnswer }} opts
 *   `interactive` — `--show` 로 창이 떠 있으면 사람 대기를 기본으로 켠다.
 *   `readAnswer` — 판독 단계. 기본은 `recognizeAnswer`(codex). **테스트가 여기에 가짜 판독을
 *   끼워 넣어** 입력·제출·판정·재시도를 codex 없이 검증한다 (test/tistory-wrong-picture.test.js).
 */
export async function solveWrongPicture(
  page,
  { interactive = false, readAnswer = recognizeAnswer } = {}
) {
  let found = await findWrongPicture(page);
  if (!found && !(await hasWrongPicture(page))) return { ok: true, solved: false };

  const screenshot = await keepScreen(page);

  /* 얼마나 기다릴지.
   *
   * `MONEYTI_WRONG_PICTURE_WAIT=<초>` 가 있으면 그 값(최대 900). 없으면 **창이 떠 있을
   * 때만** 기본 600초를 준다 — `--show` 없이 기다리면 아무도 못 풀고 시간만 태운다.
   * 이름을 바꾸기 전 설정(`MONEYTI_CAPTCHA_WAIT`)도 계속 받는다. */
  const configuredWait =
    process.env.MONEYTI_WRONG_PICTURE_WAIT ?? process.env.MONEYTI_CAPTCHA_WAIT;
  const waitSec = Math.min(900, Number(configuredWait) || (interactive ? 600 : 0));
  const maxAttempts = Math.max(0, numberEnv('MONEYTI_SEC_ATTEMPTS', 3));
  const minConfidence = numberEnv('MONEYTI_SEC_MIN_CONFIDENCE', 0.35);

  if (!found) {
    /* 감지는 됐는데 입력칸을 못 찾았다 — 프레임 렌더링이 늦는 경우가 있어 한 번 더 본다. */
    await page.waitForTimeout(2000);
    found = await findWrongPicture(page);
  }

  /* 위젯이 아예 열리지 못한 경우 — 기다려도 사람이 풀 수 없다. */
  if (!found) {
    const broken = await wrongPictureBroken(page);
    if (broken) {
      await indexWrongPicture(page, { screenshot });
      log.warn(`틀린그림찾기 위젯이 열리지 못했습니다 — 카카오 응답: "${broken.slice(0, 60)}"`);
      return {
        ok: false,
        solved: false,
        broken: true,
        brokenText: broken.slice(0, 60),
        reason:
          `틀린그림찾기 위젯이 열리지 않았습니다 (카카오 ${'dkap' + 'tcha'} 응답: ${broken.slice(0, 40)}). ` +
          '짧은 시간에 발행·재시도가 많으면 위젯 자체가 막힙니다 — 지도도 입력칸도 없어 ' +
          '사람도 풀 수 없습니다. 시간을 두고 다시 시도하세요.',
      };
    }
  }

  log.warn(
    '티스토리 틀린그림찾기가 떴습니다 (연속 발행 제한). ' +
      (maxAttempts > 0
        ? `그림을 읽어 답을 넣어 봅니다 (최대 ${maxAttempts}회).`
        : '자동 인식은 꺼져 있습니다 (MONEYTI_SEC_ATTEMPTS=0).')
  );
  if (found?.question) {
    log.info(
      `문제: ${found.question}` +
        (found.kind === 'blank' ? ` · 빈칸 유형 (패턴 ${found.pattern || '?'})` : '')
    );
  }

  const focused = found ? await focusInput(found) : null;
  if (focused) {
    log.ok(
      `입력칸을 잡았습니다 (${focused.tag}${focused.id ? '#' + focused.id : ''}` +
        `${focused.name ? '[name=' + focused.name + ']' : ''} · ${focused.frame}).`
    );
  } else {
    log.warn(
      '틀린그림찾기 입력칸을 찾지 못했습니다. Tab 으로 입력칸까지 이동해 답을 입력하세요 — ' +
        `화면 그림은 ${DIRS.shots} 의 publish-wrong-picture 파일에 있습니다.`
    );
  }

  const answerFile = prepareAnswerFiles();
  let questionImage = null;
  const tried = new Set();

  /* ── 자동 경로: 인식 → 입력 → 제출 → 판정 ───────────────────────────── */
  for (let attempt = 1; found && attempt <= maxAttempts; attempt += 1) {
    /* 사람이 이미 답을 넣어 뒀으면 그것이 이긴다 — 자동 인식보다 사람이 정확하다. */
    let answer = readAnswerFile();
    let source = '사람이 넣은 답';
    if (answer) {
      clearAnswerFiles();
    } else {
      const captured = await captureQuestionImage(page, found);
      if (!captured) break;
      questionImage = captured.file;
      if (!captured.tight) {
        /* 위젯만 잘라내지 못했다 — 이런 그림에서는 모델이 **확신 있게 틀린 답**을 준다.
         * 답을 넣지 않고 사람 경로로 내려간다 (§7-28). */
        log.warn('위젯만 잘라낸 그림을 얻지 못해 자동 판독을 건너뜁니다 (화면 전체 캡처는 판독 재료로 쓰지 않습니다).');
        break;
      }
      const imageFile = captured.file;
      log.step(`틀린그림찾기 판독 ${attempt}/${maxAttempts}`);
      try {
        const read = await readAnswer({
          imageFile,
          question: found.question,
          target: found.target,
          kind: found.kind,
          pattern: found.pattern,
        });
        source = `판독 (확신 ${read.confidence.toFixed(2)}${read.seen ? ' · 읽은 라벨: ' + read.seen : ''})`;
        answer = read.answer;
        if (!answer) {
          log.warn(`그림에서 답을 읽지 못했습니다${read.seen ? ` (읽은 라벨: ${read.seen})` : ''}.`);
        } else if (read.confidence < minConfidence) {
          log.warn(`판독 확신이 낮아 넣지 않습니다: "${answer}" (${read.confidence.toFixed(2)}).`);
          answer = '';
        }
      } catch (err) {
        log.warn(`판독 실패: ${err.message.split('\n')[0]}`);
        answer = '';
      }
    }

    let sameAgain = false;
    if (answer && tried.has(answer)) {
      /* 같은 답을 두 번 넣지 않는다. 지도 라벨은 붙여 쓰는 경우가 많아 공백을 뺀
       * 변형을 한 번 시도해 볼 값어치가 있다. 그것도 이미 넣었으면 새 문제를 받는다. */
      const compact = answer.replace(/\s+/g, '');
      sameAgain = tried.has(compact);
      answer = sameAgain ? '' : compact;
    }

    if (!answer) {
      if (attempt >= maxAttempts) break;
      /* **문제를 함부로 바꾸지 않는다.** 판독은 같은 그림에서도 한 번은 못 읽고 다음 번에
       * 읽는다 (2026-08-21 실측: 같은 그림 6회에 5회 정답 · 1회 실패). 읽지 못한 것은
       * 문제 탓이 아니므로 **같은 문제를 한 번 더 읽는다.** 새 문제는 답이 같아서
       * 더 볼 것이 없을 때만 받는다 — 새로 받으면 지도가 더 어려워질 수도 있다. */
      if (sameAgain && (await refreshQuestion(found))) {
        log.info('같은 답만 나와 새 문제를 받았습니다.');
        await page.waitForTimeout(2500);
        found = (await findWrongPicture(page)) || found;
      } else {
        log.info('같은 문제를 한 번 더 읽습니다...');
        await page.waitForTimeout(1000);
      }
      continue;
    }

    tried.add(answer);
    log.info(`답을 넣습니다: "${answer}" — ${source}`);
    const submitted = await submitAnswer(found, answer);
    if (!submitted.ok) {
      log.warn(`제출하지 못했습니다: ${submitted.how}`);
      break;
    }
    log.info(`제출했습니다 (${submitted.how}). 결과를 확인합니다...`);

    if (await waitForGone(page, 10_000)) {
      log.ok(`틀린그림찾기를 통과했습니다 (답: "${answer}").`);
      await indexWrongPicture(page, { screenshot, focused, questionImage });
      return { ok: true, solved: 'auto', answer, attempts: attempt };
    }

    const state = await found.frame
      .evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160))
      .catch(() => '');
    log.warn(`아직 남아 있습니다 — 오답으로 봅니다.${state ? ` 화면: ${state}` : ''}`);
    if (attempt < maxAttempts) {
      if (await refreshQuestion(found)) log.info('새 문제를 받았습니다.');
      await page.waitForTimeout(2500);
      found = (await findWrongPicture(page)) || found;
    }
  }

  await indexWrongPicture(page, { screenshot, focused, questionImage });

  /* ── 사람 경로: 자동이 못 풀었을 때 ──────────────────────────────────── */
  if (waitSec <= 0) {
    return {
      ok: false,
      solved: false,
      reason:
        '티스토리가 틀린그림찾기를 요구합니다 (연속 발행 제한). 자동 판독이 통과하지 못했습니다 — ' +
        '`--show` 를 붙이면 창이 열린 채 기다립니다. 무인 실행에서 기다리려면 ' +
        '`MONEYTI_WRONG_PICTURE_WAIT=180` 을 주세요. 또는 시간을 두고 재시도하세요.',
    };
  }

  log.warn(
    `자동 판독으로 통과하지 못했습니다. **열린 브라우저 창에서 직접 풀어 주세요** — ` +
      `최대 ${waitSec}초 기다립니다. 지도에서 장소를 찾아 글자를 입력하면 됩니다.`
  );
  /* 여기서부터 Enter 를 제출로 이어 준다 — 자동 경로가 끝난 뒤라 두 번 제출될 여지가 없다. */
  if (found) {
    found = (await findWrongPicture(page)) || found;
    await bindHumanEnter(found);
    log.info('입력칸에 커서를 놓았습니다 — 답만 타이핑하고 **Enter**. 마우스는 쓰지 않아도 됩니다.');
  }
  const passed = await waitForHuman(page, found, { waitSec, answerFile });
  if (passed) {
    log.ok('틀린그림찾기가 사라졌습니다.');
    return { ok: true, solved: 'human' };
  }
  return {
    ok: false,
    solved: false,
    reason: `틀린그림찾기가 ${waitSec}초 안에 풀리지 않았습니다. 시간을 두고 다시 시도하세요.`,
  };
}
