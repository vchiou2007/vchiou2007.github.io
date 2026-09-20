# 飛花令・關鍵字背詩

第一批 20 個關鍵字、262 組不重複名句；每字 20～48 組。另補《泊船瓜洲》到共用詩集，共 501 首（唐詩 300、宋詞 200、宋詩 1）。

## 使用

首頁 → 飛花令 → 選字或搜尋一個中文字 → 左右按鈕連續閱讀 → 開始背誦。

五個階段可隨時切換；遮蔽時點正文或「顯示答案」才揭曉。每句可收藏、朗讀、查看全篇，點字查看注音。自評「已熟悉」依序安排 1、3、7、14、30 天；「忘記了」改為 10 分鐘後。收藏、最近學習、未背熟、到期複習可篩選。今日總數按名句去重。

語音僅在按「我來背」後啟用。Safari 是否提供辨識取決於版本、Siri／麥克風權限及系統服務；可能需要連線。本 App 不保存錄音。無法使用時提供文字核對與自行確認。系統以文字對齊標出錯漏；同音或繁簡差異另外提示確認，不自動改動熟悉程度。古典多音字仍可能誤判。

## 資料模型與相容性

- `data/poems.json` 是唯一正文來源。每首可有 `studyLines`：id、indices、split、explanation。indices 引用原文段落，split 決定兩行分界，不另存正文。
- `data/feihua-keywords.json` 的 character、lineIds 決定首頁字卡與排序，可繼續增字。其他單字搜尋目前已整理的所有名句索引。
- 與既有兩句選完全相同的名句，沿用 `poemId:pair:n`；其他使用穩定的 `poemId:fh:start-end`。
- 共用既有 IndexedDB、`quotes` 收藏、JSON 匯出／匯入及跨分頁更新。新增 `lineProgress`，以名句 id 記 status、lastStudied、lastReviewed、nextReview、reviewCount、intervalStep。跨字引用同一紀錄。舊版 schemaVersion 1 備份沒有此欄位時補空物件。
- `feihua-core.js`：索引、篩選、遮蔽、排程、資料驗證；`feihua-views.js`：沿用色彩與閱讀樣式；`recitation.js`：條件式語音與核對。朗讀仍使用原本 `PoetrySpeech`，保留 3 倍速與動態逐句聚焦。
- 所有新資源加入離線快取。語音辨識本身不保證離線可用。

## 內容與授權

名句逐項引用共用詩集來源；白話解釋為本次編寫的簡短釋義，並非逐字校注。排除檢出缺字的兩筆候選段落。古詩詞可能有異文，以各作品來源與 textualNote 為準。《泊船瓜洲》採香港教育局推薦篇章文本：

https://www.edb.gov.hk/attachment/tc/curriculum-development/kla/chi-edu/recommended-passages/ks2_15_text.pdf

字音參考使用 pinyin-pro 3.29.4（MIT），原授權見 `vendor/pinyin-pro.LICENSE`；本地 UMD 包以 ESM 薄包裝匯出，不呼叫外部 API。已有人工注音優先採用。繁簡辨識等價表取 OpenCC STCharacters 的本詩集字元子集（Apache-2.0，見 `vendor/OpenCC.LICENSE`），只用於核對，不轉換正文。

## 驗證與實機範圍

`npm test` 執行原功能與新模組回歸測試，包含來源引用、備份、遮蔽無答案洩漏、排程、去重、語音錯漏／同音、取消後回呼、模擬 DOM 路由及離線快取。本次未操作使用者螢幕，未宣稱 iPhone 麥克風與實際聲音已實測。建議 iPhone Safari 首次更新後依序試：月 → 開始背誦 → 完全隱藏 → 我來背 → 自評 → 匯出備份。
