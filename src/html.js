/**
 * 아티클 JSON -> 티스토리 에디터에 넣을 HTML.
 * 스킨에 상관없이 동일하게 보이도록 핵심 요소는 인라인 스타일을 쓴다.
 */

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

/** CC 라이선스 사진은 저작자·라이선스 표기가 의무다. 본문 하단에 모아서 남긴다. */
function renderImageCredits(credits) {
  if (!credits.length) return '';
  const items = credits
    .map((c) => {
      const who = c.photographer || c.credit || '작자 미상';
      const lic = c.license ? ` · ${esc(c.license)}` : '';
      const link = c.pageUrl
        ? `<a href="${esc(c.pageUrl)}" target="_blank" rel="noopener nofollow">원본 보기</a>`
        : '';
      return `<li>${esc(who)}${lic}${link ? ` · ${link}` : ''}</li>`;
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
export function buildHtml(article, { cfg, images = {}, imageCredits = [] }) {
  const out = [];
  const bodyImages = images.body || [];
  const embeds = cfg.seo.includeEmbeds === false ? [] : article.embeds || [];

  // 대표 이미지 (본문 맨 위 = 티스토리 대표 이미지 후보)
  if (images.thumbnail?.src || images.thumbnail?.placeholder) {
    out.push(renderFigure(images.thumbnail));
  }

  // 직답 박스 (GEO 핵심)
  if (article.directAnswer) {
    out.push(
      `<div style="${S.answer}"><span style="${S.boxTitle}">한 줄 정리</span>${esc(
        article.directAnswer
      )}</div>`
    );
  }

  // 핵심 요약
  if (cfg.seo.includeKeyTakeaways && article.keyTakeaways.length) {
    const items = article.keyTakeaways.map((t) => `<li>${esc(t)}</li>`).join('\n');
    out.push(
      `<div style="${S.takeaways}"><span style="${S.boxTitle}">이 글의 핵심</span>` +
        `<ul style="${S.ul}margin-bottom:0;">\n${items}\n</ul></div>`
    );
  }

  // 목차 — 섹션 제목에 걸어둔 id 로 이동한다
  if (cfg.seo.includeTableOfContents && article.sections.length >= 3) {
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

  // 본문 섹션
  article.sections.forEach((sec, i) => {
    out.push(
      `<h2 id="${anchorId(i)}" data-ke-size="${KE.h2}" style="${S.h2}">${esc(sec.heading)}</h2>`
    );

    for (const para of sec.paragraphs) {
      out.push(`<p data-ke-size="${KE.p}" style="${S.p}">${esc(para)}</p>`);
    }
    if (sec.bullets.length) {
      const items = sec.bullets.map((b) => `<li>${esc(b)}</li>`).join('\n');
      out.push(`<ul style="${S.ul}">\n${items}\n</ul>`);
    }
    const table = renderTable(sec.table);
    if (table) out.push(table);
    if (sec.callout) {
      out.push(`<div style="${S.callout}">💡 ${esc(sec.callout)}</div>`);
    }

    // 이 섹션 뒤에 붙는 본문 이미지
    for (const img of bodyImages.filter((b) => b.afterSection === i + 1)) {
      out.push(renderFigure(img));
    }
    // 이 섹션 뒤에 붙는 공식 영상 임베드
    for (const em of embeds.filter((e) => e.afterSection === i + 1)) {
      out.push(renderEmbed(em));
    }
  });

  // afterSection 이 실제 섹션 범위를 벗어난 이미지는 본문 끝에 몰아 넣는다
  const sectionCount = article.sections.length;
  for (const img of bodyImages) {
    if (img.afterSection >= 1 && img.afterSection <= sectionCount) continue;
    out.push(renderFigure(img));
  }
  for (const em of embeds) {
    if (em.afterSection >= 1 && em.afterSection <= sectionCount) continue;
    out.push(renderEmbed(em));
  }

  // FAQ
  if (cfg.seo.includeFaq && article.faq.length) {
    out.push(`<h2 data-ke-size="${KE.h2}" style="${S.h2}">자주 묻는 질문</h2>`);
    for (const f of article.faq) {
      out.push(`<h3 data-ke-size="${KE.h3}" style="${S.faqQ}">Q. ${esc(f.question)}</h3>`);
      out.push(`<p data-ke-size="${KE.p}" style="${S.faqA}">A. ${esc(f.answer)}</p>`);
    }
  }

  // 마무리
  if (article.conclusion) {
    out.push(`<h2 data-ke-size="${KE.h2}" style="${S.h2}">마치며</h2>`);
    out.push(`<p data-ke-size="${KE.p}" style="${S.p}">${esc(article.conclusion)}</p>`);
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
