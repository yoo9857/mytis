import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { hasWrongPicture } from '../src/tistory.js';
import {
  findWrongPicture,
  submitAnswer,
  questionTarget,
  solveWrongPicture,
  wrongPictureBroken,
  closeWrongPicture,
  blankPattern,
} from '../src/wrongPicture.js';
import { DIRS } from '../src/paths.js';

async function withPage(run) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await run(page);
  } finally {
    await browser.close();
  }
}

test('빈 capcha 호스트의 보이는 부모로 틀린그림찾기를 감지한다', async () => {
  await withPage(async (page) => {
    await page.setContent(`
      <div style="width:500px;height:300px"><div class="capcha_layer"><div style="line-height:0"></div></div></div>
    `);
    assert.equal(await hasWrongPicture(page), true);
  });
});

test('iframe 안의 입력칸만 있어도 틀린그림찾기를 감지한다', async () => {
  await withPage(async (page) => {
    await page.setContent('<iframe style="width:500px;height:300px"></iframe>');
    const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
    await frame.setContent('<input id="inpDkaptcha" style="width:200px;height:30px">');
    assert.equal(await hasWrongPicture(page), true);
  });
});

test('실제 안내 문구 형태만 있어도 틀린그림찾기를 감지한다', async () => {
  await withPage(async (page) => {
    await page.setContent('<div>지도에 있는 화장실의 전체 명칭을 입력해주세요</div>');
    assert.equal(await hasWrongPicture(page), true);
  });
});

test('숨겨진 잔여 노드와 일반 입력칸은 틀린그림찾기로 오인하지 않는다', async () => {
  await withPage(async (page) => {
    await page.setContent(`
      <div style="display:none"><div class="capcha_layer"></div></div>
      <input id="title" style="width:300px;height:40px">
    `);
    assert.equal(await hasWrongPicture(page), false);
  });
});

test('문제 문장에서 묻는 대상만 뽑는다', () => {
  assert.equal(questionTarget('지도에 있는 화장실의 전체 명칭을 입력해주세요'), '화장실');
  assert.equal(questionTarget('지도에 있는 아파트의 전체 명칭을 입력해주세요'), '아파트');
  assert.equal(questionTarget('제목을 입력하세요'), '');
});

/* 아래 두 개는 실측 마크업을 그대로 흉내낸 화면이다
 * (logs/shots/20260821-094905-publish-wrong-picture.index.json):
 * 위젯은 iframe 안에 있고, 입력칸은 input#inpDkaptcha 하나이며,
 * 제출 버튼은 "답변 제출" 이고 입력칸이 비어 있으면 비활성이다. */
const WIDGET_HTML = `
  <p>지도에 있는 화장실의 전체 명칭을 입력해주세요</p>
  <input id="inpDkaptcha" class="inp_dkaptcha" style="width:300px;height:40px">
  <button id="refresh" style="width:40px;height:40px">새로 풀기</button>
  <button id="submit" disabled style="width:120px;height:40px">답변 제출</button>
  <script>
    const input = document.querySelector('#inpDkaptcha');
    const submit = document.querySelector('#submit');
    input.addEventListener('input', () => { submit.disabled = !input.value.trim(); });
    submit.addEventListener('click', () => { window.__answer = input.value; });
  </script>
`;

async function withWidget(page, run) {
  await page.setContent('<iframe style="width:520px;height:360px;border:0"></iframe>');
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  await frame.setContent(WIDGET_HTML);
  await run(frame);
}

test('프레임 안의 입력칸과 묻는 대상을 함께 찾는다', async () => {
  await withPage(async (page) => {
    await withWidget(page, async () => {
      const found = await findWrongPicture(page);
      assert.ok(found, '위젯을 찾지 못했다');
      assert.equal(found.input.id, 'inpDkaptcha');
      assert.equal(found.target, '화장실');
      assert.match(found.question, /전체 명칭을 입력해주세요/);
    });
  });
});

