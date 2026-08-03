/**
 * 아티클 JSON -> 티스토리 에디터에 넣을 HTML.
 * 스킨에 상관없이 동일하게 보이도록 핵심 요소는 인라인 스타일을 쓴다.
 */
/* 시각 자료(절차 흐름도·핵심 숫자 카드)는 diagram.js 가 그린다.
 * 그쪽은 esc 를 자체로 갖고 있다 — 여기서 가져가면 순환 참조가 된다. */
import { stepFlow, keyFigures } from './diagram.js';

/**
 * 본문 인라인 스타일.
 *
 * 티스토리 스킨 CSS 가 제목 태그의 굵기·크기를 초기화해 버리는 경우가 많아
 * (실제로 h2 가 font-weight:400 으로 렌더링됨) **px 과 font-weight 를 반드시 명시**한다.
 * em 을 쓰면 스킨의 본문 크기에 휘둘려 제목이 본문과 구분되지 않는다.
 */
const S = {
  answer:
    'margin:0 0 30px;padding:22px 24px;background:#f4f6ff;border-left:5px solid #4c1d95;' +
    'border-radius:8px;font-size:17px;line-height:1.8;color:#1f2937;',
  takeaways:
    'margin:0 0 34px;padding:22px 26px;background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;',
  boxTitle: 'display:block;margin:0 0 12px;font-size:18px;font-weight:800;color:#111;',
  toc: 'margin:0 0 36px;padding:20px 24px;background:#fbfbfb;border:1px solid #ececec;border-radius:8px;',
  tocList: 'margin:0;padding-left:20px;font-size:16px;line-height:2;color:#333;',
  h2:
    'margin:54px 0 18px;padding-bottom:12px;border-bottom:3px solid #222;' +
    'font-size:28px;font-weight:800;line-height:1.35;color:#111;letter-spacing:-0.02em;',
  h3: 'margin:34px 0 12px;font-size:21px;font-weight:700;line-height:1.45;color:#111;',
  p: 'margin:0 0 18px;font-size:17px;line-height:1.85;color:#222;',
  ul: 'margin:0 0 22px;padding-left:24px;font-size:17px;line-height:1.9;color:#222;',
  table: 'width:100%;border-collapse:collapse;margin:10px 0 26px;font-size:16px;',
  th:
    'border:1px solid #ddd;background:#f5f5f5;padding:11px 13px;text-align:left;' +
    'font-weight:700;font-size:16px;color:#111;',
  td: 'border:1px solid #ddd;padding:11px 13px;vertical-align:top;font-size:16px;color:#222;',
  caption: 'caption-side:top;text-align:left;padding:0 0 9px;color:#666;font-size:15px;font-weight:600;',
  callout:
    'margin:0 0 26px;padding:16px 20px;background:#fff8e1;border-left:4px solid #f59e0b;' +
    'border-radius:6px;font-size:16px;line-height:1.75;color:#3f3f46;',
  figure: 'margin:30px 0;text-align:center;',
  figcap: 'margin-top:9px;color:#777;font-size:15px;',
  faqQ: 'margin:28px 0 10px;font-size:19px;font-weight:700;line-height:1.5;color:#111;',
  faqA: 'margin:0 0 10px;font-size:17px;line-height:1.8;color:#333;',
  sources: 'margin:0;padding-left:24px;font-size:15px;line-height:1.95;color:#555;',
  hr: 'margin:44px 0;border:0;border-top:1px solid #e5e5e5;',

  /* --- 절차형 글(경제·부동산) 전용 --------------------------------------
   * 참고 글 실측(2026-08-03, hye_life 집 구하기): 4,499자에 사진 1장이었고
   * 대신 **구분선 9개**로 단계를 갈랐다. 절차 글에서 독자가 원하는 것은
   * 사진이 아니라 **자기가 몇 단계에 있는지**다 (learned.md 2026-08-03). */
  stepDiv: 'margin:52px 0 0;border:0;border-top:1px solid #ececec;',
  /* 색은 eco-m 스킨 토큰 `--c-brand`(#123a6b)에 맞춘다 — diagram.js 의 흐름도 원과
   * **같은 색이어야 한다.** 같은 뜻(단계 번호)이 두 색으로 나오면 독자는 둘을
   * 다른 것으로 읽는다 (2026-08-03 검증에서 보라/네이비로 갈려 있던 것을 발견).
   * 이 배지는 "N단계" 소제목에만 붙으므로 경제 모드 밖에는 영향이 없다. */
  stepBadge:
    'display:inline-block;min-width:30px;height:30px;line-height:30px;margin-right:10px;' +
    'border-radius:15px;background:#123a6b;color:#fff;font-size:16px;font-weight:800;' +
    'text-align:center;vertical-align:2px;padding:0 9px;',
  checkBox:
    'margin:0 0 26px;padding:18px 22px;background:#f6fbf7;border:1px solid #cfe8d6;' +
    'border-radius:8px;',
  checkTitle: 'display:block;margin:0 0 10px;font-size:16px;font-weight:800;color:#14532d;',
  checkList: 'margin:0;padding-left:22px;font-size:16px;line-height:1.9;color:#1f2937;',
  siteWrap: 'margin:0 0 34px;',
  siteCard:
    'display:block;margin:0 0 10px;padding:15px 18px;border:1px solid #e5e7eb;border-radius:9px;' +
    'background:#fff;text-decoration:none;',
  siteName: 'display:block;font-size:17px;font-weight:700;color:#1d4ed8;margin:0 0 4px;',
  siteWhy: 'display:block;font-size:15px;line-height:1.6;color:#4b5563;',
  figTable: 'width:100%;border-collapse:collapse;margin:0 0 12px;font-size:15px;',
  figTh:
    'border-bottom:2px solid #e5e7eb;padding:9px 10px;text-align:left;font-size:14px;' +
    'font-weight:700;color:#6b7280;',
  figTd: 'border-bottom:1px solid #f0f0f0;padding:9px 10px;vertical-align:top;color:#222;',
};

