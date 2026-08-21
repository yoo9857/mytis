#!/usr/bin/env node
/**
 * 틀린그림찾기 **판독만** 단독으로 돌려 본다 (발행하지 않는다).
 *
 * 발행 한 번은 15분이 넘는다. 판독 프롬프트를 고칠 때마다 발행을 다시 돌리면
 * 하루가 간다 — CLAUDE.md "검증은 부분만 한다". 받아 둔 그림 파일로 몇십 초에 본다.
 *
 *   npm run sec -- logs/shots/20260821-092641-publish-sec.png "지도에 있는 화장실의 전체 명칭을 입력해주세요"
 *
 * 두 번째 인자를 빼면 문제 문장 없이 "지도에 표시된 장소" 로 묻는다.
 */
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { recognizeAnswer, questionTarget, upscaleForReading } from '../src/wrongPicture.js';
import { log } from '../src/log.js';

const [file, question = '', patternArg = ''] = process.argv.slice(2);
if (!file) {
  console.error('사용법: npm run sec -- <그림파일> ["문제 문장"]');
  process.exit(1);
}
const imageFile = path.resolve(file);
if (!fs.existsSync(imageFile)) {
  console.error(`그림 파일이 없습니다: ${imageFile}`);
  process.exit(1);
}

const target = questionTarget(question);
/* 발행 흐름과 같은 유형 판별을 쓴다 — 빈칸 유형은 답이 "라벨 전체" 가 아니라 "빈칸 글자" 다. */
const kind = /빈칸에 들어갈/.test(question) ? 'blank' : 'full';
const pattern = patternArg;
log.info(
  `판독: ${path.basename(imageFile)}${target ? ` · 묻는 대상 "${target}"` : ''}` +
    (kind === 'blank' ? ` · 빈칸 유형 (패턴 ${pattern || '3번째 인자로 주세요'})` : '')
);

/* 화면 전체 캡처를 물리면 결과가 나쁘다 — 발행 흐름은 위젯만 잘라 쓴다(§7-28).
 * 물어본 그림이 그런 경우임을 알려 준다. PNG 머리(IHDR)에서 폭만 읽는다. */
const raw = fs.readFileSync(imageFile);
if (raw.length > 24 && raw[0] === 0x89 && raw[1] === 0x50) {
  const width = raw.readUInt32BE(16);
  if (width >= 1000) {
    log.warn(
      `그림 폭이 ${width}px 입니다 — 화면 전체 캡처로 보입니다. 발행 흐름은 위젯(지도)만 ` +
        '잘라 판독합니다. 여기서 실패하는 것이 발행 실패를 뜻하지는 않습니다.'
    );
  }
}

/* 발행 때와 **같은 확대**를 거친다 — 화질이 판독을 가른다(§7-28 실측). */
const browser = await chromium.launch({ headless: true });
let readFile = imageFile;
try {
  readFile = await upscaleForReading(imageFile, { browser });
  if (readFile !== imageFile) log.info(`판독용 확대: ${path.basename(readFile)}`);
} finally {
  await browser.close();
}

const started = Date.now();
try {
  const read = await recognizeAnswer({ imageFile: readFile, question, target, kind, pattern });
  const took = Math.round((Date.now() - started) / 1000);
  console.log(`\n답     : ${read.answer || '(읽지 못했습니다)'}`);
  console.log(`확신   : ${read.confidence.toFixed(2)}`);
  console.log(`읽은 것: ${read.seen || '-'}`);
  console.log(`소요   : ${took}초`);
} catch (err) {
  log.warn(`판독 실패: ${err.message}`);
  process.exit(1);
}
