/**
 * nodeStyle 스타일 키 실측 — 어떤 키가 에디터 왕복에서 살아남는가.
 *
 * 왜: 본문 중간중간 밑줄·크기 강조를 넣고 싶은데, 지금까지 실측된 키는
 * bold·fontSizeCode 뿐이다. 모르는 키를 넣으면 컴포넌트가 통째로
 * "알 수 없는 컴포넌트" 회색 박스가 될 수 있다 (naver.js injectDocument 머리말).
 * 그래서 발행 없이: 에디터 열기 → 후보 키 주입 → getDocumentData 왕복 →
 * 살아남은 키 확인 → 저장 않고 닫기.
 *
 *   node scripts/probe-nodestyle.mjs
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

    // 후보 키를 하나씩 다른 textNode 에 싣는다 — 한 노드에 몰면 어느 키가 문제인지 모른다
    const candidates = [
      { name: 'bold', style: { bold: true } }, // 대조군 (실측 완료)
      { name: 'underline', style: { underline: true } },
      { name: 'italic', style: { italic: true } },
      { name: 'strikethrough', style: { strikethrough: true } },
      { name: 'strike', style: { strike: true } },
      { name: 'fontColor', style: { fontColor: '#ff0000' } },
      { name: 'backgroundColor', style: { backgroundColor: '#ffff00' } },
      { name: 'fontSizeCode', style: { fontSizeCode: 'fs19' } }, // 대조군
    ];

    const mk = (i) => `probe-${i}-${Math.floor(Math.random() * 1e6)}`;
    const comp = {
      id: mk('c'),
      layout: 'default',
      value: candidates.map((c, i) => ({
        id: mk(`p${i}`),
        nodes: [
          {
            id: mk(`n${i}`),
            value: `[${c.name}] 스타일 실측 문장`,
            style: { ...c.style, '@ctype': 'nodeStyle' },
            '@ctype': 'textNode',
          },
        ],
        '@ctype': 'paragraph',
      })),
      '@ctype': 'text',
    };

    try {
      e.setDocumentData({
        ...cur,
        document: { ...cur.document, components: [...cur.document.components, comp] },
      });
    } catch (err) {
      return { error: String(err).slice(0, 300) };
    }

    // 왕복 — 에디터가 받아들인 형태를 다시 꺼낸다
    const back = e.getDocumentData().document.components;
    const mine = back.filter((c) => c['@ctype'] === 'text' && JSON.stringify(c).includes('스타일 실측 문장'));
    const unknown = back.filter((c) => String(c['@ctype']).toLowerCase().includes('unknown')).length;
    const report = [];
    for (const c of mine) {
      for (const p of c.value || []) {
        for (const n of p.nodes || []) {
          const m = String(n.value).match(/\[(\w+)\]/);
          if (m) report.push({ key: m[1], style: n.style || null });
        }
      }
    }
    return { report, unknown, total: back.length };
  });

  if (result.error) {
    log.error(`주입 자체가 거부됐습니다: ${result.error}`);
  } else {
    log.info(`알 수 없는 컴포넌트: ${result.unknown}개`);
    for (const r of result.report) {
      const kept = r.style ? Object.keys(r.style).filter((k) => k !== '@ctype') : [];
      log.ok(`${r.key.padEnd(16)} → 살아남은 키: ${kept.join(', ') || '(스타일 전부 삭제됨)'}`);
    }
  }
  // 저장하지 않고 닫는다 — 임시저장 팝업이 떠도 무시하고 컨텍스트를 버린다
} finally {
  await ctx.close();
}
