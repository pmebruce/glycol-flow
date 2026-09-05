# 壓降計算器 · GitHub Pages 版

獨立靜態 PWA，支援 EG 50%／PG 25%、圓管／矩形流道、直管與彎頭壓降、系統管路組裝、泵浦曲線與工作點、並聯支路流量分配、公式、CSV 與離線使用。計算不使用 ChatGPT API。

## 系統分析

- 共用管路可自由增減，依序疊加管摩擦、配件 K 值及段數壓降。
- 泵浦曲線由零流量、中間點與最大流量三點建立，並求與系統曲線的交點。
- 並聯支路以共同壓差求各組流量；同組可設定相同支路數量，結果同時顯示單支與群組流量。
- 冷板或其他元件可用參考點 `ΔP = ΔP_ref × (Q / Q_ref)^n` 表示，預設 `n = 2`。
- 內建值僅為通用示範，不含任何公司或專案資料；實際使用前須換成設備、管件及泵浦原廠資料。

## 開發及重建

需要 Node.js 24 或更新版本。

```sh
npm ci
npm test
```

`npm test` 會建置 `dist-pages/` 並執行計算及離線測試。只發布 `dist-pages/` 的內容。`npm run dev` 啟動本機開發伺服器，建置後可用 `npm run preview` 檢查。

所有資產、manifest 和 service worker 均使用相對路徑，可放在帳號根目錄或任意專案子目錄。

## 發布

若使用 GitHub 免費帳號，建立公開 repository，將建置後 `dist-pages/` 內所有內容放到 main 根目錄。在 Settings → Pages 選 Deploy from a branch、main、/(root)，再 Save。官方：https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

輸入保存在同一瀏覽器的本機儲存。改到新網域後，原網站的輸入不會自動搬移；先記錄原值。離線快取不等於永久資料備份。

## 工程範圍


- 內建物性：Dynalene 原廠 EG／PG 資料表第 3–4 頁，適用 0–90 °C。密度線性插值、動力黏度對數插值。品牌、添加劑或重量濃度不同時應輸入供應商物性。
- 圓管 Dh = D；矩形 Dh = 2ab/(a+b)。用 Darcy–Weisbach 計算直管壓降。
- Re ≤ 2300：圓管 f = 64/Re；矩形使用含長寬比的 Poiseuille 多項式。
- 2300 < Re < 4000：層流值與 Re=4000 紊流端點間用 smoothstep 插值，明確標為估算。
- 紊流可選 Colebrook、Churchill，或 Moody／Churchill／Zigrang–Sylvester／Romeo 中符合範圍的較大值；並非實際壓降上界保證。
- 自動彎頭採 Rennels，K 已含弧長摩擦。工具限制 Re ≥ 4000、R/Dh > 0.5；低 Re 不外推，須用對應流況的實測 K。矩形彎頭為 Dh 近似，未包含彎曲方向修正。
- 單段計算適用單一路徑、充分發展、等溫、不可壓縮且充滿流道的情況。
- 系統分析採「共用供回水管＋同一對歧管間的並聯支路」拓撲；每一並聯支路承受相同壓差，未模擬歧管沿程壓力分布、支路互相串接、重力靜壓或控制閥動態。
- 工作點為泵浦擬合曲線與系統需求曲線交點；超出泵浦輸入範圍不外推。液壓功率不是泵電功率。


## 圖示及來源

v6 圖示以深青底、壓力表、冷卻管路與三路並聯流線表達液冷系統分析；提供 180、192、512 px 及 ICO 版本。保留原有 GLYCOL FLOW 分享圖。其他元件授權依各相依套件。
