'use strict';
// Head Gesture POC 單元測試（Node 執行，無需瀏覽器）
// 涵蓋：Roll 幾何正負號、EMA 平滑、狀態機（規格 Test 1–8 情境）、校準、設定、日誌。
// 執行：node head-gesture/tests/run-tests.mjs

import assert from 'node:assert/strict';
import { GestureSettings, sanitizeSettings, DEFAULT_SETTINGS } from '../js/gesture-settings.js';
import { HeadGestureController, GESTURE_STATES, EmaFilter, relativeRoll, displayStatus } from '../js/head-gesture-controller.js';
import { GestureCalibration, median, stddev } from '../js/gesture-calibration.js';
import { DebugLog } from '../js/debug-log.js';
import { computeHeadRollDeg } from '../js/face-tracking-service.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.error('  ✗ ' + name + '\n    ' + e.message); }
}

// 以 200ms 步進餵資料的模擬器（對應 5 FPS 推論）
function makeSim(settings) {
  const c = new HeadGestureController(settings);
  let t = 0;
  const events = [];
  return {
    controller: c,
    get now() { return t; },
    feed(rollDeg, faceDetected = true) {
      t += 200;
      const out = c.feed({ rollDeg, faceDetected, nowMs: t });
      for (const ev of out.events) events.push({ ...ev, rollAtTrigger: rollDeg });
      return out;
    },
    feedFor(ms, rollDeg, faceDetected = true) {
      const steps = Math.ceil(ms / 200);
      let out;
      for (let i = 0; i < steps; i++) out = this.feed(rollDeg, faceDetected);
      return out;
    },
    events,
  };
}

console.log('\n[1] Roll 幾何正負號（使用者本人右傾 = 正值）');
test('右傾（右眼 33 下移、左眼 263 上移）為正', () => {
  // 影像座標 y 向下；33=使用者右眼（畫面左），263=使用者左眼（畫面右）
  const roll = computeHeadRollDeg([null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null,
    null, null, null,
    { x: 0.40, y: 0.55 },   // 33
  ].concat(new Array(229).fill(null)).concat([{ x: 0.60, y: 0.45 }])); // 263
  assert.ok(roll > 25 && roll < 28, '期望約 +26.6°，實得 ' + roll);
});
test('左傾為負、水平為零', () => {
  const mk = (y33, y263) => {
    const arr = new Array(478).fill(null);
    arr[33] = { x: 0.40, y: y33 };
    arr[263] = { x: 0.60, y: y263 };
    return arr;
  };
  assert.ok(computeHeadRollDeg(mk(0.45, 0.55)) < -25, '左傾應為負');
  assert.ok(Math.abs(computeHeadRollDeg(mk(0.50, 0.50))) < 1e-9, '水平應為零');
});
test('缺失資料回傳 null', () => {
  assert.equal(computeHeadRollDeg([]), null);
});

console.log('\n[2] relativeRoll 與方向反轉');
test('校準偏移與鏡像反轉', () => {
  assert.equal(relativeRoll(21, 6), 15);
  assert.equal(relativeRoll(21, 6, true), -15);
});

console.log('\n[3] EMA 平滑');
test('平滑降低雜訊且跟隨趨勢', () => {
  const f = new EmaFilter(0.35);
  assert.equal(f.update(10), 10);
  const v2 = f.update(12);
  assert.ok(Math.abs(v2 - 10.7) < 1e-9);
});

console.log('\n[4] 狀態機 — 規格 Test 1：向右傾斜 10 次，每次只翻一頁');
test('10 次右傾各觸發一次（共 10 次 next-page）', () => {
  const sim = makeSim({ ...DEFAULT_SETTINGS, smoothingEnabled: false });
  for (let i = 0; i < 10; i++) {
    sim.feed(0);                                   // 中央
    sim.feed(20);                                  // 進入候選
    sim.feedFor(400, 20);                          // 持續超過 300ms → 觸發
    assert.equal(sim.events.length, i + 1, '第 ' + (i + 1) + ' 次傾斜應觸發');
    sim.feedFor(2000, 0);                          // 回正（滿足穩定 + 冷卻）
  }
  assert.equal(sim.controller.state, GESTURE_STATES.NEUTRAL);
});

console.log('\n[5] 狀態機 — 規格 Test 3：持續右傾三秒只翻一頁');
test('持續傾斜不重複觸發', () => {
  const sim = makeSim({ ...DEFAULT_SETTINGS, smoothingEnabled: false });
  sim.feed(0);
  sim.feed(20);
  sim.feedFor(3000, 20);
  assert.equal(sim.events.length, 1);
  assert.ok([GESTURE_STATES.WAIT_FOR_CENTER, GESTURE_STATES.COOLDOWN, GESTURE_STATES.TRIGGERED].includes(sim.controller.state));
});

