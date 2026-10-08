'use strict';
// HeadGestureTestPage：POC 測試頁面邏輯（UI 接線）。
// 對應規格：A Camera Status / B Roll 角度 / C Gesture Status / D Virtual Page /
//          E Counter / F Performance / G 控制按鈕 / 可調參數 / Debug Log / 校準。

import { GestureSettings } from './gesture-settings.js';
import { HeadGestureController, displayStatus, GESTURE_STATES } from './head-gesture-controller.js';
import { GestureCalibration } from './gesture-calibration.js';
import { DebugLog } from './debug-log.js';
import { FaceTrackingService } from './face-tracking-service.js';

const TOTAL_PAGES = 7;           // 至少五個模擬頁面
const CALIBRATION_COUNTDOWN_MS = 3000;
const CALIBRATION_COLLECT_MS = 1000;
const LOG_ROWS_SHOWN = 8;

const settings = new GestureSettings(window.localStorage);
const calibration = new GestureCalibration(window.localStorage);
const log = new DebugLog(600);
const controller = new HeadGestureController(settings.all);
controller.setCalibration(calibration.offsetDeg);

const state = {
  page: 1,
  nextCount: 0,
  prevCount: 0,
  status: 'camera-off',
  statusDetail: '',
  calibrating: false,
  lastResult: null,
};

const $ = (id) => document.getElementById(id);

// ---------- FaceTrackingService ----------
const service = new FaceTrackingService({
  onStatus: handleStatus,
  onResult: handleResult,
});

function handleStatus(status, detail) {
  state.status = status;
  state.statusDetail = detail || '';
  if (status === 'model-ready') {
    $('delegateStatus').textContent = detail || 'CPU';
    state.statusDetail = '';
  }
  renderStatus();
}

function handleResult(result) {
  state.lastResult = result;
  const out = controller.feed({
    rollDeg: result.rollDeg,
    faceDetected: result.faceDetected,
    nowMs: performance.now(),
  });

  for (const ev of out.events) {
    if (ev.type === 'next-page') {
      state.nextCount++;
      state.page = Math.min(TOTAL_PAGES, state.page + 1);
      log.add(makeLogEntry(out, result, 'NEXT_PAGE'));
    } else if (ev.type === 'prev-page') {
      state.prevCount++;
      state.page = Math.max(1, state.page - 1);
      log.add(makeLogEntry(out, result, 'PREV_PAGE'));
    }
  }

  log.add(makeLogEntry(out, result, ''));
  renderAll(out, result);
}

function makeLogEntry(out, result, event) {
  return {
    rawRollDeg: result.rollDeg,
    filteredRollDeg: out.filteredRollDeg,
    relRollDeg: out.relRollDeg,
    state: out.state,
    page: state.page,
    event,
    inferenceMs: result.inferenceMs,
  };
}

// ---------- 渲染 ----------
function renderStatus() {
  const pill = $('cameraStatus');
  const map = {
    'camera-off': ['CAMERA OFF', 'off'],
    'model-loading': ['CAMERA OFF', 'off'],
    'model-ready': ['CAMERA OFF', 'off'],
    'camera-starting': ['CAMERA ON', 'on'],
    'running': ['CAMERA ON', 'on'],
    'face-detected': ['FACE DETECTED', 'face'],
    'face-lost': ['FACE LOST', 'lost'],
    'permission-denied': ['PERMISSION DENIED', 'denied'],
    'error': ['ERROR', 'error'],
    'paused': ['CAMERA ON（背景暫停）', 'on'],
  };
  const [text, cls] = map[state.status] || ['CAMERA OFF', 'off'];
  pill.textContent = text;
  pill.className = 'status-pill ' + cls;
  $('cameraInfo').textContent = state.statusDetail || '–';
}

