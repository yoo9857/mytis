# 티스토리 자동 글쓰기 · 자동 발행

> **처음 인수받으셨나요? [HANDOVER.md](HANDOVER.md) 를 먼저 읽으세요.**
> 새 컴퓨터 세팅 순서, 반드시 알아야 할 함정 4가지, 저작권 제약이 정리돼 있습니다.


주제 한 줄만 주면 **codex CLI가 웹을 검색해 최신 정보로 글을 쓰고**, 썸네일·본문 이미지를 만들고,
**Chrome을 직접 조작해 티스토리에 발행까지** 끝냅니다. 티스토리 API는 신규 발급이 막혀 있어 브라우저 자동화로 처리합니다.

```
주제 → codex(웹검색+집필) → 이미지 생성 → HTML 조립 → 카카오 로그인 → 에디터 입력 → 발행
```

---

## 1. 최초 설정 (한 번만)

### 1-1. 의존성 설치

```powershell
git clone https://github.com/yoo9857/mytis.git
cd mytis
npm install
```

`playwright install chromium`이 자동으로 함께 실행됩니다.

**유튜브 영상을 소재로 쓰거나 장면을 캡처하려면** 추가 준비물이 있습니다.
기사 기반 글쓰기만 할 거면 건너뛰어도 됩니다.

```powershell
pip install -r requirements.txt          # yt-dlp[default] · opencv 4.x
winget install Gyan.FFmpeg               # ffmpeg + ffprobe (둘 다 필요)
```

Node는 **22 이상**이어야 합니다 — yt-dlp가 유튜브 서명 검증에 Node를 JS 런타임으로 씁니다.
없으면 자막·영상 접근이 403으로 막힙니다. `npm run doctor`가 이 항목들을 점검합니다.
자세한 설명은 [HANDOVER 2-1-1](HANDOVER.md)에 있습니다.

### 1-2. 블로그 정보 입력

`.env.example`을 `.env`로 복사한 뒤 채웁니다.

```powershell
Copy-Item .env.example .env
notepad .env
```

```ini
KAKAO_ID=your-kakao-id@example.com
KAKAO_PW=your-password
TISTORY_BLOG=myblog          # myblog.tistory.com 이면 myblog
TISTORY_CATEGORY=재테크        # 비우면 카테고리 미지정
```

> `.env`는 `.gitignore`에 들어 있습니다. 절대 공유하지 마세요.

### 1-3. 최초 로그인 (중요)

```powershell
npm run login
```

Chrome이 열리고 카카오 로그인이 자동으로 진행됩니다.
**2단계 인증·기기 등록·캡차가 뜨면 이 창에서 직접 통과해 주세요.** 최대 3분 기다립니다.

한 번 성공하면 세션이 `profile/`에 저장되어 **이후에는 브라우저를 띄우지 않고도(`--headless`) 무인 실행**됩니다.
이 단계를 건너뛰면 스케줄러 실행이 카카오 추가 인증에서 막힙니다.

### 1-4. 점검

```powershell
npm run doctor    # 블로그 주소·계정·세션 유효성
npm run verify    # 로그인 화면 셀렉터가 현재 티스토리와 맞는지 (계정 없이도 실행 가능)
```

### 1-5. 첫 발행은 비공개로

```powershell
npm run post -- "테스트 주제" --private --show
```

`--private` 는 이번 실행만 비공개로 올립니다. `--show` 는 브라우저를 띄워 과정을 눈으로 확인합니다.
결과가 마음에 들면 플래그 없이 실행하면 공개로 발행됩니다.

---

## 2. 사용법

### 글 하나 즉시 발행

```powershell
npm run post -- "2026년 청년도약계좌 가입 조건과 신청 방법"
```

### 발행 없이 초안만 확인

```powershell
npm run draft -- "무지출 챌린지 한 달 실천 후기"
```

`out/`에 아티클 JSON과 `*.preview.html`이 생깁니다. 미리보기를 브라우저로 열어 확인한 뒤 발행하세요.

```powershell
npm run publish -- out\20260727-143000-무지출-챌린지.json
```

### 뉴스 기사로 글 쓰기