/** 티스토리 에디터가 쓰는 글자 크기 힌트. 에디터에서 다시 열었을 때도 제목으로 인식된다. */
const KE = { h2: 'size26', h3: 'size20', p: 'size16' };

export function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 산문용 — 이스케이프한 뒤 **굵게** 만 태그로 바꾼다.
 *
 * 왜 필요한가: 경제 모드 지시문이 "숫자와 기한, 되돌릴 수 없는 지점을 굵게" 라고
 * 시킨다. 모델은 그것을 마크다운 `**...**` 으로 보내는데, `esc()` 만 거치면
 * **별표가 그대로 화면에 남는다.** 강조를 지시하면서 렌더를 안 하면 지시가
 * 오히려 글을 더럽힌다 (2026-08-03 합성 글 검증에서 발각).
 *
 * 굵게만 허용한다 — 이탤릭·링크·코드까지 열면 모델이 표를 마크다운으로 그리기 시작하고
 * 그건 `renderTable` 과 싸운다. 소제목·표 셀에는 쓰지 않는다(제목에 굵게는 이미 굵다).
 */
function rich(text) {
  return esc(text).replace(/\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*/g, '<b>$1</b>');
}

function anchorId(index) {
  return `sec-${index + 1}`;
}

function renderTable(table) {
  if (!table?.headers?.length || !table?.rows?.length) return '';
  const cap = table.caption
    ? `<caption style="${S.caption}">${esc(table.caption)}</caption>`
    : '';
  const head = table.headers.map((h) => `<th style="${S.th}">${esc(h)}</th>`).join('');
  const body = table.rows
    .map((row) => {
      const cells = table.headers
        .map((_, i) => `<td style="${S.td}">${esc(row[i] ?? '')}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('\n');
  return `<table style="${S.table}">${cap}<thead><tr>${head}</tr></thead><tbody>\n${body}\n</tbody></table>`;
}

/**
 * 이미지 블록.
 * placeholder 가 있으면 발행 단계에서 티스토리 이미지 매크로로 치환되므로
 * 매크로를 감싸지 않고 단독 줄로 내보내고 캡션만 따로 붙인다.
 */
/**
 * 사진 두 장을 **나란히** 붙인다 (1·2·2·1 리듬용).
 *
 * 왜 필요한가: 사진을 많이 쓰는 글에서 한 장씩 세로로 세우면 글이 끝없이 길어진다.
 * 네이버는 `imageGroup` 으로 이미 묶는데(`naverDoc.js`) 티스토리에는 없었다.
 *
 * ⚠️ 티스토리는 `{{IMAGE_i}}` 를 **자체 매크로**(`[##_Image|…|_##]`)로 치환하고,
 * 그 매크로를 에디터가 다시 펼친다. 그래서 매크로를 감싼 마크업이 저장·발행을
 * 거쳐 살아남는지는 **실측해야 안다.** (⑦-2: 티스토리 sanitizer 는 `<iframe>` 의
 * style 을 지우지만 `<div>` 의 인라인 style 은 남긴다 — 그 사실에 기대를 걸고 재본다)
 *
 * 표를 쓰는 이유: flex 는 티스토리 본문 폭 계산과 부딪힐 수 있고, 표는 메일 HTML
 * 시절부터 가장 잘 살아남는 2열 배치 수단이다.
 */
function renderFigurePair(imgs) {
  const cells = imgs
    .map((img) => {
      const body = img.placeholder
        ? img.placeholder
        : img.src
          ? `<img src="${esc(img.src)}" alt="${esc(img.alt || '')}" style="max-width:100%;height:auto;border-radius:8px;" />`
          : '';
      const cap = img.caption
        ? `<p style="text-align:center;${S.figcap}">${esc(img.caption)}</p>`
        : '';
      return `<td style="width:50%;vertical-align:top;padding:0 4px;text-align:center;">${body}${cap}</td>`;
    })
    .join('');
  return `<table style="width:100%;border:0;border-collapse:collapse;margin:18px 0;"><tbody><tr>${cells}</tr></tbody></table>`;
}

/** 한 자리에 모인 사진들을 리듬에 맞춰 낸다 (2장이면 나란히, 그 밖엔 한 장씩) */
function renderFigureRun(imgs) {
  if (!imgs?.length) return '';
  if (imgs.length === 2) return renderFigurePair(imgs);
  return imgs.map(renderFigure).join('\n');
}

function renderFigure(img) {
  if (!img) return '';

  if (img.placeholder) {
    const cap = img.caption
      ? `<p style="text-align:center;${S.figcap}">${esc(img.caption)}</p>`
      : '';
    return `<p style="text-align:center;">${img.placeholder}</p>${cap}`;
  }

  if (!img.src) return '';
  const cap = img.caption
    ? `<figcaption style="${S.figcap}">${esc(img.caption)}</figcaption>`
    : '';
  return `<figure style="${S.figure}"><img src="${esc(img.src)}" alt="${esc(
    img.alt || ''
  )}" style="max-width:100%;height:auto;border-radius:8px;" />${cap}</figure>`;
}

/**
 * 공식 유튜브 임베드.
 * 영상을 내려받아 올리는 게 아니라 유튜브 플레이어를 그대로 띄우는 방식이라
 * 저작권 문제가 없고, 원본이 내려가면 임베드도 함께 사라진다.
 */
function renderEmbed(embed) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(embed?.videoId || '')) return '';
  const caption = [embed.title, embed.channel].filter(Boolean).join(' · ');
  // 장면 지정 재생: ?start=초. 자막에서 확인한 지점만 들어온다(ytClip.snapTimestamps).
  const start = Math.max(0, parseInt(embed.startSeconds, 10) || 0);
  const q = start ? `?start=${start}` : '';
  const at = start ? `${Math.floor(start / 60)}:${String(start % 60).padStart(2, '0')}` : '';
  // 주의: 티스토리는 저장할 때 **<iframe> 의 style 속성을 지운다.**
  // (2026-07-27 실측: 발행된 글에서 iframe 의 inline style 이 null 이었다)
  // 그래서 style 만 믿으면 iframe 이 기본 크기 300×225(4:3)로 쪼그라들어
  // 검은 16:9 박스 안에 작은 화면이 뜬다.
  // → width/height **속성**을 함께 주고(속성은 남는다), 최종 채움은 스킨 CSS
  //   (`#article-view div[style*="padding-bottom:56.25%"] > iframe`)가 담당한다.
  // 장면 설명 + 실제 대사. 캡처 사진 대신 이 조합이 같은 정보를 준다.
  const sceneNote = embed.caption
    ? `<p style="margin:0 0 10px;font-size:17px;line-height:1.75;color:#222;font-weight:600;">${
        at ? `<span style="color:#4c1d95;">${at}</span> ` : ''
      }${esc(embed.caption)}</p>`
    : '';
  const quote = embed.quote
    ? `<blockquote style="margin:12px 0 0;padding:14px 18px;background:#f4f6ff;` +
      `border-left:4px solid #4c1d95;border-radius:6px;font-size:16px;line-height:1.7;color:#1f2937;">` +
      `“${esc(embed.quote)}”</blockquote>`
    : '';

  return `<div style="margin:28px 0;">
  ${sceneNote}
  <div class="sk-embed" style="position:relative;width:100%;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:8px;background:#000;">
    <iframe src="https://www.youtube.com/embed/${esc(embed.videoId)}${q}"
      width="1280" height="720"
      style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"
      title="${esc(embed.title || 'YouTube video')}"
      loading="lazy" allowfullscreen
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
  </div>
  ${caption ? `<p style="${S.figcap}text-align:center;margin-top:8px;">▶ ${esc(caption)}${at ? ` · ${at}부터` : ''}</p>` : ''}
  ${quote}
</div>`;
}

/**
 * 공식 SNS(X·인스타그램) 게시물 임베드.
 *
 * 사진을 내려받아 올리는 게 아니라 **원저작자 서버의 게시물을 그대로 띄운다.**
 * 그래서 저작권·약관 문제가 없고, 원본이 지워지면 임베드도 함께 사라진다.
 * (근황 사진을 합법적으로 보여주는 유일한 방법 — HANDOVER 6장)
 *
 * 크기 처리에 주의할 점이 유튜브와 다르다.
 * - 티스토리는 `<iframe>` 의 **style 속성을 지운다** (HANDOVER ⑦-2 실측).
 *   그래서 style 에만 크기를 걸면 300×225 로 쪼그라든다.
 * - SNS 게시물은 16:9 가 아니고 높이가 내용마다 다르므로 `padding-bottom` 비율
 *   트릭을 쓸 수 없다. **감싸는 div 에 고정 높이**를 주고(div 의 inline style 은 남는다),
 *   iframe 은 width/height **속성**으로 버티게 한 뒤 최종 채움은 스킨 CSS
 *   (`#article-view .sk-social > iframe`)가 담당한다.
 * - 스크립트 임베드(widgets.js·embed.js)는 티스토리가 `<script>` 를 지울 수 있어
 *   쓰지 않는다. 둘 다 **스크립트 없이 iframe 만으로 되는 주소**가 있다.
 */
function renderSocialEmbed(em) {
  const platform = em?.platform;
  let src = '';
  let label = '';
  let height = 0;

  if (platform === 'x' && /^\d{10,25}$/.test(String(em.postId || ''))) {
    // widgets.js 가 내부적으로 띄우는 것과 같은 주소
    src = `https://platform.twitter.com/embed/Tweet.html?dnt=true&id=${esc(em.postId)}`;
    label = `X @${em.handle || ''}`;
    height = 640;
  } else if (platform === 'instagram' && /^[A-Za-z0-9_-]{5,20}$/.test(String(em.postId || ''))) {
    src = `https://www.instagram.com/p/${esc(em.postId)}/embed/`;
    label = `Instagram @${em.handle || ''}`;
    height = 760;
  } else {
    return '';
  }

  const who = [em.author, em.handle && `@${em.handle}`].filter(Boolean).join(' · ');
  const caption = `${platform === 'x' ? '𝕏' : '📷'} ${esc(who || label)} 공식 게시물`;

  return `<div style="margin:28px 0;">
  <div class="sk-social" style="position:relative;width:100%;max-width:550px;height:${height}px;margin:0 auto;overflow:hidden;border-radius:8px;">
    <iframe src="${src}"
      width="550" height="${height}"
      style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"
      title="${esc(label)}"
      loading="lazy" scrolling="no" frameborder="0"
      allowtransparency="true" allow="encrypted-media"></iframe>
  </div>
  <p style="${S.figcap}text-align:center;margin-top:8px;">${caption}</p>
</div>`;
}

/**
 * 영상 글의 맨 아래에 두는 **원본 영상 링크**.
 *
 * 왜 플레이어가 아니라 링크인가:
 *   영상 글에는 이미 장면 캡처가 20장쯤 실린다. 독자는 무슨 일이 있었는지
 *   다 본 상태이고, 하단 영상은 "직접 확인하고 싶은 사람" 을 위한 출처다.
 *
 *   게다가 플레이어는 깨질 수 있다. 임베드가 막힌 영상이거나 origin 이
 *   허용되지 않으면 유튜브가 **"오류 153 · 동영상 플레이어 구성 오류"** 를
 *   띄운다. 글 맨 아래에 빨간 오류 박스가 남는 것보다 링크 한 줄이 낫다.
 *   (미리보기를 file:// 로 열면 origin 이 null 이라 반드시 이 오류가 난다)
 */
function renderVideoLink(em) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(em?.videoId || '')) return '';
  const url = `https://www.youtube.com/watch?v=${esc(em.videoId)}`;
  const who = em.channel ? `${esc(em.channel)} 공식 영상` : '공식 영상';
  return `<div style="margin:32px 0;padding:18px 20px;border:1px solid #e5e7eb;border-radius:10px;background:#fafafa;">
  <p style="margin:0 0 8px;font-size:15px;color:#666;">${who}</p>
  <p style="margin:0;font-size:17px;line-height:1.6;">
    <a href="${url}" target="_blank" rel="noopener" style="color:#4c1d95;font-weight:700;text-decoration:none;">▶ ${esc(em.title || '유튜브에서 원본 보기')}</a>
  </p>
</div>`;
}

/** CC 라이선스 사진은 저작자·라이선스 표기가 의무다. 본문 하단에 모아서 남긴다. */
function renderImageCredits(credits) {
  if (!credits.length) return '';

  /* 같은 출처는 한 줄로 묶는다.
   *
   * 영상 글은 사진이 20장이고 전부 같은 영상에서 캡처한 것이라, 그대로 늘어놓으면
   * "YouTube · broadcast still · 원본 보기" 가 **20번 반복**돼 독자에게 방해만 된다.
   * 저작자 표기 의무는 출처를 한 번 밝히면 충족된다. */
  const merged = new Map();
  for (const c of credits) {
    const who = c.photographer || c.credit || '작자 미상';
    const key = `${who}|${c.license || ''}|${c.pageUrl || ''}`;
    const cur = merged.get(key);
    if (cur) cur.count++;
    else merged.set(key, { ...c, who, count: 1 });
  }

  const items = [...merged.values()]
    .map((c) => {
      const lic = c.license ? ` · ${esc(c.license)}` : '';
      const many = c.count > 1 ? ` · 사진 ${c.count}장` : '';
      const link = c.pageUrl
        ? `<a href="${esc(c.pageUrl)}" target="_blank" rel="noopener nofollow">원본 보기</a>`
        : '';
      return `<li>${esc(c.who)}${lic}${many}${link ? ` · ${link}` : ''}</li>`;
    })
    .join('\n');
  return `<h3 data-ke-size="${KE.h3}" style="${S.h3}">이미지 출처</h3>
<ul style="${S.sources}">
${items}
</ul>`;
}

function jsonLd(article, cfg) {
  const blocks = [];

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.seoTitle || article.title,
    description: article.metaDescription,
    keywords: [article.primaryKeyword, ...article.secondaryKeywords].filter(Boolean).join(', '),
    datePublished: (article.generatedAt || new Date().toISOString()).slice(0, 10),
    inLanguage: cfg.article.language === 'ko' ? 'ko-KR' : cfg.article.language,
  };
  if (article.sources.length) {
    articleLd.citation = article.sources.map((s) => ({
      '@type': 'CreativeWork',
      name: s.title,
      url: s.url,
    }));
  }
  blocks.push(articleLd);

  if (cfg.seo.includeFaq && article.faq.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: article.faq.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }

  return blocks
    .map(
      (b) =>
        `<script type="application/ld+json">${JSON.stringify(b).replace(/</g, '\\u003c')}</script>`
    )
    .join('\n');
}

