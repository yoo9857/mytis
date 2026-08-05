/**
 * 사진 라이선스 판정 — **허용 기준은 이 파일 하나가 갖는다.**
 *
 * 왜 따로 뺐는가: 기준이 두 곳에 있었고 서로 달랐다.
 *  - `scripts/wm-photos.mjs` 는 정규식으로 `PD · CC0 · CC BY · CC BY-SA · No restrictions` 를 받았다
 *  - `.gitignore` 주석은 "위키미디어 **PD·CC0**만 예외로 올린다" 고 적혀 있었다
 * 코드가 받아 놓은 CC BY 폴더가 문구로는 올리면 안 되는 것이 되어, 커밋해도 되는지
 * 사람이 매번 다시 판단해야 했다 (2026-08-05).
 *
 * 이제 수집기(`wm-photos.mjs`)와 검사기(`scripts/photolint.mjs`)가 같은 함수를 쓴다.
 * 기준을 바꾸려면 여기만 고치고, `.gitignore` 주석은 이 파일을 가리킨다.
 *
 * ## 무엇을 허용하나
 *
 * **표기만 하면 재배포까지 되는 것**만 허용한다. 이 저장소는 공개이므로 커밋은
 * 발행과 별개로 **재배포**다 — 발행 위험(§6)을 발행자가 감수하기로 한 결정이
 * 재배포까지 덮지 않는다.
 *
 *  - `PD` / `Public domain` — 권리 소멸
 *  - `CC0` — 권리 포기
 *  - `CC BY` — 표기 의무만
 *  - `CC BY-SA` — 표기 + 동일조건. 재배포 가능하므로 허용한다
 *  - `No restrictions` — Flickr Commons 등
 *
 * ## 무엇을 막나 (전부 실측에서 나왔다)
 *
 *  - `CC BY-NC` / `CC BY-ND` — 상업 이용 또는 변형 금지. 애드센스가 붙은 블로그에 쓴다
 *  - `KOGL 제2~4유형` — 상업 금지·변경 금지가 섞인다. 서울시 교통 누리집이 제4유형이다
 *  - **방송 화면 캡처 · 언론사 보도사진 · 서점 상품컷** — 라이선스가 아예 없다
 *
 * ⚠️ `KOGL Type 1`(공공누리 제1유형)은 상업 이용·변형이 허용되지만 **아직 받지 않는다.**
 *    유형 표기가 파일마다 정확하지 않은 것을 봤고(제1유형이라 적혀 있으나 원출처가
 *    제4유형인 경우), 넓히려면 유형을 원출처에서 확인하는 절차가 먼저다.
 */

/** 표기하면 재배포까지 되는 라이선스. 이 밖은 받지 않는다. */
const OPEN = [
  /^cc0\b/i,
  /^public domain\b/i,
  /^pd\b/i,
  /^cc by(?![-\s]*(nc|nd))/i, // CC BY, CC BY-SA 는 통과 · CC BY-NC/ND 는 막는다
  /* 위키미디어가 `cc` 를 떼고 `by-sa`·`by` 로만 적어 둔 항목이 있다.
   * > 2026-08-05 실측 — 추적 중인 폴더에서 `by-sa` 한 건이 "허용 안 됨" 으로 걸렸다.
   * 아래 BLOCKED 가 nc·nd 를 다시 막으므로 여기서는 접두사만 본다. */
  /^by(?![-\s]*(nc|nd))/i,
  /^no restrictions\b/i,
];

/** 명시적으로 막는 것 — OPEN 정규식이 느슨해져도 여기서 다시 걸린다. */
const BLOCKED = /(\bnc\b|non-?commercial|\bnd\b|no ?deriv|kogl|공공누리|제[2-4]유형|all rights reserved|copyright)/i;

/**
 * 이 라이선스 문자열을 저장소에 커밋해도 되는가.
 * @param {string} license 위키미디어 `LicenseShortName` 같은 표기 문자열
 */
export function isOpenLicense(license) {
  const s = String(license || '').trim();
  if (!s) return false;
  if (BLOCKED.test(s)) return false;
  return OPEN.some((re) => re.test(s));
}

/** 사람에게 보여줄 허용 목록 한 줄 (문구와 코드를 같은 문장으로 유지한다). */
export const OPEN_LICENSE_LABEL = 'PD · CC0 · CC BY · CC BY-SA · No restrictions';

/**
 * manifest.json 한 벌을 검사한다.
 * @returns {{ok: boolean, bad: Array<{file: string, license: string, why: string}>}}
 */
export function checkManifest(manifest) {
  const items = Array.isArray(manifest?.items) ? manifest.items : [];
  const bad = [];
  for (const it of items) {
    /* 라이선스 칸이 아예 없는 항목 — 캡처·보도사진·상품컷이 이렇게 들어온다.
     * "모르는 것" 을 통과시키면 검사가 무력해지므로 막는 쪽으로 실패한다. */
    if (!String(it?.license || '').trim()) {
      bad.push({ file: it?.file || '(이름 없음)', license: '(없음)', why: '라이선스 표기가 없다' });
      continue;
    }
    if (!isOpenLicense(it.license)) {
      bad.push({ file: it?.file || '(이름 없음)', license: it.license, why: '재배포가 허용되지 않는다' });
    }
  }
  return { ok: bad.length === 0 && items.length > 0, bad, count: items.length };
}
