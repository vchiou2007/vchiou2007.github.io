'use strict';
// GestureCalibration：中央姿勢校準。
// 純邏輯部分（median / complete）不依賴 DOM，可在 Node 中單元測試。
//
// 使用方式（由測試頁面控制時序）：
//   1. 使用者坐好、看著樂譜，按下 CALIBRATE。
//   2. UI 倒數三秒（期間不取樣，讓使用者擺正）。
//   3. UI 於取樣期間持續呼叫 addSample(rollDeg)。
//   4. UI 呼叫 complete() 取得校準偏移，之後角度皆以此為基準。

export const CALIBRATION_STORAGE_KEY = 'hg-poc-calibration-v1';

// 穩健統計：中位數，對偶發離群值不敏感。
export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function stddev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1));
}

export class GestureCalibration {
  constructor(storage = null) {
    this._storage = storage;
    this._samples = [];
    this.offsetDeg = 0;
    this.savedAt = 0;
    this.load();
  }

  get isCalibrated() { return this.savedAt > 0; }

  // 重新啟動攝影機時的檢查：校準是否仍存在、是否過舊（預設 12 小時）。
  checkFreshness(nowMs, maxAgeMs = 12 * 3600 * 1000) {
    if (!this.isCalibrated) return { ok: false, reason: '未校準' };
    const age = nowMs - this.savedAt;
    if (age > maxAgeMs) return { ok: false, reason: '校準資料已超過 12 小時，建議重新校準' };
    return { ok: true, ageMs: age };
  }

  beginCollection() { this._samples = []; }

  addSample(rollDeg) {
    if (Number.isFinite(rollDeg)) this._samples.push(rollDeg);
  }

  get sampleCount() { return this._samples.length; }

  // 結束取樣：以中位數作為中央位置偏移，存入 localStorage。
  complete(nowMs = Date.now()) {
    if (!this._samples.length) return null;
    this.offsetDeg = median(this._samples);
    this.savedAt = nowMs;
    this._persist();
    return { offsetDeg: this.offsetDeg, stddevDeg: stddev(this._samples), samples: this._samples.length };
  }

  clear() {
    this.offsetDeg = 0;
    this.savedAt = 0;
    this._samples = [];
    if (this._storage) { try { this._storage.removeItem(CALIBRATION_STORAGE_KEY); } catch (e) { /* ignore */ } }
  }

  load() {
    if (!this._storage) return;
    try {
      const raw = this._storage.getItem(CALIBRATION_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Number.isFinite(data.offsetDeg) && Number.isFinite(data.savedAt)) {
        this.offsetDeg = data.offsetDeg;
        this.savedAt = data.savedAt;
      }
    } catch (e) { /* 損壞資料：視同未校準 */ }
  }

  _persist() {
    if (!this._storage) return;
    try {
      this._storage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify({
        offsetDeg: this.offsetDeg,
        savedAt: this.savedAt,
      }));
    } catch (e) { /* 儲存空間不可用時靜默 */ }
  }
}
