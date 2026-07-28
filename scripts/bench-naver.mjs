/**
 * 참고할 네이버 글의 구조를 **수치로** 분해한다.
 *
 * 취향을 법칙으로 오해하지 않으려면 눈으로 보지 말고 세어야 한다.
 * (티스토리 쪽 benchmark-post 스킬과 같은 원칙 — HANDOVER '작업 방식')
 *
 * 재는 것:
 *   · 컴포넌트 구성비 (소제목/본문/사진/사진묶음/인용구/구분선)
 *   · 사진 밀도 = 본문 글자수 ÷ 사진 수
 *   · 문단 길이 분포, 줄간격·글자크기
 *   · 소제목 간격 (몇 글자마다 소제목이 나오는가)
 *   · 소제목 문구의 성격, 인용구 종류
 */
import fs from 'node:fs';
import { loadConfig } from '../src/config.js';
import { launchBrowser, firstPage } from '../src/browser.js';

const URL = process.argv[2] || 'https://blog.naver.com/qnel4563/224345933917';
const cfg = loadConfig();
cfg.browser.headless = false;
cfg.browser.slowMo = 0;

const ctx = await launchBrowser(cfg);
const page = await firstPage(ctx);
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
const frame = page.frames().find((f) => /PostView/i.test(f.url())) || page.mainFrame();

const r = await frame.evaluate(() => {
  const root = document.querySelector('.se-main-container');
  if (!root) return { error: '본문 컨테이너를 찾지 못했습니다' };

  const comps = [...root.querySelectorAll('.se-component')];
  const kindOf = (el) => {
    const m = el.className.match(/se-(documentTitle|sectionTitle|text|image|imageGroup|quotation|horizontalLine|oglink|table|code|sticker|map|video|placesMap)/);
    return m ? m[1] : el.className.slice(0, 40);
  };

  // 순서대로 흐름을 기록 (구조 리듬을 보려면 순서가 중요하다)
  const flow = comps.map((el) => {
    const kind = kindOf(el);
    const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
    const out = { kind, len: t.length };
    if (kind === 'sectionTitle' || kind === 'documentTitle') out.text = t.slice(0, 60);
    if (kind === 'quotation') {
      out.layout = (el.className.match(/se-l-(\S+)/) || [])[1];
      out.text = t.slice(0, 50);
    }
    if (kind === 'imageGroup') {
      out.layout = (el.className.match(/se-l-(\S+)/) || [])[1];
      out.imgs = el.querySelectorAll('img').length;
    }
    if (kind === 'image') {
      const i = el.querySelector('img');
      out.w = i ? Math.round(i.getBoundingClientRect().width) : null;
      out.caption = (el.querySelector('.se-caption')?.innerText || '').trim().slice(0, 40) || undefined;
    }
    return out;
  });

  // 문단 길이 분포
  const paras = [...root.querySelectorAll('.se-component.se-text .se-text-paragraph')]
    .map((p) => (p.innerText || '').trim())
    .filter((t) => t.length > 0);
  const lens = paras.map((t) => t.length).sort((a, b) => a - b);
  const pct = (p) => lens.length ? lens[Math.floor((lens.length - 1) * p)] : 0;

  // 본문 총 글자수 (소제목·캡션 제외)
  const bodyChars = paras.reduce((a, t) => a + t.length, 0);
  const imageCount =
    root.querySelectorAll('.se-component.se-image').length +
    [...root.querySelectorAll('.se-component.se-imageGroup')].reduce((a, g) => a + g.querySelectorAll('img').length, 0);

  const firstPara = root.querySelector('.se-component.se-text .se-text-paragraph');
  const cs = firstPara ? getComputedStyle(firstPara) : null;
  const span = firstPara?.querySelector('span');

  return {
    title: (root.querySelector('.se-documentTitle')?.innerText || '').trim().slice(0, 80),
    componentTotal: comps.length,
    kinds: flow.reduce((a, f) => ((a[f.kind] = (a[f.kind] || 0) + 1), a), {}),
    bodyChars,
    imageCount,
    charsPerImage: imageCount ? Math.round(bodyChars / imageCount) : null,
    sectionTitles: flow.filter((f) => f.kind === 'sectionTitle').map((f) => f.text),
    charsPerSectionTitle: (() => {
      const n = flow.filter((f) => f.kind === 'sectionTitle').length;
      return n ? Math.round(bodyChars / n) : null;
    })(),
    paragraphCount: paras.length,
    paraLen: { min: lens[0], p25: pct(0.25), median: pct(0.5), p75: pct(0.75), max: lens[lens.length - 1],
      avg: lens.length ? Math.round(bodyChars / lens.length) : 0 },
    typography: {
      paraLineHeight: cs?.lineHeight,
      paraInline: firstPara?.getAttribute('style'),
      spanClass: span?.className,
      spanSize: span ? getComputedStyle(span).fontSize : null,
    },
    quotations: flow.filter((f) => f.kind === 'quotation').map((f) => ({ layout: f.layout, len: f.len })),
    imageWidths: [...new Set(flow.filter((f) => f.kind === 'image').map((f) => f.w))],
    imageGroups: flow.filter((f) => f.kind === 'imageGroup').map((f) => ({ layout: f.layout, imgs: f.imgs })),
    captionCount: root.querySelectorAll('.se-caption').length,
    flow: flow.map((f) => `${f.kind}${f.kind === 'imageGroup' ? `(${f.imgs})` : ''}${f.kind === 'text' ? `[${f.len}]` : ''}${f.kind === 'quotation' ? `<${f.layout}>` : ''}`),
    tags: [...document.querySelectorAll('.post_tag a, .item_tag, .tag')].map((e) => e.innerText.trim()).slice(0, 30),
  };
});

console.log(JSON.stringify(r, null, 1));
fs.writeFileSync('logs/bench-naver.json', JSON.stringify({ url: URL, ...r }, null, 1), 'utf8');
await ctx.close().catch(() => {});
