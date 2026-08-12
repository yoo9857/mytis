/**
 * 시각 자료(도식) — 글의 **실제 데이터**로 그린다.
 *
 * ## 왜 생성 이미지를 쓰지 않는가
 *
 * 차트를 이미지 생성기로 만들면 두 가지가 무너진다.
 *  ① **한글 라벨이 뭉개진다.** 발행 후 이미지를 고칠 수 없으므로 되돌릴 방법이 없다.
 *  ② **숫자를 지어낸다.** 우리는 `figures` 에 기관 출처와 기준일을 붙여 두었는데,
 *     그림이 다른 숫자를 그리면 같은 글 안에서 표와 그림이 어긋난다.
 *
 * ## 왜 이미지가 아니라 HTML 인가
 *
 * 스톡 사진("노트와 펜")은 아무것도 설명하지 않는다. 반면 절차 흐름과 핵심 수치는
 * **글의 뼈대 그 자체**다. 그것을 이미지로 만들면 모바일에서 글자가 작아지고
 * 검색에 잡히지 않는다. HTML 로 그리면 글자가 선택되고, 반응형이고,
 * 업로드가 없으므로 **매번 같은 결과**다 (스톡 검색은 실행마다 달라진다).
 *
 * 색은 eco-m 스킨 토큰을 그대로 쓴다 (`cs.txt` 의 `--c-brand` 계열).
 * 인라인에 리터럴로 박아 두면 **다크에서 판과 글자가 함께 어두워진다** —
 * 그래서 `var(--토큰, 옛값)` 으로 참조한다. 쉼표 뒤 옛값이 있으므로
 * 스킨 CSS 가 없는 에디터 미리보기에서도 리터럴을 박았을 때와 똑같이 나온다
 * (fallback 없는 `var()` 는 빈 값이 되어 검토 화면과 발행 결과가 갈렸었다).
 *
 * flex·grid 를 쓰지 않는다. 티스토리는 기본모드 HTML 입력이 실패하면 위지윅으로
 * 폴백하는데(§7-12), 그 경로가 복잡한 레이아웃을 흘릴 수 있다.
 * `table` 과 `inline-block` 만 쓴다 — 에디터를 가장 잘 통과하는 조합이다.
 */
/* `esc` 를 html.js 에서 가져오지 않는다 — html.js 가 이 파일을 import 하므로
 * 순환 참조가 된다. 다섯 줄을 여기 두는 편이 낫다. */
function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** eco-m 스킨 토큰 (cs.txt) — 쉼표 뒤는 토큰이 없는 스킨·미리보기에서 쓰이는 옛 값 */
const C = {
  brand: 'var(--c-brand, #123a6b)',
  brand2: 'var(--c-brand-2, #1d5296)',
  brandSoft: 'var(--c-brand-soft, #eaf1f9)',
  accent: 'var(--c-accent, #c8322b)',
  ink: 'var(--c-ink, #0f1720)',
  ink2: 'var(--c-ink-2, #3b4756)',
  ink3: 'var(--c-ink-3, #6a7684)',
  line: 'var(--c-line, #e4e8ed)',
  bgSub: 'var(--c-bg-sub, #f5f7f9)',
  bgElev: 'var(--c-bg-elev, #fff)',
  /* 판(brand)이 다크에서 밝은 파랑으로 뒤집히므로 그 위 글자도 뒤집는다 */
  onBrand: 'var(--c-on-brand, #fff)',
};

/** "3단계 · 계약서와 특약을 문장으로 남기기" → { num: '3', label: '계약서와 특약을…' } */
function parseStep(heading) {
  const m = String(heading).match(/^\s*(\d+)\s*단계\s*[·:—-]?\s*(.*)$/);
  return m ? { num: m[1], label: (m[2] || '').trim() } : null;
}

/**
 * 절차 흐름도 — 단계 소제목을 **한눈에 보이는 세로 타임라인**으로 그린다.
 *
 * 목차와 무엇이 다른가: 목차는 이동을 위한 목록이고, 이것은 **순서와 되돌릴 수 없는
 * 지점**을 보여준다. 절차 글에서 독자가 가장 먼저 알고 싶은 것이 그것이다
 * (참고 글 실측 — learned.md 2026-08-03).
 *
 * 단계가 2개 미만이면 그리지 않는다. 흐름이 아닌 것을 흐름처럼 보이게 하면 거짓이다.
 */
