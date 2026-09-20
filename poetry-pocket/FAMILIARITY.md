# 全 App 背誦熟悉度

四種狀態固定為灰色尚未背誦、綠色已背熟、黃色已背過・不太熟、紅色已背過・很不熟。標記可直接點選，沒有額外儲存步驟；收藏與熟悉度互不影響。

## 使用流程

首頁「我的背誦」可切換整首作品／名句、查看統計、集中複習紅色與黃色內容。「全部未熟」只包含黃色與紅色，不含灰色。

詩集、搜尋及作者／景點作品列表、總覽、名句選、收藏、背誦待辦、進度列表與飛花令共用篩選、排序和批次標記。點「批次標記」後勾選內容，可全選目前結果，再一次設定熟悉度。清除標記只改成熟悉度預設值，不刪除收藏、複習歷史或排程。

名句與飛花令同時顯示「本句」和「全篇」標記。全篇熟悉不會強制覆蓋名句；反之亦然。相同作品中、正文相同但由不同入口引用的名句共用紀錄。名句的熟悉度可從「我的背誦 → 名句」集中整理。

## 既有架構與實作

- 沿用靜態 ES modules、hash routing、IndexedDB `poetry-pocket-learning`，資料庫版本仍為 1，物件儲存仍為 `state/current`。
- `familiarity.js` 是共用資料模型、遷移、篩選、排序與統計邏輯；`familiarity-ui.js` 是共用 badge、selector、批次工具與管理中心。
- `familiarity = {version: 1, records: {...}}`，每筆含 contentId、contentType、familiarity、updatedAt、可選 lastReviewedAt。
- 作品 key 為 `poem:<原作品 id>`，名句 key 為 `quote:<既有名句 id>`。相同名句建立 alias 索引，優先沿用既有 pair id，不使用畫面陣列位置作為永久編號。
- 快速標記更新 updatedAt；完成自評才更新 lastReviewedAt。原全篇自評與飛花令自評也寫入同一份熟悉度資料。
- 所有寫入沿用 IndexedDB 單一 readwrite transaction；讀取最新狀態後修改，避免另一分頁的變更被舊畫面覆寫。成功後才更新畫面並廣播至其他分頁。

## 不清除使用者紀錄的遷移

舊備份及舊裝置紀錄缺少 familiarity 時：有複習紀錄的全篇 masteryLevel 3 → 熟、2 → 不太熟、1／0 → 很不熟；原飛花令 mastered → 熟，曾自評但仍 learning → 很不熟。只開始閱讀、尚未自評者仍為未背。原 progress、lineProgress、quotes、events、settings 全部保留。

遷移在原資料庫中原子儲存。後續以 familiarity 為唯一熟悉度來源，避免清除標記後又被舊自評覆蓋。備份匯出／還原包含完整新舊欄位，舊 schemaVersion 1 備份仍可匯入。合法但暫時不在目錄中的 familiarity 紀錄也保留，以支援後續內容調整。

Service Worker 更新只管理自身 Cache Storage 資源；不刪除 IndexedDB、不改資料庫名稱、不以部署版本重設學習資料。不同網站網址及不同裝置仍各自保存資料，跨網址／換手機請匯出後匯入。

## 測試

Node 回歸測試涵蓋全 App 共用狀態、整首／名句分離、同文別名、複選、排序、批次不可變性、收藏與排程獨立、舊資料遷移、備份往返、孤立紀錄保留，以及原功能回歸。

另以全新測試用 WebKit profile、iPhone 15 Pro Max 尺寸執行互動驗證。WebKit 模擬無法取代實體 iPhone Safari 與「加入主畫面」後的完整 OS 行為；正式手機驗證仍需在實機進行。

### 本次驗證結果（2026-09-20）

- 40 項 Node 測試通過。
- WebKit / iPhone 15 Pro Max 模擬：唐詩快速標記、搜尋同步、紅黃複選、批次兩首標記、飛花令批次與空結果恢復、名句／全篇分離、收藏同步、管理中心統計通過。
- 實際匯出 JSON 再匯入，5 筆測試熟悉度及名句收藏恢復成功。
- 關閉並重開獨立測試瀏覽器 profile 後仍保留熟悉度。兩次 Service Worker 更新後資料也保留。
- 未操作實體 iPhone；加入主畫面後的 standalone 模式未實測。WebKit 的模擬斷網重載回報 internal error，本次未將該項列為通過；純邏輯離線快取測試通過。
