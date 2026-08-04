/**
 * 선점 레이더 — **터진 것을 쫓지 않고, 터질 것을 먼저 잡는다.**
 *
 * ## 왜 만들었나
 *
 * `newsFeed.js` 는 "최근 N시간에 보도된 기사" 를 훑는다. 그건 이미 일어난 일이다.
 * 그런데 실측이 다른 것을 가리켰다.
 *
 * > 2026-08-04 — 「재혼 황후」 두 글이 발행 직후 유입을 받았다(사용자 확인).
 * > 그 작품은 **2026년 가을 공개 예정이고 아직 방영하지 않았다.** 즉 터진 사안을
 * > 빨리 쫓아서 된 것이 아니라, **수요가 올라오는 구간을 경쟁 없이 점유**해서 됐다.
 *
 * 그리고 속도는 이미 문제가 아니다 — 같은 날 실측으로 기사 모드는 URL 하나에서
 * 발행까지 **10~11분**(집필 6분50초~7분52초 + 발행 3분)이다. 사람이 이길 수 없다.
 * 느린 것은 손이 아니라 **"언제 쓸지 아는 것"** 이었다.
 *
 * 첫방송·OTT 공개·개봉·컴백·시상식은 **미리 공표된다.** 그것을 캘린더로 잡아
 * 발행 시점을 계산하는 것이 이 파일이다.
 *
 * ## 설계의 축 — 점수를 모델에게 묻지 않는다
 *
 * `newsFeed` 는 `heatScore` 하나를 모델에게 물었다. 그건 측정이 아니라 느낌이고,
 * 왜 그 점수인지 확인할 수 없어 틀려도 고칠 데가 없다.
 *
 * 여기서는 **검증 가능한 축으로 쪼개** 사실만 받는다 —
 * `demand`(수요 크기) · `saturation`(포화도) · `dateConfirmed`(확정 여부) ·
 * `evidence`(그렇게 본 근거). **우선순위는 코드가 계산한다.**
 * 이 프로젝트가 이미 쓰는 분업이다 (의미 판단은 AI, 검증은 코드).
 *
 * ⚠️ **리드타임과 가중치는 아직 가설이다 (실측 0건).** 첫 발행들의 성과가 쌓이면
 * `radar.json` 의 `outcome` 을 보고 교정한다. 실측 없이 만든 값을 실측처럼 다루면
 * §8-9 와 같은 일이 난다 — 게이트가 매번 울거나, 조용한데 틀린다.
 */
import fs from 'node:fs';
import { FILES, todayStr } from './paths.js';
import { log } from './log.js';
import { runCodexJson } from './codexWriter.js';

/**
 * 종류별 **리드타임(일)** — 이벤트 며칠 전에 발행해야 하는가.
 *
 * 근거는 검색 수요가 올라오는 시점이 종류마다 다르다는 것이다:
 *  - OTT 공개는 공개 전 검색이 길게 붙는다(작품 정보·원작·인물). 그래서 가장 길다.
 *  - 회차 리캡은 **방송 뒤에만** 쓸 수 있다(§7-17 — 방송 전 자료로 쓰면 다른 회차가 된다).
 *  - 컴백·시상식은 당일에 몰린다.
 *
 * ⚠️ 전부 **가설**이다. 값을 바꿀 때는 `radar.json` 의 성과를 근거로 바꾼다.
 */
const LEAD_DAYS = {
  ott_release: 7,
  concert: 5,
  drama_premiere: 3,
  movie_release: 2,
  other: 2,
  comeback: 1,
  award: 1,
  drama_finale: 0,
};