기사 URL을 그대로 주면, 그 기사를 읽고 **출처를 밝힌 자체 해설 글**을 씁니다.

```powershell
npm run post -- "https://enews.imbc.com/News/RetrieveNewsInfo/512756"
npm run draft -- "https://enews.imbc.com/News/RetrieveNewsInfo/512756"   # 확인만
```

원 기사 문장을 옮기지 않고, 사실만 취해 새로 씁니다. 같은 사안의 다른 매체 기사를 교차 검색해
배경·경과·후속을 더하므로 원 기사보다 정보량이 많아집니다. 출처는 본문과 `참고 자료`에 남습니다.

### 최신 기사 자동 수집

```powershell
npm run news                              # 소재 후보만 보여줌
npm run news -- --add                     # 찾은 기사를 큐에 추가
npm run news -- --add --now               # 큐에 넣고 1위 기사를 바로 발행
npm run news -- "아이돌 컴백" --count 8 --hours 12
```

화제성(`heatScore`)이 높고 아직 포화되지 않은 소재를 우선으로 고릅니다.
미확인 루머·사생활 추측·미성년자 민감 사안은 후보에서 제외합니다.

기본 분야는 `config.json`의 `news.query`로 바꿉니다.

```json
"news": { "query": "한국 연예 뉴스", "count": 5, "hours": 24 }
```

큐(`topics.txt`)에는 일반 주제와 기사 URL을 섞어 넣을 수 있습니다. URL로 시작하는 줄은 자동으로 뉴스 모드로 처리됩니다.

### 주제 큐로 관리

```powershell
node src/cli.js topics add "국내 ETF와 해외 ETF 세금 차이" "월 50만원 저축 포트폴리오"
node src/cli.js topics list

npm run queue                 # 큐에서 1개 꺼내 발행
npm run queue -- --count 3    # 3개 연속 발행 (사이 30초 대기)
```

성공한 주제는 `topics.txt`에서 빠지고 `topics.done.txt`로, 실패는 `topics.failed.txt`로 이동합니다.

---

## 2-1. 스타·연예인 모드 (기사 기반 자동 발행)

연예 기사 URL 하나만 주면 아래가 전부 자동으로 돕니다.

```powershell
npm run post -- "https://m.entertain.naver.com/..."      # 바로 발행
npm run draft -- "https://m.entertain.naver.com/..."     # 확인만
```

| 단계 | 하는 일 |
|---|---|
| 사실 확보 | 원문 기사 본문 추출 + 웹 검색으로 교차 검증 |
| **사진** | 원문 기사 사진 → **부족하면 인용한 다른 기사에서 추가 수집** |
| 사진 화질 | `_V`·`.webp` 를 떼고 가장 큰 원본. 원본보다 크게 렌더링하지 않음 |
| 사진 중복 | 같은 사진의 크기 변형을 걸러 **서로 다른 컷**만 |
| 대표 이미지 | 얼굴 기준 자동 선별. 합성본·로고·작은 이미지는 제외 |
| 인물 사진 | `entities[].nameEn` 이 있는 인물만 위키미디어에서 |
| 카테고리 | 글 내용에 맞춰 자동 선택 (`blog.category: "auto"`) |
| 영상 | 공식 채널 유튜브 임베드 (없으면 생략) |

수동으로 소재를 찾을 필요도 없습니다.

```powershell
npm run news                      # 화제도 순 후보만 보기
npm run news -- --add             # 큐에 추가
npm run news -- --add --now       # 큐에 넣고 1위 기사 바로 발행
```

### 스케줄러에 걸기

```powershell
# 매일 09:00 — 연예 기사 5건 수집해서 1건 발행
powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1 -Star -Time 09:00

# 07:30 / 19:30 두 번, 회당 2건 발행 (8건 수집)
powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1 -Star -Time 07:30,19:30 -Count 2 -Find 8
```

`-Star` 를 붙이면 `scripts\run-star.cmd` 가 등록됩니다. 수집(`news --add`) → 발행(`queue`) 순서로 돌고
결과는 `logs\scheduler.log` 에 쌓입니다. 수집이 실패해도 기존 큐로 발행을 계속합니다.