function renderAll(out, result) {
  // B · Roll
  const rel = out.relRollDeg;
  const rollEl = $('rollValue');
  if (rel === null || rel === undefined) {
    rollEl.textContent = '--.-°';
    rollEl.className = 'big-readout';
    $('tiltFill').style.width = '0';
  } else {
    rollEl.textContent = (rel >= 0 ? '+' : '') + rel.toFixed(1) + '°';
    rollEl.className = 'big-readout ' + (rel >= 0 ? 'pos' : 'neg');
    const width = Math.min(50, Math.abs(rel) / 45 * 50);
    $('tiltFill').style.width = width + '%';
    $('tiltFill').style.left = rel >= 0 ? '50%' : (50 - width) + '%';
    $('tiltFill').style.background = rel >= 0 ? 'var(--green)' : 'var(--blue)';
  }
  $('rollRaw').textContent = Number.isFinite(result.rollDeg) ? result.rollDeg.toFixed(1) : '–';
  $('rollFiltered').textContent = Number.isFinite(out.filteredRollDeg) ? out.filteredRollDeg.toFixed(1) : '–';
  $('rollOffset').textContent = controller.calibrationOffsetDeg.toFixed(1);

  // C · Gesture
  const display = displayStatus(out.state, controller.lastEvent);
  const g = $('gestureStatus');
  g.textContent = display;
  g.className = 'gesture-readout ' + ({
    'CENTER': 'center',
    'TILT LEFT': 'tilt-l',
    'TILT RIGHT': 'tilt-r',
    'NEXT PAGE': 'fire',
    'PREVIOUS PAGE': 'fire',
    'WAIT FOR CENTER': 'wait',
  }[display] || 'center');
  $('stateMachine').textContent = out.state;

  // D · Virtual page
  $('virtualPage').textContent = 'PAGE ' + state.page;
  renderDots();

  // E · Counters
  $('nextCount').textContent = state.nextCount;
  $('prevCount').textContent = state.prevCount;
  $('totalCount').textContent = state.nextCount + state.prevCount;

  // F · Performance
  const m = service.metrics;
  $('cameraFps').textContent = m.cameraFps || '–';
  $('inferenceFps').textContent = m.inferenceFps || '–';
  $('avgInference').textContent = m.avgInferenceMs ? m.avgInferenceMs.toFixed(1) : '–';
  const latency = settings.get('holdMs') + (m.avgInferenceMs || 0) + 1000 / settings.get('detectionFps');
  $('estLatency').textContent = Math.round(latency);

  // Log
  renderLogRows();
}

function renderDots() {
  const dots = $('pageDots');
  if (dots.childElementCount !== TOTAL_PAGES) {
    dots.replaceChildren();
    for (let i = 0; i < TOTAL_PAGES; i++) dots.append(document.createElement('i'));
  }
  [...dots.children].forEach((d, i) => d.classList.toggle('on', i === state.page - 1));
}

function renderLogRows() {
  $('logCount').textContent = log.count;
  const tbody = $('logBody');
  const rows = log.entries.slice(-LOG_ROWS_SHOWN).reverse();
  tbody.replaceChildren(...rows.map((e) => {
    const tr = document.createElement('tr');
    for (const v of [e.timestamp.slice(11, 19), e.raw_roll_deg, e.filtered_roll_deg, e.rel_roll_deg, e.state, e.page, e.event, e.inference_ms]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.append(td);
    }
    return tr;
  }));
}

// ---------- 控制按鈕 ----------
$('btnStart').onclick = async () => {
  setBusy(true);
  try {
    await service.startCamera(settings.all);
    controller.reset();
    applyCalibrationIfFresh();
    syncPreview();
  } catch (e) {
    // 權限被拒或已回報錯誤時不覆蓋；其餘例外（例如模組載入失敗）必須顯示給使用者
    if (state.status !== 'permission-denied' && state.status !== 'error') {
      handleStatus('error', '啟動失敗：' + (e && e.message ? e.message : e));
    }
  }
  setBusy(false);
};

$('btnStop').onclick = () => {
  service.stop();
  controller.reset();
  setBusy(false);
};

$('btnCalibrate').onclick = async () => {
  if (state.calibrating || !service.isCameraOn) return;
  state.calibrating = true;
  $('btnCalibrate').disabled = true;
  $('btnStart').disabled = true;
  $('btnStop').disabled = true;
  const overlay = $('countdownOverlay');
  const num = $('countdownNum');
  overlay.classList.add('show');

  // 1. 倒數三秒（不取樣）
  for (let i = 3; i >= 1; i--) {
    num.textContent = i;
    await wait(1000);
  }
  num.textContent = '●';

  // 2. 連續取樣
  calibration.beginCollection();
  const collecting = setInterval(() => {
    const r = state.lastResult;
    if (r && Number.isFinite(r.rollDeg)) calibration.addSample(r.rollDeg);
  }, 50);
  await wait(CALIBRATION_COLLECT_MS);
  clearInterval(collecting);

  // 3. 穩健統計（中位數）→ 設為中央
  const done = calibration.complete();
  controller.setCalibration(calibration.offsetDeg);
  overlay.classList.remove('show');
  state.calibrating = false;
  $('btnCalibrate').disabled = false;
  $('btnStart').disabled = false;
  $('btnStop').disabled = false;
  renderCalibrationInfo();
  if (done) {
    log.add({ state: 'CALIBRATED', event: 'OFFSET ' + done.offsetDeg.toFixed(2) + '° / σ' + done.stddevDeg.toFixed(2) + ' / n=' + done.samples });
    renderLogRows();
  }
};

$('btnReset').onclick = () => {
  state.page = 1;
  state.nextCount = 0;
  state.prevCount = 0;
  renderAll({ relRollDeg: null, filteredRollDeg: null, state: controller.state }, { rollDeg: NaN, inferenceMs: 0 });
};

