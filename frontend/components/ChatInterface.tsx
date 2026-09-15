"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User,
  RefreshCw,
  Zap,
  ArrowUp,
  Database,
  BarChart2,
  Cpu,
  Layers,
  FileCode,
  CornerDownLeft,
  Upload,
  Paperclip,
  Plus,
  X,
  FileSpreadsheet,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  CornerDownRight,
  MoreHorizontal,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { api, RecommendedQuestion } from "../lib/api";
import { API_BASE } from "../lib/config";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ActiveDatasetInfo {
  dataset_id: string;
  filename: string;
  row_count: number;
  column_count: number;
  recommended_questions: RecommendedQuestion[];
}

interface ChatInterfaceProps {
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
  resetTrigger?: number;
}

// Custom CodeBlock with Copy button, header language label, and dark syntax style matching reference UI
const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-[#1e1e1e] dark:bg-[#18181b] border border-zinc-700/60 shadow-md my-3 font-mono text-xs sm:text-sm">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#252526] dark:bg-[#202023] border-b border-zinc-700/60 text-zinc-300">
        <span className="capitalize font-semibold text-xs text-zinc-300 tracking-wide">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-sans">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="text-[11px] font-sans">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-zinc-100 leading-relaxed font-mono selection:bg-accent-violet/30">
        <code>{code}</code>
      </pre>
    </div>
  );
};