test('답을 채우고 "답변 제출" 을 눌러 제출한다', async () => {
  await withPage(async (page) => {
    await withWidget(page, async (frame) => {
      const found = await findWrongPicture(page);
      const submitted = await submitAnswer(found, '개방화장실');
      assert.equal(submitted.ok, true);
      /* Enter 가 먹지 않는 화면이므로 버튼 클릭 경로로 내려가야 한다. */
      assert.match(submitted.how, /답변 제출/);
      assert.equal(await frame.evaluate(() => window.__answer), '개방화장실');
    });
  });
});

test('제출 버튼이 없는 화면에서는 Enter 로 제출한다', async () => {
  await withPage(async (page) => {
    await page.setContent('<iframe style="width:520px;height:360px;border:0"></iframe>');
    const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
    await frame.setContent(`
      <p>지도에 있는 화장실의 전체 명칭을 입력해주세요</p>
      <input id="inpDkaptcha" style="width:300px;height:40px">
      <script>
        document.querySelector('#inpDkaptcha').addEventListener('keydown', (e) => {
          if (e.key === 'Enter') window.__answer = e.target.value;
        });
      </script>
    `);
    const found = await findWrongPicture(page);
    const submitted = await submitAnswer(found, '개방화장실');
    assert.match(submitted.how, /^Enter/);
    assert.equal(await frame.evaluate(() => window.__answer), '개방화장실');
  });
});

/* ── 인식 → 입력 → 제출 → 판정 을 한 번에 (solveWrongPicture) ─────────────
 *
 * 실제 DKAPTCHA 화면 없이 흐름 전체를 본다. 라우팅으로 글쓰기 주소와 위젯 iframe 을
 * 흉내내므로 네트워크·codex 를 타지 않는다 — 답은 **사람 경로**(답 파일)로 넣어
 * 판독을 건너뛰고, 입력·제출·통과 판정만 검증한다.
 *
 * 판정이 주소에 걸려 있다는 점이 중요하다: `/manage/newpost` 를 벗어나면 발행된 것으로
 * 본다. 그래서 가짜 화면도 그 주소에 띄운다 (about:blank 로 하면 판정이 항상 통과다). */
const EDITOR_URL = 'https://classic-m.tistory.com/manage/newpost/';
const WIDGET_URL = 'https://dkaptcha.kakao.com/dkaptcha/quiz?widget=test';
const ANSWER = '개방화장실';
const MAP_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAI0lEQVR4nO3B' +
  'AQ0AAADCoPdMbQ8HFAAAAAAAAAAAAAAAAOA1RSAAAcMPLGkAAAAASUVORK5CYII=';

const FAKE_WIDGET = `<!doctype html><html><body>
  <img src="${MAP_PNG}" style="width:340px;height:200px">
  <p>지도에 있는 화장실의 전체 명칭을 입력해주세요</p>
  <p id="msg"></p>
  <input id="inpDkaptcha" class="inp_dkaptcha" style="width:300px;height:40px">
  <button id="refresh" style="width:90px;height:40px">새로 풀기</button>
  <button id="submit" disabled style="width:120px;height:40px">답변 제출</button>
  <script>
    const input = document.querySelector('#inpDkaptcha');
    const submit = document.querySelector('#submit');
    input.addEventListener('input', () => { submit.disabled = !input.value.trim(); });
    document.querySelector('#refresh').addEventListener('click', () => {
      window.__refreshed = (window.__refreshed || 0) + 1;
      input.value = '';
      submit.disabled = true;
    });
    submit.addEventListener('click', () => {
      window.__tries = [...(window.__tries || []), input.value];
      if (input.value.trim() === '${ANSWER}') document.body.innerHTML = '<p>통과했습니다</p>';
      else document.querySelector('#msg').textContent = '정답이 아닙니다';
    });
  </script>
</body></html>`;

const FAKE_EDITOR = `<!doctype html><html><body><h1>글쓰기</h1>
  <iframe id="sec" src="${WIDGET_URL}" style="width:520px;height:420px;border:0"></iframe>
</body></html>`;

async function withFakeEditor(run) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/dkaptcha/quiz**', (route) =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: FAKE_WIDGET })
    );
    await page.route('**/manage/newpost/**', (route) =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: FAKE_EDITOR })
    );
    await page.goto(EDITOR_URL);
    await page.waitForSelector('#sec');
    await run(page);
  } finally {
    await browser.close();
  }
}

