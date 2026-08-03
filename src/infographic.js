/**
 * 인포그래픽 — 절차 글의 **순서를 그림으로** 만든다 (대표 이미지용).
 *
 * ## 무엇을 이미지로 하고 무엇을 HTML 로 두는가
 *
 * 기준은 하나다: **발행 후에는 이미지를 고칠 수 없다.**
 *  - **순서·구조** → 이미지. 절차는 바뀌지 않는다. 목록·공유 카드에서 무슨 글인지
 *    한눈에 보이고, 스톡 사진("노트와 펜")보다 정직하다.
 *  - **숫자·기한·요율** → HTML (`diagram.js` 의 keyFigures, `html.js` 의 figures 표).
 *    제도는 바뀐다. 이미지에 박히면 낡은 숫자를 못 고친다.
 *
 * ## 왜 생성 이미지를 쓰지 않는가
 *
 * 라벨을 **아티클에서 그대로 가져온다.** 사람이나 생성 모델이 다시 옮겨 적으면
 * 옮기다 틀리고, 그러면 본문과 그림이 어긋난다. 한글도 뭉개지지 않는다.
 *
 * 색은 eco-m 스킨 토큰(`cs.txt` 의 `--c-brand` 계열), 서체는 맑은 고딕.
 * 사용자가 두 안을 비교해 **짙은 네이비 안**을 골랐다 (2026-08-03).
 */
import fs from 'node:fs';
import path from 'node:path';
/* `browser.js` 의 launchBrowser 를 쓰지 않는다 — 그쪽은 **로그인 프로필**을 여는
 * 물건이고(카카오·네이버 쿠키), 그림을 그리는 데 세션을 열 이유가 없다.
 * images.js 와 같은 방식으로 빈 크로미움을 띄운다. */
import { chromium } from 'playwright';
import { DIRS } from './paths.js';
import { log } from './log.js';

/** eco-m 스킨 토큰 */
const C = {
  brand: '#123a6b',
  brand2: '#1d5296',
  brandPale: '#9dc1ee',
  accent: '#c8322b',
  ink: '#0f1720',
  ink3: '#6a7684',
  line: '#e4e8ed',
  wash: '#f5f7f9',
};
/* 스킨(ht.txt)이 Pretendard 를 CDN 에서 불러 쓴다. 카드도 같은 서체로 그리면
 * 블로그와 이어져 보인다. 네트워크가 막히면 맑은 고딕으로 떨어진다 —
 * 폰트 하나 때문에 카드가 안 나오는 일은 없어야 한다. */
const PRETENDARD_CSS =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
const FONT = "'Pretendard Variable',Pretendard,'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo',sans-serif";

/** 카드 공통 껍데기 — 브랜드 바 + 이중 테두리.
 *
 * 참고 글(dampick) 카드들이 **한 시리즈로 보이는 이유**가 이 틀이었다:
 * 상단에 로고, 본문을 이중 테두리로 감싸고, 소제목 앞에 세로 막대.
 * 틀은 가져오고 그쪽의 마케팅 장치(상담 유도·브랜드 검색·수상 배너·3D 동전 더미)는
 * 가져오지 않는다 — 소개글에서 "리딩방·유료 상담 유도 하지 않습니다" 라고 했다.
 */