바로 한 번 돌려보려면:

```powershell
scripts\run-star.cmd 1 5          # 5건 수집해서 1건 발행
Get-Content logs\scheduler.log -Tail 40
```

> **분량 주의**: 짧은 간격으로 대량 발행하면 티스토리 스팸 필터에 걸립니다. 하루 1~3개를 권장합니다.

---

## 3. 자동 배포 (Windows 작업 스케줄러)

```powershell
# 매일 오전 9시에 1개 발행
powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1 -Time 09:00

# 매일 07:30 / 19:30 두 번, 회당 2개
powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1 -Time 07:30,19:30 -Count 2

# 오전 8시부터 3시간마다
powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1 -Time 08:00 -RepeatHours 3
```

확인 · 해제:

```powershell
Start-ScheduledTask -TaskName MoneytiTistoryAutoPost   # 지금 한 번 실행
Get-Content logs\scheduler.log -Tail 40                # 실행 로그
powershell -ExecutionPolicy Bypass -File scripts\unregister-task.ps1
```

기본값은 **로그온 상태에서만 실행**입니다. 로그오프 상태에서도 돌리려면 `-RunWhenLoggedOff`를 붙이세요
(단, Chrome 세션 안정성은 로그온 상태가 더 좋습니다).

---

## 3-1. 스킨 광고 설정 (`skinecode.md` 의 `window.SKIN.adsense`)

애드센스 → **광고 → 광고 단위 기준**에서 단위를 만들고, 코드의 `data-ad-slot="1234567890"` 에서 **숫자만** 복사해 넣습니다. 비워 두면 그 자리 광고는 삽입되지 않습니다(자동 광고는 그대로 동작).

| 키 | 설명 |
|---|---|
| `inArticleSlot` | 본문 중간 광고. 소제목(h2/h3) 경계에만, `minGapChars` 간격을 지켜 최대 `maxInArticle` 개 |
| `bottomSlot` | 본문 하단 디스플레이 광고 |
| `multiplexSlot` | 본문 하단 멀티플렉스(추천 콘텐츠) |
| `sidebarSlot` | **사이드바 광고** |
| `sidebarOn` | 사이드바 광고를 어디에 띄울지. `home`(기본) / `all` / `post` |
| `sidebarSticky` | 사이드바 광고가 스크롤을 따라오게 할지 (1024px 이상에서 사이드바 전체가 고정됨) |
| `minBodyChars` | 본문이 이보다 짧으면 중간 광고 생략 (정책상 안전) |
| `lazy` | 화면에 가까워질 때 로드. 내부 스크롤 영역의 광고는 문서 끝에서 자동 보정 |
| `label` | 광고 위에 붙는 라벨. 빈 문자열이면 숨김 |

---

## 4. 설정 (`config.json`)

