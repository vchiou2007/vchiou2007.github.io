# AI 頭部翻頁 POC（head-gesture）

智慧吉他譜的獨立頭部動作翻頁實驗功能。**本階段僅為 POC**：驗證技術可行性，未整合正式樂譜翻頁流程，未修改任何現有檔案。

## 技術選擇

- **Google MediaPipe Face Landmarker for Web（`@mediapipe/tasks-vision` 0.10.14）**
- 模組、WASM、模型檔（`face_landmarker.task`）全部放置於 `vendor/`，由專案目錄**本機載入**（模組載入失敗時才退回 CDN）；所有推論在裝置本機完成，不錄影、不拍照、不上傳。
- Roll 角度以**雙眼外角特徵點（33／263）連線幾何**估算，正值定義為「使用者本人的右傾」。未使用 transformation matrix（以特徵點為準，避免座標系混淆）。
- Delegate 先嘗試 GPU，失敗自動降回 CPU（不假設 GPU delegate 可用）。
- 選擇原因：Safari 17 支援 WASM；單人臉、無表情、無手部、低解析度（320×240）＋低推論頻率（5 FPS）下，對 A10X 負載低。舊版 `FaceMesh` solution 已停止維護，故不採用。

## 新增檔案（皆為新增，無修改既有檔案）

| 檔案 | 說明 |
|---|---|
| `head-gesture-test.html` | 獨立測試頁面 |
| `head-gesture/js/head-gesture-controller.js` | Gesture State Machine + EMA 平滑（純邏輯） |
| `head-gesture/js/face-tracking-service.js` | 攝影機 + MediaPipe 封裝、Roll 估算、效能統計 |
| `head-gesture/js/gesture-calibration.js` | 校準（中位數，localStorage） |
| `head-gesture/js/gesture-settings.js` | 參數設定與持久化 |
| `head-gesture/js/debug-log.js` | 偵錯日誌（JSON/CSV 匯出） |
| `head-gesture/js/head-gesture-test-page.js` | 測試頁 UI 接線 |
| `head-gesture/vendor/` | MediaPipe 模組、WASM、模型（約 23 MB） |
| `head-gesture/tests/run-tests.mjs` | Node 單元測試（21 項） |
| `serve-dev.mjs`、`package.json` | 本機預覽伺服器（`npm run dev`，預設連接埠 7100） |

## 如何開啟測試頁面

**iPad 實測（必要條件：HTTPS 或 localhost）**

1. 將 `head-gesture-test.html`、`head-gesture/` 兩項加入正式專案（例如部署到 GitHub Pages 的 `smart-guitar/` 目錄）。
2. 在 iPad Safari 開啟 `https://<你的網域>/smart-guitar/head-gesture-test.html`。
3. 「加入主畫面」後亦可從 PWA 開啟（本頁未註冊 Service Worker，不影響現有離線快取）。

**Windows 本機預覽**：在 `smart-guitar/` 目錄執行 `npm run dev`，瀏覽器開啟 `http://localhost:7100/`（localhost 屬安全來源，可啟用攝影機）。

## 操作方式

1. 按 **START CAMERA**（首次會要求攝影機權限；狀態顯示 CAMERA ON → FACE DETECTED）。
2. 坐正、看著樂譜，按 **CALIBRATE**：倒數 3 秒後取樣 1 秒，中位數設為中央 0°（存入 localStorage，重新啟動攝影機會檢查是否超過 12 小時並提示重新校準）。
3. **方向檢查**：將頭向右肩傾斜，B 區角度應顯示正值。若相反，勾選設定區的「方向反轉」。
4. 頭向右傾超過觸發角度並保持 → PAGE +1；向左 → PAGE −1。
5. 靈敏度：設定區可調 Trigger Angle（預設 15°）、Hold Duration（300 ms）、Center Threshold（±7°）、Cooldown（800 ms）、Detection FPS（5）、解析度、平滑開關與強度。
6. 測試後按 **EXPORT LOG · JSON / CSV** 下載偵錯紀錄（角度、狀態、頁碼、觸發事件、推論耗時）。

## 狀態機（防誤翻頁）

`NEUTRAL → CANDIDATE_LEFT/RIGHT → TRIGGERED → WAIT_FOR_CENTER → COOLDOWN → NEUTRAL`

- 傾斜超過觸發角進入候選；持續未滿 Hold Duration 即回位 → 取消。
- 觸發後立即鎖定：持續傾斜**不會**重複翻頁。
- 必須回到中央（±Center Threshold）**且**穩定 **且**冷卻時間結束，才恢復 NEUTRAL。
- 失去人臉立即取消候選；觸發後失蹤再回來，仍需重新滿足回正＋冷卻。

## 已自動化驗證的項目

`node head-gesture/tests/run-tests.mjs`（21 項全數通過）：Roll 正負號幾何、EMA、狀態機（10 次傾斜各翻一頁、持續 3 秒只翻一頁、回正＋冷卻缺一不可、失去人臉不觸發、微動不觸發）、校準中位數與 12 小時時效、設定 sanitize、日誌匯出。

## 尚待 iPad 實測確認（無法以推測值宣稱達標）

- Test 1–8 實際演奏情境（含 10 分鐘連續彈奏、離開／回到攝影機範圍）。
- 成功觸發率、誤觸發次數、平均觸發延遲、AI 推論時間、長時間穩定性。
- GPU delegate 在 A10X／iPadOS 17 是否可用（程式會自動降級 CPU，F 區可觀察）。
- 100 公分距離、室內照明下的追蹤穩定度。

## 已知限制

- 本頁未加入 Service Worker 快取清單（避免修改 `sw.js`）；首次開啟需連網（但模型與 WASM 皆為本機檔案，實際無外部網路依賴）。
- 若 iPad 位於多使用者環境，角度平滑參數可能需要依實測調整。
- POC 未整合正式樂譜閱讀器；確認 POC 成功後，下一步才將事件接到閱讀器翻頁 API。

## 既有功能驗證

本 POC 未修改任何現有檔案（`sw.js`、`index.html`、`scanned/` 等皆維持原樣）；既有頁面經本機伺服器抽查仍可正常存取。