export function stepFlow(article, { anchorId = null } = {}) {
  /* 섹션 번호를 함께 들고 간다 — 앵커가 섹션 순서로 붙어 있어서(sec-1, sec-2…)
   * 단계만 골라낸 뒤에는 원래 자리를 알 수 없다. */
  const steps = (article.sections || [])
    .map((s, idx) => {
      const p = parseStep(s.heading);
      return p ? { ...p, idx } : null;
    })
    .filter(Boolean);
  if (steps.length < 2) return '';

  const rows = steps
    .map((st, i) => {
      const last = i === steps.length - 1;
      /* 번호 원과 이어지는 선을 한 칸에 겹쳐 그린다. 선을 따로 두면 위지윅에서
       * 칸이 분리되어 어긋난다. 마지막 단계는 선을 그리지 않는다. */
      const rail =
        `<td width="46" style="padding:0;vertical-align:top;text-align:center;">` +
        `<div style="display:inline-block;width:30px;height:30px;line-height:30px;` +
        `border-radius:15px;background:${C.brand};color:${C.onBrand};font-size:15px;font-weight:800;">${esc(st.num)}</div>` +
        (last
          ? ''
          : `<div style="width:2px;height:26px;margin:2px auto 0;background:${C.line};"></div>`) +
        `</td>`;
      /* 라벨에 앵커 링크를 건다 — 이 흐름도가 **목차를 대체**하기 때문이다.
       * 둘을 함께 두면 같은 6줄이 화면에 두 번 찍힌다 (2026-08-03 검증에서 발각). */
      const label = `<span style="font-size:16px;font-weight:700;color:${C.ink};line-height:1.5;">${esc(st.label)}</span>`;
      const linked = anchorId
        ? `<a href="#${anchorId(st.idx)}" style="text-decoration:none;">${label}</a>`
        : label;
      const body =
        `<td style="padding:4px 0 ${last ? 0 : 22}px 6px;vertical-align:top;">${linked}</td>`;
      return `<tr>${rail}${body}</tr>`;
    })
    .join('\n');

  return (
    `<div style="margin:0 0 36px;padding:22px 24px 24px;background:${C.bgSub};` +
    `border:1px solid ${C.line};border-radius:10px;">` +
    `<span style="display:block;margin:0 0 16px;font-size:13px;font-weight:800;` +
    `letter-spacing:.08em;color:${C.brand2};">전체 순서 ${steps.length}단계</span>` +
    `<table style="width:100%;border-collapse:collapse;border:0;"><tbody>\n${rows}\n</tbody></table>` +
    `</div>`
  );
}

/**
 * 핵심 숫자 카드 — `figures` 에서 **최대 3개**를 뽑아 크게 세운다.
 *
 * 아래쪽 '이 글의 숫자와 출처' 표와 중복이 아니다. 표는 **전부를 검증 가능하게**
 * 늘어놓는 자리이고, 이것은 독자가 스크롤하다 멈추게 하는 자리다.
 * 출처를 카드에도 함께 적는다 — 크게 쓴 숫자에 출처가 없으면 그게 제일 위험하다.
 */
export function keyFigures(article) {
  const rows = (article.figures || [])
    .filter((f) => f?.label && f?.value && f?.source)
    .slice(0, 3);
  if (rows.length < 2) return '';

  const w = Math.floor(100 / rows.length);
  const cells = rows
    .map(
      (f) =>
        `<td width="${w}%" style="padding:16px 14px;vertical-align:top;border-left:1px solid ${C.line};">` +
        `<span style="display:block;font-size:13px;color:${C.ink3};line-height:1.45;margin:0 0 8px;">${esc(f.label)}</span>` +
        `<strong style="display:block;font-size:22px;font-weight:800;color:${C.brand};line-height:1.25;">${esc(f.value)}</strong>` +
        `<span style="display:block;margin-top:8px;font-size:12px;color:${C.ink3};">${esc(f.source)}${
          f.asOf ? ` · ${esc(f.asOf)}` : ''
        }</span></td>`
    )
    .join('\n');

  return (
    `<table style="width:100%;border-collapse:collapse;margin:0 0 34px;` +
    `border:1px solid ${C.line};border-radius:10px;background:${C.bgElev};">` +
    `<tbody><tr>\n${cells}\n</tr></tbody></table>`
  );
}

/**
 * 되돌릴 수 없는 지점 — 절차 글에서 **가장 값이 큰 한 줄**을 따로 세운다.
 *
 * 콜아웃과 다르다. 콜아웃은 단계 안의 주의사항이고, 이것은 글 전체에서
 * "여기를 지나면 못 돌아온다" 는 지점이다. 없으면 그리지 않는다.
 */
export function pointOfNoReturn(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  return (
    `<div style="margin:0 0 34px;padding:18px 22px;background:${C.bgElev};` +
    `border:1px solid ${C.line};border-left:4px solid ${C.accent};border-radius:8px;">` +
    `<span style="display:block;margin:0 0 6px;font-size:12px;font-weight:800;` +
    `letter-spacing:.08em;color:${C.accent};">되돌릴 수 없는 지점</span>` +
    `<span style="font-size:16px;line-height:1.7;color:${C.ink2};">${esc(t)}</span></div>`
  );
}
