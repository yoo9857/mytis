/**
 * 표 실측 2단계 — **우리가 만든** 표(글자·스타일 포함)가 왕복에서 살아남는가.
 *
 * 1단계(probe-table.mjs)는 에디터가 만든 빈 표를 떠왔다. 이제 그 스키마대로
 * 셀에 문단·굵게·색을 채워 주입하고, 되읽어서 살아남는 것을 확인한다.
 *
 *   node scripts/probe-table2.mjs
 */
import { loadConfig, naverUrls } from '../src/config.js';
import { launchBrowser, firstPage } from '../src/browser.js';
import { ensureLoggedIn } from '../src/naverLogin.js';
import { openEditor } from '../src/naver.js';
import { log } from '../src/log.js';

const cfg = loadConfig();
cfg.browser.headless = true;
const urls = naverUrls(cfg);

const ctx = await launchBrowser(cfg);
try {
  const page = await firstPage(ctx);
  await ensureLoggedIn(page, cfg, urls, { interactive: false });
  await openEditor(page, urls);

  const result = await page.evaluate(() => {
    const e = window.__seEd();
    const cur = e.getDocumentData();
    let n = 0;
    const mk = () => `probe-t-${++n}-${Math.floor(Math.random() * 1e6)}`;
    const para = (v, style) => ({
      id: mk(),
      nodes: [{ id: mk(), value: v, ...(style ? { style: { ...style, '@ctype': 'nodeStyle' } } : {}), '@ctype': 'textNode' }],
      style: { align: 'center', '@ctype': 'paragraphStyle' },
      '@ctype': 'paragraph',
    });
    const cell = (paras, width) => ({
      id: mk(), colSpan: 1, rowSpan: 1, width, height: 43,
      value: paras, '@ctype': 'tableCell',
    });
    const table = {
      id: mk(), layout: 'default', width: 100,
      rows: [
        { cells: [cell([para('시점', { bold: true })], 30), cell([para('내용', { bold: true })], 70)], '@ctype': 'tableRow' },
        { cells: [cell([para('2025. 10. 24.', { bold: true })], 30), cell([para('투어 불참 공지'), para('건강 관련 사유', { fontColor: '#8c8c8c', fontSizeCode: 'fs13' })], 70)], '@ctype': 'tableRow' },
      ],
      columnCount: 2, borderStyleName: 'thinLine', '@ctype': 'table',
    };
    try {
      e.setDocumentData({ ...cur, document: { ...cur.document, components: [...cur.document.components, table] } });
    } catch (err) {
      return { error: String(err).slice(0, 300) };
    }
    const back = e.getDocumentData().document.components;
    const t = back.find((c) => c['@ctype'] === 'table');
    const unknown = back.filter((c) => String(c['@ctype']).toLowerCase().includes('unknown')).length;
    if (!t) return { error: '표가 왕복에서 사라짐', unknown, types: back.map((c) => c['@ctype']) };
    const texts = [];
    for (const r of t.rows) for (const c of r.cells) for (const p of c.value || []) for (const nd of p.nodes || [])
      texts.push({ v: nd.value, style: nd.style ? Object.keys(nd.style).filter((k) => k !== '@ctype') : [] });
    return { unknown, columnCount: t.columnCount, border: t.borderStyleName, widths: t.rows[0].cells.map((c) => c.width), texts };
  });

  if (result.error) log.error(`실패: ${result.error} ${JSON.stringify(result.types || [])}`);
  else {
    log.info(`알 수 없는 컴포넌트: ${result.unknown}개 · 열 ${result.columnCount} · 테두리 ${result.border} · 폭 ${JSON.stringify(result.widths)}`);
    for (const t of result.texts) log.ok(`"${t.v}" → 스타일: ${t.style.join(', ') || '없음'}`);
  }
} finally {
  await ctx.close();
}
