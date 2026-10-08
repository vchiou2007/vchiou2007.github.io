'use strict';
// HeadGestureController：頭部翻頁狀態機 + 角度平滑。
// 純邏輯、不依賴 DOM，可在 Node 中單元測試。
//
// 狀態（依規格）：
//   NEUTRAL → CANDIDATE_RIGHT / CANDIDATE_LEFT → TRIGGERED → WAIT_FOR_CENTER → COOLDOWN → NEUTRAL
//
// 規則：
//  1. 傾斜超過觸發角度進入候選；持續 holdMs 觸發翻頁。
//  2. 觸發後鎖定，繼續傾斜不會重複翻頁。
//  3. 必須回到中央（|roll| <= centerThreshold）並穩定 stableMs。
//  4. 冷卻時間與回正條件同時滿足才回到 NEUTRAL。
//  5. 失去人臉立即取消候選；追蹤失敗不得觸發翻頁。

export const GESTURE_STATES = Object.freeze({
  NEUTRAL: 'NEUTRAL',
  CANDIDATE_LEFT: 'CANDIDATE_LEFT',
  CANDIDATE_RIGHT: 'CANDIDATE_RIGHT',
  TRIGGERED: 'TRIGGERED',
  WAIT_FOR_CENTER: 'WAIT_FOR_CENTER',
  COOLDOWN: 'COOLDOWN',
});

// 顯示用文字（規格六之三 Gesture Status）
export function displayStatus(state, lastEvent) {
  switch (state) {
    case GESTURE_STATES.NEUTRAL: return 'CENTER';
    case GESTURE_STATES.CANDIDATE_LEFT: return 'TILT LEFT';
    case GESTURE_STATES.CANDIDATE_RIGHT: return 'TILT RIGHT';
    case GESTURE_STATES.TRIGGERED: return lastEvent === 'prev-page' ? 'PREVIOUS PAGE' : 'NEXT PAGE';
    case GESTURE_STATES.WAIT_FOR_CENTER: return 'WAIT FOR CENTER';
    case GESTURE_STATES.COOLDOWN: return 'WAIT FOR CENTER';
    default: return 'CENTER';
  }
}

// 指數移動平均平滑，避免攝影機雜訊造成誤觸。
export class EmaFilter {
  constructor(alpha = 0.35) {
    this.alpha = alpha;
    this.value = null;
  }
  reset() { this.value = null; }
  update(sample) {
    if (this.value === null) { this.value = sample; return this.value; }
    this.value = this.alpha * sample + (1 - this.alpha) * this.value;
    return this.value;
  }
}

// 原始角度 → 校準後相對角度；directionFlip 供鏡像裝置反轉。
export function relativeRoll(rawRollDeg, calibrationOffsetDeg = 0, directionFlip = false) {
  const rel = rawRollDeg - calibrationOffsetDeg;
  return directionFlip ? -rel : rel;
}

export class HeadGestureController {
  constructor(settings) {
    this._settings = { ...settings };
    this._filter = new EmaFilter(this._settings.smoothingAlpha);
    this.calibrationOffsetDeg = 0;
    this.state = GESTURE_STATES.NEUTRAL;
    this.lastEvent = null;       // 'next-page' | 'prev-page'
    this._candidateSince = 0;    // 候選開始時間
    this._triggeredAt = 0;       // 觸發時間（冷卻起點）
    this._centerSince = 0;       // 回正穩定起點
    this._lastEventSide = null;
  }

  updateSettings(settings) {
    this._settings = { ...settings };
    this._filter.alpha = this._settings.smoothingAlpha;
  }

  setCalibration(offsetDeg) {
    this.calibrationOffsetDeg = Number.isFinite(offsetDeg) ? offsetDeg : 0;
    this._filter.reset(); // 校準後重新累積平滑值，避免舊值殘留
  }

  reset() {
    this._filter.reset();
    this.state = GESTURE_STATES.NEUTRAL;
    this.lastEvent = null;
    this._candidateSince = 0;
    this._triggeredAt = 0;
    this._centerSince = 0;
  }

