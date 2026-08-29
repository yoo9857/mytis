import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  acquireFollowLock,
  assertFollowTarget,
  findLatestFollowArtifact,
  followRetryDelayMs,
  parseNaverRss,
  popularityScore,
  queueUnselectedNew,
  recordDetected,
  reconcilePublishedArtifacts,
  selectLatestNew,
  selectNextFollowItem,
  shouldRegenerateFollowArtifact,
  sourcePostId,
  usageLimitRetryAt,
} from '../src/followBlog.js';

test('실패 재시도는 같은 원문의 최신 완성 원고를 재사용한다', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moneyti-follow-artifact-'));
  try {
    const valid = {
      sourceUrl: 'https://blog.naver.com/happytigers/224399999999',
      title: '완성 원고',
      sections: [{ heading: '본문' }],
      imageBriefs: [{ placement: 'thumbnail' }],
    };
    fs.writeFileSync(path.join(outDir, 'old.json'), JSON.stringify(valid));
    const newest = path.join(outDir, 'new.json');
    fs.writeFileSync(newest, JSON.stringify({ ...valid, title: '최신 완성 원고' }));
    const now = new Date();
    fs.utimesSync(path.join(outDir, 'old.json'), new Date(now.getTime() - 1000), new Date(now.getTime() - 1000));
    fs.utimesSync(newest, now, now);
    fs.writeFileSync(path.join(outDir, 'incomplete.json'), JSON.stringify({ sourceUrl: valid.sourceUrl }));

    assert.equal(
      findLatestFollowArtifact('https://blog.naver.com/happytigers/224399999999', { outDir }),
      newest
    );
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('사진 부족 실패는 기존 원고를 재사용하지 않고 다시 생성한다', () => {
  assert.equal(
    shouldRegenerateFollowArtifact('기사 사진이 2장뿐입니다 (최소 3장). 동일 인물 사진을 더 확보하세요.'),
    true
  );
  assert.equal(shouldRegenerateFollowArtifact('티스토리가 틀린그림찾기를 요구합니다.'), false);
});

test('재시도 성공 상태에는 과거 실패 정보를 남기지 않는다', () => {
  const state = { seen: {} };
  recordDetected(state, [{
    id: '1',
    error: '기사 사진이 2장뿐입니다',
    attempts: 1,
    retryAfter: '2026-08-25T00:00:00.000Z',
  }], 'published', { postUrl: 'https://example.com/entry/ok' });
  assert.deepEqual(state.seen['1'], {
    id: '1',
    status: 'published',
    detectedAt: state.seen['1'].detectedAt,
    postUrl: 'https://example.com/entry/ok',
  });
});

test('네이버 RSS에서 글 번호·카테고리·정식 URL을 읽는다', () => {
  const xml = `
    <rss><channel><item>
      <category><![CDATA[함께보는 이슈들]]></category>
      <title><![CDATA[새 글 &amp; 후속]]></title>
      <link><![CDATA[https://blog.naver.com/happytigers/224399999999?fromRss=true&trackingCode=rss]]></link>
      <guid>https://blog.naver.com/happytigers/224399999999</guid>
      <pubDate>Sun, 23 Aug 2026 12:00:00 +0900</pubDate>
    </item></channel></rss>`;
  assert.deepEqual(parseNaverRss(xml), [
    {
      id: '224399999999',
      title: '새 글 & 후속',
      url: 'https://blog.naver.com/happytigers/224399999999',
      category: '함께보는 이슈들',
      publishedAt: 'Sun, 23 Aug 2026 12:00:00 +0900',
    },
  ]);
});

test('한 주기에 여러 글이면 가장 최신 글 하나만 고른다', () => {
  const items = [
    { id: '2', publishedAt: 'Sun, 23 Aug 2026 12:00:00 +0900' },
    { id: '1', publishedAt: 'Sun, 23 Aug 2026 11:00:00 +0900' },
    { id: '0', publishedAt: 'Sun, 23 Aug 2026 10:00:00 +0900' },
  ];
  const state = { seen: { 0: { status: 'baseline' } } };
  const result = selectLatestNew(items, state);
  assert.equal(result.selected.id, '2');
  assert.deepEqual(result.skipped.map((x) => x.id), ['1']);
});

test('새 글이 있으면 과거 미작성보다 새 글을 먼저 고르고 나머지를 대기시킨다', () => {
  const items = [
    { id: '3', publishedAt: 'Sun, 23 Aug 2026 13:00:00 +0900' },
    { id: '2', publishedAt: 'Sun, 23 Aug 2026 12:00:00 +0900' },
    { id: '1', publishedAt: 'Sun, 23 Aug 2026 11:00:00 +0900' },
  ];
  const state = { seen: { 1: { status: 'baseline' } } };
  const result = selectNextFollowItem(items, state);
  assert.equal(result.selected.id, '3');
  assert.equal(result.reason, 'new');
  assert.equal(result.pending, 2, '새 글 1편과 기존 미작성 1편이 남는다');
  assert.equal(state.seen['2'], undefined, '선택하지 않은 새 글은 다음 주기 후보로 남아야 한다');
});

test('새 글이 없으면 과거 미작성 글 중 최신 글을 고른다', () => {
  const items = [
    { id: '3', publishedAt: 'Sun, 23 Aug 2026 13:00:00 +0900' },
    { id: '2', publishedAt: 'Sun, 23 Aug 2026 12:00:00 +0900' },
    { id: '1', publishedAt: 'Sun, 23 Aug 2026 11:00:00 +0900' },
  ];
  const state = {
    seen: {
      3: { status: 'published' },
      2: { status: 'baseline' },
      1: { status: 'baseline' },
    },
  };
  const result = selectNextFollowItem(items, state);
  assert.equal(result.selected.id, '2');
  assert.equal(result.reason, 'backlog');
  assert.equal(result.pending, 1);
});

test('실패 글은 대기 시간이 지나면 횟수 제한 없이 재시도한다', () => {
  const items = [{ id: '1', publishedAt: 'Sun, 23 Aug 2026 11:00:00 +0900' }];
  const waiting = {
    seen: { 1: { status: 'failed', attempts: 1, retryAfter: '2026-08-24T06:00:00.000Z' } },
  };
  assert.equal(selectNextFollowItem(items, waiting, new Date('2026-08-24T05:00:00.000Z')).selected, null);
  assert.equal(selectNextFollowItem(items, waiting, new Date('2026-08-24T07:00:00.000Z')).reason, 'retry');

  const manyFailures = { seen: { 1: { ...items[0], status: 'failed', attempts: 20 } } };
  assert.equal(selectNextFollowItem(items, manyFailures).reason, 'retry');
});

test('미작성 후보는 최신순이 아니라 공감·댓글·공유 인기순으로 고른다', () => {
  const items = [
    { id: 'new', publishedAt: 'Sun, 23 Aug 2026 13:00:00 +0900', popularity: { likes: 1, comments: 0, shares: 0 } },
    { id: 'popular', publishedAt: 'Sun, 23 Aug 2026 11:00:00 +0900', popularity: { likes: 10, comments: 3, shares: 1 } },
  ];
  const result = selectNextFollowItem(items, { seen: {} });
  assert.equal(result.selected.id, 'popular');
  assert.equal(popularityScore(result.selected), 53);
});

test('참고 블로그와 발행 티스토리 연결이 바뀌면 발행 전에 차단한다', () => {
  assert.equal(assertFollowTarget('ektha0108', 'eco-m'), true);
  assert.equal(assertFollowTarget('happytigers', 'classic-m.tistory.com'), true);
  assert.throws(() => assertFollowTarget('ektha0108', 'classic-m'), /eco-m\.tistory\.com/);
  assert.throws(() => assertFollowTarget('happytigers', 'eco-m'), /classic-m\.tistory\.com/);
});

test('실패 후보는 정상 대기 후보를 막지 않는다', () => {
  const items = [
    { id: 'failed', url: 'https://example.com/failed', popularity: { likes: 100 } },
    { id: 'healthy', url: 'https://example.com/healthy', popularity: { likes: 1 } },
  ];
  const state = { seen: {
    failed: { ...items[0], status: 'failed', attempts: 2, retryAfter: '2026-08-20T00:00:00.000Z' },
    healthy: { ...items[1], status: 'pending' },
  } };
  assert.equal(selectNextFollowItem(items, state, new Date('2026-08-26T00:00:00.000Z')).selected.id, 'healthy');
});

test('재시도 간격은 일시 오류 10분부터 늘고 24시간을 넘지 않는다', () => {
  assert.equal(followRetryDelayMs('navigation timeout', 1), 10 * 60_000);
  assert.equal(followRetryDelayMs('사진 후보 부족', 1), 30 * 60_000);
  assert.equal(followRetryDelayMs('navigation timeout', 99), 24 * 60 * 60_000);
});

test('Codex 사용량 제한의 재개 시각을 글별 실패와 별도로 계산한다', () => {
  const now = new Date('2026-08-26T00:30:00+09:00');
  assert.equal(
    usageLimitRetryAt("You've hit your usage limit. try again at 4:27 AM.", now).toISOString(),
    '2026-08-25T19:27:00.000Z'
  );
  assert.equal(usageLimitRetryAt('navigation timeout', now), null);
});

test('follow 잠금은 동시 실행을 거부하고 해제 뒤 다시 잡힌다', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moneyti-follow-lock-'));
  const lockFile = path.join(root, 'follow.lock');
  try {
    const release = await acquireFollowLock({ lockFile, owner: 'one', waitMs: 0 });
    await assert.rejects(
      acquireFollowLock({ lockFile, owner: 'two', waitMs: 0 }),
      /다른 자동발행 작업/
    );
    release();
    const releaseAgain = await acquireFollowLock({ lockFile, owner: 'two', waitMs: 0 });
    releaseAgain();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('비정상 종료로 남은 죽은 프로세스 잠금은 즉시 회수한다', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moneyti-follow-dead-lock-'));
  const lockFile = path.join(root, 'follow.lock');
  try {
    fs.writeFileSync(lockFile, JSON.stringify({
      token: 'dead',
      owner: 'crashed',
      pid: 2147483647,
      startedAt: new Date().toISOString(),
    }));
    const release = await acquireFollowLock({ lockFile, owner: 'recovered', waitMs: 0 });
    release();
    assert.equal(fs.existsSync(lockFile), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('수동 발행은 원고 sourceUrl과 실제 발행 완료 로그가 모두 있을 때만 합친다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moneyti-follow-'));
  const outDir = path.join(root, 'out');
  const logsDir = path.join(root, 'logs');
  fs.mkdirSync(outDir);
  fs.mkdirSync(logsDir);
  try {
    fs.writeFileSync(path.join(outDir, 'published.json'), JSON.stringify({
      sourceUrl: 'https://blog.naver.com/PostView.naver?blogId=happytigers&logNo=224399999999',
      urlSlug: 'already-published',
    }));
    fs.writeFileSync(path.join(outDir, 'draft-only.json'), JSON.stringify({
      sourceUrl: 'https://blog.naver.com/happytigers/224399999998',
      urlSlug: 'draft-only',
    }));
    fs.writeFileSync(
      path.join(logsDir, '2026-08-24.log'),
      '[01:00:00] OK    티스토리 발행 완료: https://classic-m.tistory.com/entry/already-published\n'
    );

    const items = [
      { id: '224399999999', title: '발행함' },
      { id: '224399999998', title: '초안만' },
    ];
    const state = { seen: Object.fromEntries(items.map((item) => [item.id, { ...item, status: 'baseline' }])) };
    const result = reconcilePublishedArtifacts(state, items, {
      outDir,
      logsDir,
      now: new Date('2026-08-24T00:00:00.000Z'),
    });
    assert.equal(result.length, 1);
    assert.equal(state.seen['224399999999'].status, 'published');
    assert.equal(state.seen['224399999998'].status, 'baseline');
    assert.equal(sourcePostId('https://blog.naver.com/PostView.naver?logNo=224399999999'), '224399999999');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('RSS 목록에서 밀려난 미작성 글도 저장 상태에서 최신순으로 선택한다', () => {
  const items = [
    { id: '3', url: 'https://example.com/3', publishedAt: 'Sun, 23 Aug 2026 13:00:00 +0900' },
  ];
  const state = {
    seen: {
      3: { ...items[0], status: 'published' },
      2: { id: '2', url: 'https://example.com/2', status: 'baseline', publishedAt: 'Sun, 23 Aug 2026 12:00:00 +0900' },
      1: { id: '1', url: 'https://example.com/1', status: 'baseline', publishedAt: 'Sun, 23 Aug 2026 11:00:00 +0900' },
    },
  };
  const result = selectNextFollowItem(items, state);
  assert.equal(result.selected.id, '2');
  assert.equal(result.reason, 'backlog');
  assert.equal(result.pending, 1);
});

test('선택하지 않은 새 글을 대기열에 저장해 RSS에서 사라진 뒤에도 선택한다', () => {
  const items = [
    { id: '3', url: 'https://example.com/3', publishedAt: 'Sun, 23 Aug 2026 13:00:00 +0900' },
    { id: '2', url: 'https://example.com/2', publishedAt: 'Sun, 23 Aug 2026 12:00:00 +0900' },
  ];
  const state = { seen: {} };
  const first = selectNextFollowItem(items, state);
  const queued = queueUnselectedNew(state, items, first.selected.id, new Date('2026-08-24T00:00:00.000Z'));
  assert.deepEqual(queued.map((item) => item.id), ['2']);
  assert.equal(state.seen['2'].status, 'pending');

  state.seen['3'] = { ...items[0], status: 'published' };
  const next = selectNextFollowItem([], state);
  assert.equal(next.selected.id, '2');
  assert.equal(next.reason, 'backlog');
});