| 키 | 설명 |
|---|---|
| `blog.name` | `myblog.tistory.com` 이면 `myblog`. `.env`의 `TISTORY_BLOG`가 우선 |
| `blog.category` | 카테고리 이름, 또는 **`auto`**(글 내용에 맞춰 자동 선택). ⚠️ **비워 두지 마세요** — 티스토리는 카테고리를 지정하지 않으면 **직전 글의 카테고리를 물려줍니다** |
| `blog.categoryFallback` | `auto` 가 확신하지 못했을 때 쓸 카테고리. 비우면 `카테고리 없음` |
| `blog.categoryAliases` | 카테고리 이름 → 본문에서 찾을 낱말들. 예: `{"방송": ["아이돌","드라마"]}`. `src/category.js` 의 기본 별칭에 더해집니다 |
| `blog.visibility` | `public` / `protected` / `private` |
| `blog.publishMode` | `now`(즉시) 또는 `reserve`(예약) |
| `blog.reserveAfterMinutes` | 예약 모드일 때 몇 분 뒤에 발행할지 |
| `article.minChars` | 목표 본문 분량. 절반 미만이면 자동 재시도 |
| `article.sectionCount` | 목표 섹션 수 |
| `article.tone` / `audience` | 글의 톤과 타깃 독자 |
| `article.extraInstructions` | 매 글에 추가로 넣을 지시문 |
| `seo.*` | 목차·핵심요약·FAQ·출처·JSON-LD 삽입 여부 |
| `images.bodyImages` | 본문 삽입 이미지 개수 (0이면 대표 이미지만) |
| `images.background` | `photo` = 실사 사진 배경, `gradient` = 그라디언트만 |
| `images.scrim` | 사진 위를 덮는 어두운 정도 (0~1). 글자가 안 보이면 올리세요 |
| `images.showCredit` | 카드 우하단에 사진 출처 표기 여부 |
| `images.layout` | 비우면 글마다 다른 연출 자동 선택. `editorial`/`panel`/`spotlight`/`figure`/`band` 로 고정 가능 |
| `images.useStats` | 본문 핵심 수치를 카드에 표시할지 |
| `images.useSourcePhoto` | ⚠️ 소재 기사에 실린 **언론사 사진**을 쓸지. 저작권 위험은 발행자 부담 |
| `images.usePersonPhotos` | 위키미디어 인물 사진을 쓸지. `entities[].nameEn` 이 있을 때만 동작 |
| `images.personPhotoOnThumb` | 인물 사진을 대표 이미지에도 쓸지. 기본 `false`(본문에만) |
| `images.brand` | 이미지 카드에 넣을 브랜드 표기 |
| `images.palettes` | 그라디언트 폴백 색 조합 · 사진 배경일 때 포인트 색. 글 제목 해시로 자동 선택. **6자리 hex만** |
| `news.query` | `npm run news` 의 기본 분야 |
| `news.count` | 한 번에 수집할 기사 수 |
| `news.hours` | 몇 시간 이내 기사만 볼지 |
| `codex.model` | 사용할 모델 (비우면 codex 기본값) |
| `codex.search` | 웹 검색 사용 여부. 최신 정보가 필요하면 반드시 `true` |
| `codex.timeoutMs` | 글 생성 제한 시간 |
| `browser.headless` | 기본 실행 시 브라우저 표시 여부 |
| `browser.slowMo` | 조작 사이 지연(ms). 값이 크면 안정적, 작으면 빠름 |

---

## 5. 생성되는 글의 구조

SEO(검색엔진)와 GEO(생성형 검색 인용) 양쪽을 노린 구조로 조립됩니다.

- **한 줄 정리** — 제목이 던진 질문에 즉답하는 박스. AI 검색이 인용하기 좋은 형태
- **이 글의 핵심** — 단독 인용해도 말이 되는 완결형 사실 문장 목록
- **목차** — 섹션 앵커 링크
- **본문 섹션** — h2 + 문단 + 불릿 + 비교표 + 강조 박스, 사이사이 이미지
- **자주 묻는 질문** — 실제 검색 질의 형태
- **마치며** / **참고 자료** — 실제로 열어본 출처 링크만
- **JSON-LD** — `BlogPosting` + `FAQPage` 구조화 데이터 (`seo.includeJsonLd`)

### 이미지

**실사 사진 배경 + 텍스트 오버레이** 카드로 만들어집니다.

**대표 이미지 1장은 텍스트 카드, 본문 사진은 텍스트 없는 사진**으로 나갑니다.

| | 크기 | 내용 |
|---|---|---|
| 대표 이미지 | **1200×1200 정사각** | 사진 위에 우하단 심플 라벨만 (티스토리 목록·공유 카드가 정사각으로 잘림) |
| 본문 사진 | 가로·세로 **랜덤** (3:2 / 4:3 / 1:1 / 3:4 / 2:3) | 텍스트 없이 사진 그대로 |

1. 글을 쓸 때 codex가 이미지마다 **영어 사진 검색어**(`photoQuery`)를 같이 뽑습니다
2. 그 검색어로 실사 사진을 구합니다 (아래 순서)
3. 대표 이미지는 사진 밝기를 재서 스크림을 자동 조절하고 우하단에 분류·제목·브랜드만 얹습니다
4. 티스토리에 실제 업로드 → 본문에는 이미지 매크로(`[##_Image|...|_##]`)로 삽입. 첫 이미지가 대표 이미지가 됩니다