  /**
   * 每個推論影格呼叫。
   * @param {Object} p
   * @param {number} p.rollDeg   原始（未平滑、未校準）Roll 角度
   * @param {boolean} p.faceDetected 本影格是否偵測到人臉
   * @param {number} p.nowMs     時間戳（performance.now() 或 Date.now()）
   * @returns {{state:string, relRollDeg:number, filteredRollDeg:number|null, events:Array<{type:string,atMs:number}>}}
   */
  feed({ rollDeg, faceDetected, nowMs }) {
    const events = [];
    const s = this._settings;

    // 平滑處理（可依設定關閉）
    let filtered = null;
    if (faceDetected && Number.isFinite(rollDeg)) {
      filtered = s.smoothingEnabled ? this._filter.update(rollDeg) : rollDeg;
    }
    const rel = (filtered === null) ? null : relativeRoll(filtered, this.calibrationOffsetDeg, s.directionFlip);

    // 失去人臉：取消尚未完成的候選動作，且絕對不觸發翻頁。
    if (!faceDetected) {
      if (this.state === GESTURE_STATES.CANDIDATE_LEFT || this.state === GESTURE_STATES.CANDIDATE_RIGHT) {
        this.state = GESTURE_STATES.NEUTRAL;
        this._candidateSince = 0;
      }
      // WAIT_FOR_CENTER / COOLDOWN 期間失去人臉：維持鎖定，回來後仍需滿足回正+冷卻。
      if (this.state === GESTURE_STATES.TRIGGERED) this.state = GESTURE_STATES.WAIT_FOR_CENTER;
      return { state: this.state, relRollDeg: rel, filteredRollDeg: filtered, events };
    }

    const absRel = Math.abs(rel);
    const overTrigger = absRel >= s.triggerAngleDeg;
    const atCenter = absRel <= s.centerThresholdDeg;

    switch (this.state) {
      case GESTURE_STATES.NEUTRAL:
        if (overTrigger && rel > 0) {
          this.state = GESTURE_STATES.CANDIDATE_RIGHT;
          this._candidateSince = nowMs;
        } else if (overTrigger && rel < 0) {
          this.state = GESTURE_STATES.CANDIDATE_LEFT;
          this._candidateSince = nowMs;
        }
        break;

      case GESTURE_STATES.CANDIDATE_RIGHT:
        if (!overTrigger || rel <= 0) {
          // 提早回到觸發角以下 → 取消候選
          this.state = GESTURE_STATES.NEUTRAL;
          this._candidateSince = 0;
        } else if (nowMs - this._candidateSince >= s.holdMs) {
          this._fire(events, 'next-page', nowMs);
        }
        break;

      case GESTURE_STATES.CANDIDATE_LEFT:
        if (!overTrigger || rel >= 0) {
          this.state = GESTURE_STATES.NEUTRAL;
          this._candidateSince = 0;
        } else if (nowMs - this._candidateSince >= s.holdMs) {
          this._fire(events, 'prev-page', nowMs);
        }
        break;

      case GESTURE_STATES.TRIGGERED:
        // 觸發是瞬態：下一個影格進入等待回正。
        this.state = GESTURE_STATES.WAIT_FOR_CENTER;
        this._centerSince = 0;
        break;

      case GESTURE_STATES.WAIT_FOR_CENTER:
        this._updateCenterLock(atCenter, nowMs, events);
        break;

      case GESTURE_STATES.COOLDOWN:
        this._updateCenterLock(atCenter, nowMs, events);
        break;
    }

    return { state: this.state, relRollDeg: rel, filteredRollDeg: filtered, events };
  }

  _fire(events, type, nowMs) {
    this.lastEvent = type;
    this._lastEventSide = type;
    this._triggeredAt = nowMs;
    this.state = GESTURE_STATES.TRIGGERED;
    this._centerSince = 0;
    events.push({ type, atMs: nowMs });
  }

  _updateCenterLock(atCenter, nowMs, events) {
    const s = this._settings;
    if (!atCenter) {
      this._centerSince = 0;
      if (this.state === GESTURE_STATES.COOLDOWN) this.state = GESTURE_STATES.WAIT_FOR_CENTER;
      return;
    }
    if (!this._centerSince) { this._centerSince = nowMs; return; }
    const centerStable = nowMs - this._centerSince >= (s.stableMs ?? 150);
    const cooldownDone = nowMs - this._triggeredAt >= s.cooldownMs;
    if (!centerStable) return;
    if (!cooldownDone) { this.state = GESTURE_STATES.COOLDOWN; return; }
    // 回正穩定 + 冷卻結束 → 解除鎖定
    this.state = GESTURE_STATES.NEUTRAL;
    this._centerSince = 0;
  }
}