/**
 * @param {object} article  normalizeArticle 결과
 * @param {object} opts
 * @param {object} opts.cfg
 * @param {object} [opts.images]  { thumbnail: {src,alt}, body: [{afterSection,src,alt,caption}] }
 */
/**
 * "3단계 · 가계약과 본계약" 같은 소제목에 **번호 배지와 구분선**을 붙인다.
 *
 * 왜: 절차 글에서 독자가 가장 먼저 알고 싶은 것은 자기가 몇 단계에 있는지다.
 * 참고 글(hye_life)은 구분선 9개로 그것을 했고 사진은 1장뿐이었다.
 * 단계 글이 아니면 아무 것도 하지 않으므로 다른 모드는 영향이 없다.
 */
function renderHeading(heading, id) {
  const m = String(heading).match(/^\s*(\d+)\s*단계\s*[·:—-]?\s*(.*)$/);
  if (!m) {
    return `<h2 id="${id}" data-ke-size="${KE.h2}" style="${S.h2}">${esc(heading)}</h2>`;
  }
  const [, num, rest] = m;
  return (
    `<hr style="${S.stepDiv}" />` +
    `<h2 id="${id}" data-ke-size="${KE.h2}" style="${S.h2}">` +
    `<span style="${S.stepBadge}">${esc(num)}</span>${esc(rest || heading)}</h2>`
  );
}