```jsonc
"images": {
  "thumbSize": 1200,          // 대표 이미지 한 변
  "thumbLayout": "clean",     // 정보 최소화 연출
  "bodyStyle": "photo",       // photo = 텍스트 없는 사진 | card = 텍스트 카드
  "bodyAspects": ["3:2", "4:3", "3:4", "1:1", "2:3"]
}
```

**사진 소스 우선순위**

| 순위 | 소스 | 키 | 용도 | 라이선스 |
|---|---|---|---|---|
| **★** | **원문 기사 사진** | 불필요 | 기사 기반 글의 대표·본문. `images.useSourcePhoto` | ⚠️ **언론사 저작물** |
| 0 | 위키미디어 공용 | 불필요 | 인물 실물 사진. **`entities[].nameEn` 이 있을 때만** | 상업 이용 가능 |
| 1 | Pexels / Unsplash / Pixabay | 무료 발급 | 장면 스톡 사진 | 상업 이용 무료 |
| 2 | codex 웹 검색 | 불필요 | 위 API가 없거나 실패했을 때 | 화이트리스트 도메인만 |
| 3 | Openverse | 불필요 | 마지막 폴백 | 열린 라이선스 |

전부 실패하면 그라디언트 카드로 폴백하므로 파이프라인이 멈추지 않습니다.

### ⚠️ `images.useSourcePhoto` — 기본 방침을 뒤집는 옵션

`true` 로 두면 **소재 기사에 실린 사진을 그대로 씁니다.** 연예 글에서 "그날 그 장면"을
보여주는 유일한 현실적 방법이지만, **언론사 보도사진은 저작권이 있습니다.**

이 저장소의 원래 방침(§ 아래 "저작권 처리")은 스톡 사진만 쓰는 것이었습니다.
이 옵션을 켜는 것은 **발행자가 위험을 감수하겠다는 선택**입니다. 켜면 실행할 때마다
경고 로그가 찍힙니다.

켠다면 최소한 이것들은 지켜집니다(코드가 자동 처리):

- 매체 도메인이 사진 우하단에 표기됩니다 (`Photo: en.seoul.co.kr · press photo`, 한글 없음)
- 매체명과 원문 링크가 본문 하단 "이미지 출처"에 남습니다
- 같은 사진의 크기 변형(`_V` 등)을 걸러 **서로 다른 컷**만 씁니다
- `_V`·`.webp` 를 떼고 **가장 큰 원본**을 받습니다
- 원본보다 크게 렌더링하지 않습니다(업스케일 방지)

끄려면 `"images": { "useSourcePhoto": false }`.

### 인물 사진 규칙

- **`entities[].nameEn` 이 있는 인물만** 위키미디어에서 찾습니다.
  `nameEn` 이 비어 있으면 "위키미디어에 없는 사람"이라는 뜻이라 검색하지 않습니다.
  한글 이름으로 검색하면 동명이인·한자 문서가 걸립니다.
- 인물 사진은 **본문 슬롯에만** 들어갑니다. 대표 이미지에는 글이 지정한 장면 사진을 씁니다.
  (인물 검색은 공연 사진을 물어오는데, 대표 이미지에는 헤드라인이 얹혀 주제와 어긋납니다)
- 예전처럼 대표에도 쓰려면 `"images": { "personPhotoOnThumb": true }`.

> **국내 연예인 사진의 현실**
> 위키미디어 공용에 한국 연예인 사진은 거의 없고, 있어도 대부분 광고 스틸입니다.
> 게다가 팬이 광고 사진을 "본인 저작물"로 올려 라이선스를 잘못 표시한 경우가 섞여 있습니다.
> 그래서 코드가 광고·포스터·앨범커버로 보이는 항목을 걸러냅니다(`UNUSABLE_PATTERN`).
> **인물 얼굴을 보여주는 현실적인 방법은 아래 공식 유튜브 임베드입니다.**

### 실제 장면은 공식 영상 임베드로

**연예 글의 핵심 시각 자료는 "그 사건의 실제 장면"입니다.** 그런데 언론사 사진과 팬이 찍은 사진은
저작권이 있어 내려받아 올릴 수 없습니다. 대신 **유튜브 임베드는 유튜브가 제공하는 기능이라 문제가 없고,
현장 영상을 그대로 보여줍니다.**

