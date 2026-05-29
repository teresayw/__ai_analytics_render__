<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# AI 會議記錄生成與翻譯工具

這是一個以 React + Vite + Express 建置的專案，可本機開發或部署到 Render / 一般 Node.js 主機。

## 本機執行

**前置需求：** Node.js

1. 安裝套件：
   `npm install`
2. 複製 `.env.example` 為 `.env`，並在其中設定 `GEMINI_API_KEY`：
   `cp .env.example .env`
3. 啟動開發伺服器：
   `npm run dev`

## 建置與啟動

1. 安裝套件：
   `npm install`
2. 建置專案：
   `npm run build`
3. 啟動伺服器：
   `npm start`

## 部署到 Render

- Render 會使用 `npm run build` 和 `npm start` 來建置與啟動此專案。
- 請在 Render 環境變數中設定 `GEMINI_API_KEY`。
- `PORT` 會由 Render 自動提供給應用程式。

## 測試環境

1. 安裝套件：
   `npm install`
2. 進行測試：
   `npm run test`
3. 監聽模式：
   `npm run test:watch`