/** 진단 파일은 검증에 필요하지만 저장소에 쌓일 이유가 없다 — 이 테스트가 만든 것만 지운다. */
function cleanShots(since) {
  for (const name of fs.readdirSync(DIRS.shots)) {
    if (!/-publish-(sec|wrong-picture|captcha)\b/.test(name)) continue;
    const file = path.join(DIRS.shots, name);
    if (fs.statSync(file).mtimeMs >= since) fs.unlinkSync(file);
  }
}

/** 판독을 대신하는 가짜 — 넘긴 답을 순서대로 돌려준다 (codex 를 타지 않는다). */
function fakeReader(answers) {
  let i = 0;
  const calls = [];
  const readAnswer = async ({ imageFile, question, target }) => {
    calls.push({ imageFile, question, target });
    const answer = answers[Math.min(i, answers.length - 1)];
    i += 1;
    return { answer, confidence: 0.9, seen: answer };
  };
  return { readAnswer, calls };
}

async function tries(page) {
  const frame = page.frames().find((f) => /dkaptcha/.test(f.url()));
  return {
    submitted: (await frame.evaluate(() => window.__tries)) || [],
    refreshed: (await frame.evaluate(() => window.__refreshed)) || 0,
  };
}

test('읽은 답을 넣어 제출하고 통과로 판정한다', async () => {
  const since = Date.now();
  process.env.MONEYTI_SEC_ATTEMPTS = '3';
  process.env.MONEYTI_WRONG_PICTURE_WAIT = '0';
  try {
    await withFakeEditor(async (page) => {
      const fake = fakeReader([ANSWER]);
      const result = await solveWrongPicture(page, { readAnswer: fake.readAnswer });
      assert.equal(result.ok, true);
      assert.equal(result.solved, 'auto');
      assert.equal(result.answer, ANSWER);
      assert.equal(result.attempts, 1);
      /* 판독에 **문제 문장과 묻는 대상**이 함께 넘어가야 한다 — 그림만 주면 무엇을
       * 읽어야 할지 알 수 없다. 그림 파일도 실제로 만들어져 있어야 한다. */
      assert.equal(fake.calls.length, 1);
      assert.equal(fake.calls[0].target, '화장실');
      assert.match(fake.calls[0].question, /전체 명칭을 입력해주세요/);
      assert.ok(fs.existsSync(fake.calls[0].imageFile));
      assert.equal(await hasWrongPicture(page), false);
    });
  } finally {
    cleanShots(since);
  }
});

test('틀리면 새 문제를 받아 다시 읽고, 맞히면 통과한다', async () => {
  const since = Date.now();
  process.env.MONEYTI_SEC_ATTEMPTS = '3';
  process.env.MONEYTI_WRONG_PICTURE_WAIT = '0';
  try {
    await withFakeEditor(async (page) => {
      const fake = fakeReader(['엉뚱한답', ANSWER]);
      const result = await solveWrongPicture(page, { readAnswer: fake.readAnswer });
      assert.equal(result.ok, true);
      assert.equal(result.attempts, 2);
      assert.equal(result.answer, ANSWER);
      assert.equal(fake.calls.length, 2);
    });
  } finally {
    cleanShots(since);
  }
});

test('판독이 비면 문제를 바꾸지 않고 같은 문제를 다시 읽는다', async () => {
  const since = Date.now();
  process.env.MONEYTI_SEC_ATTEMPTS = '3';
  process.env.MONEYTI_WRONG_PICTURE_WAIT = '0';
  try {
    await withFakeEditor(async (page) => {
      /* 판독은 같은 그림에서도 한 번은 못 읽는다 (2026-08-21 실측) — 그 한 번에
       * 새 문제를 받아 버리면 읽을 수 있었던 문제를 버린다. */
      const fake = fakeReader(['', ANSWER]);
      const result = await solveWrongPicture(page, { readAnswer: fake.readAnswer });
      assert.equal(result.ok, true);
      assert.equal(result.attempts, 2);
      const seen = await tries(page);
      assert.deepEqual(seen.submitted, [ANSWER]);
      assert.equal(seen.refreshed, 0); // 문제를 바꾸지 않았다
    });
  } finally {
    cleanShots(since);
  }
});