/**
 * '직접 확인할 곳' — 기관 조회 페이지 링크 카드.
 *
 * 참고 글의 **진짜 실용성이 여기 있었다**: 공인중개사인지 중개보조인인지 조회하는
 * 페이지, 등기사건 처리현황을 보는 페이지를 링크 카드로 걸어 두었다.
 * "확인하세요" 라고 쓰는 것과 **확인할 주소를 주는 것**은 다르다.
 */
function checkSitesBlock(sites) {
  const rows = (sites || []).filter((s) => s?.name && /^https?:\/\//i.test(s.url || ''));
  if (!rows.length) return '';
  const cards = rows
    .map(
      (s) =>
        `<a href="${esc(s.url)}" target="_blank" rel="noopener" style="${S.siteCard}">` +
        `<span style="${S.siteName}">${esc(s.name)}</span>` +
        `<span style="${S.siteWhy}">${esc(s.why || '')}</span></a>`
    )
    .join('\n');
  return (
    `<h2 data-ke-size="${KE.h2}" style="${S.h2}">직접 확인할 곳</h2>` +
    `<div style="${S.siteWrap}">\n${cards}\n</div>`
  );
}

/**
 * `figures` — 본문 수치와 출처·기준일의 짝을 **표로 보여준다.**
 *
 * 필드만 만들어 두고 그리지 않으면 약속이 지켜진 것이 아니다. 소개글에서
 * 독자에게 "숫자에는 출처와 기준일을 붙인다" 고 했고, 독자가 그것을 볼 자리가 여기다.
 * (2026-08-03: econ 스키마에 figures 를 넣고도 화면에 없던 것을 발각)
 */
function figuresBlock(figures, asOf) {
  const rows = (figures || []).filter((f) => f?.label && f?.value && f?.source);
  if (!rows.length) return '';
  const body = rows
    .map(
      (f) =>
        `<tr><td style="${S.figTd}">${esc(f.label)}</td>` +
        `<td style="${S.figTd}font-weight:700;">${esc(f.value)}</td>` +
        `<td style="${S.figTd}">${esc(f.source)}</td>` +
        `<td style="${S.figTd}color:#6b7280;">${esc(f.asOf || '')}</td></tr>`
    )
    .join('\n');
  return (
    `<h2 data-ke-size="${KE.h2}" style="${S.h2}">이 글의 숫자와 출처</h2>` +
    `<table style="${S.figTable}"><thead><tr>` +
    `<th style="${S.figTh}">항목</th><th style="${S.figTh}">값</th>` +
    `<th style="${S.figTh}">출처</th><th style="${S.figTh}">기준</th>` +
    `</tr></thead><tbody>\n${body}\n</tbody></table>` +
    `<p style="${S.figcap}">제도·세율·금리는 바뀝니다.${
      asOf ? ` 이 글은 ${esc(asOf)} 기준입니다.` : ''
    } 실제 결정 전에는 위 기관의 최신 공고를 확인하세요.</p>`
  );
}

export function buildHtml(article, { cfg, images = {}, imageCredits = [] }) {
  const out = [];
  const bodyImages = images.body || [];
  const embeds = cfg.seo.includeEmbeds === false ? [] : article.embeds || [];
  const socials = cfg.social?.enabled === false ? [] : article.socialEmbeds || [];

  // 대표 이미지 (본문 맨 위 = 티스토리 대표 이미지 후보)
  if (images.thumbnail?.src || images.thumbnail?.placeholder) {
    out.push(renderFigure(images.thumbnail));
  }

  // 직답 박스 (GEO 핵심)
  if (article.directAnswer) {
    out.push(
      `<div style="${S.answer}"><span style="${S.boxTitle}">한 줄 정리</span>${rich(
        article.directAnswer
      )}</div>`
    );
  }

  // 핵심 요약
  if (cfg.seo.includeKeyTakeaways && article.keyTakeaways.length) {
    const items = article.keyTakeaways.map((t) => `<li>${rich(t)}</li>`).join('\n');
    out.push(
      `<div style="${S.takeaways}"><span style="${S.boxTitle}">이 글의 핵심</span>` +
        `<ul style="${S.ul}margin-bottom:0;">\n${items}\n</ul></div>`
    );
  }

  /* 절차 흐름도 — **목차보다 먼저 계산한다.** 흐름도가 나오면 목차를 끈다.
   * 둘은 같은 정보를 두 번 보여준다 (목차 6줄 + 흐름도 6줄). 흐름도 쪽이 순서를
   * 보여주고 링크도 걸려 있으므로 목차의 일을 겸한다. */
  /* 순서를 보여주는 자리는 **글 하나에 하나만** 둔다.
   *
   * 후보가 셋이나 된다: ① 대표 이미지로 쓰는 흐름도 카드(infographic.js),
   * ② HTML 흐름도(diagram.js), ③ 목차. 셋이 같은 6줄을 보여주므로 하나만 남긴다.
   * 우선순위는 ① > ② > ③ — 그림이 가장 잘 보이고, 그림이 없으면 HTML 흐름도가
   * 링크까지 갖고 있어 목차의 일을 겸한다. */
  const stepCardUsed = images.thumbnail?.isStepCard === true;
  const flow = stepCardUsed ? '' : stepFlow(article, { anchorId });
  const orderAlreadyShown = stepCardUsed || !!flow;

  // 목차 — 섹션 제목에 걸어둔 id 로 이동한다. 순서를 이미 보여줬으면 생략한다.
  if (!orderAlreadyShown && cfg.seo.includeTableOfContents && article.sections.length >= 3) {
    const items = article.sections
      .map(
        (s, i) =>
          `<li><a href="#${anchorId(i)}" style="color:#4c1d95;text-decoration:none;">${esc(
            s.heading
          )}</a></li>`
      )
      .join('\n');
    out.push(
      `<div style="${S.toc}"><span style="${S.boxTitle}">목차</span>` +
        `<ol style="${S.tocList}">\n${items}\n</ol></div>`
    );
  }

  /* 시각 자료 — **글의 실제 데이터로 그린다** (src/diagram.js).
   *
   * 목차 바로 아래에 둔다. 목차는 이동을 위한 목록이고 흐름도는 순서를 보여주는
   * 그림이라 나란히 있어야 한다. 절차 글이 아니거나 figures 가 없으면 빈 문자열이
   * 되어 filter(Boolean) 이 걸러낸다 — 다른 모드는 영향이 없다.
   *
   * 스톡 사진과 역할이 다르다: 사진은 읽는 호흡의 쉼표이고, 이 도식은 정보다.
   * "노트와 펜" 사진은 아무것도 설명하지 않지만 6단계 흐름도는 글의 뼈대다. */
  out.push(flow);
  out.push(keyFigures(article));

  // 본문 섹션
  article.sections.forEach((sec, i) => {
    out.push(renderHeading(sec.heading, anchorId(i)));

    /* 사진을 **문단 사이에 끼워 넣는다.**
     *
     * 예전에는 섹션의 문단을 전부 쓴 뒤 사진을 몰아서 붙였다. 한 섹션에
     * 사진이 두세 장이면 캡션이 줄줄이 쌓여 목록처럼 보이고, 사진 아래로
     * 글이 이어지지 않아 읽는 흐름이 끊긴다.
     *
     * 사진 → 이어지는 글 → 사진 → 이어지는 글 순서가 되도록 문단 사이에
     * 고르게 흩뿌린다. 마지막 문단 뒤에는 두지 않는다 — 그러면 다음 소제목과
     * 사진이 붙어 다시 몰린 것처럼 보인다. */
    const mine = bodyImages.filter((b) => b.afterSection === i + 1);

    /* 사진을 **묶음**으로 만든 뒤 자리를 잡는다.
     *
     * ① `group` 이 같은 사진끼리 묶는다 (아티클이 지정 — 연관 있는 두 컷).
     * ② 지정이 없으면 **1·2·2·1 리듬**을 돌린다. 사진을 많이 쓰는 글에서
     *    한 장씩 세우면 글이 끝없이 길어진다 (naverDoc 이 쓰는 것과 같은 리듬).
     *    사진이 3장 이하면 리듬을 쓰지 않는다 — 억지로 붙이면 어울리지 않는 두 컷이
     *    나란히 선다. */
    /* 자동 묶기 여부. 기본은 꺼짐 — 네이버(`naver.collage`)와 같은 기본값이다. */
    const collage = cfg.blog?.collage === true;
    const runs = [];
    if (mine.some((b) => b.group)) {
      const byGroup = new Map();
      for (const img of mine) {
        const key = img.group || `__${runs.length}_${byGroup.size}`;
        if (!byGroup.has(key)) {
          byGroup.set(key, []);
          runs.push(byGroup.get(key));
        }
        byGroup.get(key).push(img);
      }
    } else if (!collage || mine.length === 1) {
      /* **기본은 한 장씩이다.** 자동 묶기는 `blog.collage` 를 켜야 돈다.
       *
       * 한때 섹션에 온 장수를 그대로 존중해(홀수면 첫 장 단독, 나머지 짝) 무조건 묶었다.
       * 영화 글에서 사진을 나란히 붙이려고 그렇게 고친 것인데, `html.js` 는 모드를 보지
       * 않으므로 **다른 모드까지 전부 묶여 버렸다.**
       *
       * > 2026-08-02 사용자 지적 — 영상(클립) 글은 사진을 이어붙이는 양식이 아닌데
       * >   2열 표가 8개 나왔다. 8절에 사진 8장이 몰려 4쌍이 붙었다.
       *
       * 그리고 두 플랫폼의 기본값이 **반대**였다. 네이버는 `naver.collage` 기본 false 로
       * 자동 묶기가 꺼져 있고 `group` 지정만 묶는데, 티스토리만 무조건 묶었다.
       * "규칙이 플랫폼마다 다르면 글쓴이가 결과를 예측할 수 없다" 고 적어 두고
       * 정작 반대 방향으로 맞춘 셈이다 — 네이버와 같게 되돌린다.
       *
       * 나란히 붙이려면 아티클이 `imageBriefs[].group` 으로 **어느 두 장을** 붙일지
       * 지정한다. 관계없는 두 장이 붙으면 둘 다 죽기 때문에 코드가 임의로 정하지 않는다. */
      for (const img of mine) runs.push([img]);
    } else {
      /* `collage` 를 켠 글만 — 섹션에 온 장수를 존중한다(홀수면 첫 장 단독, 나머지 짝). */
      let at = 0;
      if (mine.length % 2 === 1) runs.push([mine[at++]]);
      while (at < mine.length) {
        runs.push(mine.slice(at, at + 2));
        at += 2;
      }
    }

    const gaps = Math.max(1, sec.paragraphs.length - 1); // 문단 사이 자리 수
    const slot = new Map();
    runs.forEach((run, k) => {
      // 자리를 고르게 나눈다. (묶음 3개·문단 4개 → 1·2·3번 문단 뒤)
      const at = Math.min(
        gaps,
        Math.max(1, Math.round(((k + 1) * (gaps + 1)) / (runs.length + 1)))
      );
      if (!slot.has(at)) slot.set(at, []);
      slot.get(at).push(run);
    });

    sec.paragraphs.forEach((para, pi) => {
      out.push(`<p data-ke-size="${KE.p}" style="${S.p}">${rich(para)}</p>`);
      for (const run of slot.get(pi + 1) || []) out.push(renderFigureRun(run));
    });

    if (sec.bullets.length) {
      const items = sec.bullets.map((b) => `<li>${rich(b)}</li>`).join('\n');
      /* 단계 글의 불릿은 **'확인할 것' 박스**로 감싼다 — 절차에서 독자가 손해를 보는
       * 지점은 순서가 아니라 각 단계에서 빠뜨린 확인이다. 참고 글은 이것을
       * 인용 박스로 했다(learned.md 2026-08-03). 단계 글이 아니면 평범한 목록. */
      if (/^\s*\d+\s*단계/.test(sec.heading)) {
        out.push(
          `<div style="${S.checkBox}"><span style="${S.checkTitle}">이 단계에서 확인할 것</span>` +
            `<ul style="${S.checkList}">\n${items}\n</ul></div>`
        );
      } else {
        out.push(`<ul style="${S.ul}">\n${items}\n</ul>`);
      }
    }
    const table = renderTable(sec.table);
    if (table) out.push(table);
    if (sec.callout) {
      out.push(`<div style="${S.callout}">💡 ${rich(sec.callout)}</div>`);
    }

    /* 묶음은 전부 자리를 받는다 (`at` 이 항상 1..gaps 로 떨어지고 slot 이 쌓는다).
     * 예전에는 "자리를 못 잡은 것" 을 섹션 끝에 다시 넣었는데, 묶음 단위로 바뀐 뒤
     * 그 계산이 **묶음 수로 이미지 배열을 자르는** 꼴이 되어 사진이 중복된다.
     * 남는 것이 없으므로 지운다 — 필요해지면 묶음 기준으로 다시 세야 한다. */
    // 이 섹션 뒤에 붙는 공식 영상 임베드
    for (const em of embeds.filter((e) => e.afterSection === i + 1)) {
      out.push(renderEmbed(em));
    }
    // 공식 SNS 근황 게시물
    for (const em of socials.filter((e) => e.afterSection === i + 1)) {
      out.push(renderSocialEmbed(em));
    }
  });

  // afterSection 이 실제 섹션 범위를 벗어난 이미지는 본문 끝에 몰아 넣는다
  const sectionCount = article.sections.length;
  for (const img of bodyImages) {
    if (img.afterSection >= 1 && img.afterSection <= sectionCount) continue;
    out.push(renderFigure(img));
  }
  /* 영상 글은 장면 캡처가 이미 본문을 채우므로, 하단 영상은 링크로 둔다
   * (renderVideoLink 머리말 참고). 기사·주제 글의 임베드는 플레이어를 유지한다. */
  const bottomAsLink = article.mode === 'clip' || article.fromClip;
  for (const em of embeds) {
    if (em.afterSection >= 1 && em.afterSection <= sectionCount) continue;
    out.push(bottomAsLink ? renderVideoLink(em) : renderEmbed(em));
  }
  for (const em of socials) {
    if (em.afterSection >= 1 && em.afterSection <= sectionCount) continue;
    out.push(renderSocialEmbed(em));
  }

  /* 직접 확인할 곳 · 숫자와 출처 — 경제 모드에만 값이 있다.
   * 다른 모드는 필드가 비어 있어 빈 문자열이 되고 filter(Boolean) 이 걸러낸다. */
  out.push(checkSitesBlock(article.checkSites));
  out.push(figuresBlock(article.figures, article.asOf));

  // FAQ
  if (cfg.seo.includeFaq && article.faq.length) {
    out.push(`<h2 data-ke-size="${KE.h2}" style="${S.h2}">자주 묻는 질문</h2>`);
    for (const f of article.faq) {
      out.push(`<h3 data-ke-size="${KE.h3}" style="${S.faqQ}">Q. ${esc(f.question)}</h3>`);
      out.push(`<p data-ke-size="${KE.p}" style="${S.faqA}">A. ${rich(f.answer)}</p>`);
    }
  }

  // 마무리
  if (article.conclusion) {
    out.push(`<h2 data-ke-size="${KE.h2}" style="${S.h2}">마치며</h2>`);
    out.push(`<p data-ke-size="${KE.p}" style="${S.p}">${rich(article.conclusion)}</p>`);
  }

  // 출처 · 이미지 저작자 표기
  const credits = imageCredits.filter((c) => c && (c.photographer || c.credit));
  if ((cfg.seo.includeSources && article.sources.length) || credits.length) {
    out.push(`<hr style="${S.hr}" />`);
  }
  if (cfg.seo.includeSources && article.sources.length) {
    out.push(`<h3 data-ke-size="${KE.h3}" style="${S.h3}">참고 자료</h3>`);
    const items = article.sources
      .map((s) => {
        const meta = [s.publisher, s.date].filter(Boolean).join(' · ');
        return `<li><a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(
          s.title || s.url
        )}</a>${meta ? ` <span style="color:#999;">(${esc(meta)})</span>` : ''}</li>`;
      })
      .join('\n');
    out.push(`<ul style="${S.sources}">\n${items}\n</ul>`);
  }

  if (credits.length) {
    out.push(renderImageCredits(credits));
  }

  if (cfg.seo.includeJsonLd) {
    out.push(jsonLd(article, cfg));
  }

  return out.filter(Boolean).join('\n');
}

/** 미리보기용 완전한 HTML 문서 */
export function previewDocument(article, html) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(article.seoTitle || article.title)}</title>
<meta name="description" content="${esc(article.metaDescription)}" />
<style>
  body{max-width:760px;margin:0 auto;padding:40px 20px 120px;
       font-family:'Pretendard','Malgun Gothic',-apple-system,sans-serif;color:#222;}
  h1{font-size:1.9em;line-height:1.35;margin:0 0 8px;}
  .meta{color:#888;font-size:0.9em;margin-bottom:32px;}
  a{color:#4c1d95;}
</style>
</head>
<body>
<h1>${esc(article.title)}</h1>
<div class="meta">${esc(article.tags.join(' · '))}</div>
${html}
</body>
</html>`;
}