/** 날짜 문자열 → YYYYMMDD 숫자. 못 읽으면 null (없는 것으로 센다) */
function dayNum(text) {
  const m = String(text || '').match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!(y > 2000 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  return y * 10000 + mo * 100 + d;
}

/** YYYYMMDD 숫자에서 n일 뺀 날짜 (달 경계를 넘도록 Date 로 계산) */
function minusDays(num, n) {
  const y = Math.floor(num / 10000);
  const mo = Math.floor((num % 10000) / 100);
  const d = num % 100;
  const t = new Date(Date.UTC(y, mo - 1, d));
  t.setUTCDate(t.getUTCDate() - n);
  return t.getUTCFullYear() * 10000 + (t.getUTCMonth() + 1) * 100 + t.getUTCDate();
}

/** 두 YYYYMMDD 사이의 일수 (b − a) */
function diffDays(a, b) {
  const toDate = (n) =>
    Date.UTC(Math.floor(n / 10000), Math.floor((n % 10000) / 100) - 1, n % 100);
  return Math.round((toDate(b) - toDate(a)) / 86400000);
}

const fmt = (num) =>
  num == null ? '?' : `${Math.floor(num / 10000)}-${String(Math.floor((num % 10000) / 100)).padStart(2, '0')}-${String(num % 100).padStart(2, '0')}`;

/**
 * 이벤트 하나의 우선순위를 **코드가** 계산한다.
 *
 * `base`   수요 × 신선도. 포화된 것(saturation 5)은 수요가 커도 값이 없다 —
 *          이미 수백 개가 쓰인 주제에 한 개를 더 얹는 일이다.
 * `확정`   공식 발표가 아닌 일정은 깎는다. 날짜가 밀리면 선점이 헛일이 된다.
 * `시점`   지금 써야 하는 것에 가중을 준다. 아직 이른 것은 나중에 다시 올라온다.
 */
function rank(ev, todayNum) {
  const date = dayNum(ev.date);
  const demand = Math.min(5, Math.max(1, Number(ev.demand) || 1));
  const saturation = Math.min(5, Math.max(1, Number(ev.saturation) || 5));
  const lead = LEAD_DAYS[ev.kind] ?? LEAD_DAYS.other;

  if (date == null) {
    return { ...ev, date: ev.date, dateNum: null, verdict: '날짜없음', score: 0, publishOn: null, leadDays: null };
  }

  const publishOn = minusDays(date, lead);
  const daysToEvent = diffDays(todayNum, date);
  const daysToPublish = diffDays(todayNum, publishOn);

  const freshness = 6 - saturation; // 1~5
  const base = demand * freshness; // 1~25
  const confidence = ev.dateConfirmed === true ? 1 : 0.7;

  let timing;
  let verdict;
  if (daysToEvent < 0) {
    timing = 0;
    verdict = '지남';
  } else if (daysToPublish <= 0) {
    /* 발행 권장일이 지났지만 이벤트는 아직이다 — 늦었어도 만회할 구간이다.
     * 0 으로 죽이지 않는다. 오늘 쓰면 그래도 이벤트 전에 색인된다. */
    timing = daysToEvent <= 1 ? 0.6 : 0.9;
    verdict = '지금';
  } else if (daysToPublish <= 2) {
    timing = 1;
    verdict = '임박';
  } else if (daysToPublish <= 7) {
    timing = 0.85;
    verdict = '대기';
  } else {
    timing = 0.6;
    verdict = '아직';
  }

  return {
    ...ev,
    dateNum: date,
    publishOn,
    leadDays: lead,
    daysToEvent,
    daysToPublish,
    verdict,
    score: Math.round(base * confidence * timing),
  };
}

/**
 * 그대로 복사해 실행할 수 있는 입력 문자열을 **코드가** 만든다.
 *
 * 모델에게 만들게 하면 모드 접두사를 틀린다(오늘 실측: `드라마:` 를 방영 전 작품에
 * 붙이면 회차가 없어 글이 지어진다 — §7-17). 규칙이 기계적이므로 코드가 만든다.
 */
function suggestInput(ev) {
  const title = String(ev.title || '').trim();
  switch (ev.mode) {
    case 'movie':
      return `영화: ${title}`;
    case 'drama':
      /* 회차 리캡은 방송 뒤에만 가능하다. 회차 번호를 모르므로 사람이 채운다. */
      return `드라마: ${title} <회차>회`;
    case 'topic':
      return `${title} — ${String(ev.angle || '').trim()}`;
    case 'clip':
      /* 영상 모드는 유튜브 URL 이 입력이다. 레이더에는 그 주소가 없다. */
      return `(유튜브 URL 필요) ${title}`;
    case 'news':
    default:
      return String(ev.source || '').trim() || title;
  }
}

/** 선언과 실제가 어긋난 항목을 잡는다 — 발행 사고로 이어지는 것만 본다 */
function lintEvent(ev, todayNum) {
  const out = [];
  if (ev.mode === 'drama' && ev.dateNum != null && ev.dateNum >= todayNum) {
    out.push('방영 전인데 mode=drama 다 — 회차가 없으므로 news 나 topic 으로 써야 한다 (§7-17)');
  }
  if (ev.mode === 'clip') out.push('mode=clip 은 유튜브 URL 이 있어야 한다 — 레이더 결과로는 바로 못 돌린다');
  if (!/^https?:\/\//i.test(String(ev.source || ''))) out.push('근거 URL 이 없다 — 확인되지 않은 일정이다');
  if (!(ev.people || []).length) out.push('인물이 비었다 — 검색 수요의 원천이 불분명하다');
  return out;
}

/**
 * 앞으로 `days` 일 안에 일어날 것이 **이미 공표된** 이벤트를 찾는다.
 */
export async function discoverRadar({ cfg, query, days = 21, count = 12 }) {
  const today = new Date();
  const dateStr = todayStr(today);
  const q = query || cfg.radar?.query || cfg.news?.query || '한국 드라마 영화 아이돌';

  const prompt = `당신은 검색 유입으로 먹고사는 블로그의 편집장입니다.
오늘 기사를 훑는 것이 아니라, **앞으로 일어날 일의 달력**을 만드는 중입니다.

# 오늘 날짜
${dateStr}

# 찾을 분야
${q}

# 할 일
웹 검색으로 **오늘부터 ${days}일 안에** 일어날 것이 **이미 공표된** 일정을 ${count + 4}건 찾으세요.

찾는 것:
- 드라마 첫방송 / 최종회
- OTT 공개 (넷플릭스·디즈니+·티빙·웨이브·쿠팡플레이)
- 영화 개봉
- 아이돌 컴백·신곡 발매
- 시상식·연말 무대
- 대형 콘서트 티켓 오픈

# 왜 이것을 찾는가 (판단 기준이 여기서 나옵니다)
사람들은 **일이 벌어지기 전부터 검색합니다.** 공개 전에 작품 정보·인물 관계·원작을
찾고, 첫방송 전에 편성과 등장인물을 찾습니다. 그 구간에 글이 이미 있으면 유입을 받고,
사건이 터진 뒤에 쓰면 수백 개와 경쟁합니다.

그래서 **아직 글이 적은데 곧 수요가 올 것**을 찾습니다. 이미 포화된 것은 값이 없습니다.

# 각 항목에 반드시 할 일
1. **날짜를 확인하세요.** YYYY-MM-DD 로 씁니다. 날짜를 확인하지 못한 항목은 **빼세요** —
   이 도구는 날짜로 발행 시점을 계산하므로 날짜 없는 항목은 쓸모가 없습니다.
2. **공식 발표인지 보세요.** 방송사·배급사·소속사·플랫폼이 발표한 날짜면
   dateConfirmed=true, 보도에서 "예정"·"전망"으로만 언급되면 false 입니다.
3. **saturation 을 실제로 검색해서 매기세요.** 그 작품·아티스트 이름으로 검색해
   블로그 글이 얼마나 쌓였는지 보고 1~5 로 씁니다. **추측하지 마세요.**
   이 값이 낮은 것이 이 도구가 찾는 것입니다.
4. **demand 의 근거를 evidence 에 쓰세요.** 주연의 인지도, 원작의 규모, 플랫폼의 크기,
   전작의 화제성 중 **확인한 것**을 씁니다. 근거 없이 5 를 주지 마세요.
5. **angle 을 쓰세요.** 원 기사에 없는데 우리가 더할 수 있는 것입니다. 이것이 없으면
   그 소재는 쓸 이유가 없습니다.

# 종류를 골고루 찾으세요 — 이것이 이 작업에서 가장 자주 실패하는 지점입니다

**한 사이트의 목록을 베껴 정원을 채우지 마세요.** 예매처의 공연 목록이나 극장의
개봉 예정표는 열거하기 쉬워서, 거기서만 뽑으면 목록이 그 사이트의 목차가 됩니다.

> 실패 실측 (2026-08-04, 첫 실행): 12건 중 거의 전부가 한 예매처의 공연 목록이었고
> **드라마 첫방송·OTT 공개·영화 개봉·컴백이 0건**이었습니다. 정작 유입을 만든
> 카테고리(드라마·OTT)가 통째로 빠졌습니다.

- **kind 를 최소 4종류 이상** 섞으세요.
- **drama_premiere · ott_release 를 먼저 찾으세요.** 이 둘은 공개 전 검색이 가장
  길게 붙는 종류입니다. 편성표·OTT 라인업 발표·제작발표회 보도에서 찾습니다.
- 한 종류가 3건을 넘지 않게 하세요. 코드가 넘는 것을 잘라냅니다.
- 지역 소규모 공연은 검색 수요가 작습니다. 그것으로 자리를 채우지 마세요.

# 피할 것
- 확인되지 않은 루머, 사생활 추측, 열애설
- 미성년자 관련 민감 사안
- 판결 전 범죄 사안
- 특정인을 깎아내리는 것 말고는 쓸 내용이 없는 소재

# 규칙
- source 는 검색으로 **실제 확인한** 주소만. 지어내면 그 항목 전체가 쓸모없어집니다.
- 같은 작품의 여러 일정(첫방송·최종회)은 각각 한 항목으로 나눕니다.
- **점수를 매겨 정렬하지 마세요.** 우선순위는 코드가 계산합니다. 사실만 채우세요.

# 출력
파일을 만들지 말고 지정된 JSON 스키마에 맞는 JSON 객체 하나만 최종 응답으로 반환하세요.`;

  log.step(`선점 레이더: ${q} (앞으로 ${days}일)`);

  const result = await runCodexJson({
    prompt,
    schemaFile: FILES.radarSchema,
    cfg,
    search: true,
    timeoutMs: Math.min(cfg.codex.timeoutMs, 900_000),
  });

  const todayNum = dayNum(dateStr);
  const raw = (result?.events || []).filter((e) => e && String(e.title || '').trim());
  /* **판정을 점수보다 먼저 본다.**
   *
   * 점수만으로 정렬하면 "크지만 아직 이른 것" 이 "오늘 써야 하는 것" 위로 올라온다.
   * > 검증에서 실제로 그랬다: OTT 대작(15점·아직) > 첫방송 D-3(14점·지금).
   * 이 도구가 답해야 하는 질문은 "무엇이 큰가" 가 아니라 **"오늘 무엇을 쓰나"** 다.
   * 큰 것은 발행 권장일이 오면 저절로 맨 위로 올라온다. */
  const ORDER = { 지금: 0, 임박: 1, 대기: 2, 아직: 3 };
  const sorted = raw
    .map((e) => rank(e, todayNum))
    .filter((e) => e.verdict !== '지남' && e.verdict !== '날짜없음')
    .sort(
      (a, b) =>
        (ORDER[a.verdict] ?? 9) - (ORDER[b.verdict] ?? 9) ||
        b.score - a.score ||
        a.dateNum - b.dateNum
    );

  /* **한 종류가 목록을 삼키지 못하게 한다.**
   *
   * 지시문으로도 막지만 코드가 한 번 더 막는다. 열거하기 쉬운 목록(예매처 공연,
   * 극장 개봉 예정표)이 있으면 모델은 거기서 정원을 채우고, 그러면 이 도구는
   * 그 사이트의 목차가 된다.
   *
   * > 2026-08-04 첫 실행 실측: 12건 중 거의 전부가 한 예매처 공연 목록이었고
   * >   drama_premiere·ott_release·movie_release·comeback 이 **0건**이었다.
   * >   정작 유입을 만든 카테고리가 통째로 빠진 것이다.
   *
   * 산문 규칙은 어겨져도 소리가 안 난다 — 그래서 상한을 코드에 둔다. */
  const PER_KIND = 3;
  const seen = new Map();
  const ranked = [];
  const spilled = [];
  for (const ev of sorted) {
    const n = seen.get(ev.kind) || 0;
    if (n >= PER_KIND) {
      spilled.push(ev);
      continue;
    }
    seen.set(ev.kind, n + 1);
    ranked.push(ev);
    if (ranked.length >= count) break;
  }
  /* 종류 상한 때문에 정원이 안 차면 남은 것으로 채운다 — 빈 목록보다 낫다.
   * 다만 **잘라낸 사실을 반드시 찍는다** (CLAUDE.md: 조용한 상한은 거짓말이 된다). */
  if (ranked.length < count && spilled.length) {
    const fill = spilled.slice(0, count - ranked.length);
    log.warn(
      `종류 상한(${PER_KIND}건)에 걸린 ${spilled.length}건 중 ${fill.length}건으로 정원을 채웁니다 — ` +
        `종류가 ${seen.size}가지뿐입니다. 질의를 나눠 다시 돌리는 편이 낫습니다.`
    );
    ranked.push(...fill);
  }

  const dropped = raw.length - sorted.length;
  if (dropped > 0) log.info(`${dropped}건 제외 (날짜 없음 또는 이미 지난 일정)`);
  log.info(`종류 분포: ${[...seen.entries()].map(([k, v]) => `${k} ${v}`).join(' · ')}`);

  if (!ranked.length) {
    log.warn('선점할 일정을 찾지 못했습니다.');
    return [];
  }

  log.ok(`일정 ${ranked.length}건 (우선순위는 코드가 계산 — 수요 × 신선도 × 확정 × 시점)`);
  for (const ev of ranked) {
    const mark = ev.verdict === '지금' ? '●' : ev.verdict === '임박' ? '◐' : '○';
    log.info(
      `  ${mark} [${String(ev.score).padStart(2)}] ${ev.verdict.padEnd(3)} ${fmt(ev.dateNum)} ${ev.title}`
    );
    log.info(
      `        ${ev.kind} · ${ev.platform || '?'} · 수요 ${ev.demand}/5 · 포화 ${ev.saturation}/5` +
        `${ev.dateConfirmed ? '' : ' · 날짜 미확정'} · 발행 권장 ${fmt(ev.publishOn)} (D-${ev.leadDays})`
    );
    if (ev.people?.length) log.info(`        인물: ${ev.people.join(', ')}`);
    if (ev.evidence) log.info(`        근거: ${ev.evidence}`);
    if (ev.angle) log.info(`        각도: ${ev.angle}`);
    log.info(`        실행: npm run draft -- "${suggestInput(ev)}"`);
    for (const problem of lintEvent(ev, todayNum)) log.warn(`        ⚠ ${problem}`);
  }
  return ranked;
}

/**
 * `radar.json` 에 누적한다 — **성과를 되먹이는 자리다.**
 *
 * `outcome` 을 비워 두고 저장한다. 발행 뒤 그 값을 채우면(유입이 왔는가)
 * `LEAD_DAYS` 와 가중치를 실측으로 교정할 수 있다. 지금은 그 데이터가 0 건이고,
 * 그래서 이 파일이 이 도구에서 가장 중요한 부분이다.
 */
export function saveRadar(events) {
  let prev = { events: [] };
  if (fs.existsSync(FILES.radar)) {
    try {
      const text = fs.readFileSync(FILES.radar, 'utf8');
      prev = text.trim() ? JSON.parse(text) : { events: [] };
    } catch (err) {
      /* 깨진 파일 때문에 레이더를 멈추지 않는다. 다만 **덮어쓰기 전에 옮겨 둔다** —
       * 누적된 성과 기록을 조용히 버리면 이 도구의 근거가 사라진다. */
      const bak = `${FILES.radar}.broken-${Date.now()}`;
      try {
        fs.renameSync(FILES.radar, bak);
        log.warn(`radar.json 을 읽지 못해 ${bak} 로 옮겼습니다 — ${err.message.split('\n')[0]}`);
      } catch {
        log.warn(`radar.json 을 읽지 못했습니다 — ${err.message.split('\n')[0]}`);
      }
      prev = { events: [] };
    }
  }
  const byKey = new Map((prev.events || []).map((e) => [`${e.title}|${e.date}`, e]));
  let added = 0;
  for (const ev of events) {
    const key = `${ev.title}|${ev.date}`;
    const old = byKey.get(key);
    byKey.set(key, {
      title: ev.title,
      kind: ev.kind,
      date: ev.date,
      dateConfirmed: ev.dateConfirmed,
      platform: ev.platform,
      people: ev.people,
      source: ev.source,
      demand: ev.demand,
      saturation: ev.saturation,
      evidence: ev.evidence,
      angle: ev.angle,
      mode: ev.mode,
      publishOn: fmt(ev.publishOn),
      leadDays: ev.leadDays,
      score: ev.score,
      suggestedInput: suggestInput(ev),
      /** 되먹임 — 발행 뒤 사람이(또는 통계 스크립트가) 채운다 */
      publishedUrl: old?.publishedUrl || '',
      publishedAt: old?.publishedAt || '',
      outcome: old?.outcome || '',
    });
    if (!old) added += 1;
  }
  const out = { updatedAt: new Date().toISOString(), events: [...byKey.values()] };
  /* **임시 파일에 쓴 뒤 바꿔 끼운다.**
   *
   * 살아 있는 파일에 바로 쓰면 쓰는 중에 프로세스가 죽을 때 **누적 기록이 통째로
   * 날아간다.** 이 파일은 성과 되먹임을 담는 자리라 다시 만들 수 없다.
   *
   * > 2026-08-04 실측: 출력을 `Select-Object -First 3` 으로 잘랐더니 파이프가 닫혀
   * >   프로세스가 죽었고, 마침 이 줄을 지나던 중이라 radar.json 이 **0바이트**가 됐다.
   * >   23건이 사라졌다. 도구가 아니라 **터미널 파이프 하나**가 지운 것이다.
   *
   * rename 은 같은 파일시스템에서 원자적이다 — 실패하면 옛 파일이 그대로 남는다. */
  const tmp = `${FILES.radar}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, FILES.radar);
  log.ok(`radar.json 갱신 — 새 일정 ${added}건 · 누적 ${out.events.length}건`);
  return out;
}

export { LEAD_DAYS, rank, suggestInput, dayNum, fmt };
