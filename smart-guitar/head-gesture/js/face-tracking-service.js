'use strict';
// FaceTrackingService：攝影機 + MediaPipe Face Landmarker 封裝。
// 所有影像辨識皆在 iPad 本機完成，不送出任何影像到伺服器。
//
// 效能策略（A10X / iPadOS 17）：
//  - 預設 320×240 低解析度、單人臉、關閉 blendshapes 與表情。
//  - 推論頻率由設定檔限制（預設 5 FPS），推論間隔不做事。
//  - delegate 先嘗試 GPU，失敗自動降回 CPU（不假設 GPU 可用）。
//  - 模組 / WASM / 模型皆由專案目錄本機載入，失敗才退回 CDN。

// MediaPipe Face Mesh 特徵點索引：
//  33  = 右眼外角（使用者本人右眼，畫面左側）
//  263 = 左眼外角（使用者本人左眼，畫面右側）
const RIGHT_EYE_OUTER = 33;
const LEFT_EYE_OUTER = 263;

// 注意：模組內的動態 import / fetch 會以「本模組所在目錄」解析相對路徑，
// 因此資源一律改以「頁面」（document.baseURI）為基準，否則會 404 而靜默失敗。
function pageAsset(path) {
  const base = (typeof document !== 'undefined' && document.baseURI) || 'http://localhost/';
  return new URL(path, base).href;
}
const LOCAL_MODULE_PATH = './head-gesture/vendor/tasks-vision/vision_bundle.mjs';
const LOCAL_WASM_PATH = './head-gesture/vendor/tasks-vision/wasm';
const LOCAL_MODEL_PATH = './head-gesture/vendor/models/face_landmarker.task';
const CDN_MODULE_URLS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.min.mjs',
  'https://unpkg.com/@mediapipe/tasks-vision@0.10.14/vision_bundle.min.mjs',
];
const CDN_WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const CDN_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

function errMsg(e) { return e && e.message ? e.message : String(e); }

// 由雙眼連線估算頭部 Roll（左右傾斜）角度。
// 座標系：影像 y 軸向下；回傳值定義為「使用者本人的右傾 = 正角度」。
// 驗證：右傾時右眼(33)下移、左眼(263)上移 → atan2(dy,dx)<0 → 加負號後為正。
export function computeHeadRollDeg(landmarks) {
  const r = landmarks[RIGHT_EYE_OUTER];
  const l = landmarks[LEFT_EYE_OUTER];
  if (!r || !l) return null;
  const dx = l.x - r.x;
  const dy = l.y - r.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return null;
  const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
  // 平角歸一化到 (-90, 90]：臉上下顛倒（罕見）時仍取銳角傾斜。
  let roll = -angleDeg;
  if (roll > 90) roll -= 180;
  if (roll <= -90) roll += 180;
  return roll;
}

export class FaceTrackingService {
  /**
   * @param {Object} hooks
   * @param {(status:string, detail?:string)=>void} hooks.onStatus
   * @param {(result:{rollDeg:number|null, faceDetected:boolean, inferenceMs:number, matrixNote:string})=>void} hooks.onResult
   */
  constructor(hooks) {
    this._onStatus = hooks.onStatus || (() => {});
    this._onResult = hooks.onResult || (() => {});
    this._mp = null;           // 載入的 tasks-vision 模組
    this._landmarker = null;
    this._delegate = 'CPU';
    this._stream = null;
    this._video = null;
    this._running = false;     // 推論迴圈開關
    this._settings = null;
    this._lastInferTs = 0;
    this._lastVideoTime = -1;
    this._frameCount = 0;      // 攝影機幀計數（每秒歸零）
    this._inferCount = 0;      // 推論計數（每秒歸零）
    this._metrics = { cameraFps: 0, inferenceFps: 0, avgInferenceMs: 0 };
    this._inferenceEma = null;
    this._secondTimer = 0;
    this._destroyed = false;
  }

  get metrics() { return { ...this._metrics }; }
  get delegate() { return this._delegate; }
  get stream() { return this._stream; }
  get isRunning() { return this._running; }
  get isCameraOn() { return Boolean(this._stream); }

  async loadModule() {
    if (this._mp) return this._mp;
    this._onStatus('model-loading', '載入 AI 模組…');
    try {
      this._mp = await import(pageAsset(LOCAL_MODULE_PATH));
      return this._mp;
    } catch (e) {
      console.warn('本機 MediaPipe 模組載入失敗，改用 CDN：', e);
    }
    let lastErr = null;
    for (const url of CDN_MODULE_URLS) {
      try { this._mp = await import(url); return this._mp; }
      catch (e) { lastErr = e; console.warn('CDN 模組載入失敗：', url, e); }
    }
    this._onStatus('error', 'AI 模組載入失敗（本機與 CDN 皆不可用）：' + errMsg(lastErr));
    throw lastErr || new Error('module load failed');
  }

