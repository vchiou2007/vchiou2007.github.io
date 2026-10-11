---
name: poetry-pocket-development
description: >-
  專為《詩詞隨身背》（Poetry Pocket）PWA 應用設計的全流程開發、驗證與部署標準技能。
  當需要為「詩詞隨身背」新增功能（如熱門篩選、詩詞與名句擴充、背誦排程、熟悉度系統）、
  修改架構、執行自動化測試、或遵循安全發布流程部署至 GitHub Pages 時，啟用此技能。
license: Apache-2.0
metadata:
  version: v1.0.0
  author: Vincent Chiou
  platform: Antigravity IDE
---

# 《詩詞隨身背》全流程開發、驗證與發布標準技能

本技能彙整《詩詞隨身背》（Poetry Pocket）專案的完整架構、需求分析規格、實作方法、自動化測試策略、避坑經驗以及安全的 GitHub Pages 發布工作流。未來任何針對此 App 的功能迭代、修復或擴充，皆應依循本技能規範執行。

---

## 一、專案架構與資料核心 (Architecture Overview)

### 1. 核心設計原則
* **零構建依賴 (Zero-Build Vanilla PWA)**：不使用 Webpack/Vite 等打包工具，全站採用現代瀏覽器原生 ES Modules (`import`/`export`)。
* **離線優先 (Offline-First)**：透過 Service Worker (`sw.js`) 進行全靜態快取，支援手機「加入主畫面」後以獨立 App 運作，完全支援飛航模式離線學習。
* **資料純粹性與不可變性**：詩詞內容存於 `data/poems.json`，執行期資料（熟悉度、進度、收藏、設定）存於瀏覽器 `localStorage`，具備無損匯出與匯入機制。

### 2. 資料規格矩陣
在進行任何篩選或功能改動前，必須嚴格核對以下資料集合規模：
* **全部詩詞作品**：共 **518 首**（含唐詩 307 首、宋詞與其他作品）。
* **🔥 熱門作品**：共 **35 首**（作品物件包含標籤 `tags: ["熱門", ...]`）。
* **兩句名句選摘 (`pairEntries`)**：共 **1,083 組**，為「名句」分頁（`pairsView`）的資料來源。其中出自 35 首熱門作品的名句共 **92 組**。
* **名句引用條目 (`quoteEntries`)**：共 **1,766 組**（包含單句、飛花令名句等）。
* **熟悉度註冊表 (`famRegistry.byKey`)**：去重後作品共 **518 筆**（熱門 35 筆）；名句去重後共 **1,240 筆**（熱門 111 筆）。這是「我的背誦」名句模式（`managerView('quote')`）的資料來源。

### 3. 核心檔案職責劃分
| 檔案 | 職責與關鍵匯出 |
| :--- | :--- |
| `data/poems.json` | 完整 518 首詩詞資料庫（含注音、譯文、標籤、兩句選摘、朝代、作者等）。 |
| `core.js` | 核心演算法：搜尋、資料驗證、艾賓浩斯間隔複習（SM-2 衍生）、兩句選摘產出（`pairEntries`）。 |
| `familiarity.js` | 背誦熟悉度底層：註冊表建立（`createRegistry`）、四級狀態（`familiar`, `shaky`, `weak`, `unlearned`）、遷移相容（`migrateFamiliarity`）。 |
| `familiarity-ui.js` | 熟悉度介面：管理中心視圖（`managerView`）、徽章（`badge`）、篩選控制項（`controls`）。 |
| `explorer.js` | 瀏覽與探索：名句選摘（`pairsView`）、兩句接龍（`pairPracticeView`）、飛花令。 |
| `views.js` | 主視圖：背誦頁面（`studyView`）、隨身詩集（`libraryView`）、千古名句（`quotesView`）、熱門學習進度卡片。 |
| `app.js` | 應用控制器：Hash 路由分發、全域 UI 狀態管理（`ui`）、全域按鈕點擊事件委派。 |
| `storage.js` | 本地儲存：`localStorage` 讀寫、資料備份 JSON 驗證與 round-trip 還原。 |
| `sw.js` | Service Worker：快取版本管理、原子化資源快取更新、舊快取清除。 |
| `tests/*.test.mjs` | Node.js 原生測試套件（`npm test` 執行 `node --test tests/*.test.mjs`）。 |

---

## 二、需求規格標準：跨分頁熱門篩選 (Specification Standard)

以本次「跨分頁熱門篩選」為範本，未來新增跨功能模組時應遵循以下標準：

