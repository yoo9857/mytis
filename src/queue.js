import fs from 'node:fs';
import { FILES } from './paths.js';
import { log } from './log.js';

function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

function appendLine(file, line) {
  fs.appendFileSync(file, line + '\n', 'utf8');
}

/** 대기 중인 주제 목록 */
export function pending() {
  return readLines(FILES.topics);
}

/** 이미 처리한 주제(성공/실패 모두) */
export function processed() {
  const strip = (l) => l.replace(/^\[[^\]]*\]\s*/, '').trim();
  return new Set([...readLines(FILES.done), ...readLines(FILES.failed)].map(strip));
}

/** 큐에서 아직 처리하지 않은 주제 하나를 꺼낸다. */
export function nextTopic() {
  const seen = processed();
  for (const topic of pending()) {
    if (!seen.has(topic)) return topic;
  }
  return null;
}

/** topics.txt 에서 해당 줄을 제거한다. */
function removeFromQueue(topic) {
  if (!fs.existsSync(FILES.topics)) return;
  const text = fs.readFileSync(FILES.topics, 'utf8');
  const kept = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== topic.trim())
    .join('\n');
  fs.writeFileSync(FILES.topics, kept.replace(/\n{3,}/g, '\n\n'), 'utf8');
}

export function markDone(topic, url = '') {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  appendLine(FILES.done, `[${ts}] ${topic}${url ? ` -> ${url}` : ''}`);
  removeFromQueue(topic);
  log.debug(`큐 처리 완료: ${topic}`);
}

export function markFailed(topic, reason = '') {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  appendLine(FILES.failed, `[${ts}] ${topic}${reason ? ` -> ${reason.split('\n')[0]}` : ''}`);
  removeFromQueue(topic);
  log.debug(`큐 실패 기록: ${topic}`);
}

/** 큐에 주제를 추가한다. */
export function addTopics(topics) {
  const existing = new Set(pending());
  const added = [];
  for (const t of topics) {
    const topic = t.trim();
    if (!topic || existing.has(topic)) continue;
    appendLine(FILES.topics, topic);
    existing.add(topic);
    added.push(topic);
  }
  return added;
}

export function status() {
  const seen = processed();
  const all = pending();
  return {
    pending: all.filter((t) => !seen.has(t)),
    total: all.length,
    done: readLines(FILES.done).length,
    failed: readLines(FILES.failed).length,
  };
}