console.log('\n[6] 狀態機 — 回正 + 冷卻同時滿足才解除鎖定');
test('回正後未滿冷卻時間仍鎖定', () => {
  const sim = makeSim({ ...DEFAULT_SETTINGS, smoothingEnabled: false, cooldownMs: 800, holdMs: 300 });
  sim.feed(0);
  sim.feed(20);
  sim.feedFor(400, 20);          // 觸發（t≈800）
  const tAfterTrigger = sim.now;
  sim.feedFor(600, 0);           // 回正並穩定，但冷卻未滿 800ms
  assert.notEqual(sim.controller.state, GESTURE_STATES.NEUTRAL, '冷卻未滿不得解除鎖定');
  sim.feedFor(600, 0);           // 冷卻期滿
  assert.equal(sim.controller.state, GESTURE_STATES.NEUTRAL);
});
test('冷卻期滿但未回正仍鎖定', () => {
  const sim = makeSim({ ...DEFAULT_SETTINGS, smoothingEnabled: false });
  sim.feed(0); sim.feed(20); sim.feedFor(400, 20);   // 觸發
  sim.feedFor(2000, 20);                              // 持續傾斜（未回正）
  assert.notEqual(sim.controller.state, GESTURE_STATES.NEUTRAL);
});

console.log('\n[7] 狀態機 — 規格 Test 2/4：左傾與小角度不觸發');
test('左傾觸發 prev-page', () => {
  const sim = makeSim({ ...DEFAULT_SETTINGS, smoothingEnabled: false });
  sim.feed(0); sim.feed(-20); sim.feedFor(400, -20);
  assert.equal(sim.events.length, 1);
  assert.equal(sim.events[0].type, 'prev-page');
});
test('自然低頭/微動（±8°）不觸發', () => {
  const sim = makeSim({ ...DEFAULT_SETTINGS, smoothingEnabled: false });
  for (let i = 0; i < 25; i++) sim.feed(i % 2 ? 8 : -8);
  assert.equal(sim.events.length, 0);
});

console.log('\n[8] 狀態機 — 規格 Test 7/8：失去人臉');
test('候選期間失去人臉 → 取消，不觸發', () => {
  const sim = makeSim({ ...DEFAULT_SETTINGS, smoothingEnabled: false });
  sim.feed(0); sim.feed(20);
  sim.feed(20, false);          // 失去人臉
  assert.equal(sim.events.length, 0);
  assert.equal(sim.controller.state, GESTURE_STATES.NEUTRAL);
});
test('觸發後失去人臉，回來後仍需回正 + 冷卻', () => {
  const sim = makeSim({ ...DEFAULT_SETTINGS, smoothingEnabled: false });
  sim.feed(0); sim.feed(20); sim.feedFor(400, 20);
  sim.feedFor(1000, 0, false);  // 人臉消失
  sim.feedFor(2000, 20);        // 回來但仍傾斜
  assert.equal(sim.events.length, 1, '不得自動再次觸發');
});
test('從未偵測到人臉不得觸發', () => {
  const sim = makeSim({ ...DEFAULT_SETTINGS, smoothingEnabled: false });
  sim.feedFor(3000, 20, false);
  assert.equal(sim.events.length, 0);
});

console.log('\n[9] 提早回位取消候選');
test('未滿 hold 時間即回到觸發角以下 → 取消', () => {
  const sim = makeSim({ ...DEFAULT_SETTINGS, smoothingEnabled: false, holdMs: 300 });
  sim.feed(0); sim.feed(20); sim.feed(20);   // 僅 400ms 中只累積 200ms 候選
  sim.feed(5);                                // 提早回位
  sim.feedFor(1000, 5);
  assert.equal(sim.events.length, 0);
});

console.log('\n[10] 平滑處理與遲滯');
test('開啟平滑時單幀雜訊尖峰不越過觸發角', () => {
  const s = { ...DEFAULT_SETTINGS, smoothingEnabled: true, smoothingAlpha: 0.35, triggerAngleDeg: 15, holdMs: 300 };
  const sim = makeSim(s);
  sim.feed(0); sim.feed(0); sim.feed(0);      // 平滑值歸零
  const out = sim.feed(30);                    // 單幀尖峰
  assert.ok(Math.abs(out.relRollDeg) < 15, '平滑後仍應低於觸發角，實得 ' + out.relRollDeg);
});
test('候選期間短暫低於觸發角（高於遲滯門檻）不取消、不重新計時', () => {
  // 5 FPS 下 EMA(α=0.5) 傾斜約需 3 幀跨過 15°；期間 13° 的 dips 不應取消候選
  const s = { ...DEFAULT_SETTINGS, smoothingEnabled: true, smoothingAlpha: 0.5, triggerAngleDeg: 15, holdMs: 300 };
  const sim = makeSim(s);
  sim.feed(0);
  sim.feed(25);        // f=12.5
  sim.feed(25);        // f=18.75 → CANDIDATE
  sim.feed(25);        // f≈22 → 持續計時
  const out = sim.feed(25);  // 累計持有 ≥300ms 且 recentMax≥15 → 觸發
  assert.equal(out.events.length, 1, '應觸發一次翻頁');
  assert.equal(out.events[0].type, 'next-page');
});
test('明顯回位（低於遲滯門檻）仍會取消候選', () => {
  const s = { ...DEFAULT_SETTINGS, smoothingEnabled: false };
  const sim = makeSim(s);
  sim.feed(0); sim.feed(20); sim.feed(20);
  sim.feed(5);         // 低於 exitThreshold(12) → 取消
  sim.feedFor(1000, 5);
  assert.equal(sim.events.length, 0);
});