// Formatter for Assistant responses: parses fenced code blocks, key features, and next steps cards
const AssistantMessageContent: React.FC<{
  content: string;
  onSendMessage: (prompt: string) => void;
  isStreaming?: boolean;
}> = ({ content, onSendMessage, isStreaming }) => {
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleCopyAll = () => {
    navigator.clipboard.writeText(content);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  // Parse markdown code blocks ```lang ... ```
  const parts: React.ReactNode[] = [];
  const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = content.substring(lastIndex, match.index);
      parts.push(renderTextSegment(textBefore, `text_${lastIndex}`));
    }
    const lang = match[1] || "";
    const code = match[2] || "";
    parts.push(<CodeBlock key={`code_${match.index}`} language={lang} code={code} />);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const remainingText = content.substring(lastIndex);
    parts.push(renderTextSegment(remainingText, `text_${lastIndex}`));
  }

  function renderTextSegment(text: string, keyPrefix: string) {
    const lines = text.split("\n");
    const renderedLines: React.ReactNode[] = [];

    let inNextSteps = false;
    const nextStepItems: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line is "Next steps for enhancing this..." heading
      const cleanLine = line.replace(/\*\*/g, "").trim().toLowerCase();
      if (cleanLine.includes("next steps for enhancing") || cleanLine.startsWith("next steps:") || cleanLine.startsWith("### next steps")) {
        inNextSteps = true;
        renderedLines.push(
          <p key={`${keyPrefix}_line_${i}`} className="font-semibold text-xs sm:text-sm mt-4 mb-2.5 text-primaryText">
            {line.replace(/^#+\s*/, "").replace(/\*\*/g, "")}
          </p>
        );
        continue;
      }

      // If we are under next steps and encounter bullet points, collect them for grid cards
      if (inNextSteps && (line.trim().startsWith("- ") || line.trim().startsWith("* ") || /^\d+\.\s/.test(line.trim()))) {
        const itemText = line.trim().replace(/^[-*•]|\d+\.\s*/, "").trim();
        nextStepItems.push(itemText);
        continue;
      }

      // Render standard bullet points cleanly with square icons matching reference image
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ") || line.trim().startsWith("• ")) {
        const bulletText = line.trim().substring(2);
        renderedLines.push(
          <div key={`${keyPrefix}_line_${i}`} className="flex items-start gap-2.5 my-1.5 text-xs sm:text-sm">
            <span className="h-1.5 w-1.5 rounded-[2px] bg-accent-violet mt-1.5 shrink-0 opacity-80" />
            <span className="flex-1 leading-relaxed text-primaryText">{renderInlineFormatting(bulletText)}</span>
          </div>
        );
        continue;
      }

      // Regular paragraph or headings
      if (line.trim()) {
        const isHeader = line.startsWith("#");
        renderedLines.push(
          <div
            key={`${keyPrefix}_line_${i}`}
            className={`${isHeader ? "font-bold text-sm sm:text-base mt-3 mb-1 text-primaryText" : "text-xs sm:text-sm leading-relaxed text-primaryText"}`}
          >
            {renderInlineFormatting(line.replace(/^#+\s*/, ""))}
          </div>
        );
      } else {
        renderedLines.push(<div key={`${keyPrefix}_line_${i}`} className="h-2" />);
      }
    }

    // If next steps cards were collected, render them in an interactive grid just like the user's reference image
    if (nextStepItems.length > 0) {
      renderedLines.push(
        <div key={`${keyPrefix}_next_steps_grid`} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 my-3">
          {nextStepItems.map((step, sIdx) => {
            // Split title and subtitle if colon exists
            const [stepTitle, ...rest] = step.split(":");
            const stepDesc = rest.join(":").trim();
            return (
              <button
                key={sIdx}
                onClick={() => onSendMessage(stepTitle)}
                className="group flex flex-col justify-between p-3 rounded-2xl border border-zinc-700/50 bg-[#1e1e1e]/90 hover:bg-[#27272a] text-left transition-all shadow-xs hover:border-zinc-600"
              >
                <div>
                  <div className="text-xs font-semibold text-zinc-100 group-hover:text-white leading-tight">
                    {stepTitle.replace(/\*\*/g, "")}
                  </div>
                  {stepDesc && (
                    <div className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-snug">
                      {stepDesc.replace(/\*\*/g, "")}
                    </div>
                  )}
                </div>
                <CornerDownRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-accent-violet mt-3 self-start transition-colors" />
              </button>
            );
          })}
        </div>
      );
    }

    return <div key={keyPrefix}>{renderedLines}</div>;
  }

  function renderInlineFormatting(str: string): React.ReactNode {
    // Bold and inline code formatting
    const boldParts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
    return boldParts.map((bp, bpIdx) => {
      if (bp.startsWith("**") && bp.endsWith("**")) {
        return <strong key={bpIdx} className="font-semibold text-primaryText">{bp.slice(2, -2)}</strong>;
      }
      if (bp.startsWith("`") && bp.endsWith("`")) {
        return (
          <code key={bpIdx} className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-xs text-accent-violet font-medium">
            {bp.slice(1, -1)}
          </code>
        );
      }
      return bp;
    });
  }

  return (
    <div className="space-y-3 w-full">
      <div className="space-y-2">{parts}</div>

      {/* Action Footer matching reference UI: Thumbs up, Thumbs down, Copy, Retry/Refresh */}
      {!isStreaming && content && (
        <div className="flex items-center gap-2 pt-2 border-t border-subtleBorder/40 dark:border-zinc-800 text-mutedText text-xs">
          <button
            onClick={() => setFeedback(feedback === "up" ? null : "up")}
            className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
              feedback === "up" ? "text-accent-violet" : "text-mutedText hover:text-primaryText"
            }`}
            title="Helpful"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setFeedback(feedback === "down" ? null : "down")}
            className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
              feedback === "down" ? "text-red-500" : "text-mutedText hover:text-primaryText"
            }`}
            title="Unhelpful"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleCopyAll}
            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-mutedText hover:text-primaryText transition-colors flex items-center gap-1"
            title="Copy entire response"
          >
            {copiedResponse ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onSendMessage(content.slice(0, 100))}
            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-mutedText hover:text-primaryText transition-colors"
            title="Follow-up"
          >
            <CornerDownRight className="h-3.5 w-3.5" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-mutedText hover:text-primaryText transition-colors"
            title="More options"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  initialMessages = [],
  onMessagesChange,
  resetTrigger = 0,
}) => {
  const { user, isAuthenticated, openAuthModal } = useAuth();

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // Active dataset state & upload status
  const [activeDataset, setActiveDataset] = useState<ActiveDatasetInfo | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomFileInputRef = useRef<HTMLInputElement>(null);

  // Sync active dataset from localStorage and custom window events
  useEffect(() => {
    const syncActiveDataset = () => {
      try {
        const stored = localStorage.getItem("active_dataset");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.dataset_id) {
            setActiveDataset(parsed);
          }
        } else {
          setActiveDataset(null);
        }
      } catch (e) {
        console.error("Failed to parse active_dataset from localStorage:", e);
      }
    };

    syncActiveDataset();
    window.addEventListener("active_dataset_updated", syncActiveDataset);
    window.addEventListener("storage", syncActiveDataset);

    return () => {
      window.removeEventListener("active_dataset_updated", syncActiveDataset);
      window.removeEventListener("storage", syncActiveDataset);
    };
  }, []);

  // Clear messages when resetTrigger changes
  useEffect(() => {
    setMessages([]);
    setInputText("");
    if (onMessagesChange) onMessagesChange([]);
  }, [resetTrigger]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming]);

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        180
      )}px`;
    }
  }, [inputText]);

  // Handle file upload and analysis via backend DuckDB agent
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);
    setUploadError(null);

    try {
      const res = await api.uploadDataset(file);
      const datasetInfo: ActiveDatasetInfo = {
        dataset_id: res.dataset_id,
        filename: file.name,
        row_count: res.metadata.row_count,
        column_count: res.metadata.column_count,
        recommended_questions: res.recommended_questions || [],
      };
      setActiveDataset(datasetInfo);
      localStorage.setItem("active_dataset", JSON.stringify(datasetInfo));
      window.dispatchEvent(new Event("active_dataset_updated"));
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err.message || "Failed to upload and analyze dataset");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (bottomFileInputRef.current) bottomFileInputRef.current.value = "";
    }
  };

  // Handle loading the built-in sample sales dataset
  const handleLoadSample = async () => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const res = await api.loadSampleDataset();
      const datasetInfo: ActiveDatasetInfo = {
        dataset_id: res.dataset_id,
        filename: res.metadata.file_name || "sample_business_sales.csv",
        row_count: res.metadata.row_count,
        column_count: res.metadata.column_count,
        recommended_questions: res.recommended_questions || [],
      };
      setActiveDataset(datasetInfo);
      localStorage.setItem("active_dataset", JSON.stringify(datasetInfo));
      window.dispatchEvent(new Event("active_dataset_updated"));
    } catch (err: any) {
      console.error("Sample dataset error:", err);
      setUploadError(err.message || "Failed to load sample dataset");
    } finally {
      setIsUploading(false);
    }
  };

  // Clear active dataset
  const handleClearDataset = () => {
    setActiveDataset(null);
    localStorage.removeItem("active_dataset");
    window.dispatchEvent(new Event("active_dataset_updated"));
  };

  const handleSendMessage = async (promptToSend?: string) => {
    const text = (promptToSend || inputText).trim();
    if (!text || isStreaming) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText("");
    setIsStreaming(true);

    const assistantMsgId = `msg_${Date.now()}_assistant`;
    const initialAssistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, initialAssistantMsg]);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
          dataset_id: activeDataset?.dataset_id,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API error (${response.status})`);
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.replace("data: ", "").trim();
              if (dataStr === "[DONE]") {
                break;
              }
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.content) {
                  accumulatedText += parsed.content;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? { ...msg, content: accumulatedText }
                        : msg
                    )
                  );
                }
              } catch (e) {
                // Ignore parse errors on partial chunks
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to stream chat:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: `⚠️ We encountered an issue connecting to the AI Data Analyst engine: ${err.message || "Network Error"}. Please check your connection or backend server and retry.`,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
      if (onMessagesChange) onMessagesChange(newMessages);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // =========================================================================
  // STATE A: Centered Initial Screen (No conversation started)
  // =========================================================================
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden bg-canvas">
        {/* Ambient Aura Background */}
        <div className="aura-glow-left -top-20 -left-20" />
        <div className="aura-glow-right top-10 -right-20" />

        {/* Top Right Controls (Theme Toggle & Sign In) */}
        <div className="absolute top-5 right-6 z-30 flex items-center gap-2.5">
          <ThemeToggle />
          {!isAuthenticated && (
            <button
              onClick={openAuthModal}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-subtleBorder dark:border-zinc-700 bg-white/80 dark:bg-zinc-800 text-primaryText hover:bg-white dark:hover:bg-zinc-700 transition-all shadow-subtle"
            >
              Sign In
            </button>
          )}
        </div>

        <div className="w-full max-w-2xl flex flex-col items-center text-center space-y-5 z-10 animate-in fade-in zoom-in-95 duration-300">
          {/* Post-Login Welcome Greeting */}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-primaryText leading-tight">
              {isAuthenticated && user ? (
                <>
                  Welcome,{" "}
                  <span className="font-serif italic font-normal text-accent-violet">
                    {user.name}
                  </span>
                </>
              ) : (
                <>
                  Welcome to{" "}
                  <span className="font-serif italic font-normal text-accent-violet">
                    DataAnalyst.Ai
                  </span>
                </>
              )}
            </h1>
          </div>

          {/* Active Dataset Pill if source is uploaded */}
          {activeDataset && (
            <div className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-accent-violet/10 border border-accent-violet/30 text-accent-violet text-xs font-mono animate-in fade-in">
              <div className="flex items-center gap-2 truncate">
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-accent-violet" />
                <span className="font-semibold truncate text-primaryText">{activeDataset.filename}</span>
                <span className="text-mutedText text-[11px] shrink-0">
                  ({activeDataset.row_count.toLocaleString()} rows • {activeDataset.column_count} cols)
                </span>
              </div>
              <button
                onClick={handleClearDataset}
                className="p-1 text-mutedText hover:text-red-500 rounded transition-colors ml-2"
                title="Remove dataset"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Centered Message Input Box (Hints Removed) */}
          <div className="w-full rounded-2xl bg-white dark:bg-zinc-900 p-3 shadow-floating border border-subtleBorder/90 dark:border-zinc-800 transition-all focus-within:border-dark dark:focus-within:border-accent-violet/60 focus-within:shadow-xl relative text-left">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your data, DuckDB SQL, DAX, or BI metrics..."
              rows={2}
              className="w-full resize-none bg-transparent px-3 py-2 text-xs sm:text-sm text-primaryText placeholder:text-mutedText/70 focus:outline-none"
            />

            <div className="flex items-center justify-between pt-2 px-2 border-t border-subtleBorder/60 dark:border-zinc-800">
              {/* Left Toolbar: Source Attachment Trigger (No Hints) */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.xlsx,.xls,.parquet"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-mutedText hover:text-primaryText hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  title="Upload dataset (CSV, Excel, Parquet)"
                >
                  {isUploading ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent-violet" />
                  ) : (
                    <Plus className="h-4 w-4 text-accent-violet" />
                  )}
                </button>
              </div>

              {/* Right Toolbar: Send Message Button */}
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isStreaming || isUploading}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-dark dark:bg-white text-white dark:text-dark hover:bg-dark/90 dark:hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                title="Send Message"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Upload Error Banner */}
          {uploadError && (
            <div className="w-full flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{uploadError}</span>
            </div>
          )}

          {/* Upload In-Progress State */}
          {isUploading && (
            <div className="w-full flex items-center justify-center gap-2 py-4 text-xs text-mutedText animate-pulse">
              <RefreshCw className="h-4 w-4 animate-spin text-accent-violet" />
              <span>Analyzing uploaded data schema with DuckDB...</span>
            </div>
          )}

          {/* BEFORE UPLOAD: DO NOT SHOW ANY RECOMMENDATIONS! */}
          {!activeDataset && !isUploading && (
            <div className="w-full flex flex-col items-center gap-2 pt-1 text-center text-xs">
              <button
                onClick={handleLoadSample}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/70 dark:bg-zinc-800/70 border border-subtleBorder/80 dark:border-zinc-700/80 text-mutedText hover:text-primaryText hover:border-dark/30 shadow-sm transition-all text-xs"
              >
                <Database className="h-3.5 w-3.5 text-accent-lime" />
                <span>Try Sample Sales Data</span>
              </button>
            </div>
          )}

          {/* AFTER UPLOAD: SHOW TAILORED RECOMMENDED QUESTIONS DERIVED FROM ANALYZED DATA */}
          {activeDataset && !isUploading && activeDataset.recommended_questions.length > 0 && (
            <div className="w-full space-y-2.5 pt-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-mutedText">
                  Recommended Questions for {activeDataset.filename}
                </span>
                <span className="text-[10px] font-mono text-accent-violet font-semibold">
                  {activeDataset.recommended_questions.length} Questions
                </span>
              </div>

              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                {activeDataset.recommended_questions.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(item.prompt)}
                    className="group flex flex-col p-3 rounded-xl border border-subtleBorder dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 hover:bg-white dark:hover:bg-zinc-800 hover:border-dark/30 dark:hover:border-zinc-700 hover:shadow-subtle transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-3.5 w-3.5 text-accent-violet shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold text-primaryText group-hover:text-dark dark:group-hover:text-white truncate">
                        {item.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-mutedText line-clamp-1">
                      {item.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE B: Standard Chat Conversation Layout (History + Bottom Input)
  // =========================================================================
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-canvas relative">
      {/* Top Banner */}
      <header className="shrink-0 h-14 border-b border-subtleBorder/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-primaryText tracking-tight">
            {isAuthenticated && user ? `Welcome, ${user.name}` : "DataAnalyst.Ai"}
          </span>
          <span className="text-mutedText text-xs">•</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-accent-violet/10 text-accent-violet font-semibold">
            <Sparkles className="h-3 w-3" />
            AI Copilot
          </span>
          {activeDataset && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-mutedText border border-subtleBorder dark:border-zinc-700">
              <FileSpreadsheet className="h-3 w-3 text-accent-violet" />
              {activeDataset.filename}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          {!isAuthenticated && (
            <button
              onClick={openAuthModal}
              className="text-xs font-semibold text-dark dark:text-white hover:underline"
            >
              Sign In to save
            </button>
          )}
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-4xl w-full mx-auto">
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id || index}
              className={`flex ${isUser ? "justify-end" : "justify-start"} animate-in fade-in duration-200`}
            >
              <div
                className={`group relative text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? "max-w-[80%] sm:max-w-xl rounded-full px-5 py-2.5 bg-zinc-800 text-white shadow-subtle self-end ml-auto"
                    : "w-full max-w-3xl rounded-2xl p-4 bg-white dark:bg-zinc-900 text-primaryText border border-subtleBorder dark:border-zinc-800/80 shadow-xs"
                }`}
              >
                {/* Content Rendering */}
                {isUser ? (
                  <div className="whitespace-pre-wrap font-sans break-words text-xs sm:text-sm">
                    {msg.content}
                  </div>
                ) : (
                  <div>
                    {msg.content ? (
                      <AssistantMessageContent
                        content={msg.content}
                        onSendMessage={(prompt) => handleSendMessage(prompt)}
                        isStreaming={isStreaming && index === messages.length - 1}
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-mutedText py-1">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent-violet" />
                        <span className="text-xs italic">Formulating response...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Pinned Bottom Input Box */}
      <div className="shrink-0 p-4 sm:p-6 bg-gradient-to-t from-canvas via-canvas to-transparent border-t border-subtleBorder/50 dark:border-zinc-800/80">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Quick dataset question chips if dataset active */}
          {activeDataset && activeDataset.recommended_questions.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[10px] font-mono text-mutedText shrink-0 flex items-center gap-1 mr-1">
                <Sparkles className="h-3 w-3 text-accent-violet" />
                Suggestions:
              </span>
              {activeDataset.recommended_questions.map((q, qIdx) => (
                <button
                  key={qIdx}
                  onClick={() => handleSendMessage(q.prompt)}
                  disabled={isStreaming}
                  className="shrink-0 text-[11px] px-2.5 py-1 rounded-lg border border-subtleBorder dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 text-mutedText hover:text-primaryText hover:border-dark/30 dark:hover:border-zinc-700 transition-all truncate max-w-xs shadow-xs"
                >
                  {q.title}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-2xl bg-white dark:bg-zinc-900 p-2.5 shadow-floating border border-subtleBorder dark:border-zinc-800 focus-within:border-dark dark:focus-within:border-accent-violet/60 transition-all">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question or data analysis request..."
              rows={1}
              className="w-full resize-none bg-transparent px-3 py-1.5 text-xs sm:text-sm text-primaryText placeholder:text-mutedText/70 focus:outline-none max-h-32"
            />

            <div className="flex items-center justify-between pt-1.5 px-2 border-t border-subtleBorder/40 dark:border-zinc-800">
              {/* Left Toolbar: Source Attachment (No Hints) */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={bottomFileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.xlsx,.xls,.parquet"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => bottomFileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex h-6 w-6 items-center justify-center rounded text-mutedText hover:text-primaryText hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  title="Upload dataset (CSV, Excel, Parquet)"
                >
                  {isUploading ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent-violet" />
                  ) : (
                    <Plus className="h-4 w-4 text-accent-violet" />
                  )}
                </button>

                {activeDataset && (
                  <div className="flex items-center gap-1 text-[11px] text-mutedText font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    <span className="truncate max-w-[140px]">{activeDataset.filename}</span>
                    <button
                      onClick={handleClearDataset}
                      className="text-mutedText hover:text-red-500 transition-colors ml-0.5"
                      title="Clear dataset"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Right Toolbar: Send Message Button */}
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isStreaming || isUploading}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-dark dark:bg-white text-white dark:text-dark hover:bg-dark/90 dark:hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                title="Send Message"
              >
                {isStreaming ? (
                  <RefreshCw className="h-3 w-3 animate-spin text-accent-lime" />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
