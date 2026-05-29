/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { 
  Sparkles, 
  Languages, 
  FileText, 
  CheckSquare, 
  Layers, 
  Copy, 
  Check, 
  RotateCcw, 
  Trash2, 
  Download, 
  Clock, 
  History, 
  Calendar, 
  Loader2, 
  ArrowRight,
  BookOpen,
  Edit2,
  Heart,
  ExternalLink,
  MessageSquare,
  Moon,
  Sun
} from "lucide-react";
import { SAMPLE_TRANSCRIPTS } from "./sampleData";
import { HistoryItem, MeetingSummaryResponse } from "./types";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  // 核心輸入與配置狀態
  const [transcript, setTranscript] = useState("");
  const [templateType, setTemplateType] = useState<'general' | 'detailed' | 'action_items' | 'qa_only'>('general');
  const [targetLanguage, setTargetLanguage] = useState("none");
  
  // 執行與處理狀態
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('dark');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<MeetingSummaryResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'translation' | 'original' | 'history'>('summary');
  
  // 歷史與通知狀態
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // Loading 跑馬燈文案列表
  const LOADING_STEPS = [
    "正在分析會議音訊編碼與語音逐字稿結構...",
    "正在細緻過濾贅詞、口氣與重複性贅述...",
    "正在歸納講者發言脈絡，梳理各階段討論議程...",
    "正在提取會中關鍵共識、最終決策與爭論焦點...",
    "正在自動編排下一階段待辦任務、負責人與排程...",
    "正依據要求產生專業的多國商務語言對照翻譯...",
    "正在將會議紀錄精準排版，即將華麗呈現..."
  ];

  // 1. 初始化讀取 LocalStorage 歷史紀錄
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ai_meeting_history");
      if (stored) {
        setHistoryList(JSON.parse(stored));
      }
    } catch (e) {
      console.error("無法自 LocalStorage 讀取歷史紀錄", e);
    }
  }, []);

  // 1a. 初始化讀取主題模式
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem("themeMode");
      if (storedTheme === "light" || storedTheme === "dark") {
        setThemeMode(storedTheme);
      }
    } catch (e) {
      console.error("無法自 LocalStorage 讀取主題設定", e);
    }
  }, []);

  // 1b. 當主題改變時儲存至 LocalStorage
  useEffect(() => {
    localStorage.setItem("themeMode", themeMode);
  }, [themeMode]);

  // 2. 當 historyList 變動時儲存至 LocalStorage
  const saveHistoryToStorage = (newList: HistoryItem[]) => {
    try {
      localStorage.setItem("ai_meeting_history", JSON.stringify(newList));
      setHistoryList(newList);
    } catch (e) {
      console.error("儲存歷史紀錄失敗", e);
    }
  };

  // 3. 處理每 2.5 秒輪播 Loading 印記提示
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 2500);
    } else {
      setLoadingStep(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

  // Toast 浮動泡泡通知自動關閉
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // 載入範本
  const handleLoadSample = (sample: typeof SAMPLE_TRANSCRIPTS[0]) => {
    setTranscript(sample.content);
    showNotification(`已為您載入「${sample.title}」範例逐字稿`, 'info');
  };

  // 清空輸入
  const handleClearInput = () => {
    setTranscript("");
    showNotification("輸入框已清空", "info");
  };

  // 發送分析與生成
  const handleGenerate = async () => {
    if (!transcript.trim()) {
      showNotification("請先輸入或貼上會議逐字稿！", "error");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: transcript,
          templateType: templateType,
          targetLanguage: targetLanguage,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "生成失敗，請稍候重試");
      }

      const data: MeetingSummaryResponse = await response.json();
      
      if (data.success) {
        setResult(data);
        setActiveTab(targetLanguage !== "none" ? "translation" : "summary");
        showNotification("會議紀錄分析完畢！", "success");

        // 自動新增本紀錄到歷史存檔中
        const newHistoryItem: HistoryItem = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          title: data.metadata?.title || `會議紀要-${new Date().toLocaleDateString('zh-TW')}`,
          originalTranscript: transcript,
          templateType: templateType,
          targetLanguage: targetLanguage,
          summaryMarkdown: data.summaryMarkdown,
          translationMarkdown: data.translationMarkdown,
        };

        const updatedHistory = [newHistoryItem, ...historyList];
        saveHistoryToStorage(updatedHistory);
        setActiveHistoryId(newHistoryItem.id);
      } else {
        throw new Error(data.error || "未知的 API 處理異常");
      }
    } catch (error: any) {
      console.error(error);
      showNotification(error.message || "網路連線異常，後端伺服器回應失敗", "error");
    } finally {
      setLoading(false);
    }
  };

  // 點擊歷史紀錄載入
  const handleSelectHistory = (item: HistoryItem) => {
    setTranscript(item.originalTranscript);
    setTemplateType(item.templateType);
    setTargetLanguage(item.targetLanguage);
    setResult({
      success: true,
      summaryMarkdown: item.summaryMarkdown,
      translationMarkdown: item.translationMarkdown,
      metadata: {
        wordCount: item.originalTranscript.length,
        processingTimeMs: 0,
        title: item.title
      }
    });
    setActiveHistoryId(item.id);
    setActiveTab(item.translationMarkdown ? "translation" : "summary");
    showNotification(`已載入「${item.title}」的會議結果`, "success");
  };

  // 刪除歷史紀錄
  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm("確定要刪除此筆歷史會議紀錄嗎？此動作無法復原。");
    if (!confirmed) return;

    const filtered = historyList.filter((item) => item.id !== id);
    saveHistoryToStorage(filtered);

    if (activeHistoryId === id) {
      setActiveHistoryId(null);
      setResult(null);
    }
    showNotification("歷史項目已安全刪除", "info");
  };

  // 起始欄位更名歷史
  const startRename = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  // 儲存重命名
  const saveRename = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!editingTitle.trim()) {
      showNotification("標題不得為空", "error");
      return;
    }
    const updated = historyList.map((item) => {
      if (item.id === id) {
        return { ...item, title: editingTitle.trim() };
      }
      return item;
    });
    saveHistoryToStorage(updated);
    setEditingId(null);
    showNotification("會議標題修改成功", "success");
  };

  // 複製結果
  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showNotification("繁中會議紀錄已成功複製至剪貼簿！", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // 退路（針對 iframe 的特殊沙盒限制，如果寫入失敗就透過 textarea 來選取複製）
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (success) {
          setCopied(true);
          showNotification("會議紀錄已複製至剪貼簿！", "success");
          setTimeout(() => setCopied(false), 2000);
        } else {
          throw new Error("execCommand copy failed");
        }
      } catch (fallbackErr) {
        showNotification("您的瀏覽器暫不支援複製指令。請選取下方結果直接手動複製，或使用「下載 Markdown」保存！", "error");
      }
    }
  };

  // 下載檔案 (.md 或 .txt)
  const handleDownloadFile = (text: string, ext: "md" | "txt", title: string) => {
    try {
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const cleanTitle = title.replace(/[^\w\s\u4e00-\u9fa5-]/gi, '_');
      link.download = `${cleanTitle || "會議彙整"}.${ext}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showNotification(`已成功下載會議檔案 (${ext.toUpperCase()})`, "success");
    } catch (e) {
      showNotification("下載檔案失敗，您的環境不支援本機下載。", "error");
    }
  };

  // 取得當前顯示的結果內容
  const getShareableText = () => {
    if (!result) return "";
    let shareText = `# ${result.metadata?.title || "會議紀要與總結"}\n\n`;
    shareText += `**【原始逐字稿長度】**：約 ${result.metadata?.wordCount || 0} 字\n`;
    shareText += `**【整理範本風格】**：${
      templateType === "general" ? "綜合摘要" : 
      templateType === "detailed" ? "詳細紀錄" : 
      templateType === "action_items" ? "行動待辦清單" : "關鍵 Q&A 二次梳理"
    }\n\n`;
    
    shareText += `## 📝 會議紀錄主摘要內容\n---\n\n${result.summaryMarkdown}\n\n`;
    
    if (result.translationMarkdown) {
      shareText += `## 🌐 跨國翻譯對照區塊\n---\n\n${result.translationMarkdown}`;
    }
    return shareText;
  };

  const containerClassName = `min-h-screen ${themeMode === 'dark' ? 'dark-mode bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-slate-950' : 'bg-[#F3F4F6] text-slate-800 selection:bg-indigo-100 selection:text-indigo-900'} font-sans antialiased flex flex-col`;

  return (
    <div className={containerClassName}>
      
      {/* 頂部華麗橫幅 Header */}
      <nav className="sticky top-0 z-40 bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M12 12L2.1 12"/><path d="M12 12l9.9 0"/><path d="M12 12l-6.5 7.5"/><path d="M12 12l6.5 7.5"/></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center space-x-2">
              <span>AI 會議記錄生成與翻譯助理</span>
              <span className="bg-indigo-50 text-indigo-700 text-[10px] px-2 py-0.5 rounded-md font-semibold border border-indigo-100/50">Gemini</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium hidden md:flex">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Gemini Flash 模型已就緒
          </div>          <button
            type="button"
            onClick={() => setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-indigo-600 hover:bg-slate-100 px-3 py-2 rounded-xl transition-all duration-200 font-semibold border border-slate-200 bg-white"
          >
            {themeMode === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{themeMode === 'dark' ? '切換亮色模式' : '切換暗色模式'}</span>
          </button>          <button 
            type="button"
            onClick={() => {
              setTranscript("");
              setResult(null);
              setActiveHistoryId(null);
              showNotification("全新會議工作檯已重設！", "info");
            }}
            className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-indigo-600 hover:bg-slate-100 px-3 py-2 rounded-xl transition-all duration-200 font-semibold border border-slate-200 bg-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>重設</span>
          </button>
        </div>
      </nav>

      {/* 核心工作流區 */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* 左半邊：輸入、範例、設定區域 (占 5 格) */}
        <section className="lg:col-span-5 flex flex-col space-y-5 lg:sticky lg:top-[88px] max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
          
          {/* STEP 1: 貼上逐字稿內容 */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="transcript" className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                <span className="bg-slate-100 text-slate-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                <span>貼上會議逐字稿 或 隨選範例</span>
              </label>
              {transcript.trim().length > 0 && (
                <button
                  type="button"
                  onClick={handleClearInput}
                  className="text-xs text-rose-500 hover:underline flex items-center space-x-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>清除內容 ({transcript.length} 字)</span>
                </button>
              )}
            </div>

            {/* 大輸入文字方塊 */}
            <div className="relative group/input">
              <textarea
                id="transcript"
                rows={10}
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 resize-none font-sans leading-relaxed text-slate-700 placeholder:text-slate-400/80"
                placeholder="請貼上您的會議講者發言逐字稿、隨意錄音筆記、語音識別文字（不限長度），或者在底下點擊「載入會議範例」嘗試功能..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
              />
              {transcript.length === 0 && (
                <div className="absolute inset-x-4 top-24 pointer-events-none flex flex-col items-center justify-center text-center space-y-2 opacity-60">
                  <div className="bg-slate-100 p-2.5 rounded-full text-slate-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-xs text-slate-400">
                    支援滑鼠右鍵直接貼上、或拉放文字拖曳
                  </span>
                </div>
              )}
            </div>

            {/* 客製精選範例 */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase block">
                💡 快速載入高模擬商業會議範例
              </span>
              <div className="flex flex-col space-y-1.5">
                {SAMPLE_TRANSCRIPTS.map((sample) => (
                  <button
                    key={sample.title}
                    type="button"
                    onClick={() => handleLoadSample(sample)}
                    className="flex items-start text-left text-xs bg-slate-50/60 hover:bg-slate-100/90 hover:border-indigo-100 border border-slate-100 p-2 rounded-lg transition-all text-slate-700 space-x-2"
                  >
                    <BookOpen className="w-3.5 h-3.5 mt-0.5 text-indigo-500 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-800">{sample.title}</div>
                      <div className="text-[10px] text-slate-500 line-clamp-1">{sample.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* STEP 2: 套用範本樣式與多國語系翻譯 */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
              <span className="bg-slate-100 text-slate-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
              <span>設定會議整理範本與目標翻譯</span>
            </h2>

            {/* 整理範本選擇 (Grid 2x2) */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                會議紀錄呈現風格 (PRO 樣式)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTemplateType('general')}
                  className={`p-3 rounded-xl border text-left transition-all text-xs flex flex-col justify-between ${
                    templateType === 'general'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/10'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-semibold block text-slate-900 mb-0.5">📋 綜合商務摘要</span>
                  <span className="text-[10px] text-slate-450 leading-normal block">提煉核心事件、決策、行動大綱</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateType('detailed')}
                  className={`p-3 rounded-xl border text-left transition-all text-xs flex flex-col justify-between ${
                    templateType === 'detailed'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/10'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-semibold block text-slate-900 mb-0.5">🔍 極致詳細紀錄</span>
                  <span className="text-[10px] text-slate-450 leading-normal block">剖析多條討論線路、反對意見</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateType('action_items')}
                  className={`p-3 rounded-xl border text-left transition-all text-xs flex flex-col justify-between ${
                    templateType === 'action_items'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/10'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-semibold block text-slate-900 mb-0.5">⚡ 行動任務導向</span>
                  <span className="text-[10px] text-slate-450 leading-normal block">強調 \`- [ ] 任務\` 列表與審核指標</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateType('qa_only')}
                  className={`p-3 rounded-xl border text-left transition-all text-xs flex flex-col justify-between ${
                    templateType === 'qa_only'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/10'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-semibold block text-slate-900 mb-0.5">💬 關鍵問答提取</span>
                  <span className="text-[10px] text-slate-450 leading-normal block">濃縮問題與答覆、分析懸案痛點</span>
                </button>
              </div>
            </div>

            {/* 目標翻譯語系 */}
            <div className="space-y-1.5">
              <label htmlFor="targetLanguage" className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                多國語系翻譯選擇 (可同時生成)
              </label>
              <div className="relative">
                <select
                  id="targetLanguage"
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer"
                >
                  <option value="none">保持原繁體中文 ── 不啟用多國翻譯</option>
                  <option value="en">🇺🇸 英文 (Business English)</option>
                  <option value="ja">🇯🇵 日文 (日本語 - ビジネス敬語)</option>
                  <option value="ko">🇰🇷 韓文 (한국어 - 尊稱)</option>
                  <option value="zh_cn">🇨🇳 簡體中文 (简体中文)</option>
                  <option value="es">🇪🇸 西班牙文 (Español comercial)</option>
                  <option value="de">🇩🇪 德文 (Deutsch)</option>
                  <option value="fr">🇫🇷 法文 (Français)</option>
                </select>
              </div>
            </div>

            {/* 送出與提交主按鈕 */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !transcript.trim()}
              className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center space-x-2 ${
                loading
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/50"
                  : transcript.trim()
                  ? "bg-indigo-600 border border-indigo-700 text-white shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transform hover:-translate-y-0.5 cursor-pointer"
                  : "bg-slate-150 text-slate-400 cursor-not-allowed border border-slate-200/40"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>正在深度解析會議中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>一鍵生成繁中摘要與翻譯</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* 右半邊：歷史清單、結果展示、匯出 (占 7 格) */}
        <section className="lg:col-span-7 flex flex-col space-y-4">
          
          {/* 設計華麗的 TABS 導航 */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col min-h-[500px]">
            <div className="flex bg-slate-50 border-b border-slate-150 justify-between items-center px-4 overflow-x-auto">
              <div className="flex space-x-1 py-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("summary")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shrink-0 ${
                    activeTab === "summary"
                      ? "bg-white text-indigo-700 shadow-sm border border-slate-100"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>📝 繁中會議摘要</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("translation")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shrink-0 ${
                    activeTab === "translation"
                      ? "bg-white text-indigo-700 shadow-sm border border-slate-100"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Languages className="w-3.5 h-3.5" />
                  <span>🌐 多國翻譯對照</span>
                  {result?.translationMarkdown && (
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("original")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shrink-0 ${
                    activeTab === "original"
                      ? "bg-white text-indigo-700 shadow-sm border border-slate-100"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>📋 原始逐字稿對照</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shrink-0 relative ${
                    activeTab === "history"
                      ? "bg-white text-indigo-700 shadow-sm border border-slate-100"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>⏰ 歷史存檔庫</span>
                  {historyList.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-indigo-100 text-indigo-700 text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {historyList.length}
                    </span>
                  )}
                </button>
              </div>

              {/* 匯出模組 (如果有回應結果的話才會顯示) */}
              {result && activeTab !== "history" && (
                <div className="flex items-center space-x-1 py-2">
                  <button
                    type="button"
                    title="一鍵複製全文"
                    onClick={() => handleCopyText(getShareableText())}
                    className="p-2 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-all font-semibold flex items-center justify-center"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    title="下載為 Markdown 檔案 (.md)"
                    onClick={() => handleDownloadFile(getShareableText(), "md", result.metadata?.title || "會議紀錄")}
                    className="p-2 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-all font-semibold flex items-center justify-center"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* TAB CONTENT */}
            <div className="p-6 flex-1 flex flex-col overflow-y-auto max-h-[600px]">
              
              {/* LOADING SCREEN (當狀態正在處理時) */}
              {loading && (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-12">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin flex items-center justify-center" />
                    <Sparkles className="w-6 h-6 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  
                  <div className="max-w-md space-y-2">
                    <p className="font-bold text-slate-800 text-base">
                      AI 會議處理引擎正在高速運算中...
                    </p>
                    
                    {/* 微動態進度提示 */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={loadingStep}
                        initial={{ opacity: 0, y: 7 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -7 }}
                        transition={{ duration: 0.3 }}
                        className="text-xs bg-indigo-50/70 text-indigo-800 px-4 py-2 rounded-lg border border-indigo-100/50 inline-block font-medium min-h-[32px]"
                      >
                        {LOADING_STEPS[loadingStep]}
                      </motion.div>
                    </AnimatePresence>
                    
                    <p className="text-[11px] text-slate-400">
                      我們正在安全地利用 Google Gemini-3.5-Flash 端點處理大型商務字流文本，這通常需要 5 - 15 秒。
                    </p>
                  </div>
                </div>
              )}

              {/* 無載入、無結果之下的 EMPTY STATE / GUIDE 畫面 */}
              {!loading && !result && activeTab !== "history" && (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-4 space-y-6">
                  <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 animate-bounce">
                    <Sparkles className="w-10 h-10" />
                  </div>
                  <div className="max-w-md space-y-2">
                    <h3 className="font-bold text-slate-900 text-lg">
                      等待生成會議總結與翻譯
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      您可在左側「輸入框」手動貼上團隊的會議錄音逐字稿，或是利用下方的範例項目，隨後點選「一鍵生成」即可以驚人的排版品質與商業敏感度產出結果與對照。
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 text-xs justify-center pt-2">
                    <div className="bg-slate-100 px-3 py-1.5 rounded-lg text-slate-600 font-medium border border-slate-200/40">
                      🔥 100% 繁體中文術語調教
                    </div>
                    <div className="bg-slate-100 px-3 py-1.5 rounded-lg text-slate-600 font-medium border border-slate-200/40">
                      🌏 八重語系道地翻譯
                    </div>
                    <div className="bg-slate-100 px-3 py-1.5 rounded-lg text-slate-600 font-medium border border-slate-200/40">
                      📎 匯出 Markdown / TXT
                    </div>
                  </div>
                </div>
              )}

              {/* 當有結果，並且在「📝 繁中會議摘要」Tabs 下 */}
              {!loading && result && activeTab === "summary" && (
                <div className="space-y-5 animate-fade-in">
                  
                  {/* 會議元數據資訊 */}
                  <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-slate-100">
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px] font-bold px-2.5 py-1 rounded-md block">
                      精簡摘要
                    </span>
                    <span className="text-xs text-slate-400 font-medium flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      分析費時：{result.metadata?.processingTimeMs ? `${(result.metadata.processingTimeMs / 1000).toFixed(2)} 秒` : "歷史讀取"}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      • 原始逐字字數：{result.metadata?.wordCount || 0} 字
                    </span>
                  </div>

                  {/* 會議大標題與 AI 主輸出 Markdown */}
                  <article className="markdown-body transition-all duration-300">
                    <ReactMarkdown>{result.summaryMarkdown}</ReactMarkdown>
                  </article>
                </div>
              )}

              {/* 當有結果，並且在「🌐 多國翻譯對照」Tabs 下 */}
              {!loading && result && activeTab === "translation" && (
                <div className="space-y-5 animate-fade-in">
                  {targetLanguage === "none" ? (
                    <div className="flex flex-col items-center justify-center text-center py-16 space-y-4">
                      <div className="bg-amber-50 p-4 rounded-full text-amber-600">
                        <Languages className="w-8 h-8" />
                      </div>
                      <div className="max-w-sm space-y-1.5">
                        <h4 className="font-bold text-slate-800 text-sm">
                          未啟用多國語言翻譯功能
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          您在左側的翻譯設定選取了「保持原繁體中文」。如果要啟用多國翻譯對照，請在左側選取英文、日文或韓文等語系，再行點擊「一鍵生成」即可。
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-slate-100">
                        <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[11px] font-bold px-2.5 py-1 rounded-md block">
                          跨國商務譯文
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          目標語系編碼：{targetLanguage.toUpperCase()}
                        </span>
                      </div>
                      <article className="markdown-body transition-all duration-300">
                        {result.translationMarkdown ? (
                          <ReactMarkdown>{result.translationMarkdown}</ReactMarkdown>
                        ) : (
                          <div className="text-xs text-slate-450 italic">
                            正在載入或未找到獨立譯文，請確認是否與主要摘要合併生成...
                          </div>
                        )}
                      </article>
                    </>
                  )}
                </div>
              )}

              {/* 當有結果，並且在「📋 原始逐字稿對照」Tabs 下 */}
              {!loading && result && activeTab === "original" && (
                <div className="space-y-4 animate-fade-in max-h-[500px]">
                  <div className="pb-3 border-b border-slate-100">
                    <h4 className="text-xs font-bold text-slate-700">原始輸入逐字稿</h4>
                    <p className="text-[11px] text-slate-400">這是您在上一個視窗貼上或載入的原始文字流：</p>
                  </div>
                  <div className="bg-slate-50/80 border border-slate-150 rounded-xl p-4 text-xs font-sans leading-relaxed text-slate-600 select-all whitespace-pre-wrap overflow-y-auto max-h-[400px]">
                    {result.metadata?.wordCount ? result.summaryMarkdown ? transcript : "無原始逐字稿保留" : transcript}
                  </div>
                </div>
              )}

              {/* 當在「⏰ 歷史存檔庫」Tabs 下 */}
              {activeTab === "history" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="pb-3 border-b border-slate-150 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">本機歷史會議檔案</h4>
                      <p className="text-xs text-slate-500">歷史紀錄安全地以加密形式暫存在您的本機網頁暫存中 (LocalStorage)</p>
                    </div>
                    {historyList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const confirmed = window.confirm("確定要整批清除所有本地會議紀錄嗎？此動作將抹除所有資料！");
                          if (confirmed) {
                            saveHistoryToStorage([]);
                            setResult(null);
                            setActiveHistoryId(null);
                            showNotification("所有歷史存檔已抹除", "info");
                          }
                        }}
                        className="text-xs text-rose-600 hover:text-rose-800 flex items-center space-x-1 outline-none font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>整批清除</span>
                      </button>
                    )}
                  </div>

                  {historyList.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
                      <History className="w-10 h-10 text-slate-300" />
                      <span>目前尚未有任何本地生成紀錄。每一次產出對帳後都會自動保存在此喔！</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 max-h-[420px] overflow-y-auto pr-1">
                      {historyList.map((item) => {
                        const isCurrentActive = activeHistoryId === item.id;
                        const isEditingName = editingId === item.id;
                        
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectHistory(item)}
                            className={`p-4 rounded-xl border text-left transition-all duration-300 cursor-pointer flex justify-between items-start group relative ${
                              isCurrentActive
                                ? "bg-indigo-50/50 border-indigo-500 shadow-xs"
                                : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/30"
                            }`}
                          >
                            <div className="space-y-2 flex-1 mr-3">
                              <div className="flex items-center space-x-2">
                                {isEditingName ? (
                                  <div className="flex items-center space-x-1.5 w-full mr-2" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="text"
                                      value={editingTitle}
                                      onChange={(e) => setEditingTitle(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") saveRename(item.id);
                                        if (e.key === "Escape") setEditingId(null);
                                      }}
                                      className="bg-white border border-indigo-400 rounded-md py-0.5 px-2 text-xs text-slate-800 outline-none w-full font-bold focus:ring-1 focus:ring-indigo-450"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => saveRename(item.id)}
                                      className="bg-emerald-500 text-white text-[10px] px-2 py-1 rounded hover:bg-emerald-600 font-bold"
                                    >
                                      確定
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <h5 className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                                      {item.title}
                                    </h5>
                                    <button
                                      type="button"
                                      title="重命名"
                                      onClick={(e) => startRename(item, e)}
                                      className="p-1 text-slate-405 group-hover:opacity-100 opacity-0 hover:text-indigo-600 rounded"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-y-1 gap-x-2.5 text-[10px] text-slate-500">
                                <span className="flex items-center text-slate-400">
                                  <Calendar className="w-3 h-3 mr-0.5" />
                                  {new Date(item.timestamp).toLocaleString('zh-TW', { hour12: false })}
                                </span>
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] text-slate-600 uppercase font-semibold">
                                  {item.templateType === 'general' ? '綜合摘要' : 
                                   item.templateType === 'detailed' ? '精細紀錄' : 
                                   item.templateType === 'action_items' ? '行動導向' : '問答提取'}
                                </span>
                                {item.targetLanguage !== "none" && (
                                  <span className="bg-rose-50 px-1.5 py-0.5 rounded text-[9px] text-rose-700 font-semibold flex items-center space-x-0.5">
                                    <Languages className="w-2.5 h-2.5 mr-0.5" />
                                    <span>已翻譯 {item.targetLanguage.toUpperCase()}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={(e) => handleDeleteHistory(item.id, e)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="刪除本條"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </section>

      </main>

      {/* 底部 Footer 標識 (極簡、商務、大氣) */}
      <footer className="bg-white border-t border-slate-150 py-6 px-6 mt-12 text-center text-slate-450 text-xs">
        <div className="max-w-2xl mx-auto space-y-2">
          <p className="flex items-center justify-center space-x-1">
            <span>AI 會議記錄生成與翻譯工具 © 2026 ── 搭載 Google Gemini-3.5-Flash</span>
          </p>
          <div className="flex items-center justify-center space-x-3 text-slate-400 text-[10px] select-none">
            <span>專聘商用繁中高階指令集</span>
            <span>•</span>
            <span>AES 本地沙盒隱私保護</span>
            <span>•</span>
            <span>支援 Markdown 免費格式匯出</span>
          </div>
        </div>
      </footer>

      {/* TOAST 浮動通知 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 px-4 py-3 rounded-xl shadow-xl text-xs font-bold leading-normal border max-w-sm"
            style={{
              backgroundColor: 
                toast.type === "success" ? "#0f172a" : 
                toast.type === "error" ? "#1f0f1e" : "#0f172a",
              borderColor: 
                toast.type === "success" ? "#2563eb" : 
                toast.type === "error" ? "#be185d" : "#2563eb",
              color: 
                toast.type === "success" ? "#bfdbfe" : 
                toast.type === "error" ? "#fecdd3" : "#bfdbfe"
            }}
          >
            {toast.type === "success" && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
            {toast.type === "error" && <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />}
            {toast.type === "info" && <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