### 1. 三大分頁功能規格
* **「我的背誦」(`my-recitation`)**：
  * 提供 `〔全部作品〕〔🔥 只看熱門〕`（名句模式下切換為 `〔全部名句〕〔🔥 熱門名句〕`）。
  * 支援與現有熟悉度篩選（熟、未背、不太熟、很不熟、只看不熟）正交交集。
  * 畫面必須即時顯示符合條件的數量（例如「符合 35 項」）。
  * 原有排序（已背過優先／尚未背誦優先）與批次標記功能完全保留。
* **「名句」(`quotes` / `pairsView`)**：
  * 提供 `〔全部名句〕〔🔥 熱門名句〕` 晶片按鈕。
  * 篩選以所屬作品的熱門標籤為準（`q.poem.tags.includes('熱門')`），不可靠純文字猜測。
  * 1,083 組名句動態計算出 92 組熱門名句。
  * 保留「本句熟悉度」、「全篇熟悉度」、「讀／背這兩句」及「全篇」操作。
* **「背誦」(`study` / `studyView`)**：
  * 提供 `〔全部作品〕〔🔥 只背熱門〕`。
  * 切換後，排程複習清單與自由練習清單僅顯示熱門作品母體。
  * 學習進度統計反映當前母體（如「熱門作品 35 首，其中 X 首已練習」）。
  * **🔥 熱門學習進度獨立卡片**：即時統計 35 首熱門作品的「已熟讀、不太熟、很不熟、尚未背誦」數量分佈。

### 2. 嚴格不變性約束 (Invariants)
1. **不得重建資料庫**：禁止隨意重新產生或覆蓋 `data/poems.json`，防止詩詞 ID 或結構飄移。
2. **不得清除或污染使用者資料**：既有進度、熟悉度、收藏夾、複習記錄必須 100% 向後相容。
3. **篩選條件彼此正交**：「熱門／全部」屬於作品類別篩選，「熟／未背」屬於熟悉度篩選，兩者交集運作，不得互相覆蓋。
4. **狀態隔離記憶**：使用者切換至其他分頁再返回時，各分頁必須保留各自獨立的篩選設定。

---

## 三、實作方法與關鍵避坑指南 (Implementation & Gotchas)

### 1. 狀態隔離與事件委派模式
在 `app.js` 中定義隔離的狀態屬性，切換分頁時互不干擾：
```javascript
// app.js
const ui = {
  study: { popular: false },
  pairs: { popular: false, type: '', theme: '', saved: false, query: '' },
  familiarity: { popular: false, filters: [], sort: 'default', selected: [], batch: false }
};

// 事件委派處理
document.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;

  if (act === 'fam-popular') {
    ui.familiarity.popular = (btn.dataset.value === 'popular');
    render();
  } else if (act === 'pair-popular') {
    ui.pairs.popular = (btn.dataset.value === 'popular');
    render();
  } else if (act === 'study-popular') {
    ui.study.popular = (btn.dataset.value === 'popular');
    render();
  }
});
```

### 2. 熟悉度系統的參照物件 (Ref) 陷阱
* **陷阱**：呼叫 `setFamiliarity(state, refs, value)` 時，`refs` 必須是包含 `{ key, contentId, contentType }` 的完整物件陣列，**不能傳入字串 key**。
* **正確做法**：
```javascript
// 先從 registry 解析出 key，再取得 ref 物件
const ref = (type, id) => registry.byKey.get(registry.resolve(type, id));
state = setFamiliarity(state, [ref('poem', poemId)], 'weak', new Date());
```

### 3. 字串匹配防禦
* **陷阱**：在測試或驗證中，`String.prototype.includes` **不能傳入正則表達式**，否則 Node.js 會丟出 `TypeError: First argument to String.prototype.includes must not be a regular expression`。
* **正確做法**：直接傳入子字串，如 `html.includes('/practice/' + poemId)`；如需正則比對，使用 `regex.test(html)`。

### 4. 介面視覺風格規範
* **配色規範**：
  * 背景：柔和淺粉色調（`#faf7f7` / `#fdf2f4`）。
  * 卡片：白色圓角高對比卡片（`border-radius: 12px; background: #fff`）。
  * 標題與文字：深綠色沉穩文字（`#1d382b` / `#234e38`）。
  * 互動按鈕：粉紅色調操作按鈕（`#d96b82` / `#e28295`）。
* **無障礙 (A11y)**：
  * 所有按鈕必須包含語意屬性（`aria-pressed="true|false"`）。
  * 包含螢幕閱讀器友善說明與焦點狀態。

---

## 四、自動化測試與驗證體系 (Verification Methodology)