test('같은 답을 두 번 넣지 않고, 못 풀면 이유를 돌려준다', async () => {
  const since = Date.now();
  process.env.MONEYTI_SEC_ATTEMPTS = '3';
  process.env.MONEYTI_WRONG_PICTURE_WAIT = '0'; // 사람 대기 없이 즉시 판정
  try {
    await withFakeEditor(async (page) => {
      /* 판독이 매번 같은 답을 준다 — 시도 횟수를 같은 답으로 태우지 않아야 한다. */
      const fake = fakeReader(['엉뚱한답']);
      const result = await solveWrongPicture(page, { readAnswer: fake.readAnswer });
      assert.equal(result.ok, false);
      assert.match(result.reason, /틀린그림찾기/);
      assert.equal(await hasWrongPicture(page), true);
      const seen = await tries(page);
      /* 같은 답은 한 번만 들어간다 — 시도 횟수를 같은 오답으로 태우지 않는다. */
      assert.deepEqual(seen.submitted, ['엉뚱한답']);
      /* 새 문제는 두 번 받았다: 오답 뒤 한 번, 다음 판독이 또 같은 답을 줘서 한 번. */
      assert.equal(seen.refreshed, 2);
    });
  } finally {
    cleanShots(since);
  }
});


/* ── 위젯이 열리지 못한 화면 (2026-08-21 실측) ───────────────────────────
 *
 * 하루에 시도가 많아지자 카카오가 위젯 자체를 막았고 iframe 본문이 `Bad Request` 였다.
 * 지도도 입력칸도 없으니 사람도 풀 수 없다 — **기다리지 않고** 그 사실을 돌려줘야 한다. */
const BROKEN_WIDGET = '<!doctype html><html><body><p>Bad Request</p></body></html>';

const EDITOR_WITH_CLOSE = `<!doctype html><html><body>
  <div class="dkaptcha_layer" style="width:520px;height:420px">
    <button type="button" class="btn_close" aria-label="닫기">×</button>
    <iframe id="sec" src="${WIDGET_URL}" style="width:520px;height:380px;border:0"></iframe>
  </div>
</body></html>`;

/* 실측 화면에서는 **바깥 문서에 위젯 레이어가 그대로 떠 있다** (index.json 의 frame 0:
 * wrongPictureNodes 1). 그래서 감지는 참이고, 프레임 안에만 문제가 없다. 가짜 화면도
 * 그 구조를 따라야 실제와 같은 길을 탄다 — 레이어 없는 가짜로는 "화면에 없음" 으로 끝난다. */
async function withBrokenWidget(run, editorHtml = EDITOR_WITH_CLOSE) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/dkaptcha/quiz**', (route) =>
      route.fulfill({ status: 400, contentType: 'text/html; charset=utf-8', body: BROKEN_WIDGET })
    );
    await page.route('**/manage/newpost/**', (route) =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: editorHtml })
    );
    await page.goto(EDITOR_URL);
    await page.waitForSelector('#sec');
    await run(page);
  } finally {
    await browser.close();
  }
}

test('위젯이 Bad Request 면 열리지 못한 것으로 본다', async () => {
  await withBrokenWidget(async (page) => {
    assert.match(await wrongPictureBroken(page), /Bad Request/);
  });
});

test('열리지 못한 위젯 앞에서는 사람을 기다리지 않는다', async () => {
  const since = Date.now();
  process.env.MONEYTI_SEC_ATTEMPTS = '3';
  process.env.MONEYTI_WRONG_PICTURE_WAIT = '600'; // 사람 대기가 켜져 있어도
  try {
    await withBrokenWidget(async (page) => {
      const started = Date.now();
      const result = await solveWrongPicture(page, { interactive: true });
      const took = Date.now() - started;
      assert.equal(result.ok, false);
      assert.equal(result.broken, true);
      assert.match(result.reason, /열리지 않았습니다/);
      /* 600초를 태우지 않는다 — 재시도 판단은 호출부(clickPublish)가 한다. */
      assert.ok(took < 30_000, `너무 오래 기다렸다: ${took}ms`);
    });
  } finally {
    process.env.MONEYTI_WRONG_PICTURE_WAIT = '0';
    cleanShots(since);
  }
});