$('btnExportJson').onclick = () => download('head-gesture-log.json', log.toJSON(), 'application/json');
$('btnExportCsv').onclick = () => download('head-gesture-log.csv', log.toCSV(), 'text/csv');
$('btnClearLog').onclick = () => { log.clear(); renderLogRows(); };

function download(name, text, mime) {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function setBusy(starting) {
  $('btnStart').disabled = starting || service.isCameraOn;
  $('btnStop').disabled = starting || !service.isCameraOn;
  $('btnCalibrate').disabled = starting || !service.isCameraOn;
}

// ---------- 校準資訊 ----------
function applyCalibrationIfFresh() {
  // 重新啟動攝影機時檢查校準資料是否仍可使用
  controller.setCalibration(calibration.offsetDeg);
  renderCalibrationInfo(true);
}

function renderCalibrationInfo(withWarning = false) {
  const el = $('calibrationInfo');
  if (!calibration.isCalibrated) {
    el.textContent = '未校準 · 建議啟動攝影機後先按 CALIBRATE';
    return;
  }
  const date = new Date(calibration.savedAt);
  let text = '已校準 ' + calibration.offsetDeg.toFixed(2) + '°（' + date.toLocaleString() + '）';
  const check = calibration.checkFreshness(Date.now());
  if (!check.ok && withWarning) text += '　⚠ ' + check.reason;
  el.textContent = text;
}

// ---------- 設定面板 ----------
function bindSettings() {
  const pairs = [
    ['setTrigger', 'setTriggerOut', 'triggerAngleDeg', (v) => v + '°'],
    ['setHold', 'setHoldOut', 'holdMs', (v) => v + ' ms'],
    ['setCenter', 'setCenterOut', 'centerThresholdDeg', (v) => '±' + v + '°'],
    ['setCooldown', 'setCooldownOut', 'cooldownMs', (v) => v + ' ms'],
    ['setFps', 'setFpsOut', 'detectionFps', (v) => v + ' FPS'],
  ];
  for (const [inputId, outId, key, fmt] of pairs) {
    const input = $(inputId);
    input.value = settings.get(key);
    $(outId).textContent = fmt(settings.get(key));
    input.oninput = () => {
      settings.set({ [key]: Number(input.value) });
      $(outId).textContent = fmt(settings.get(key));
    };
  }

  const alpha = $('setAlpha');
  alpha.value = settings.get('smoothingAlpha');
  $('setAlphaOut').textContent = settings.get('smoothingAlpha').toFixed(2);
  alpha.oninput = () => {
    settings.set({ smoothingAlpha: Number(alpha.value) });
    $('setAlphaOut').textContent = settings.get('smoothingAlpha').toFixed(2);
  };

  $('setSmoothing').checked = settings.get('smoothingEnabled');
  $('setSmoothing').onchange = (e) => settings.set({ smoothingEnabled: e.target.checked });

  $('setFlip').checked = settings.get('directionFlip');
  $('setFlip').onchange = (e) => settings.set({ directionFlip: e.target.checked });

  $('setPreview').checked = settings.get('showPreview');
  $('setPreview').onchange = (e) => {
    settings.set({ showPreview: e.target.checked });
    syncPreview();
  };

  const res = $('setResolution');
  res.value = settings.get('cameraWidth') + 'x' + settings.get('cameraHeight');
  res.onchange = async () => {
    const [w, h] = res.value.split('x').map(Number);
    const wasOn = service.isCameraOn;
    if (wasOn) service.stop();
    settings.set({ cameraWidth: w, cameraHeight: h });
    if (wasOn) {
      try { await service.startCamera(settings.all); syncPreview(); }
      catch (e) { /* 狀態已回報 */ }
    }
  };

  $('btnResetSettings').onclick = () => {
    settings.reset();
    controller.updateSettings(settings.all);
    service.updateSettings(settings.all);
    bindSettings(); // 重新同步全部控制項
  };

  // 任何設定變更即時套用
  settings.onChange((all) => {
    controller.updateSettings(all);
    service.updateSettings(all);
  });
}

function syncPreview() {
  const show = settings.get('showPreview');
  $('previewWrap').classList.toggle('show', show);
  $('preview').srcObject = show ? service.stream : null;
  if (show) $('preview').play().catch(() => {});
}

// ---------- 背景 / 前景 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    service.pause();
  } else {
    service.resume();
  }
});
window.addEventListener('pagehide', () => service.stop());
window.addEventListener('beforeunload', () => service.stop());

// ---------- 啟動 ----------
bindSettings();
renderCalibrationInfo();
renderStatus();
renderDots();
// 預先載入模型（不開攝影機），縮短 START 等待時間
service.loadModule().then(() => {
  $('modelStatus').textContent = '已載入（本機）';
}).catch(() => {
  $('modelStatus').textContent = '載入失敗';
});
$('delegateStatus').textContent = '–';
