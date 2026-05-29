/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

// 解析 JSON 封包，並放寬長度限制以防範長篇逐字稿
app.use(express.json({ limit: "15mb" }));

// 延遲初始化 Gemini 用戶端
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("警告：未檢測到 GEMINI_API_KEY 環境變數。後端 API 回應可能會失敗。請至 AI Studio 秘密管理面板配置金鑰。");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// 預寫的系統指令（System Instructions）
const SYSTEM_INSTRUCTIONS = `
你是一位極其專業且高效的「會議語音記錄分析大師」與「跨國商務翻譯專家」。
你的任務是將使用者貼上的會議逐字稿（可能是口語、雜亂、缺乏邏輯結構的文本）進行深度的結構化整理，並生成高質感的繁體中文（台灣習慣用語）商務會議紀錄與摘要。

請嚴格遵循以下指南進行處理：

1. **基本原則**：
   - 輸出的主要語言必須是精心修飾的【繁體中文】（台灣商務術語，例如：「專案」、「排程」、「優化」、「資訊」、「測試」）。
   - 對於逐字稿中雜亂、重複或語氣詞進行過濾，提煉出真正有價值的關鍵資訊。
   - 保持客觀、專業、乾淨的商業寫作風格。

2. **根據使用者選擇的範本類型 (Template Type)，呈現對應的結構**：
   - 【general】（綜合商務摘要）：
     - **會議主題與焦點**：(從上下文中推導出一個適切、精簡的主題標題)
     - **會議核心對話重點**：(條列式，重點摘要核心討論焦點)
     - **主要共識與決策**：(明確記錄會中達成了什麼協議、定案或決策)
     - **關鍵待辦事項 (Action Items)**：(條列，指出做什麼、誰負責、時程/若無則寫「待確認」)
   - 【detailed】（詳細會議紀錄）：
     - **會議背景與大綱**：(分析會議的可能背景與主要議程大綱)
     - **各階段討論細節與進度**：(若有多個主題或講者，依主題或時序詳盡摘錄多個討論區塊)
     - **重要決策與反對/顧慮意見**：(不僅記錄共識，也記錄曾討論過的痛點、問題點、顧慮)
     - **下一步行動計畫與資源分配**：(詳細條列任務、責任歸屬與排程)
   - 【action_items】（行動與待辦與交付成果導向）：
     - **會議名稱與速覽**
     - **核心行動清單 (Action Log)**：使用 Markdown 任務列表格式 \`- [ ] 任務描述 (@負責人) [截止時間/進度]\` 呈現
     - **交付成果與審查指標**：(會後需要看什麼成果、如何評估)
     - **下一次追蹤會議/待解議題**
   - 【qa_only】（Q&A 關鍵問答與專利/產品痛點提取）：
     - **核心問題與解答歸納**：整理出會中被提問的 key questions 以及各方給出的具體 answer。
     - **未決懸案與痛點分析**：記錄會中爭執不下、或尚未解答的懸而未決事項。

3. **翻譯指令 (Translation Guide)**：
   - 若使用者有指定目標翻譯語言（即 Target Language，如：英文 en、日文 ja、韓文 ko 等），你必須額外生成一個【多國翻譯與對照】區塊。
   - 將「生成的總結摘要結構」精準且道地地翻譯為指定的目標語言。翻譯要符合該語言當地的商業習慣用詞，不得使用生硬的機器直譯。

4. **輸出格式**：
   - 一律使用精美的 Markdown 格式，包含清晰的標題（#、##、###）、加粗強化的關鍵字、無序或有序清單等，以便於網頁上渲染讀取與一鍵複製。
   - 如果能識別出會議參與者，請在最上方簡短標記「參與人員」。
`;

// /api/summarize 核心 API
app.post("/api/summarize", async (req, res) => {
  const startMs = Date.now();
  try {
    const { transcript, templateType = "general", targetLanguage = "none" } = req.body;

    if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
      return res.status(400).json({ success: false, error: "會議逐字稿內容不得為空" });
    }

    const ai = getGeminiClient();

    // 依據 targetLanguage 建立補充指示
    let languagePrompt = "請一律以中文繁體整理這份會議紀錄。";
    if (targetLanguage !== "none") {
      const langNames: Record<string, string> = {
        en: "英文 (English - Standard Business Style)",
        ja: "日文 (日本語 - ビジネス敬語)",
        ko: "韓文 (한국어 - business honorifics)",
        zh_cn: "簡體中文 (简体中文)",
        es: "西班牙文 (Español comercial)",
        de: "德文 (Deutsch Business-Stil)",
        fr: "法文 (Français style d'affaires)",
      };
      const displayLang = langNames[targetLanguage] || targetLanguage;
      languagePrompt = `請先以中文繁體整理這份會議紀錄，接著在末尾放上「---」水平線並加上標題【跨國翻譯對照 - ${displayLang}】，將上述整理出來的所有結構與精髓內容精準、道地、專業地翻譯成 ${displayLang}。`;
    }

    const userPrompt = `
逐字稿長度：${transcript.length} 個字元。
範本類型：${templateType}
目標翻譯語言編碼：${targetLanguage}

=== 語言要求與補充任務 ===
${languagePrompt}

=== 會議逐字稿內容開始 ===
${transcript}
=== 會議逐字稿內容結束 ===

請即刻為我產生該會議紀錄 summary！
`;

    // 呼叫 gemini-3.5-flash
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS,
        temperature: 0.35, // 較低的溫度可以讓會議紀要更嚴謹客觀
      },
    });

    const aiText = response.text || "";
    const processingTimeMs = Date.now() - startMs;

    // 試著從內容中擷取會議名稱或主標題
    let derivedTitle = "會議紀錄與總結";
    const firstLine = aiText.trim().split("\n")[0];
    if (firstLine.startsWith("# ")) {
      derivedTitle = firstLine.replace("# ", "").trim();
    } else if (firstLine.startsWith("## ")) {
      derivedTitle = firstLine.replace("## ", "").trim();
    }

    // 將產出的 markdown 區分（若有翻譯的話，在前端也可以方便拆分展示）
    let summaryMarkdown = aiText;
    let translationMarkdown = "";

    const splitIndex = aiText.indexOf("---");
    if (splitIndex !== -1 && targetLanguage !== "none") {
      // 找到水平線分割
      const parts = aiText.split("---");
      summaryMarkdown = parts[0].trim();
      // 將剩下的部分拼回去（如果有複數個水平線）
      translationMarkdown = parts.slice(1).join("---").trim();
    }

    res.json({
      success: true,
      summaryMarkdown: summaryMarkdown,
      translationMarkdown: translationMarkdown || undefined,
      metadata: {
        wordCount: transcript.length,
        processingTimeMs: processingTimeMs,
        title: derivedTitle,
      }
    });

  } catch (error: any) {
    console.error("處理會議紀錄時發生異常:", error);
    res.status(500).json({
      success: false,
      error: error.message || "伺服器內部錯誤，請稍後重試"
    });
  }
});

// 設置 Vite 伺服器中間件 (在開發模式中)，否則 serve 靜態檔案
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("開發模式：啟動 Vite Middleware");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("生產模式：Serving 靜態檔案");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`伺服器成功在埠口 ${PORT} 啟動，請訪問 http://localhost:${PORT}`);
  });
}

startServer();