console.log('\n[11] 校準');
test('中位數與標準差', () => {
  assert.equal(median([5, 6, 7]), 6);
  assert.equal(median([7, 5]), 6);
  assert.ok(stddev([2, 4, 4, 4, 5, 5, 7, 9]) > 2.1 && stddev([2, 4, 4, 4, 5, 5, 7, 9]) < 2.3);
});
test('校準後中央姿勢為零、右傾 15° 顯示 +15', () => {
  const storage = new Map();
  const fakeStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k),
  };
  const cal = new GestureCalibration(fakeStorage);
  cal.beginCollection();
  for (let i = 0; i < 20; i++) cal.addSample(5.9 + (i % 3) * 0.1);
  const done = cal.complete(1000);
  assert.ok(Math.abs(done.offsetDeg - 6) < 0.05);
  const c = new HeadGestureController({ ...DEFAULT_SETTINGS, smoothingEnabled: false });
  c.setCalibration(cal.offsetDeg);
  let out = c.feed({ rollDeg: 6, faceDetected: true, nowMs: 200 });
  assert.ok(Math.abs(out.relRollDeg) < 0.01, '校準後中央應為 0，實得 ' + out.relRollDeg);
  out = c.feed({ rollDeg: 21, faceDetected: true, nowMs: 400 });
  assert.ok(Math.abs(out.relRollDeg - 15) < 0.01, '右傾應為 +15，實得 ' + out.relRollDeg);
  // 持久化與重新載入
  const cal2 = new GestureCalibration(fakeStorage);
  assert.ok(Math.abs(cal2.offsetDeg - 6) < 0.05);
  assert.equal(cal2.checkFreshness(1000 + 3600e3).ok, true);
  assert.equal(cal2.checkFreshness(1000 + 13 * 3600e3).ok, false, '超過 12 小時應要求重新校準');
});

console.log('\n[12] 設定 sanitize');
test('型別與範圍檢查、損壞資料回退', () => {
  const s = sanitizeSettings({ triggerAngleDeg: 999, holdMs: 'abc', detectionFps: 5.7, smoothingEnabled: 'yes' });
  assert.equal(s.triggerAngleDeg, 45);
  assert.equal(s.holdMs, DEFAULT_SETTINGS.holdMs);
  assert.equal(s.detectionFps, 6);
  assert.equal(s.smoothingEnabled, DEFAULT_SETTINGS.smoothingEnabled);
  assert.equal(sanitizeSettings(null).triggerAngleDeg, 15);
});

console.log('\n[13] Debug Log');
test('容量上限、JSON/CSV 匯出', () => {
  const log = new DebugLog(10);
  for (let i = 0; i < 15; i++) log.add({ rawRollDeg: i, state: 'NEUTRAL' });
  assert.equal(log.count, 10);
  const json = JSON.parse(log.toJSON());
  assert.equal(json.length, 10);
  assert.equal(json[9].raw_roll_deg, 14);
  const csv = log.toCSV();
  assert.ok(csv.startsWith('timestamp,raw_roll_deg'));
  assert.equal(csv.trim().split('\n').length, 11);
});

console.log('\n[14] 顯示狀態文字');
test('displayStatus 對應規格用語', () => {
  assert.equal(displayStatus(GESTURE_STATES.NEUTRAL), 'CENTER');
  assert.equal(displayStatus(GESTURE_STATES.CANDIDATE_LEFT), 'TILT LEFT');
  assert.equal(displayStatus(GESTURE_STATES.CANDIDATE_RIGHT), 'TILT RIGHT');
  assert.equal(displayStatus(GESTURE_STATES.TRIGGERED, 'next-page'), 'NEXT PAGE');
  assert.equal(displayStatus(GESTURE_STATES.TRIGGERED, 'prev-page'), 'PREVIOUS PAGE');
  assert.equal(displayStatus(GESTURE_STATES.WAIT_FOR_CENTER), 'WAIT FOR CENTER');
});

console.log('\n結果：' + passed + ' 通過，' + failed + ' 失敗');
process.exit(failed ? 1 : 0);