  // 初始化 Face Landmarker；GPU 失敗自動降級 CPU。
  async initLandmarker(settings) {
    if (this._landmarker) return;
    this._settings = settings;
    const mp = await this.loadModule();
    const fileset = await mp.FilesetForVisionTasks.forVisionTasks(pageAsset(LOCAL_WASM_PATH))
      .catch(async () => {
        console.warn('本機 WASM 載入失敗，改用 CDN');
        return mp.FilesetForVisionTasks.forVisionTasks(CDN_WASM_BASE);
      });
    const modelUrl = pageAsset(LOCAL_MODEL_PATH);
    const options = (delegate) => ({
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate,
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    try {
      this._landmarker = await mp.FaceLandmarker.createFromOptions(fileset, options('GPU'));
      this._delegate = 'GPU';
    } catch (e) {
      console.warn('GPU delegate 不可用，改用 CPU：', e);
      try {
        this._landmarker = await mp.FaceLandmarker.createFromOptions(fileset, options('CPU'));
        this._delegate = 'CPU';
      } catch (e2) {
        this._landmarker = null;
        this._onStatus('error', '模型初始化失敗：' + errMsg(e2));
        throw e2;
      }
    }
    this._onStatus('model-ready', this._delegate);
  }

  async startCamera(settings) {
    this._settings = settings;
    if (!this._landmarker) await this.initLandmarker(settings);
    if (this._stream) return; // 已在運作

    this._onStatus('camera-starting', '啟動攝影機…');
    const constraints = {
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: settings.cameraWidth },
        height: { ideal: settings.cameraHeight },
        frameRate: { ideal: 15, max: 30 },
      },
    };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      this._onStatus(denied ? 'permission-denied' : 'error',
        denied ? '攝影機權限被拒絕' : ('無法開啟攝影機：' + (e && e.message ? e.message : e)));
      throw e;
    }
    this._stream = stream;
    if (!this._video) {
      this._video = document.createElement('video');
      this._video.playsInline = true;
      this._video.muted = true;
      this._video.setAttribute('aria-hidden', 'true');
    }
    this._video.srcObject = stream;
    await this._video.play().catch(() => {});
    this._running = true;
    this._onStatus('running', this._actualResolution());
    this._loop();
  }

  stop() {
    this._running = false;
    if (this._stream) {
      for (const track of this._stream.getTracks()) track.stop();
      this._stream = null;
    }
    if (this._video) { this._video.srcObject = null; }
    this._lastVideoTime = -1;
    this._metrics.cameraFps = 0;
    this._metrics.inferenceFps = 0;
    this._onStatus('camera-off');
  }

  // App 進入背景時暫停推論；返回前景時呼叫 resume 重新檢查攝影機狀態。
  pause() {
    this._running = false;
    this._onStatus('paused');
  }

  resume() {
    if (!this._stream || !this._video) return;
    if (this._video.readyState < 2) { this._onStatus('error', '攝影機尚未就緒，請重新啟動'); return; }
    if (!this._running) {
      this._running = true;
      this._onStatus('running', this._actualResolution());
      this._loop();
    }
  }

  updateSettings(settings) {
    this._settings = settings;
    // 解析度變更需重新啟動攝影機才生效（由頁面處理）。
  }

  _actualResolution() {
    const t = this._stream && this._stream.getVideoTracks()[0];
    const s = t && t.getSettings ? t.getSettings() : {};
    return (s.width || '?') + '×' + (s.height || '?') + ' @ ' + (s.frameRate ? Math.round(s.frameRate) : '?') + 'fps';
  }

  _loop() {
    if (this._destroyed || !this._running) return;
    const step = () => {
      if (!this._running) return;
      this._tick();
      this._scheduleNext(step);
    };
    this._scheduleNext(step);
  }

  _scheduleNext(step) {
    // 優先使用 requestVideoFrameCallback（Safari 15+），退而求其次用 rAF。
    const v = this._video;
    if (v && typeof v.requestVideoFrameCallback === 'function') {
      v.requestVideoFrameCallback(() => step());
    } else {
      requestAnimationFrame(step);
    }
  }

  _tick() {
    const video = this._video;
    if (!video || video.readyState < 2) return;
    const now = performance.now();

    // 攝影機 FPS：每秒統計實際幀數
    this._frameCount++;
    if (!this._secondTimer) this._secondTimer = now;
    if (now - this._secondTimer >= 1000) {
      this._metrics.cameraFps = this._frameCount;
      this._metrics.inferenceFps = this._inferCount;
      this._frameCount = 0;
      this._inferCount = 0;
      this._secondTimer = now;
    }

    // 同一影片幀不重複推論（rAF 可能一幀多次）
    if (video.currentTime === this._lastVideoTime) return;

    // 推論頻率限制
    const interval = 1000 / (this._settings ? this._settings.detectionFps : 5);
    if (now - this._lastInferTs < interval) return;

    this._lastVideoTime = video.currentTime;
    this._lastInferTs = now;

    let result = null;
    const t0 = performance.now();
    try {
      result = this._landmarker.detectForVideo(video, now);
    } catch (e) {
      // 單幀失敗（例如攝影機切換中）不中斷整個迴圈
      this._onResult({ rollDeg: null, faceDetected: false, inferenceMs: performance.now() - t0, matrixNote: 'detect-error' });
      return;
    }
    const inferenceMs = performance.now() - t0;
    this._inferCount++;
    this._inferenceEma = this._inferenceEma === null
      ? inferenceMs
      : this._inferenceEma * 0.8 + inferenceMs * 0.2;
    this._metrics.avgInferenceMs = this._inferenceEma;

    const face = result && result.faceLandmarks && result.faceLandmarks.length > 0;
    if (!face) {
      this._onStatus('face-lost');
      this._onResult({ rollDeg: null, faceDetected: false, inferenceMs, matrixNote: '' });
      return;
    }
    this._onStatus('face-detected');
    const rollDeg = computeHeadRollDeg(result.faceLandmarks[0]);
    this._onResult({ rollDeg, faceDetected: true, inferenceMs, matrixNote: '' });
  }

  destroy() {
    this._destroyed = true;
    this.stop();
    if (this._landmarker && typeof this._landmarker.close === 'function') {
      try { this._landmarker.close(); } catch (e) { /* ignore */ }
    }
    this._landmarker = null;
  }
}
