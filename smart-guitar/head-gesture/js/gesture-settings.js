'use strict';
// GestureSettings：POC 參數設定與 localStorage 持久化。
// 本模組不依賴 DOM，可在 Node 中單元測試。

export const SETTINGS_STORAGE_KEY = 'hg-poc-settings-v1';

export const DEFAULT_SETTINGS = Object.freeze({
  triggerAngleDeg: 15,     // 觸發角度
  holdMs: 300,             // 持續時間
  centerThresholdDeg: 7,   // 回到中央角度
  cooldownMs: 800,         // 翻頁冷卻時間
  detectionFps: 5,         // AI 推論每秒次數
  cameraWidth: 320,        // 攝影機解析度
  cameraHeight: 240,
  smoothingEnabled: true,  // 角度平滑
  smoothingAlpha: 0.35,    // EMA 新樣本權重 (0~1)
  directionFlip: false,    // 鏡像／方向反轉
  showPreview: false,      // 選擇性攝影機預覽
});

const LIMITS = {
  triggerAngleDeg: [5, 45],
  holdMs: [100, 2000],
  centerThresholdDeg: [2, 20],
  cooldownMs: [200, 5000],
  detectionFps: [1, 15],
  cameraWidth: [160, 1280],
  cameraHeight: [120, 960],
  smoothingAlpha: [0.05, 1],
};

function clampInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

// 逐鍵檢查型別與範圍；不合法的值直接丟棄（回退預設值）。
export function sanitizeSettings(input, defaults = DEFAULT_SETTINGS) {
  const out = { ...defaults };
  if (!input || typeof input !== 'object') return out;
  for (const key of Object.keys(defaults)) {
    if (!(key in input)) continue;
    const value = input[key];
    if (typeof defaults[key] === 'boolean') {
      if (typeof value === 'boolean') out[key] = value;
      continue;
    }
    const range = LIMITS[key];
    const n = clampInt(value, range[0], range[1]);
    if (n !== null) out[key] = n;
  }
  return out;
}

export class GestureSettings {
  constructor(storage = null) {
    this._storage = storage; // 瀏覽器端傳入 localStorage；Node 測試傳入 null
    this._settings = { ...DEFAULT_SETTINGS };
    this._listeners = new Set();
    this.load();
  }

  get all() { return { ...this._settings }; }

  get(key) { return this._settings[key]; }

  set(partial) {
    this._settings = sanitizeSettings({ ...this._settings, ...partial });
    this.save();
    for (const fn of this._listeners) fn(this.all);
  }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  load() {
    if (!this._storage) return;
    try {
      const raw = this._storage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) this._settings = sanitizeSettings(JSON.parse(raw));
    } catch (e) { /* 損壞的儲存資料：使用預設值 */ }
  }

  save() {
    if (!this._storage) return;
    try { this._storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this._settings)); }
    catch (e) { /* 儲存空間不可用時靜默 */ }
  }

  reset() {
    this._settings = { ...DEFAULT_SETTINGS };
    this.save();
    for (const fn of this._listeners) fn(this.all);
  }
}
