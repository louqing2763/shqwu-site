# shqwu.com — 工程師作品集網站 + 後台 CMS

黑白極簡 Bento Grid 作品集網站，加上一套**零外部依賴**的 Node.js 後台 CMS。

- 不需要 `npm install`，只要裝好 Node.js 18 以上
- 後台可以管理個人資料、作品集、競賽榮譽、證照，圖片用拖曳上傳
- 每次儲存都會自動輸出靜態網站到 `dist/`，可以直接部署到 Cloudflare Pages

## 快速開始

```bash
node server.js
```

- 前台：http://localhost:3000/
- 後台：http://localhost:3000/admin/

在後台改完內容按「儲存」（或 Ctrl/⌘ + S），資料就會寫進 `data/content.json`，圖片放在 `uploads/`，`dist/` 也會自動更新。

| 環境變數 | 用途 |
|---|---|
| `PORT=8080` | 換 port（預設 3000） |
| `ADMIN_PASSWORD=xxx` | 後台和寫入 API 需要登入，帳號隨便填，密碼填這個值 |
| `HOST=0.0.0.0` | 讓同網路的手機也能連（預設只有本機可以連） |
| `AUTO_EXPORT=0` | 關掉自動輸出，改成手動按「輸出靜態網站」 |

## 部署到 shqwu.com（Cloudflare Pages）

後台只在你自己的電腦上跑，網路上只放靜態網站。這樣做免費、速度快，後台也不會被別人連到。

### 第一次設定

1. **推到 GitHub**：在 GitHub 建一個新 repo（例如 `shqwu-site`，公開或私人都可以），然後：
   ```bash
   git remote add origin https://github.com/louqing2763/shqwu-site.git
   git push -u origin main
   ```
2. **建立 Pages 專案**：Cloudflare 後台 → Workers & Pages → Create → Pages → Connect to Git，選這個 repo。
   - Framework preset：`None`
   - Build command：`npm run build`
   - Build output directory：`dist`
3. **綁網址**：部署完成後，進專案 → Custom domains → Set up a custom domain，輸入 `shqwu.com`，再加一個 `www.shqwu.com`。網域本來就在 Cloudflare，DNS 和 HTTPS 會自動設好。

### 之後更新網站

```bash
node server.js          # 開後台改內容
git add -A && git commit -m "update content" && git push
```

push 之後 Cloudflare 會自動重新建置，大約一分鐘就會上線。

> `dist/` 不用 commit，Cloudflare 會在雲端執行 `npm run build` 自己產生。
> `data/content.json` 和 `uploads/` 一定要 commit，網站內容都在這兩個地方。

## 專案結構

```
server.js            伺服器：前台即時渲染、後台、REST API、上傳
lib/store.js         資料讀寫（原子寫入）、欄位驗證
lib/render.js        前台 HTML 產生器（即時渲染和靜態輸出共用）
lib/export.js        靜態輸出到 dist/（也可以單獨執行：npm run build）
public/assets/       前台的 CSS / JS
admin/               後台介面（純原生 JS）
data/content.json    所有網站內容
uploads/             上傳的圖片
```

## REST API

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/content` | 全部內容（含隱藏項目） |
| GET / PUT / PATCH | `/api/profile`、`/api/site` | 個人資料、網站設定 |
| GET / POST | `/api/{projects\|awards\|certifications}` | 列表、新增 |
| GET / PUT / PATCH / DELETE | `/api/{collection}/{id}` | 單筆讀取、修改、刪除 |
| POST | `/api/{collection}/reorder` | 排序，body：`{ "ids": [...] }` |
| POST | `/api/uploads` | 上傳圖片，body 放檔案本身，header 帶 `X-Filename` |
| POST | `/api/export` | 立即輸出靜態網站 |
| GET | `/api/status` | 上次輸出的時間與結果 |

公開的 JSON 在 `/content.json`，靜態版裡也有，只包含公開的項目。

## 內容寫法

- 自介與作品內文：空一行就是新段落；每行用 `- ` 開頭會變成清單
- 「首頁精選」：第一個精選作品會變成大格，其他的變成寬格
- 「公開顯示」關掉的話，網站上看不到，但資料會留在後台
- 大於 2000px 的照片上傳前會自動縮圖並轉成 WebP