test('떠 있는 레이어의 닫기 버튼을 찾아 누른다', async () => {
  await withBrokenWidget(async (page) => {
    await page.evaluate(() => {
      document.querySelector('.btn_close').addEventListener('click', () => {
        window.__closed = true;
      });
    });
    assert.equal(await closeWrongPicture(page), true);
    assert.equal(await page.evaluate(() => window.__closed), true);
  }, EDITOR_WITH_CLOSE);
});

/* ── 문제 유형이 두 가지다 (2026-08-21 실측) ────────────────────────────
 *
 * ① "지도에 있는 마트의 전체 명칭을 입력해주세요"        → 라벨 전체
 * ② "지도에서 아래 장소를 찾아 빈칸에 들어갈 글자를…"   → 빈칸 글자만
 *
 * ②에 라벨 전체를 넣으면 반드시 틀린다 — 실제로 "아[빈칸]벤트" 에 "아트벤트" 를 넣어 틀렸다. */
const BLANK_WIDGET_TEXT =
  'DKAPTCHA (CAPTCHA 서비스) 지도에서 아래 장소를 찾아 빈칸에 들어갈 글자를 입력해주세요 ' +
  '문제 아빈칸 벤트 정답을 입력해주세요 새로 풀기 음성 문제 재생 답변 제출';

test('빈칸 유형의 패턴을 읽어 낸다', () => {
  assert.equal(blankPattern(BLANK_WIDGET_TEXT), '아○벤트');
  assert.equal(blankPattern('지도에 있는 마트의 전체 명칭을 입력해주세요'), '');
});

test('화면 문구로 문제 유형을 가른다', async () => {
  await withPage(async (page) => {
    await page.setContent('<iframe style="width:520px;height:360px;border:0"></iframe>');
    const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
    await frame.setContent(
      `<p>${BLANK_WIDGET_TEXT}</p><input id="inpDkaptcha" style="width:300px;height:40px">`
    );
    const found = await findWrongPicture(page);
    assert.equal(found.kind, 'blank');
    assert.equal(found.pattern, '아○벤트');
  });
});

test('전체 명칭 유형은 blank 로 보지 않는다', async () => {
  await withPage(async (page) => {
    await page.setContent('<iframe style="width:520px;height:360px;border:0"></iframe>');
    const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
    await frame.setContent(
      '<p>지도에 있는 마트의 전체 명칭을 입력해주세요 정답을 입력해주세요</p>' +
        '<input id="inpDkaptcha" style="width:300px;height:40px">'
    );
    const found = await findWrongPicture(page);
    assert.equal(found.kind, 'full');
    assert.equal(found.target, '마트');
  });
});

/* 위젯의 제출 버튼은 `fill` 로는 켜지지 않는다 — keyup 을 듣기 때문이다.
 * 이 가짜 위젯은 그 성질을 그대로 흉내낸다: `fill` 만 하면 버튼이 계속 disabled 다. */
const KEYUP_ONLY_WIDGET = `
  <p>지도에 있는 마트의 전체 명칭을 입력해주세요</p>
  <input id="inpDkaptcha" style="width:300px;height:40px">
  <button id="submit" disabled style="width:120px;height:40px">답변 제출</button>
  <script>
    const input = document.querySelector('#inpDkaptcha');
    const submit = document.querySelector('#submit');
    input.addEventListener('keyup', () => { submit.disabled = !input.value.trim(); });
    submit.addEventListener('click', () => { window.__answer = input.value; });
  </script>
`;

test('keyup 만 듣는 위젯에서도 버튼을 켜서 누른다', async () => {
  await withPage(async (page) => {
    await page.setContent('<iframe style="width:520px;height:360px;border:0"></iframe>');
    const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
    await frame.setContent(KEYUP_ONLY_WIDGET);
    const found = await findWrongPicture(page);
    const submitted = await submitAnswer(found, '롯데마트');
    assert.match(submitted.how, /답변 제출/);
    assert.equal(await frame.evaluate(() => window.__answer), '롯데마트');
  });
});
