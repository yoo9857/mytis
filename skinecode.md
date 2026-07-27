<!doctype html>
<html lang="ko">

<head>
  <meta charset="UTF-8">
  <meta name="google-site-verification" content="5Fp3LtC1neupztUt1hJ9NmH06OCvyHKgS1oVnmn6dz0" />

  <!-- 확대/축소 허용(user-scalable=no 제거): 접근성 + 모바일 가독성. viewport-fit 은 노치 대응 -->
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#15171b" media="(prefers-color-scheme: dark)">
  <meta name="format-detection" content="telephone=no,address=no,email=no">
  <meta name="referrer" content="strict-origin-when-cross-origin">

  <title>[##_page_title_##]</title>

  <!-- ===== 다크모드 선적용 (FOUC 방지) =====
       스타일이 그려지기 전에 data-theme 을 확정해야 새로고침 시 흰 화면이 번쩍이지 않는다. -->
  <script>
    (function () {
      try {
        var t = localStorage.getItem('sk-theme');
        if (t !== 'dark' && t !== 'light') {
          t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', t);
        var fs = localStorage.getItem('sk-fontsize');
        if (fs === '1' || fs === '2') document.documentElement.setAttribute('data-fs', fs);
      } catch (e) { }
    })();
  </script>

  <!-- ===== 스킨 설정 ==========================================================
       ▼ 애드센스 본문 중간 광고를 켜려면 inArticleSlot 에 광고 단위 ID 를 넣으세요.
         애드센스 > 광고 > 광고 단위 기준 > '디스플레이 광고' 또는 '인아티클 광고' 생성
         → 코드에서 data-ad-slot="1234567890" 의 숫자만 복사해 붙여넣기.
         비워두면 중간 광고는 삽입되지 않습니다(자동 광고는 그대로 동작).
       ========================================================================= -->
  <script>
    window.SKIN = {
      adsense: {
        client: 'ca-pub-9021429421997169',
        inArticleSlot: '',      // 본문 중간 광고 슬롯 ID (예: '1234567890')
        bottomSlot: '',         // 본문 하단 광고 슬롯 ID (선택)
        multiplexSlot: '',      // 하단 '멀티플렉스(추천 콘텐츠)' 슬롯 ID (선택)
        maxInArticle: 3,        // 본문 중간 광고 최대 개수
        minGapChars: 1300,      // 광고 사이 최소 본문 글자수 — 광고가 몰리는 것을 막는다
        minBodyChars: 1800,     // 본문이 이보다 짧으면 중간 광고 생략(정책상 안전)
        lazy: true,             // 화면에 가까워질 때 광고 로드 (LCP·수익성 모두 유리)
        label: '광고'            // 광고 위에 붙는 라벨 (빈 문자열이면 숨김)
      },
      features: {
        progress: true,        // 읽기 진행률 바
        toc: true,             // 자동 목차(사이드바 + 모바일 시트)
        darkToggle: true,      // 다크모드 토글
        fontSize: true,        // 본문 글자 크기 조절
        readTime: true,        // 예상 읽기 시간
        share: true,           // 공유 버튼
        copyCode: true,        // 코드블록 복사 버튼
        reveal: true,          // 스크롤 등장 애니메이션
        lazyImages: true,      // 본문 이미지 지연 로딩
        externalBlank: true,   // 외부 링크 새 탭
        jsonLd: true,          // 검색엔진용 구조화 데이터(사이트/이동경로)
        shortcuts: true        // 키보드 단축키 ( / 검색, Esc 닫기 )
      }
    };
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossorigin>
  <link rel="dns-prefetch" href="//i1.daumcdn.net">

  <link rel="stylesheet" href="./style.css">

  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9021429421997169"
    crossorigin="anonymous"></script>
  <script src="//t1.daumcdn.net/tistory_admin/lib/jquery/jquery-1.12.4.min.js"></script>

  <style type="text/css">
    /* 스킨 편집기의 '포인트 색상'을 새 컴포넌트(목차·공유·태그 등)까지 한 번에 적용 */
    <s_if_var_point-color>:root {
      --sk-accent: [##_var_point-color_##];
      --sk-accent-strong: [##_var_point-color_##];
    }

    .entry-content a,
    .post-header h1 em,
    .comments h2 .count {
      color: [##_var_point-color_##]
    }

    .comment-form .submit button:hover,
    .comment-form .submit button:focus {
      background-color: [##_var_point-color_##]
    }

    </s_if_var_point-color><s_if_var_promotion-1-btn-color>.main-slider ul li:nth-child(1) .btn {
      background-color: [##_var_promotion-1-btn-color_##]
    }

    </s_if_var_promotion-1-btn-color><s_if_var_promotion-1-btn-hover-color>.main-slider ul li:nth-child(1) .btn:hover {
      background-color: [##_var_promotion-1-btn-hover-color_##] !important;
    }

    </s_if_var_promotion-1-btn-hover-color><s_if_var_promotion-2-btn-hover-color>.main-slider ul li:nth-child(2) .btn:hover {
      background-color: [##_var_promotion-2-btn-hover-color_##] !important;
    }

    </s_if_var_promotion-2-btn-hover-color><s_if_var_promotion-3-btn-hover-color>.main-slider ul li:nth-child(3) .btn:hover {
      background-color: [##_var_promotion-3-btn-hover-color_##] !important;
    }

    </s_if_var_promotion-3-btn-hover-color>
  </style>
</head>

<body id="[##_body_id_##]"
  class="<s_if_var_layout-aside>[##_var_layout-aside_##]</s_if_var_layout-aside><s_if_var_list-type> [##_var_list-type_##]</s_if_var_list-type><s_if_var_view-more> [##_var_view-more_##]</s_if_var_view-more><s_not_var_promotion-mobile-view> promotion-mobile-hide</s_not_var_promotion-mobile-view>">
  <s_t3>
    <div id="acc-nav">
      <a href="#content">본문 바로가기</a>
      <a href="#gnb">메뉴 바로가기</a>
    </div>

    <!-- 읽기 진행률 -->
    <div class="sk-progress" aria-hidden="true"><span class="sk-progress__bar"></span></div>

    <div id="wrap">
      <header id="header">
        <div class="inner">
          <h1>
            <a href="[##_blog_link_##]">
              <s_if_var_logo>
                <img src="[##_var_logo_##]" alt="[##_title_##]">
              </s_if_var_logo>
              <s_not_var_logo>
                [##_title_##]
              </s_not_var_logo>
            </a>
          </h1>
          <div class="util">
            <div class="search">
              <s_search>
                <label for="[##_search_name_##]" class="screen_out">블로그 내 검색</label>
                <input id="[##_search_name_##]" type="text" name="[##_search_name_##]" value="[##_search_text_##]"
                  autocomplete="off" placeholder="검색어를 입력하세요 ( / )"
                  onkeypress="if (event.keyCode == 13) { [##_search_onclick_submit_##] }">
                <button type="submit" onclick="[##_search_onclick_submit_##]">검색</button>
              </s_search>
            </div>

            <!-- 다크모드 토글 -->
            <button type="button" class="sk-theme-toggle" aria-pressed="false" aria-label="다크 모드로 전환"
              title="다크 모드 (D)">
              <span class="sk-theme-toggle__icon" aria-hidden="true"></span>
            </button>

            <div class="profile">
              <button type="button" aria-label="블로그 관리 메뉴">[##_blog_image_##]</button>
              <nav>
                <ul>
                  <li><a href="[##_owner_url_##]">관리</a></li>
                  <li><a href="[##_owner_url_##]/entry/post ">글쓰기</a></li>
                  <li class="login"><a href="#">로그인</a></li>
                  <li class="logout"><a href="#">로그아웃</a></li>
                </ul>
              </nav>
            </div>
            <button type="button" class="menu" aria-label="메뉴 열기"><span>메뉴</span></button>
          </div>
          <nav id="gnb" aria-label="블로그 메뉴">
            [##_blog_menu_##]
          </nav>
        </div>
      </header>
      <section id="container">
        <s_if_var_promotion-1-image>
          <div class="main-slider">
            <ul>
              <li style="background-image: url([##_var_promotion-1-image_##]);">
                <s_if_var_promotion-1-url>
                  <a href="[##_var_promotion-1-url_##]">
                    <span class="inner">
                      <span class="box">
                        <s_if_var_promotion-1-text>
                          <span class="text" <s_if_var_promotion-1-color>
                            style="color:[##_var_promotion-1-color_##]"</s_if_var_promotion-1-color>>
                            [##_var_promotion-1-text_##]
                          </span>
                        </s_if_var_promotion-1-text>
                        <span class="btn">바로가기</span>
                      </span>
                    </span>
                  </a>
                </s_if_var_promotion-1-url>
                <s_not_var_promotion-1-url>
                  <span class="inner">
                    <span class="box">
                      <s_if_var_promotion-1-text>
                        <span class="text" <s_if_var_promotion-1-color>
                          style="color:[##_var_promotion-1-color_##]"</s_if_var_promotion-1-color>>
                          [##_var_promotion-1-text_##]
                        </span>
                      </s_if_var_promotion-1-text>
                    </span>
                  </span>
                </s_not_var_promotion-1-url>
              </li>
              <s_if_var_promotion-2-image>
                <li style="background-image: url([##_var_promotion-2-image_##]);">
                  <s_if_var_promotion-2-url>
                    <a href="[##_var_promotion-2-url_##]">
                      <span class="inner">
                        <span class="box">
                          <s_if_var_promotion-2-text>
                            <span class="text" <s_if_var_promotion-2-color>
                              style="color:[##_var_promotion-2-color_##]"</s_if_var_promotion-2-color>>
                              [##_var_promotion-2-text_##]
                            </span>
                          </s_if_var_promotion-2-text>
                          <span class="btn" <s_if_var_promotion-2-btn-color>
                            style="background-color:[##_var_promotion-2-btn-color_##]"</s_if_var_promotion-2-btn-color>>바로가기</span>
                        </span>
                      </span>
                    </a>
                  </s_if_var_promotion-2-url>
                  <s_not_var_promotion-2-url>
                    <span class="inner">
                      <span class="box">
                        <s_if_var_promotion-2-text>
                          <span class="text" <s_if_var_promotion-2-color>
                            style="color:[##_var_promotion-2-color_##]"</s_if_var_promotion-2-color>>
                            [##_var_promotion-2-text_##]
                          </span>
                        </s_if_var_promotion-2-text>
                      </span>
                    </span>
                  </s_not_var_promotion-2-url>
                </li>
              </s_if_var_promotion-2-image>
              <s_if_var_promotion-3-image>
                <li style="background-image: url([##_var_promotion-3-image_##]);">
                  <s_if_var_promotion-3-url>
                    <a href="[##_var_promotion-3-url_##]">
                      <span class="inner">
                        <span class="box">
                          <s_if_var_promotion-3-text>
                            <span class="text" <s_if_var_promotion-3-color>
                              style="color:[##_var_promotion-3-color_##]"</s_if_var_promotion-3-color>>
                              [##_var_promotion-3-text_##]
                            </span>
                          </s_if_var_promotion-3-text>
                          <span class="btn" <s_if_var_promotion-3-btn-color>
                            style="background-color:[##_var_promotion-3-btn-color_##]"</s_if_var_promotion-3-btn-color>>바로가기</span>
                        </span>
                      </span>
                    </a>
                  </s_if_var_promotion-3-url>
                  <s_not_var_promotion-3-url>
                    <span class="inner">
                      <span class="box">
                        <s_if_var_promotion-3-text>
                          <span class="text" <s_if_var_promotion-3-color>
                            style="color:[##_var_promotion-3-color_##]"</s_if_var_promotion-3-color>>
                            [##_var_promotion-3-text_##]
                          </span>
                        </s_if_var_promotion-3-text>
                      </span>
                    </span>
                  </s_not_var_promotion-3-url>
                </li>
              </s_if_var_promotion-3-image>
            </ul>
          </div>
        </s_if_var_promotion-1-image>
        <div class="content-wrap">
          <article id="content">
            [##_revenue_list_upper_##]

            <s_cover_group>
              <s_cover_rep>

                <s_cover name='cover-thumbnail-1'>
                  <div class="cover-thumbnail-1">
                    <h2>[##_cover_title_##]</h2>
                    <ul>
                      <s_cover_item>
                        <li>
                          <a href="[##_cover_item_url_##]">
                            <figure>
                              <s_cover_item_thumbnail>
                                <img src="//i1.daumcdn.net/thumb/C230x300/?fname=[##_cover_item_thumbnail_##]" alt=""
                                  loading="lazy" decoding="async">
                              </s_cover_item_thumbnail>
                            </figure>
                            <span class="title">[##_cover_item_title_##]</span>
                            <s_cover_item_article_info>
                              <span class="date">[##_cover_item_simple_date_##]</span>
                            </s_cover_item_article_info>
                          </a>
                        </li>
                      </s_cover_item>
                    </ul>
                    <s_cover_url>
                      <a href="[##_cover_url_##]" class="more">more</a>
                    </s_cover_url>
                  </div>
                </s_cover>

                <s_cover name='cover-thumbnail-2'>
                  <div class="cover-thumbnail-2">
                    <h2>[##_cover_title_##]</h2>
                    <ul>
                      <s_cover_item>
                        <li>
                          <a href="[##_cover_item_url_##]">
                            <figure>
                              <s_cover_item_thumbnail>
                                <img src="//i1.daumcdn.net/thumb/C126x166/?fname=[##_cover_item_thumbnail_##]" alt=""
                                  loading="lazy" decoding="async">
                              </s_cover_item_thumbnail>
                            </figure>
                            <span class="title">[##_cover_item_title_##]</span>
                            <span class="excerpt">[##_cover_item_summary_##]</span>
                            <s_cover_item_article_info>
                              <span class="meta">
                                <span class="date">[##_cover_item_simple_date_##]</span>
                              </span>
                            </s_cover_item_article_info>
                          </a>
                        </li>
                      </s_cover_item>
                    </ul>
                  </div>
                </s_cover>

                <s_cover name='cover-thumbnail-3'>
                  <div class="cover-thumbnail-3">
                    <h2>[##_cover_title_##]</h2>
                    <ul>
                      <s_cover_item>
                        <li>
                          <a href="[##_cover_item_url_##]">
                            <figure>
                              <s_cover_item_thumbnail>
                                <img src="//i1.daumcdn.net/thumb/C126x164/?fname=[##_cover_item_thumbnail_##]" alt=""
                                  loading="lazy" decoding="async">
                              </s_cover_item_thumbnail>
                            </figure>
                            <span class="title">[##_cover_item_title_##]</span>
                          </a>
                        </li>
                      </s_cover_item>
                    </ul>
                  </div>
                </s_cover>

                <s_cover name='cover-thumbnail-4'>
                  <div class="cover-thumbnail-4">
                    <h2>[##_cover_title_##]</h2>
                    <ul>
                      <s_cover_item>
                        <li>
                          <a href="[##_cover_item_url_##]">
                            <figure>
                              <s_cover_item_thumbnail>
                                <img src="//i1.daumcdn.net/thumb/C230x140/?fname=[##_cover_item_thumbnail_##]" alt=""
                                  loading="lazy" decoding="async">
                              </s_cover_item_thumbnail>
                            </figure>
                            <span class="title">[##_cover_item_title_##]</span>
                            <s_cover_item_article_info>
                              <span class="excerpt">[##_cover_item_summary_##]</span>
                              <span class="meta">
                                <span class="comment">댓글 [##_cover_item_comment_count_##]</span>
                                <span class="date">[##_cover_item_simple_date_##]</span>
                              </span>
                            </s_cover_item_article_info>
                          </a>
                        </li>
                      </s_cover_item>
                    </ul>
                  </div>
                </s_cover>

                <s_cover name='cover-list'>
                  <div class="cover-list">
                    <h2>[##_cover_title_##]</h2>
                    <ul>
                      <s_cover_item>
                        <li>
                          <a href="[##_cover_item_url_##]">
                            <span class="title">[##_cover_item_title_##]</span>
                            <span class="excerpt">[##_cover_item_summary_##]</span>
                            <s_cover_item_article_info>
                              <span class="date">[##_cover_item_simple_date_##]</span>
                            </s_cover_item_article_info>
                          </a>
                        </li>
                      </s_cover_item>
                    </ul>
                  </div>
                </s_cover>

                <s_cover name='cover-event'>
                  <div class="cover-event">
                    <h2>[##_cover_title_##]</h2>
                    <ul>
                      <s_cover_item>
                        <li>
                          <a href="[##_cover_item_url_##]" <s_cover_item_thumbnail>
                            style="background-image:url(//i1.daumcdn.net/thumb/C360x120/?fname=[##_cover_item_thumbnail_##])"
                            </s_cover_item_thumbnail>>
                            <s_cover_item_article_info>
                              <span class="title">[##_cover_item_title_##]</span>
                              <span class="more">more</span>
                            </s_cover_item_article_info>
                          </a>
                        </li>
                      </s_cover_item>
                    </ul>
                  </div>
                </s_cover>

              </s_cover_rep>
            </s_cover_group>

            <s_page_rep>
              <div class="post-cover">
                <div class="inner">
                  <h1>[##_article_rep_title_##]</h1>
                  <span class="meta">
                    <span class="author">by [##_article_rep_author_##]</span>
                    <span class="date">[##_article_rep_simple_date_##]</span>
                    <span class="sk-readtime" hidden></span>
                  </span>
                </div>
              </div>
              <div class="entry-content" id="article-view">
                [##_article_rep_desc_##]
              </div>
            </s_page_rep>

            <s_notice_rep>
              <div class="post-cover notice" <s_notice_rep_thumbnail> style="background-image:
                url([##_notice_rep_thumbnail_raw_url_##]);"</s_notice_rep_thumbnail>>
                <div class="inner">
                  <h1><a href="[##_notice_rep_link_##]">[##_notice_rep_title_##]</a></h1>
                  <span class="meta">
                    <span class="date">[##_notice_rep_simple_date_##]</span>
                  </span>
                </div>
              </div>
              <div class="entry-content" id="article-view">
                [##_notice_rep_desc_##]
              </div>
            </s_notice_rep>

            <s_list>
              <div class="post-header">
                <h1><span>[##_list_conform_##]</span><em>[##_list_count_##]</em></h1>
              </div>
              <s_list_empty>
                <div class="not-found">
                  <ul>
                    <li>입력하신 단어의 철자가 정확한지 확인해 보세요.</li>
                    <li>검색어의 단어 수를 줄이거나, 보다 일반적인 단어로 검색해 보세요.</li>
                    <li>두 단어 이상의 키워드로 검색 하신 경우, 정확하게 띄어쓰기를 한 후 검색해 보세요.</li>
                  </ul>
                  <ul class="tag">
                    <li>선택하신 태그에 해당하는 글이 없습니다.</li>
                    <li>다른 태그를 선택하시거나, 검색 기능을 활용해 보세요.</li>
                  </ul>
                  <ul class="category">
                    <li>선택하신 카테고리에 해당하는 글이 없습니다.</li>
                    <li>다른 카테고리를 선택하시거나, 검색 기능을 활용해 보세요.</li>
                  </ul>
                  <ul class="archive">
                    <li>선택하신 기간에 등록된 글이 없습니다.</li>
                  </ul>
                  <a href="[##_blog_link_##]" class="sk-btn-home">홈으로 돌아가기</a>
                </div>
              </s_list_empty>
            </s_list>

            <s_article_protected>
              <s_index_article_rep>
                <div class="post-item protected">
                  <a href="[##_article_rep_link_##]">
                    <span class="thum"></span>
                    <span class="title">[##_article_rep_title_##]</span>
                    <span class="excerpt">보호되어 있는 글 입니다.</span>
                    <span class="meta">
                      <span class="date">[##_article_rep_simple_date_##]</span>
                    </span>
                  </a>
                </div>
              </s_index_article_rep>

              <s_permalink_article_rep>
                <div class="entry-content">
                  <form class="protected_form" onsubmit="{reloadEntry(14);return false;}">
                    <h2>보호되어 있는 글입니다.</h2>
                    <p>내용을 보시려면 비밀번호를 입력하세요.</p>
                    <input type="password" id="entry14password" name="entry14password" value="" placeholder="비밀번호">
                    <button type="submit" class="btn">확인</button>
                  </form>
                </div>
              </s_permalink_article_rep>
            </s_article_protected>

            <div class="inner">
              <s_article_rep>

                <s_index_article_rep>
                  <div class="post-item">
                    <a href="[##_article_rep_link_##]">
                      <span class="thum">
                        <s_article_rep_thumbnail>
                          <img src="//i1.daumcdn.net/thumb/C230x300/?fname=[##_article_rep_thumbnail_raw_url_##]" alt=""
                            loading="lazy" decoding="async">
                        </s_article_rep_thumbnail>
                      </span>
                      <span class="title">[##_article_rep_title_##]</span>
                      <span class="excerpt">[##_article_rep_summary_##]</span>
                      <span class="meta">
                        <span class="date">[##_article_rep_simple_date_##]</span>
                      </span>
                    </a>
                  </div>
                </s_index_article_rep>

                <s_permalink_article_rep>
                  <div class="post-cover">
                    <div class="inner">
                      <span class="category">[##_article_rep_category_##]</span>
                      <h1>[##_article_rep_title_##]</h1>
                      <span class="meta">
                        <span class="author">by [##_article_rep_author_##]</span>
                        <span class="date">[##_article_rep_simple_date_##]</span>
                        <span class="sk-readtime" hidden></span>
                        [##_s_ad_isolation_##]
                      </span>
                    </div>
                  </div>

                  <!-- 읽기 도구: 예상 읽기 시간 · 본문 글자 크기 -->
                  <div class="sk-tools" hidden>
                    <p class="sk-tools__info"></p>
                    <div class="sk-fs" role="group" aria-label="본문 글자 크기 조절">
                      <button type="button" class="sk-fs__btn" data-sk-fs="down" aria-label="글자 작게">A<sup>-</sup></button>
                      <span class="sk-fs__val" aria-live="polite">기본</span>
                      <button type="button" class="sk-fs__btn" data-sk-fs="up" aria-label="글자 크게">A<sup>+</sup></button>
                    </div>
                  </div>

                  <div class="entry-content" id="article-view">
                    [##_article_rep_desc_##]
                  </div>

                  <!-- 본문 하단 광고 자리 (bottomSlot / multiplexSlot 설정 시 표시) -->
                  <div class="sk-adzone" data-sk-adzone="bottom"></div>

                  <!-- 공유 -->
                  <div class="sk-share" hidden>
                    <h2 class="sk-share__title">이 글 공유하기</h2>
                    <div class="sk-share__list">
                      <button type="button" class="sk-share__btn is-copy" data-sk-share="copy">
                        <span aria-hidden="true">🔗</span> 링크 복사
                      </button>
                      <button type="button" class="sk-share__btn is-native" data-sk-share="native" hidden>
                        <span aria-hidden="true">📱</span> 공유
                      </button>
                      <a class="sk-share__btn is-x" data-sk-share="x" href="#" rel="noopener nofollow">
                        <span aria-hidden="true">𝕏</span> 엑스
                      </a>
                      <a class="sk-share__btn is-fb" data-sk-share="facebook" href="#" rel="noopener nofollow">
                        <span aria-hidden="true">f</span> 페이스북
                      </a>
                      <a class="sk-share__btn is-band" data-sk-share="band" href="#" rel="noopener nofollow">
                        <span aria-hidden="true">B</span> 밴드
                      </a>
                    </div>
                  </div>

                  <s_tag_label>
                    <div class="tags">
                      <h2>태그</h2>
                      [##_tag_label_rep_##]
                    </div>
                  </s_tag_label>

                  <s_article_related>
                    <div class="related-articles">
                      <h2>관련글</h2>
                      <ul>
                        <s_article_related_rep>
                          <li>
                            <a href="[##_article_related_rep_link_##]">
                              <figure>
                                <s_article_related_rep_thumbnail>
                                  <img
                                    src="//i1.daumcdn.net/thumb/C176x120/?fname=[##_article_related_rep_thumbnail_link_##]"
                                    alt="" loading="lazy" decoding="async">
                                </s_article_related_rep_thumbnail>
                              </figure>
                              <span class="title">[##_article_related_rep_title_##]</span>
                            </a>
                          </li>
                        </s_article_related_rep>
                      </ul>
                    </div>
                  </s_article_related>

                  <div class="comments">
                    <s_rp>
                      <div class="tt-comments-wrap">
                        [##_comment_group_##]
                      </div>
                    </s_rp>
                  </div>
                </s_permalink_article_rep>

              </s_article_rep>

            </div>

            <s_tag>
              <div class="post-header">
                <h1>태그</h1>
              </div>
              <div class="tags">
                <s_tag_rep>
                  <a href="[##_tag_link_##]">[##_tag_name_##]</a>
                </s_tag_rep>
              </div>
            </s_tag>

            <s_guest>
              <div class="tt-comments-wrap">
                [##_guestbook_group_##]
              </div>
            </s_guest>

            <s_paging>
              <div class="pagination">
                <a [##_prev_page_##] class="prev [##_no_more_prev_##]">이전</a>
                <s_paging_rep>
                  <a [##_paging_rep_link_##]>[##_paging_rep_link_num_##]</a>
                </s_paging_rep>
                <a [##_next_page_##] class="next [##_no_more_next_##]">다음</a>
              </div>
            </s_paging>

            [##_revenue_list_lower_##]

          </article>
          <aside id="aside" class="sidebar">
            <!-- 모바일에서 사이드바가 서랍으로 열릴 때 쓰이는 닫기 버튼 / 관리 메뉴 -->
            <button type="button" class="close" aria-label="사이드바 닫기"><span>닫기</span></button>
            <div class="profile">
              <ul>
                <li><a href="[##_owner_url_##]">관리</a></li>
                <li><a href="[##_owner_url_##]/entry/post">글쓰기</a></li>
              </ul>
            </div>

            <!-- 자동 목차 (본문 페이지에서만 채워짐) -->
            <nav class="sk-toc sk-toc--rail" aria-label="목차" hidden>
              <h2 class="sk-toc__title">목차</h2>
              <ol class="sk-toc__list"></ol>
            </nav>

            <div class="sidebar-1">
              <s_sidebar>
                <s_sidebar_element>
                  <!-- 카테고리 -->
                  <nav class="category" aria-label="카테고리">
                    [##_category_list_##]
                  </nav>
                </s_sidebar_element>
              </s_sidebar>
            </div>
            <div class="sidebar-2">
              <s_sidebar>
                <s_sidebar_element>
                  <!-- 공지사항 -->
                  <s_rct_notice>
                    <div class="notice">
                      <h2>공지사항</h2>
                      <ul>
                        <s_rct_notice_rep>
                          <li><a href="[##_notice_rep_link_##]">[##_notice_rep_title_##]</a></li>
                        </s_rct_notice_rep>
                      </ul>
                    </div>
                  </s_rct_notice>
                </s_sidebar_element>
                <s_sidebar_element>
                  <!-- 최근글/인기글 -->
                  <div class="post-list tab-ui">
                    <div id="recent" class="tab-list">
                      <h2>최근글</h2>
                      <ul>
                        <s_rctps_rep>
                          <li>
                            <a href="[##_rctps_rep_link_##]">
                              <s_rctps_rep_thumbnail>
                                <img src="//i1.daumcdn.net/thumb/C58x58/?fname=[##_rctps_rep_thumbnail_##]" alt=""
                                  loading="lazy" decoding="async" />
                              </s_rctps_rep_thumbnail>
                              <span class="title">[##_rctps_rep_title_##]</span>
                              <span class="date">[##_rctps_rep_simple_date_##]</span>
                            </a>
                          </li>
                        </s_rctps_rep>
                      </ul>
                    </div>
                    <div id="popular" class="tab-list">
                      <h2>인기글</h2>
                      <ul>
                        <s_rctps_popular_rep>
                          <li>
                            <a href="[##_rctps_rep_link_##]">
                              <s_rctps_rep_thumbnail>
                                <img src="//i1.daumcdn.net/thumb/C58x58/?fname=[##_rctps_rep_thumbnail_##]" alt=""
                                  loading="lazy" decoding="async" />
                              </s_rctps_rep_thumbnail>
                              <span class="title">[##_rctps_rep_title_##]</span>
                              <span class="date">[##_rctps_rep_simple_date_##]</span>
                            </a>
                          </li>
                        </s_rctps_popular_rep>
                      </ul>
                    </div>
                  </div>
                </s_sidebar_element>
                <s_sidebar_element>
                  <!-- 최근댓글 -->
                  <div class="recent-comment">
                    <h2>최근댓글</h2>
                    <ul>
                      <s_rctrp_rep>
                        <li><a href="[##_rctrp_rep_link_##]">[##_rctrp_rep_desc_##]</a></li>
                      </s_rctrp_rep>
                    </ul>
                  </div>
                </s_sidebar_element>
                <s_sidebar_element>
                  <!-- Facebook/Twitter -->
                  <div class="social-list tab-ui">
                    <s_if_var_facebook-timeline>
                      <div id="facebook" class="tab-list">
                        <h2>Facebook</h2>
                        <div id="fb-root"></div>
                        <script>(function (d, s, id) {
                            var js, fjs = d.getElementsByTagName(s)[0];
                            if (d.getElementById(id)) return;
                            js = d.createElement(s); js.id = id;
                            js.src = 'https://connect.facebook.net/ko_KR/sdk.js#xfbml=1&version=v3.2';
                            fjs.parentNode.insertBefore(js, fjs);
                          }(document, 'script', 'facebook-jssdk'));</script>
                        <div class="fb-page" data-href="[##_var_facebook-timeline_##]" data-tabs="timeline"
                          data-width="230" data-height="400" data-small-header="true" data-adapt-container-width="true"
                          data-hide-cover="true" data-show-facepile="false"></div>
                      </div>
                    </s_if_var_facebook-timeline>
                    <s_if_var_twitter-timeline>
                      <div id="twitter" class="tab-list">
                        <h2>Twitter</h2>
                        <a class="twitter-timeline" data-width="230" data-height="400"
                          href="[##_var_twitter-timeline_##]?ref_src=twsrc%5Etfw">[##_var_twitter-timeline_##]</a>
                        <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
                      </div>
                    </s_if_var_twitter-timeline>
                  </div>
                </s_sidebar_element>
              </s_sidebar>
              <s_sidebar>
                <s_sidebar_element>
                  <!-- 태그 -->
                  <div class="tags">
                    <h2>태그</h2>
                    <s_random_tags>
                      <a href="[##_tag_link_##]">[##_tag_name_##]</a>
                    </s_random_tags>
                  </div>
                </s_sidebar_element>
                <s_sidebar_element>
                  <!-- 전체 방문자 -->
                  <div class="count">
                    <h2>전체 방문자</h2>
                    <p class="total">[##_count_total_##]</p>
                    <p>Today : [##_count_today_##]</p>
                    <p>Yesterday : [##_count_yesterday_##]</p>
                  </div>
                </s_sidebar_element>
                <s_sidebar_element>
                  <!-- 소셜 채널 -->
                  <div class="social-channel">
                    <ul>
                      <s_if_var_facebook-link>
                        <li class="facebook"><a href="[##_var_facebook-link_##]">페이스북</a></li>
                      </s_if_var_facebook-link>
                      <s_if_var_instagram-link>
                        <li class="instagram"><a href="[##_var_instagram-link_##]">인스타그램</a></li>
                      </s_if_var_instagram-link>
                      <s_if_var_twitter-link>
                        <li class="twitter"><a href="[##_var_twitter-link_##]">트위터</a></li>
                      </s_if_var_twitter-link>
                      <s_if_var_youtube-link>
                        <li class="youtube"><a href="[##_var_youtube-link_##]">유투브</a></li>
                      </s_if_var_youtube-link>
                    </ul>
                  </div>
                </s_sidebar_element>
              </s_sidebar>
            </div>
          </aside>
        </div>
      </section>
      <hr>
      <footer id="footer">
        <div class="inner">
          <div class="order-menu">
            <s_if_var_order-link-1-title>
              <a href="[##_var_order-link-1-url_##]">[##_var_order-link-1-title_##]</a>
            </s_if_var_order-link-1-title>
            <s_if_var_order-link-2-title>
              <a href="[##_var_order-link-2-url_##]">[##_var_order-link-2-title_##]</a>
            </s_if_var_order-link-2-title>
            <s_if_var_order-link-3-title>
              <a href="[##_var_order-link-3-url_##]">[##_var_order-link-3-title_##]</a>
            </s_if_var_order-link-3-title>
            <s_if_var_order-link-4-title>
              <a href="[##_var_order-link-4-url_##]">[##_var_order-link-4-title_##]</a>
            </s_if_var_order-link-4-title>
          </div>
          <a href="#" class="page-top">TOP</a>
          <p class="meta"><s_if_var_footer-text-1>[##_var_footer-text-1_##]</s_if_var_footer-text-1></p>
          <p class="copyright"><s_if_var_footer-text-2>[##_var_footer-text-2_##]</s_if_var_footer-text-2></p>
        </div>
      </footer>
    </div>

    <!-- 모바일 목차 시트 -->
    <div class="sk-sheet" hidden>
      <div class="sk-sheet__dim" data-sk-sheet="close"></div>
      <div class="sk-sheet__panel" role="dialog" aria-modal="true" aria-label="목차">
        <div class="sk-sheet__head">
          <strong>목차</strong>
          <button type="button" class="sk-sheet__close" data-sk-sheet="close" aria-label="목차 닫기">✕</button>
        </div>
        <nav class="sk-toc sk-toc--sheet">
          <ol class="sk-toc__list"></ol>
        </nav>
      </div>
    </div>

    <!-- 플로팅 버튼 -->
    <div class="sk-fab">
      <button type="button" class="sk-fab__btn is-toc" data-sk-sheet="open" aria-label="목차 열기" hidden>
        <span aria-hidden="true">☰</span>
      </button>
      <button type="button" class="sk-fab__btn is-top" aria-label="맨 위로 이동">
        <span aria-hidden="true">↑</span>
      </button>
    </div>

    <!-- 알림 토스트 -->
    <div class="sk-toast" role="status" aria-live="polite"></div>
  </s_t3>
  <script src="./images/script.js"></script>

  <!-- =========================================================================
       스킨 업그레이드 스크립트 (의존성 없음 / 원본 script.js 와 충돌하지 않음)
       ========================================================================= -->
  <script>
    (function () {
      'use strict';

      var CFG = window.SKIN || {};
      var F = CFG.features || {};
      var AD = CFG.adsense || {};
      var doc = document;
      var root = doc.documentElement;
      var body = doc.body;

      var article = doc.getElementById('article-view');
      var isPost = !!article;
      var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (isPost) body.classList.add('sk-post');

      /* ---------- 유틸 ---------- */
      function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
      function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
      function on(el, ev, fn, opt) { if (el) el.addEventListener(ev, fn, opt || false); }
      function num(v, d) { v = parseInt(v, 10); return isNaN(v) ? d : v; }
      function store(k, v) {
        try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
      }
      // 스크롤 핸들러는 rAF 로 묶어 호출을 줄인다.
      // 대기 플래그는 '등록마다 따로' 둔다 — 공유하면 두 번째 리스너가 실행되지 않는다.
      function onScroll(fn) {
        var pending = false;
        on(window, 'scroll', function () {
          if (pending) return;
          pending = true;
          requestAnimationFrame(function () { pending = false; fn(); });
        }, { passive: true });
      }
      // 스티키 헤더 높이 보정값 — 실제 헤더 높이를 읽는다(모바일은 고정이 아니라 0)
      function headOffset() {
        var h = doc.getElementById('header');
        if (!h || window.innerWidth < 768) return 16;
        var pos = getComputedStyle(h).position;
        return (pos === 'sticky' || pos === 'fixed' ? h.offsetHeight : 0) + 12;
      }
      // 앵커 이동 후 제목이 놓일 위치. CSS 의 scroll-margin-top 과 반드시 같은 값이어야 한다.
      function landing() { return window.innerWidth >= 768 ? 124 : 20; }
      // 구형 사파리는 scrollTo(옵션) 을 무시하므로 지원 여부를 확인해 폴백한다
      var smoothOK = 'scrollBehavior' in root.style;
      function scrollToY(y) {
        y = Math.max(0, Math.round(y));
        if (smoothOK && !reduceMotion) window.scrollTo({ top: y, behavior: 'smooth' });
        else window.scrollTo(0, y);
      }
      /**
       * 목차 등에서 특정 요소로 이동.
       * scroll-margin-top 이 헤더 높이를 대신 계산해 주고,
       * 이미지·광고가 뒤늦게 로드되며 위치가 밀리는 경우를 한 번 보정한다.
       */
      function goTo(target) {
        var go = function (behavior) {
          if (target.scrollIntoView && smoothOK) target.scrollIntoView({ behavior: behavior, block: 'start' });
          else scrollToY(target.getBoundingClientRect().top + (window.pageYOffset || 0) - landing());
        };
        go(reduceMotion ? 'auto' : 'smooth');
        setTimeout(function () {
          if (Math.abs(target.getBoundingClientRect().top - landing()) > 28) go('auto');
        }, 640);
        target.setAttribute('tabindex', '-1');
        try { target.focus({ preventScroll: true }); } catch (err) { }
      }
      var toastTimer;
      function toast(msg) {
        var box = $('.sk-toast');
        if (!box) return;
        box.textContent = msg;
        box.classList.add('is-on');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { box.classList.remove('is-on'); }, 2200);
      }

      /* ---------- 1. 다크모드 ---------- */
      (function theme() {
        var btn = $('.sk-theme-toggle');
        if (!btn) return;
        if (F.darkToggle === false) { btn.hidden = true; return; }

        function apply(t, persist) {
          root.setAttribute('data-theme', t);
          btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
          btn.setAttribute('aria-label', t === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
          if (persist) store('sk-theme', t);
        }
        apply(root.getAttribute('data-theme') || 'light', false);

        on(btn, 'click', function () {
          var next = (root.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
          apply(next, true);
          toast(next === 'dark' ? '다크 모드' : '라이트 모드');
        });

        // 사용자가 직접 고른 적이 없으면 OS 설정을 따라간다
        if (window.matchMedia) {
          var mq = window.matchMedia('(prefers-color-scheme: dark)');
          var handler = function (e) { if (!store('sk-theme')) apply(e.matches ? 'dark' : 'light', false); };
          if (mq.addEventListener) mq.addEventListener('change', handler);
          else if (mq.addListener) mq.addListener(handler);
        }
      })();

      /* ---------- 2. 스티키 헤더 + 진행률 ---------- */
      (function headerAndProgress() {
        var header = $('#header');
        var bar = $('.sk-progress__bar');
        var wrapEl = $('.sk-progress');
        var fabTop = $('.sk-fab__btn.is-top');
        var showProgress = isPost && F.progress !== false;
        if (wrapEl && !showProgress) wrapEl.hidden = true;

        function update() {
          var y = window.pageYOffset || root.scrollTop;
          if (header) header.classList.toggle('is-scrolled', y > 8);
          if (fabTop) fabTop.parentNode.classList.toggle('is-on', y > 400);

          if (showProgress && bar && article) {
            var start = article.offsetTop;
            var total = article.offsetHeight - window.innerHeight * 0.4;
            var pct = total > 0 ? ((y - start) / total) * 100 : 0;
            bar.style.width = Math.max(0, Math.min(100, pct)).toFixed(2) + '%';
          }
        }
        onScroll(update);
        on(window, 'resize', update);
        update();

        on(fabTop, 'click', function () { scrollToY(0); });
      })();

      /* ---------- 3. 읽기 도구 (읽는 시간 · 글자 크기) ---------- */
      (function readingTools() {
        if (!isPost) return;
        var text = (article.textContent || '').replace(/\s+/g, ' ').trim();
        var chars = text.length;

        if (F.readTime !== false && chars > 200) {
          var min = Math.max(1, Math.round(chars / 500)); // 한국어 평균 분당 약 500자
          $$('.sk-readtime').forEach(function (el) {
            el.textContent = '읽는 시간 약 ' + min + '분';
            el.hidden = false;
          });
          var info = $('.sk-tools__info');
          if (info) info.textContent = '약 ' + min + '분 분량 · ' + chars.toLocaleString('ko-KR') + '자';
        }

        var tools = $('.sk-tools');
        if (!tools) return;
        if (F.fontSize === false) { if (chars > 200) tools.hidden = false; return; }
        tools.hidden = false;

        var LABEL = { '0': '기본', '1': '크게', '2': '더 크게' };
        function level() { return root.getAttribute('data-fs') || '0'; }
        function setLevel(n) {
          n = String(Math.max(0, Math.min(2, n)));
          if (n === '0') root.removeAttribute('data-fs'); else root.setAttribute('data-fs', n);
          store('sk-fontsize', n);
          var val = $('.sk-fs__val');
          if (val) val.textContent = LABEL[n];
          $$('.sk-fs__btn').forEach(function (b) {
            var up = b.getAttribute('data-sk-fs') === 'up';
            b.disabled = up ? n === '2' : n === '0';
          });
        }
        $$('.sk-fs__btn').forEach(function (b) {
          on(b, 'click', function () {
            setLevel(num(level(), 0) + (b.getAttribute('data-sk-fs') === 'up' ? 1 : -1));
          });
        });
        setLevel(num(level(), 0));
      })();

      /* ---------- 4. 자동 목차 + 스크롤 스파이 ---------- */
      var tocLinks = [];
      var tocTargets = [];
      (function toc() {
        if (!isPost || F.toc === false) return;
        var heads = $$('h2, h3', article).filter(function (h) {
          return (h.textContent || '').trim().length > 0;
        });
        if (heads.length < 3) return;

        var items = heads.map(function (h, i) {
          if (!h.id) h.id = 'sk-h-' + (i + 1);
          return {
            id: h.id,
            text: (h.textContent || '').replace(/^Q\.\s*/, '').trim(),
            sub: h.tagName === 'H3'
          };
        });

        var html = items.map(function (it) {
          return '<li class="sk-toc__item' + (it.sub ? ' is-sub' : '') + '">' +
            '<a href="#' + it.id + '">' + it.text.replace(/[<>&]/g, '') + '</a></li>';
        }).join('');

        $$('.sk-toc__list').forEach(function (list) {
          list.innerHTML = html;
          var nav = list.closest ? list.closest('.sk-toc') : list.parentNode;
          if (nav) nav.hidden = false;
        });

        var fabToc = $('.sk-fab__btn.is-toc');
        if (fabToc) fabToc.hidden = false;

        tocLinks = $$('.sk-toc a');
        tocTargets = items.map(function (it) { return doc.getElementById(it.id); });

        // 부드러운 이동 (스티키 헤더 높이 보정)
        $$('.sk-toc, .entry-content').forEach(function (scope) {
          on(scope, 'click', function (e) {
            var a = e.target.closest && e.target.closest('a[href^="#"]');
            if (!a) return;
            var id = a.getAttribute('href').slice(1);
            var target = id && doc.getElementById(id);
            if (!target) return;
            e.preventDefault();
            closeSheet();
            goTo(target);
            if (history.replaceState) history.replaceState(null, '', '#' + id);
          });
        });

        function spy() {
          var y = (window.pageYOffset || 0) + headOffset() + 12;
          var idx = -1;
          for (var i = 0; i < tocTargets.length; i++) {
            if (tocTargets[i] && tocTargets[i].offsetTop <= y) idx = i; else break;
          }
          tocLinks.forEach(function (a) { a.classList.remove('is-active'); });
          if (idx < 0) return;
          var activeId = tocTargets[idx].id;
          tocLinks.forEach(function (a) {
            if (a.getAttribute('href') === '#' + activeId) {
              a.classList.add('is-active');
              var box = a.closest ? a.closest('.sk-toc--rail') : null;
              if (box && box.scrollHeight > box.clientHeight) {
                var t = a.offsetTop - box.clientHeight / 2;
                if (Math.abs(box.scrollTop - t) > 40) box.scrollTop = t;
              }
            }
          });
        }
        onScroll(spy);
        spy();
      })();

      /* ---------- 5. 모바일 목차 시트 ---------- */
      var sheet = $('.sk-sheet');
      function openSheet() {
        if (!sheet) return;
        sheet.hidden = false;
        requestAnimationFrame(function () { sheet.classList.add('is-on'); });
        body.classList.add('sk-lock');
        var first = $('.sk-sheet__close');
        if (first) first.focus();
      }
      function closeSheet() {
        if (!sheet || sheet.hidden) return;
        sheet.classList.remove('is-on');
        body.classList.remove('sk-lock');
        setTimeout(function () { sheet.hidden = true; }, 220);
      }
      $$('[data-sk-sheet]').forEach(function (el) {
        on(el, 'click', function () {
          el.getAttribute('data-sk-sheet') === 'open' ? openSheet() : closeSheet();
        });
      });

      /* ---------- 6. 공유 ---------- */
      (function share() {
        var box = $('.sk-share');
        if (!box || !isPost) return;
        if (F.share === false) { box.hidden = true; return; }
        box.hidden = false;

        var url = (function () {
          var can = $('link[rel="canonical"]');
          return (can && can.href) || location.href.split('#')[0];
        })();
        var title = (doc.querySelector('.post-cover h1') || {}).textContent || doc.title;
        title = title.replace(/\s+/g, ' ').trim();
        var eu = encodeURIComponent(url), et = encodeURIComponent(title);

        var links = {
          x: 'https://twitter.com/intent/tweet?text=' + et + '&url=' + eu,
          facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + eu,
          band: 'https://band.us/plugin/share?body=' + et + '%0A' + eu + '&route=' + eu
        };
        Object.keys(links).forEach(function (k) {
          var a = $('[data-sk-share="' + k + '"]');
          if (a) {
            a.href = links[k];
            on(a, 'click', function (e) {
              e.preventDefault();
              window.open(links[k], 'sk-share-' + k, 'width=600,height=520,noopener');
            });
          }
        });

        on($('[data-sk-share="copy"]'), 'click', function () {
          var done = function () { toast('링크를 복사했습니다'); };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done, fallback);
          } else fallback();
          function fallback() {
            var ta = doc.createElement('textarea');
            ta.value = url; ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;left:-9999px;';
            doc.body.appendChild(ta); ta.select();
            try { doc.execCommand('copy'); done(); } catch (e) { toast('복사에 실패했습니다'); }
            doc.body.removeChild(ta);
          }
        });

        var native = $('[data-sk-share="native"]');
        if (native && navigator.share) {
          native.hidden = false;
          on(native, 'click', function () {
            navigator.share({ title: title, url: url }).catch(function () { });
          });
        }
      })();

      /* ---------- 7. 본문 다듬기 (표 스크롤 · 코드 복사 · 이미지 · 외부 링크) ---------- */
      (function enhanceContent() {
        if (!article) return;

        // 표: 모바일에서 가로 스크롤
        $$('table', article).forEach(function (t) {
          if (t.parentNode.classList && t.parentNode.classList.contains('sk-tablewrap')) return;
          var w = doc.createElement('div');
          w.className = 'sk-tablewrap';
          w.setAttribute('tabindex', '0');
          w.setAttribute('role', 'region');
          w.setAttribute('aria-label', '표 (좌우 스크롤 가능)');
          t.parentNode.insertBefore(w, t);
          w.appendChild(t);
        });

        // 코드 블록 복사 버튼
        if (F.copyCode !== false) {
          $$('pre', article).forEach(function (pre) {
            if (!(pre.textContent || '').trim()) return;
            var wrap = doc.createElement('div');
            wrap.className = 'sk-codewrap';
            pre.parentNode.insertBefore(wrap, pre);
            wrap.appendChild(pre);
            var btn = doc.createElement('button');
            btn.type = 'button';
            btn.className = 'sk-copy';
            btn.textContent = '복사';
            wrap.appendChild(btn);
            on(btn, 'click', function () {
              var t = pre.textContent;
              var ok = function () { btn.textContent = '복사됨'; toast('코드를 복사했습니다'); setTimeout(function () { btn.textContent = '복사'; }, 1600); };
              if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, function () { });
              else ok();
            });
          });
        }

        // 이미지: 지연 로딩 + 로드 후 페이드인
        if (F.lazyImages !== false) {
          $$('img', article).forEach(function (img, i) {
            if (i > 0 && !img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
            if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
            img.classList.add('sk-img');
            if (img.complete) img.classList.add('is-loaded');
            else on(img, 'load', function () { img.classList.add('is-loaded'); });
          });
        }

        // 외부 링크는 새 탭 + 보안 속성
        if (F.externalBlank !== false) {
          $$('a[href^="http"]', article).forEach(function (a) {
            if (a.host === location.host) return;
            a.setAttribute('target', '_blank');
            var rel = (a.getAttribute('rel') || '').split(/\s+/);
            ['noopener', 'noreferrer'].forEach(function (r) { if (rel.indexOf(r) < 0) rel.push(r); });
            a.setAttribute('rel', rel.join(' ').trim());
            a.classList.add('sk-extlink');
          });
        }
      })();

      /* ---------- 8. 애드센스: 본문 중간 · 하단 ---------- */
      (function ads() {
        if (!AD.client) return;

        var io = null;
        if (AD.lazy !== false && 'IntersectionObserver' in window) {
          io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
              if (!en.isIntersecting) return;
              push(en.target);
              io.unobserve(en.target);
            });
          }, { rootMargin: '600px 0px' });
        }

        function push(wrap) {
          var ins = $('ins.adsbygoogle', wrap);
          if (!ins || ins.getAttribute('data-sk-pushed')) return;
          ins.setAttribute('data-sk-pushed', '1');
          try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { }
        }

        function build(kind, slot) {
          if (!slot) return null;
          var wrap = doc.createElement('div');
          wrap.className = 'sk-ad sk-ad--' + kind;
          if (AD.label) {
            var lb = doc.createElement('span');
            lb.className = 'sk-ad__label';
            lb.textContent = AD.label;
            wrap.appendChild(lb);
          }
          var ins = doc.createElement('ins');
          ins.className = 'adsbygoogle';
          ins.style.display = 'block';
          ins.setAttribute('data-ad-client', AD.client);
          ins.setAttribute('data-ad-slot', String(slot));
          if (kind === 'inarticle') {
            ins.style.textAlign = 'center';
            ins.setAttribute('data-ad-layout', 'in-article');
            ins.setAttribute('data-ad-format', 'fluid');
          } else if (kind === 'multiplex') {
            ins.setAttribute('data-ad-format', 'autorelaxed');
          } else {
            ins.setAttribute('data-ad-format', 'auto');
            ins.setAttribute('data-full-width-responsive', 'true');
          }
          wrap.appendChild(ins);
          return wrap;
        }

        function activate(wrap) {
          if (!wrap) return;
          if (io) io.observe(wrap); else push(wrap);
        }

        // 8-1. 본문 중간 — 섹션(h2/h3) 경계에만, 광고 사이 최소 간격을 지켜서 삽입
        if (isPost && AD.inArticleSlot) {
          var full = (article.textContent || '').trim();
          if (full.length >= num(AD.minBodyChars, 1800)) {
            var max = num(AD.maxInArticle, 3);
            var gap = num(AD.minGapChars, 1300);
            var nodes = Array.prototype.slice.call(article.children);
            var placed = 0, acc = 0;

            for (var i = 0; i < nodes.length && placed < max; i++) {
              var n = nodes[i];
              acc += (n.textContent || '').length;
              var isBoundary = /^H[23]$/.test(n.tagName);
              var nearEnd = i >= nodes.length - 2;          // 글 끝에는 넣지 않는다
              if (isBoundary && !nearEnd && acc >= gap) {
                var unit = build('inarticle', AD.inArticleSlot);
                if (!unit) break;
                article.insertBefore(unit, n);
                activate(unit);
                placed++; acc = 0;
              }
            }

            // 소제목이 거의 없는 글: 문단 기준으로 한 번만 삽입
            if (placed === 0) {
              var acc2 = 0;
              for (var j = 0; j < nodes.length - 2; j++) {
                acc2 += (nodes[j].textContent || '').length;
                if (nodes[j].tagName === 'P' && acc2 >= gap) {
                  var u2 = build('inarticle', AD.inArticleSlot);
                  if (u2) { article.insertBefore(u2, nodes[j]); activate(u2); }
                  break;
                }
              }
            }
          }
        }

        // 8-2. 본문 하단 (디스플레이 + 멀티플렉스)
        var zone = $('[data-sk-adzone="bottom"]');
        if (isPost && zone) {
          [['bottom', AD.bottomSlot], ['multiplex', AD.multiplexSlot]].forEach(function (pair) {
            var unit = build(pair[0], pair[1]);
            if (unit) { zone.appendChild(unit); activate(unit); }
          });
        }
      })();

      /* ---------- 9. 스크롤 등장 애니메이션 ---------- */
      (function reveal() {
        if (F.reveal === false || reduceMotion || !('IntersectionObserver' in window)) return;
        var targets = $$('.post-item, .cover-thumbnail-1 ul li, .cover-thumbnail-2 ul li, .cover-thumbnail-4 ul li, .cover-list ul li, .related-articles ul li, .entry-content figure');
        if (!targets.length) return;
        targets.forEach(function (t) { t.classList.add('sk-reveal'); });
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            en.target.classList.add('is-in');
            io.unobserve(en.target);
          });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
        targets.forEach(function (t) { io.observe(t); });
      })();

      /* ---------- 10. 사이드바 서랍 닫기 · 키보드 단축키 ---------- */
      (function shortcuts() {
        // 모바일 서랍 닫기(원본 스킨에는 닫기 버튼이 없어 추가)
        function closeDrawer() {
          body.classList.remove('mobile-menu');
          var dim = doc.getElementById('dimmed');
          if (dim && dim.parentNode) dim.parentNode.removeChild(dim);
        }
        on($('#aside .close'), 'click', closeDrawer);
        on(doc, 'click', function (e) {
          if (e.target && e.target.id === 'dimmed') closeDrawer();
        });

        if (F.shortcuts === false) return;
        on(doc, 'keydown', function (e) {
          var tag = (e.target.tagName || '').toLowerCase();
          var typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

          if (e.key === 'Escape') {
            closeSheet();
            closeDrawer();
            if (typing) e.target.blur();
            return;
          }
          if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

          if (e.key === '/') {
            var searchBox = $('#header .util .search');
            var input = searchBox && $('input', searchBox);
            if (input) {
              e.preventDefault();
              searchBox.classList.add('on');
              input.focus();
            }
          } else if (e.key === 'd' || e.key === 'D') {
            var t = $('.sk-theme-toggle');
            if (t) t.click();
          }
        });
      })();

      /* ---------- 11. 구조화 데이터 (사이트 검색 · 이동경로) ---------- */
      (function jsonLd() {
        if (F.jsonLd === false) return;
        var blocks = [];
        var home = (function () {
          var a = $('#header h1 a');
          return (a && a.href) || location.origin + '/';
        })();
        var siteName = (function () {
          var a = $('#header h1 a');
          var img = a && $('img', a);
          return (img && img.alt) || (a && a.textContent.trim()) || doc.title;
        })();

        if (/tt-body-index/.test(body.id)) {
          blocks.push({
            '@context': 'https://schema.org', '@type': 'WebSite',
            name: siteName, url: home,
            potentialAction: {
              '@type': 'SearchAction',
              target: { '@type': 'EntryPoint', urlTemplate: home.replace(/\/$/, '') + '/search/{search_term_string}' },
              'query-input': 'required name=search_term_string'
            }
          });
        }

        if (isPost) {
          var cat = $('.post-cover .category');
          var crumbs = [{ '@type': 'ListItem', position: 1, name: siteName, item: home }];
          if (cat && cat.textContent.trim()) {
            crumbs.push({ '@type': 'ListItem', position: 2, name: cat.textContent.trim() });
          }
          var h1 = $('.post-cover h1');
          if (h1) {
            crumbs.push({
              '@type': 'ListItem', position: crumbs.length + 1,
              name: h1.textContent.replace(/\s+/g, ' ').trim(),
              item: location.href.split('#')[0]
            });
          }
          blocks.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs });
        }

        blocks.forEach(function (b) {
          var s = doc.createElement('script');
          s.type = 'application/ld+json';
          s.textContent = JSON.stringify(b).replace(/</g, '\\u003c');
          doc.head.appendChild(s);
        });
      })();

    })();
  </script>
</body>

</html>