function frame(inner, { pad = 46 } = {}) {
  /* 높이를 고정하지 않는다 — 정사각으로 박아 두면 항목이 3개인 카드에서 **아래 절반이
   * 통째로 빈다** (2026-08-03 첫 렌더에서 그렇게 나왔다). 흐름 배치로 두고
   * renderCards 가 scrollHeight 로 잘라낸다. */
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${PRETENDARD_CSS}"></head>
<body style="margin:0;width:1080px;background:${C.brand};font-family:${FONT};
  padding:22px;box-sizing:border-box;">
  <div style="border:2px solid rgba(255,255,255,.28);border-radius:14px;padding:12px;">
    <div style="background:#fff;border-radius:10px;padding:34px ${pad}px 38px;">
      <div style="font-size:26px;font-weight:800;letter-spacing:-0.02em;color:${C.brand};">eco-m</div>
      <div style="margin:10px 0 26px;height:1px;background:${C.line};"></div>
${inner}
    </div>
  </div>
</body></html>`;
}

/** 소제목 — 앞에 세로 막대를 세운다 (참고 글의 표기법) */
function cardHeading(title) {
  return `<div style="display:flex;align-items:flex-start;margin:0 0 26px;">
  <span style="display:inline-block;width:5px;min-height:34px;margin:3px 14px 0 0;background:${C.brand};border-radius:3px;"></span>
  <span style="font-size:38px;font-weight:800;color:${C.ink};line-height:1.3;letter-spacing:-0.03em;">${esc(title)}</span>
</div>`;
}

/** "3단계 · 계약서와 특약을 문장으로 남기기" → { num, label } */
function parseStep(heading) {
  const m = String(heading).match(/^\s*(\d+)\s*단계\s*[·:—-]?\s*(.*)$/);
  return m ? { num: m[1], label: (m[2] || '').trim() } : null;
}

/** 이 아티클이 절차 글인가 (단계 소제목 2개 이상) */
export function steps(article) {
  return (article?.sections || []).map((s) => parseStep(s.heading)).filter(Boolean);
}

/**
 * 카드 제목 — 본문 제목을 그대로 쓰지 않는다. 제목은 길고 검색어가 섞여 있다.
 *
 * ⚠️ **글자 수로 자르지 않는다.** `slice(0, 12)` 는 낱말 중간을 끊는다
 * ("주택담보대출 금리 비교 방법" → "주택담보대출 금리 비"). 큰 활자로 세우는
 * 자리라서 잘린 낱말이 그대로 눈에 박힌다.
 *
 * 어절 경계에서 끊고, 한 어절이 통째로 길면 그대로 둔다 — 자르는 것보다 낫다.
 */
function cardTitle(title, max = 14) {
  if (title.length <= max) return title;
  const words = title.split(/\s+/);
  let out = '';
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > max) break;
    out = next;
  }
  return out || words[0] || title;
}

/**
 * 되돌릴 수 없는 지점을 고른다.
 *
 * 절차 글의 값은 "어디를 지나면 못 돌아오는가" 다. 돈이 나가는 단계가 그 지점이다.
 * 못 찾으면 표시하지 않는다 — 아무 단계나 빨갛게 칠하면 거짓 강조가 된다.
 */
function pickNoReturn(list) {
  const MONEY = /잔금|송금|입금|가계약|계약금|서명|날인|이체/;
  const hit = list.find((s) => MONEY.test(s.label));
  return hit ? hit.num : '';
}

/**
 * 절차 흐름 카드를 그린다. 성공하면 파일 경로, 아니면 `null`.
 *
 * 높이는 단계 수에 맞춰 **자동으로 잡는다.** 고정 높이로 두면 단계가 적은 글에서
 * 아래쪽이 통째로 비고, 많은 글에서는 잘린다.
 */
export async function renderStepCard(article, cfg) {
  const list = steps(article);
  if (list.length < 2) return null;

  const noReturn = pickNoReturn(list);
  const title = String(article.primaryKeyword || article.title || '').trim();
  const head = cardTitle(title);
  /* 둘째 줄 "확인 순서" 를 무조건 붙이면 **낱말이 겹친다.**
   * > 2026-08-03 실측: primaryKeyword 가 "주택담보대출 한도 확인" 이라서
   * > 카드에 "주택담보대출 한도 확인 / **확인** 순서" 로 찍혔다.
   * 이미 순서·절차·방법·확인으로 끝나는 제목이면 덧붙이지 않는다. */
  const suffix = /(순서|절차|방법|확인|하는\s*법)$/.test(head) ? '' : '확인 순서';

  const rows = list
    .map((s) => {
      const hot = s.num === noReturn;
      return `<div style="padding:26px 6px;border-bottom:1px solid ${C.line};">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td width="96" style="vertical-align:top;font-size:54px;font-weight:800;line-height:1;
      color:${hot ? C.accent : C.brand2};">${s.num}</td>
    <td style="vertical-align:top;padding-top:6px;">
      <div style="font-size:32px;font-weight:700;color:${C.ink};line-height:1.4;
        letter-spacing:-0.02em;">${esc(s.label)}</div>
      ${hot ? `<div style="margin-top:10px;font-size:23px;font-weight:700;color:${C.accent};">되돌릴 수 없는 지점</div>` : ''}
    </td>
  </tr></table>
</div>`;
    })
    .join('\n');

  const html = `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;width:1080px;background:${C.brand};font-family:${FONT};color:#fff;">
  <div style="padding:80px 72px 0;">
    <div style="font-size:22px;font-weight:700;letter-spacing:.14em;color:${C.brandPale};">STEP BY STEP</div>
    <div style="margin-top:18px;font-size:72px;font-weight:800;line-height:1.16;letter-spacing:-0.03em;">
      ${esc(head)}${suffix ? `<br/>${suffix}` : ''}
    </div>
  </div>
  <div style="margin:54px 42px 0;padding:10px 30px 24px;background:#fff;border-radius:22px;">
${rows}
  </div>
  <div style="padding:44px 72px 52px;font-size:22px;color:${C.brandPale};">eco-m · 경제를 모르던 사람의 기록</div>
</body></html>`;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1200 }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    /* 높이를 내용에 맞춘다. 마지막 항목의 아래 테두리가 잘리지 않게 조금 넉넉히. */
    const h = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewportSize({ width: 1080, height: Math.ceil(h) });
    await page.waitForTimeout(150);

    fs.mkdirSync(DIRS.images, { recursive: true });
    const file = path.join(DIRS.images, `stepcard-${Date.now()}.png`);
    await page.screenshot({ path: file, type: 'png' });
    await page.close();
    log.ok(`절차 카드 생성 (${list.length}단계 · 1080x${Math.ceil(h)}${noReturn ? ` · 되돌릴 수 없는 지점 ${noReturn}단계` : ''})`);
    return file;
  } catch (err) {
    /* 카드 하나 실패로 발행을 멈추지 않는다 — 없으면 스톡 대표 이미지가 그 자리를 쓴다 */
    log.warn(`절차 카드 생성 실패: ${err.message.split('\n')[0]}`);
    return null;
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * 정보 카드를 그린다 — `article.cards[]` 한 항목당 정사각 1080x1080 한 장.
 *
 * 두 종류뿐이다. 종류를 늘리면 모델이 고르는 데 실패하고, 안 맞는 틀에 글을 밀어넣는다.
 *  - `reasons`  번호 카드를 세로로 (설명이 두 줄 이상일 때)
 *  - `columns`  3열로 나란히 (항목이 짧고 대등할 때)
 *
 * 글자가 넘치면 **카드가 깨지는 게 아니라 잘린다.** 그래서 스키마에서 길이를 못박았고
 * 여기서도 한 번 더 자른다 — 발행 후에는 이미지를 고칠 수 없다.
 */
export async function renderCards(article, cfg) {
  const cards = (article?.cards || []).filter((c) => c?.title && (c.items || []).length >= 2);
  if (!cards.length) return [];

  const browser = await chromium.launch({ headless: true });
  const out = [];
  try {
    for (const [i, card] of cards.entries()) {
      const items = card.items.slice(0, 4);
      const inner = card.type === 'columns' ? columnsBody(card, items) : reasonsBody(card, items);
      const page = await browser.newPage({ viewport: { width: 1080, height: 900 }, deviceScaleFactor: 1 });
      await page.setContent(frame(inner), { waitUntil: 'load' });
      /* 웹폰트를 기다린다. 안 기다리면 맑은 고딕으로 찍혀 스킨과 서체가 어긋난다.
       * 못 받아도 그냥 진행한다 — 폰트 때문에 카드를 버릴 이유는 없다.
       * ⚠️ 폰트가 바뀌면 줄바꿈이 바뀌고 높이도 바뀐다 — **높이는 폰트를 기다린 뒤** 재야 한다. */
      await page.evaluate(() => document.fonts?.ready).catch(() => {});
      await page.waitForTimeout(500);
      const h = await page.evaluate(() => document.body.scrollHeight);
      await page.setViewportSize({ width: 1080, height: Math.ceil(h) });
      await page.waitForTimeout(150);
      const file = path.join(DIRS.images, `card-${Date.now()}-${i}.png`);
      await page.screenshot({ path: file, type: 'png' });
      await page.close();
      out.push({
        file,
        title: card.title,
        type: card.type,
        count: items.length,
        afterSection: Number.isFinite(card.afterSection) ? Math.max(1, card.afterSection) : 1,
      });
      log.ok(`정보 카드 생성: "${card.title}" (${card.type} · ${items.length}항목)`);
    }
  } catch (err) {
    log.warn(`정보 카드 생성 실패: ${err.message.split('\n')[0]}`);
  } finally {
    await browser.close().catch(() => {});
  }
  return out;
}

/** 번호 카드 세로 — 참고 글 img02 의 문법 */
function reasonsBody(card, items) {
  const rows = items
    .map(
      (it, i) => `<div style="margin:0 0 14px;padding:22px 26px;background:${C.wash};border-radius:12px;">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td width="66" style="vertical-align:top;font-size:26px;font-weight:800;color:${C.brand2};letter-spacing:.02em;">
      ${String(i + 1).padStart(2, '0')}</td>
    <td style="vertical-align:top;">
      <div style="font-size:29px;font-weight:800;color:${C.ink};line-height:1.35;letter-spacing:-0.02em;">${esc(it.label)}</div>
      ${it.text ? `<div style="margin-top:9px;font-size:22px;color:${C.ink3};line-height:1.6;">${esc(cut(it.text, 78))}</div>` : ''}
    </td>
  </tr></table>
</div>`
    )
    .join('\n');
  return cardHeading(card.title) + rows;
}

/** 3열 나란히 — 참고 글 img03 의 문법 */
function columnsBody(card, items) {
  const list = items.slice(0, 3);
  const w = Math.floor(100 / list.length);
  const cells = list
    .map(
      (it, i) => `<td width="${w}%" style="vertical-align:top;padding:0 ${i === list.length - 1 ? 0 : 9}px 0 ${i ? 9 : 0}px;">
  <div style="height:100%;padding:24px 20px;background:${C.wash};border-radius:12px;box-sizing:border-box;">
    <div style="font-size:24px;font-weight:800;color:${C.brand2};letter-spacing:.02em;">${String(i + 1).padStart(2, '0')}</div>
    <div style="margin-top:12px;font-size:27px;font-weight:800;color:${C.ink};line-height:1.35;letter-spacing:-0.02em;">${esc(it.label)}</div>
    <div style="margin-top:14px;height:1px;background:${C.line};"></div>
    ${it.text ? `<div style="margin-top:14px;font-size:21px;color:${C.ink3};line-height:1.6;">${esc(cut(it.text, 60))}</div>` : ''}
  </div>
</td>`
    )
    .join('\n');
  return (
    cardHeading(card.title) +
    `<table style="width:100%;border-collapse:collapse;"><tr>\n${cells}\n</tr></table>`
  );
}

/** 넘치는 글자는 어절 경계에서 자른다 (제목 자르기와 같은 이유) */
function cut(text, max) {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  const words = t.split(/\s+/);
  let out = '';
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > max) break;
    out = next;
  }
  return (out || t.slice(0, max)) + '…';
}

function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