本專案堅持「無測試、不上線」，所有改動必須通過完整的自動化測試套件。

### 1. 執行測試標準指令
```powershell
# 1. 語法檢查（確保無未定義變數或語法錯誤）
npm run check

# 2. 全量單元測試（包含 60+ 項測試）
npm test
```

### 2. Windows 環境終端編碼處理
在 Windows 環境下執行含有 Unicode 符號（如 `✔`, `✖`, `🔥`）的 Node.js 測試時，GBK 代碼頁可能導致 `UnicodeEncodeError`。
* **PowerShell 解決方案**：
```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
npm test
```
* **Python 子進程解決方案**：
```python
subprocess.run(['npm', 'test'], capture_output=True, encoding='utf-8')
```

### 3. 測試用例設計四大維度
每次新增篩選或邏輯，至少編寫以下 4 組測試：
1. **全量 vs 篩選基準計數**：驗證全部作品（518）與熱門（35）、全部名句（1,083）與熱門名句（92）之精確數量。
2. **多條件交集正交性**：測試「熱門 ＋ 很不熟」、「熱門 ＋ 尚未背誦」與「全部 ＋ 很不熟」的交集精確度。
3. **介面渲染與統計卡片**：驗證 HTML 中正確渲染按鈕列、選中態、以及進度卡片的四級數量分佈。
4. **狀態隔離與無損性**：模擬在分頁 A 切換篩選，確認分頁 B 狀態不變，且既有背誦紀錄（`reviewCount`, `masteryLevel`）完全無損。

---

## 五、安全發布與 GitHub Pages 部署規範 (Safe Release Runbook)

發布至生產環境（`https://vchiou2007.github.io/poetry-pocket/`）必須嚴格遵守以下八階段安全流程：

### 階段一：工作目錄與主分支基線確認
```bash
git checkout main
git pull origin main
git status  # 確認工作目錄完全乾淨
```

### 階段二：建立獨立功能分支
**嚴格禁止直接在 `main` 分支進行實驗性修改！**
```bash
git checkout -b feature/popular-filter-all-tabs
```

### 階段三：增量開發與測試驗收
* 僅修改該功能所必需的檔案。
* 執行 `npm test` 與 `npm run check`，確保所有既有測試與新增測試 100% 通過。

### 階段四：產出報告與等待使用者授權
> [!CAUTION]
> **未經使用者明確發布授權，絕對不得執行 Git Push、不得合併 main、不得發布 GitHub Pages！**
* 向使用者列出修改檔案清單、功能實作重點、測試通過報告。
* 明確告知「目前僅完成本地開發，等待指示」。

### 階段五：推送功能分支並合併回 main
在獲得使用者明確核准（如「可以開始部署」）後執行：
```bash
# 1. 提交功能分支
git add -A
git commit -m "feat(popular): add independent popular filter across all three tabs with popular progress card"

# 2. 推送功能分支至遠端作為備份
git push origin feature/popular-filter-all-tabs

# 3. 切換至 main 並進行非快進合併
git checkout main
git merge feature/popular-filter-all-tabs --no-ff -m "Merge branch feature/popular-filter-all-tabs into main"
```

### 階段六：更新 Service Worker 快取版本
編輯 `sw.js`，更新版本號，強制瀏覽器原子化更新離線資源：
```javascript
// sw.js
const VERSION = 'poetry-pocket-v1-content021-popular-tabs-20261011';
```

### 階段七：推送主分支觸發 GitHub Pages 部署
```bash
git push origin main
```

### 階段八：線上驗收與快取確認
推送後等待約 30～60 秒，透過 HTTP 請求檢查線上部署狀態：
```powershell
# 檢查 Service Worker 線上版本是否生效
(Invoke-WebRequest -Uri 'https://vchiou2007.github.io/poetry-pocket/sw.js' -Headers @{'Cache-Control'='no-cache'}).Content.Split([char]10)[0]
```
確認輸出為最新 `VERSION` 且 HTTP 狀態碼為 200 即代表發布成功。

---

## 六、調用與執行指南 (How to Invoke This Skill)

當使用者發出以下需求時，應直接調用本技能引導操作：
1. **「新增詩詞 / 名句 / 標籤」**：參考第一章資料規格與第二章不變性約束。
2. **「修改分頁 / 增加篩選器」**：參考第三章狀態隔離模式與第四章測試設計。
3. **「跑測試 / 修復報錯」**：參考第四章 Windows 編碼處理與第三章 Ref 參照物件避坑。
4. **「發布 / 上線」**：嚴格依循第五章安全發布八階段守則。