`src/youtube.js`가 유튜브 검색에서 직접 영상을 찾아옵니다 (codex에 맡기면 ID를 확신하지 못해 자주 비웁니다).

- 인물 이름(한글·영문)과 **사안 키워드가 제목에 모두 있는 영상만** 통과시킵니다
- 공식 채널(인증 배지·소속사·방송사)을 우선하고, 조회수 순으로 고릅니다
- **관련 영상이 없으면 아무것도 넣지 않습니다** — 무관한 예능 영상이 끼어드는 걸 막습니다
- 리액션·해석·정리 채널은 제외합니다

실제 결과 예시:

| 주제 | 찾아온 영상 |
|---|---|
| 장원영 시구 | `[오늘의 시구] 장원영&사쿠라 시구 시타!` — BEARS TV(두산 공식) / `시구하는 장원영 4K 직캠` |
| 세븐틴 군입대 | 없음 → 임베드 생략 (실제로 해당 영상이 존재하지 않음) |

개수는 `config.json`의 `"seo": { "embedCount": 2 }`, 끄려면 `"includeEmbeds": false`.

**연출은 매번 달라집니다.** 같은 틀을 반복하면 티가 나므로 여러 레이아웃을 두고
글 제목 해시 + 이미지 순번으로 골라 씁니다.

기본값은 **트렌디 스타일**(`src/cardStyles.js`) — 연예·팬 콘텐츠용입니다.

| 레이아웃 | 구도 |
|---|---|
| `neon` | 듀오톤 사진 + 네온 글로우 타이포 + 형광 알약 배지. 가장 K팝 썸네일다움 |
| `pop` | 사선으로 잘린 컬러 블록 + 회전된 스티커 배지. 밝고 통통 튐 |
| `zine` | 형광펜으로 그은 듯한 제목 + 그레인 + 프레임. 잡지·진 감성 |
| `poster` | 초대형 타이포가 사진에 걸침 + 비네트. 강렬한 한 방 |

정보성 글에는 **사설 스타일**(`src/cardLayouts.js`)이 더 어울립니다.

| 레이아웃 | 구도 |
|---|---|
| `editorial` | 하단 좌측 정렬. 액센트 룰 + 헤드라인, 우상단 수치 배지 |
| `panel` | 좌측 컬러 패널에 텍스트, 우측에 사진 피사체 |
| `spotlight` | 중앙 정렬 + 비네트 |
| `figure` | 수치가 주인공. 거대한 숫자 (수치가 있을 때만) |
| `band` | 사진 위 / 짙은 띠 아래. 가독성 최상 |

```jsonc
"images": {
  "style": "trendy",   // trendy(기본) | editorial | mixed
  "layout": ""         // 한 가지로 고정하려면 레이아웃 이름 (예: "neon")
}
```

공통 처리:
- **사진 밝기를 자동 측정**해 스크림 세기를 조절합니다. 어두운 사진은 덜 덮고, 밝은 사진은 더 덮습니다
- 인물 사진일 때는 얼굴을 가리지 않는 연출과 크롭 위치를 자동 선택합니다
- 본문에 나오는 수치를 카드에 얹습니다 (`images.useStats`로 끔)

### 저작권 처리

- codex가 URL을 직접 줄 때는 **images.unsplash.com · images.pexels.com · cdn.pixabay.com** 도메인만 통과시킵니다
  (`src/photo.js`의 `CODEX_ALLOWED_HOSTS`). 모델이 다른 곳의 사진을 가져오는 걸 코드 레벨에서 막습니다.
- 위키미디어 공용은 **CC0 · Public domain · CC BY · CC BY-SA**만 허용하고 **NC(비영리)·ND(변경금지)는 제외**합니다.
  NC는 애드센스가 붙은 블로그에서 못 쓰고, ND는 재가공이 금지라 카드로 만들 수 없기 때문입니다.
