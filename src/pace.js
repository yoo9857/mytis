import fs from 'node:fs';
import path from 'node:path';
import { log } from './log.js';
import { DIRS } from './paths.js';

/**
 * 발행 간격을 지킨다 — **틀린그림찾기를 만나지 않기 위해서다.**
 *
 * 티스토리는 연속 발행을 스팸으로 보고 지도 틀린그림찾기를 띄운다. 틀린그림찾기는 사람이
 * 풀어야 하므로, 그 순간 무인 실행이 끊긴다. 뚫는 것은 방법이 아니다 — 계정 정지
 * 사유이고, 그러면 블로그 자체가 사라진다.
 *
 * > 2026-08-05 실측: 한 시간 안에 4번 발행을 시도해 **4번 모두** 틀린그림찾기가 떴다.
 * > HANDOVER 에도 "한 시간 반에 9건" 뒤 발생 기록이 있다.
 *
 * 그래서 **간격 자체를 코드가 지킨다.** 직전 발행에서 `minGapMinutes` 가 지나지
 * 않았으면 즉시 발행을 포기하고 **예약 발행**으로 돌린다(티스토리 기능이라 틀린그림찾기와
 * 무관하다). 사람이 기다릴 필요도, 큐를 되돌릴 필요도 없다.
 */

const FILE = () => path.join(DIRS.logs, 'publish-pace.json');

function read() {
  try {
    return JSON.parse(fs.readFileSync(FILE(), 'utf8'));
  } catch {
    return {};
  }
}

/** 발행 성공을 기록한다 (플랫폼·블로그별). */
export function recordPublish(platform, blog) {
  const key = `${platform}:${blog || '-'}`;
  const state = read();
  state[key] = new Date().toISOString();
  try {
    fs.mkdirSync(DIRS.logs, { recursive: true });
    fs.writeFileSync(FILE(), JSON.stringify(state, null, 2));
  } catch (err) {
    log.debug(`발행 간격 기록 실패: ${err.message}`);
  }
}

/**
 * 지금 즉시 발행해도 되는지 본다.
 *
 * @returns {{ok: true} | {ok: false, waitMinutes: number, sinceMinutes: number}}
 */
export function checkGap(platform, blog, minGapMinutes) {
  if (!minGapMinutes || minGapMinutes <= 0) return { ok: true };
  const last = read()[`${platform}:${blog || '-'}`];
  if (!last) return { ok: true };
  const sinceMs = Date.now() - new Date(last).getTime();
  if (!Number.isFinite(sinceMs) || sinceMs < 0) return { ok: true };
  const sinceMinutes = Math.floor(sinceMs / 60_000);
  if (sinceMinutes >= minGapMinutes) return { ok: true };
  return { ok: false, waitMinutes: minGapMinutes - sinceMinutes, sinceMinutes };
}

/**
 * 간격이 모자라면 **cfg 를 예약 발행으로 바꿔** 틀린그림찾기를 피한다.
 *
 * cfg 를 직접 고치는 것은 이 호출 한 번에 한정된다(큐 모드에서 다음 글로 새지
 * 않도록 호출한 쪽이 넘긴 cfg 사본을 쓴다 — cli 의 발행 경로가 매번 loadConfig 한다).
 * 사람이 `--now` 로 강제하면 그대로 즉시 발행한다.
 */
export function applyPacing(cfg, platform, blog, { force = false } = {}) {
  const minGap = cfg.blog.minPublishGapMinutes ?? 45;
  const gap = checkGap(platform, blog, minGap);
  if (gap.ok) return { reserved: false };
  if (force) {
    log.warn(
      `직전 발행에서 ${gap.sinceMinutes}분밖에 지나지 않았습니다 (권장 ${minGap}분) — ` +
        '--now 가 있어 즉시 발행합니다. 틀린그림찾기가 뜰 수 있습니다.'
    );
    return { reserved: false };
  }
  cfg.blog.publishMode = 'reserve';
  // 이미 예약값이 더 크면 그대로 둔다 (사람이 정한 값을 줄이지 않는다)
  cfg.blog.reserveAfterMinutes = Math.max(cfg.blog.reserveAfterMinutes || 0, gap.waitMinutes + 1);
  log.warn(
    `직전 발행에서 ${gap.sinceMinutes}분밖에 지나지 않았습니다 (권장 간격 ${minGap}분). ` +
      `연속 발행 틀린그림찾기를 피하려고 **${cfg.blog.reserveAfterMinutes}분 뒤 예약 발행**으로 돌립니다 — ` +
      '즉시 올리려면 --now 를 붙이세요.'
  );
  return { reserved: true, minutes: cfg.blog.reserveAfterMinutes };
}