- CC BY 계열은 저작자 표기가 의무라, 카드 우하단과 본문 하단 **"이미지 출처"** 목록에 저작자·라이선스·원본 링크를 자동으로 남깁니다.
- `CC BY-SA`는 **동일조건변경허락**이라, 그 사진으로 만든 썸네일도 같은 라이선스로 공개해야 합니다.
  이 조건이 부담되면 `"images": { "allowShareAlike": false }`로 두면 CC BY·CC0·PD만 씁니다.

**속도를 올리려면** `.env`에 무료 API 키를 넣으세요. 하나만 넣어도 사진 확보가 몇 분 → 몇 초로 줄어듭니다.

```ini
PEXELS_API_KEY=
UNSPLASH_ACCESS_KEY=
PIXABAY_API_KEY=
```

그라디언트 카드만 쓰려면 `config.json`에서 `"images": { "background": "gradient" }`로 바꾸세요.

---

## 6. 실제 에디터에서 확인된 동작 (2026-07-27)

실제 티스토리 블로그에 발행해 확인한 내용입니다. 티스토리가 마크업을 바꾸면
`npm run verify` (로그인 화면) 와 `npm run probe` (에디터 화면) 로 다시 확인하세요.

| 항목 | 검증된 방식 |
|---|---|
| 로그인 | 카카오 자동 로그인 → 쿠키를 `profile/session.json` 에 저장 후 재주입 |
| 임시저장 팝업 | "이어서 작성하시겠습니까?" confirm 자동 거절 |
| 모드 전환 | `#editor-mode-html-tistory` / `#editor-mode-kakao-tistory`, 전환 confirm 자동 수락 |
| 본문 입력 | **`tinymce.activeEditor.setContent()` 로 위지윅에 직접 주입.** HTML 모드 → 기본모드 복귀 경로를 먼저 시도하지만 실측상 0자로 실패하고, 길이 검증 후 이 폴백이 본문을 채운다 |
| 이미지 업로드 | 툴바 첨부(`#mceu_0-open`) → "사진" → 파일 선택창 가로채기 |
| 이미지 삽입 | 업로드 후 HTML 모드에서 `[##_Image\|...\|_##]` 매크로를 회수해 본문에 배치 |
| 카테고리 | `#category-btn` → `.mce-menu-item` (하위 카테고리는 앞에 `- ` 가 붙음). **지정하지 않으면 직전 글의 카테고리를 물려받는다** |
| 태그 | `#tagText` 에 입력 후 Enter |
| 글 주소 | `#urlPublish` 를 영문 슬러그로 덮어씀 |
| 공개 범위 | `#open20`(공개) / `#open15`(보호) / `#open0`(비공개) |
| 발행 | `#publish-btn` |

> **순서가 중요합니다.** 카테고리와 태그는 **에디터 화면**에, 글 주소·공개 범위·발행 버튼은
> **발행 레이어** 안에 있습니다. 레이어를 먼저 열고 카테고리를 건드리면 레이어가 닫혀버립니다.
> 그래서 코드는 `카테고리 → 태그 → 완료(레이어 열기) → 글 주소 → 공개 범위 → 발행` 순서로 진행합니다.

### 세션이 유지되는 원리

티스토리 인증 쿠키(`__T_`, `__T_SECURE`)는 **만료 시각이 없는 세션 쿠키**라
브라우저를 닫으면 디스크에 남지 않습니다. Chrome 프로필 디렉터리만으로는 로그인이 유지되지 않습니다.
그래서 로그인 성공 시 쿠키를 `profile/session.json` 에 저장하고, 다음 실행에서 다시 주입합니다.

---

## 7. 문제가 생겼을 때

### 에디터 조작이 실패한다

티스토리는 예고 없이 화면 구조를 바꿉니다. 진단 덤프를 뜨세요.

```powershell
npm run probe
```

`logs/probe-*.json`에 버튼·입력창 id 목록이, `logs/shots/`에 스크린샷이 저장됩니다.
바뀐 id를 `src/tistory.js`의 `SEL` 객체 맨 앞에 추가하면 됩니다 (후보 배열이라 앞에 넣을수록 우선).

### 로그인이 자꾸 막힌다

```powershell
npm run login
```

카카오가 새 기기·새 IP를 의심하면 추가 인증을 요구합니다. 이건 자동화로 못 뚫습니다.
한 번 직접 통과시키면 `profile/`에 세션이 남습니다.

### 실행 흔적 확인

```powershell
Get-Content logs\2026-07-27.log -Tail 60   # 날짜별 상세 로그
Get-Content logs\scheduler.log -Tail 40    # 스케줄러 실행 로그
```

`logs/shots/`에는 발행 직전 화면과 실패 시점 스크린샷이 남습니다.

### 브라우저를 보면서 디버깅

```powershell
npm run post -- "주제" --show --verbose
```

---

## 8. 뉴스 기사를 소재로 쓸 때 지켜지는 선

기사 기반 글에는 다음 제약이 프롬프트에 걸려 있습니다 (`src/prompt.js`의 `buildNewsPrompt`).

**저작권**
- 기사 문장을 그대로 옮기지 않습니다. 사실만 취하고 표현은 전부 새로 씁니다.
- 직접 인용은 큰따옴표로 한두 문장까지, 발언자를 밝혀서만.
- 원문 기사를 `sources` 맨 앞에 강제로 넣습니다. 코드에서 누락 시 자동 추가합니다.

> 국내 언론사 기사에는 대부분 "무단 전재·복제 금지" 고지가 붙습니다.
> **사실 자체(수치, 순위, 일정)는 저작권 대상이 아니지만, 문장 표현은 보호받습니다.**
> 그래서 이 도구는 사실만 가져오고 문장은 새로 쓰는 방식만 지원합니다.

**인물 관련**
- 보도된 사실과 해석을 분리하고, "○○ 보도에 따르면" 식으로 귀속합니다.
- 미확인 루머, 사생활 추측, 열애·불화 단정 금지.
- 판결 전 사안은 "혐의", "의혹"으로만 표기.
- 외모 평가, 조롱, 신상 추측 금지.

**이미지**
- 언론사 사진과 인물 사진은 쓸 수 없습니다(초상권·저작권).
- 사안의 분위기를 나타내는 라이선스 프리 스톡 사진만 배경으로 씁니다.

**후킹과 신뢰의 균형**
- 제목은 구체적 사실과 수치를 앞세워 강하게 뽑되, 제목이 약속한 내용을 본문이 반드시 지킵니다.
- 낚시성 제목은 이탈률을 올려 검색 노출을 깎기 때문에 프롬프트에서 금지합니다.

---

## 9. 주의사항

- **발행 전 최소 한 번은 `npm run draft`로 결과물을 확인하세요.** codex가 웹 검색을 하더라도 사실 오류가 섞일 수 있습니다.
- 짧은 간격으로 대량 발행하면 티스토리 스팸 필터에 걸릴 수 있습니다. 하루 1~3개를 권장합니다.
- 의료·법률·투자 주제는 프롬프트에서 단정적 조언을 피하도록 지시하지만, 최종 책임은 발행자에게 있습니다.
- `profile/` 디렉터리에는 로그인 세션이 들어 있습니다. 백업·공유하지 마세요.

---

## 10. 구조

```
src/
  cli.js           명령 라우팅
  run.js           생성→이미지→HTML→발행 파이프라인
  config.js        config.json + .env 병합
  prompt.js        SEO/GEO 글쓰기 지시문 · 뉴스 해설 지시문 · 후킹 규칙
  schema/          codex 구조화 출력 스키마 (아티클 · 사진 · 뉴스피드)
  codexWriter.js   codex exec 실행 및 결과 정규화
  newsFeed.js      최신 기사 소재 탐색
  photo.js         실사 배경 사진 확보 (Pexels → codex → Openverse)
  cardLayouts.js   이미지 카드 레이아웃 5종
  images.js        카드 → PNG 렌더링
  html.js          아티클 JSON → 티스토리 HTML
  browser.js       Chrome persistent context
  kakaoLogin.js    카카오 로그인
  tistory.js       에디터 조작 및 발행
  queue.js         주제·기사 큐
scripts/
  run-queue.cmd        스케줄러가 호출하는 실행 스크립트
  register-task.ps1    작업 스케줄러 등록
  unregister-task.ps1  등록 해제
```
