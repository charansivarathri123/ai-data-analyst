"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  ArrowUp,
  Database,
  Paperclip,
  X,
  FileSpreadsheet,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  CornerDownRight,
  RotateCcw,
  ExternalLink,
  Cpu,
  ArrowRight,
  RefreshCw,
  FileText
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { api, RecommendedQuestion } from "../lib/api";
import { API_BASE } from "../lib/config";
import {
  fadeUp,
  fadeIn,
  staggerContainer,
  staggerItem,
  pressScale,
  usePrefersReducedMotion,
  safeVariants,
  blockReveal
} from "@/lib/motion";
import { InteractiveDotGrid } from "@/components/ui/InteractiveDotGrid";

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

// Starter query chips
const STARTER_CHIPS = [
  "Which product categories are driving margin erosion?",
  "Show me quarterly revenue trend with YoY comparison",
  "What are the top 5 root causes of customer churn?",
];

// In-flight progression steps during streaming
const PROGRESS_STEPS = [
  "Parsing analytical hypothesis...",
  "Running DuckDB queries in-memory...",
  "Attributing key drivers & variance...",
  "Synthesizing analytical write-up...",
];

// Custom CodeBlock with Copy button, header language label, and dark syntax style
const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl overflow-hidden bg-surface-2 border border-b-subtle shadow-subtle my-3.5 font-mono text-xs">
      <div className="flex items-center justify-between px-4 py-2 bg-surface-3 border-b border-b-subtle text-t-secondary">
        <span className="capitalize font-mono font-medium text-micro text-t-secondary tracking-wider">
          {language || "sql"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-micro text-t-secondary hover:text-t-primary transition-colors px-2 py-0.5 rounded hover:bg-surface-2"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-accent-cool" />
              <span className="text-accent-cool font-sans">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-t-primary leading-relaxed font-mono tabular-nums custom-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
};

// Formatter for Executive Memo Assistant responses:
// Uses Source Serif 4 for body copy (~16px, line-height 1.65, max-w ~68ch)
// Uses UI Sans for in-answer subheadings (~14px, medium weight)
// Uses Tabular Monospace for inline figures and numbers
const AssistantMessageContent: React.FC<{
  content: string;
  onSendMessage: (prompt: string) => void;
  isStreaming?: boolean;
}> = ({ content, onSendMessage, isStreaming }) => {
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const prefersReduced = usePrefersReducedMotion();

  const handleCopyAll = () => {
    navigator.clipboard.writeText(content);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  // Split markdown code blocks ```lang ... ``` and tables
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
    // Break into paragraphs / blocks
    const paragraphs = text.split(/\n\n+/);

    return (
      <div key={keyPrefix} className="space-y-3">
        {paragraphs.map((p, pIdx) => {
          const trimmed = p.trim();
          if (!trimmed) return null;

          // Check if block is a markdown table
          if (trimmed.includes("|") && trimmed.includes("-|-")) {
            return renderTable(trimmed, `${keyPrefix}_tbl_${pIdx}`);
          }

          // Check if block is a heading
          if (trimmed.startsWith("#")) {
            const headingText = trimmed.replace(/^#+\s*/, "");
            return (
              <h4
                key={`${keyPrefix}_p_${pIdx}`}
                className="font-sans text-caption font-semibold text-t-secondary uppercase tracking-wider mt-4 mb-1"
              >
                {renderInlineFormatting(headingText)}
              </h4>
            );
          }

          // Standard paragraph: executive memo typography (Serif, 16px, 1.65 line-height, max-w ~68ch)
          return (
            <motion.p
              key={`${keyPrefix}_p_${pIdx}`}
              variants={safeVariants(blockReveal, prefersReduced)}
              initial="hidden"
              animate="visible"
              className="font-serif text-[16px] leading-[1.68] text-t-primary max-w-[68ch] tracking-normal"
            >
              {renderInlineFormatting(trimmed)}
            </motion.p>
          );
        })}
      </div>
    );
  }

  function renderTable(tableText: string, key: string) {
    const rows = tableText
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.startsWith("|") && r.endsWith("|"));

    if (rows.length < 2) return <p key={key}>{tableText}</p>;

    const headerCols = rows[0]
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());

    // Skip separator row (rows[1])
    const bodyRows = rows.slice(2).map((r) =>
      r
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim())
    );

    return (
      <div key={key} className="my-4 overflow-x-auto rounded-xl border border-b-subtle bg-surface-1 shadow-subtle custom-scrollbar">
        <table className="w-full text-caption text-left border-collapse">
          <thead>
            <tr className="border-b border-b-subtle bg-surface-2 font-sans font-semibold text-t-secondary text-micro">
              {headerCols.map((col, idx) => (
                <th key={idx} className="py-2 px-3.5 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-b-subtle font-mono text-micro tabular-nums">
            {bodyRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-surface-2/60 transition-colors">
                {row.map((cell, cIdx) => {
                  const isNumeric = /^[\d$,.%\-+]+$/.test(cell.trim());
                  return (
                    <td
                      key={cIdx}
                      className={`py-2 px-3.5 whitespace-nowrap text-t-primary ${
                        isNumeric ? "text-right font-medium" : "text-left"
                      }`}
                    >
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderInlineFormatting(str: string): React.ReactNode {
    // Bold, inline code, and key metrics pill
    const parts = str.split(/(\*\*.*?\*\*|`.*?`|\b\d+(?:,\d+)*(?:\.\d+)?%?\b)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={idx} className="font-semibold font-sans text-t-primary">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-surface-2 font-mono text-micro text-accent-warm font-medium border border-b-subtle"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      // Highlight metrics with subtle warm amber pill
      if (/^\b\d+(?:,\d+)*(?:\.\d+)?%?\b$/.test(part) && part.length >= 2) {
        return (
          <span
            key={idx}
            className="inline-block px-1 py-0.5 rounded bg-accent-warm/15 text-accent-warm font-mono text-micro font-medium tabular-nums mx-0.5"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  }

  return (
    <div className="group space-y-3 w-full">
      <div className="space-y-3">{parts}</div>

      {/* Hover-revealed message action toolbar (opacity fade on hover/focus) */}
      {!isStreaming && content && (
        <div className="flex items-center gap-1.5 pt-2 text-t-secondary text-micro opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            onClick={() => setFeedback(feedback === "up" ? null : "up")}
            className={`p-1.5 rounded-md hover:bg-surface-2 transition-colors ${
              feedback === "up" ? "text-accent-cool" : "text-t-secondary hover:text-t-primary"
            }`}
            title="Helpful"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFeedback(feedback === "down" ? null : "down")}
            className={`p-1.5 rounded-md hover:bg-surface-2 transition-colors ${
              feedback === "down" ? "text-accent-danger" : "text-t-secondary hover:text-t-primary"
            }`}
            title="Unhelpful"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleCopyAll}
            className="p-1.5 rounded-md hover:bg-surface-2 text-t-secondary hover:text-t-primary transition-colors flex items-center gap-1"
            title="Copy entire answer"
          >
            {copiedResponse ? <Check className="h-3.5 w-3.5 text-accent-cool" /> : <Copy className="h-3.5 w-3.5" />}
            <span>Copy</span>
          </button>
          <button
            type="button"
            onClick={() => onSendMessage(content.slice(0, 100))}
            className="p-1.5 rounded-md hover:bg-surface-2 text-t-secondary hover:text-t-primary transition-colors flex items-center gap-1"
            title="Follow-up on this analysis"
          >
            <CornerDownRight className="h-3.5 w-3.5" />
            <span>Follow-up</span>
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
  const prefersReduced = usePrefersReducedMotion();

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamProgressIdx, setStreamProgressIdx] = useState(0);

  // Active dataset state & upload status
  const [activeDataset, setActiveDataset] = useState<ActiveDatasetInfo | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Time-of-day greeting & live clock (recomputed every 30s)
  const [timeGreeting, setTimeGreeting] = useState("Good day");
  const [currentTimeStr, setCurrentTimeStr] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Periodically compute time-of-day greeting & live clock
  useEffect(() => {
    const updateTimeAndGreeting = () => {
      const now = new Date();
      const hour = now.getHours();

      if (hour < 12) setTimeGreeting("Good morning");
      else if (hour < 18) setTimeGreeting("Good afternoon");
      else setTimeGreeting("Good evening");

      setCurrentTimeStr(
        now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      );
    };

    updateTimeAndGreeting();
    const interval = setInterval(updateTimeAndGreeting, 30000);
    return () => clearInterval(interval);
  }, []);

  // Cycle progress steps while streaming
  useEffect(() => {
    if (!isStreaming) {
      setStreamProgressIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setStreamProgressIdx((prev) => (prev + 1) % PROGRESS_STEPS.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [isStreaming]);

  // Sync active dataset from localStorage and custom events
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
        console.error("Failed to parse active_dataset:", e);
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

  // Auto-grow textarea up to 180px then scroll
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        180
      )}px`;
    }
  }, [inputText]);

  // Trigger brief confirmation toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Upload file without clearing composer
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
      showToast(`Attached ${file.name} (${res.metadata.row_count.toLocaleString()} rows)`);
    } catch (err: unknown) {
      console.error("Upload error:", err);
      setUploadError(err instanceof Error ? err.message : "Failed to ingest dataset");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Load sample dataset
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
      showToast(`Loaded sample_business_sales.csv (${res.metadata.row_count.toLocaleString()} rows)`);
    } catch (err: unknown) {
      console.error("Sample dataset error:", err);
      setUploadError(err instanceof Error ? err.message : "Failed to load sample dataset");
    } finally {
      setIsUploading(false);
    }
  };

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
              } catch {
                // Ignore parse errors on partial chunks
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      console.error("Failed to stream chat:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: `⚠️ Failed to connect to the autonomous analyst engine: ${
                  err instanceof Error ? err.message : "Network error"
                }. Please check that the backend is active.`,
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
  // STATE A: Redesigned Empty State (Welcome + Composer + Sample Shortcut)
  // =========================================================================
  if (messages.length === 0) {
    const userName = isAuthenticated && user?.name ? user.name.split(" ")[0] : null;

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden bg-canvas">
        {/* Interactive Blinking Dot Grid Background reacting to cursor movement */}
        <InteractiveDotGrid className="absolute inset-0 z-0 pointer-events-none" />

        {/* Top Right Controls */}
        <div className="absolute top-5 right-6 z-30 flex items-center gap-2.5">
          <ThemeToggle />
          {!isAuthenticated && (
            <button
              type="button"
              onClick={openAuthModal}
              className="text-micro font-medium px-3 py-1.5 rounded-lg border border-b-subtle bg-surface-1 text-t-primary hover:bg-surface-2 transition-colors shadow-subtle"
            >
              Sign In
            </button>
          )}
        </div>

        {/* Confirmation Toast */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
              className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-surface-2 border border-accent-cool/40 shadow-elevated text-caption text-t-primary flex items-center gap-2"
            >
              <Check className="h-4 w-4 text-accent-cool" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Single Orchestrated Staggered Entrance on First Mount */}
        <motion.div
          variants={safeVariants(staggerContainer, prefersReduced)}
          initial="hidden"
          animate="visible"
          className="w-full max-w-2xl flex flex-col items-center text-center space-y-6 z-10"
        >
          {/* Element 1: Top Quiet Greeting Line */}
          <motion.div
            variants={safeVariants(staggerItem, prefersReduced)}
            className="flex items-center gap-2 text-micro text-t-secondary font-mono tracking-wide"
          >
            <img src="/logo.png" alt="Logo" className="h-4 w-4 rounded object-contain opacity-80" />
            <span>{timeGreeting}</span>
            <span className="opacity-40">•</span>
            <span>{currentTimeStr}</span>
          </motion.div>

          {/* Element 2: Welcome Headline with Inline Name & Subtext */}
          <motion.div variants={safeVariants(staggerItem, prefersReduced)} className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold font-display tracking-tight text-t-primary leading-tight">
              What are we digging into,{" "}
              {userName ? (
                <span className="text-accent-warm font-semibold">{userName}</span>
              ) : (
                "today"
              )}
              ?
            </h1>
            <p className="text-caption text-t-secondary max-w-md mx-auto leading-relaxed">
              Attach your business dataset to start querying, or explore the built-in sales dataset.
            </p>
          </motion.div>

          {/* Element 3: Chat Box Composer with Attached Dataset Chip */}
          <motion.div
            variants={safeVariants(staggerItem, prefersReduced)}
            className="w-full rounded-2xl bg-surface-1 p-3.5 shadow-elevated border border-b-subtle transition-all focus-within:border-b-hover text-left"
          >
            {/* Dismissible Attachment Chip above textarea (does not clear composer text) */}
            <AnimatePresence>
              {activeDataset && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-2.5 overflow-hidden"
                >
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface-2 border border-b-subtle text-caption text-t-primary">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-accent-warm shrink-0" />
                    <span className="font-mono text-micro font-medium truncate max-w-[240px]">
                      {activeDataset.filename}
                    </span>
                    <span className="text-t-tertiary text-micro font-mono">
                      • {activeDataset.row_count.toLocaleString()} rows
                    </span>
                    <button
                      type="button"
                      onClick={handleClearDataset}
                      className="p-0.5 rounded text-t-tertiary hover:text-accent-danger transition-colors ml-1"
                      title="Remove attachment"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your data, DuckDB SQL, DAX, or BI metrics..."
              rows={2}
              className="w-full resize-none bg-transparent px-2 text-caption sm:text-body text-t-primary placeholder:text-t-tertiary focus:outline-none custom-scrollbar"
            />

            {/* Composer Toolbar */}
            <div className="flex items-center justify-between pt-2.5 px-1 border-t border-b-subtle mt-1">
              {/* Labeled Toolbar Buttons */}
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
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-micro font-medium text-t-secondary hover:text-t-primary hover:bg-surface-2 border border-transparent hover:border-b-subtle transition-colors disabled:opacity-40"
                  title="Upload CSV, XLSX, or Parquet dataset"
                >
                  {isUploading ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent-warm" />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5" />
                  )}
                  <span>Attach dataset</span>
                </button>

                <div className="flex items-center gap-1 text-micro text-t-tertiary font-mono px-2 py-1 rounded bg-surface-2/60 border border-b-subtle hidden sm:flex">
                  <Cpu className="h-3 w-3 text-accent-cool" />
                  <span>7 Agents Ready</span>
                </div>
              </div>

              {/* Send Button: Visually inert until there's input, then animates to accent */}
              <motion.button
                type="button"
                whileTap={pressScale.whileTap}
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isStreaming || isUploading}
                animate={{
                  backgroundColor: inputText.trim() ? "var(--accent-warm)" : "var(--surface-3)",
                  color: inputText.trim() ? "#0A0B0F" : "var(--text-tertiary)",
                }}
                transition={{ duration: 0.18 }}
                className="flex h-8 w-8 items-center justify-center rounded-xl transition-all disabled:cursor-not-allowed shadow-subtle"
                title="Send message"
              >
                <ArrowUp className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>

          {/* Upload Error Banner */}
          {uploadError && (
            <div className="w-full flex items-center gap-2 p-3 rounded-xl bg-accent-danger/10 border border-accent-danger/30 text-accent-danger text-caption text-left">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Element 4: Distinct Sample Dataset Shortcut Button */}
          <motion.div variants={safeVariants(staggerItem, prefersReduced)} className="w-full">
            <button
              type="button"
              onClick={handleLoadSample}
              disabled={isUploading}
              className="group w-full flex items-center justify-between p-3.5 rounded-xl border-2 border-dashed border-b-subtle hover:border-accent-warm/70 bg-surface-1/60 hover:bg-surface-2 transition-all text-left shadow-subtle cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-surface-2 group-hover:bg-surface-3 border border-b-subtle flex items-center justify-center text-accent-warm transition-colors">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-caption font-semibold text-t-primary group-hover:text-accent-warm transition-colors">
                      Try Sample Retail Sales Dataset
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-2 border border-b-subtle text-t-secondary font-medium">
                      .CSV
                    </span>
                  </div>
                  <p className="text-micro font-mono text-t-secondary mt-0.5">
                    1,000 rows • 7 columns • Revenue, Margin &amp; Return Metrics
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-caption font-medium text-t-secondary group-hover:text-t-primary transition-colors">
                {isUploading ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-accent-warm" />
                ) : (
                  <>
                    <span className="text-micro font-mono">Instant Load</span>
                    <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </div>
            </button>
          </motion.div>

          {/* Element 5: Secondary Starter Chips (Lower weight, alternative paths) */}
          <motion.div
            variants={safeVariants(staggerItem, prefersReduced)}
            className="w-full flex flex-wrap items-center justify-center gap-2 pt-1"
          >
            {STARTER_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInputText(chip);
                  handleSendMessage(chip);
                }}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 text-t-secondary hover:text-t-primary text-micro font-medium transition-colors cursor-pointer border border-transparent"
              >
                {chip}
              </button>
            ))}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // =========================================================================
  // STATE B: Conversation Screen (Header + Memo Stream + Bottom Composer)
  // =========================================================================
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-canvas relative">
      {/* Top Header */}
      <header className="shrink-0 h-14 border-b border-b-subtle bg-surface-1/90 backdrop-blur-md px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-2.5">
          <span className="text-caption font-semibold text-t-primary">
            {isAuthenticated && user ? `Workspace • ${user.name}` : "DataAnalyst.Ai"}
          </span>
          <span className="text-t-tertiary">•</span>
          <span className="inline-flex items-center gap-1 text-micro font-mono px-2 py-0.5 rounded-full bg-surface-2 text-t-secondary border border-b-subtle">
            <Sparkles className="h-3 w-3 text-accent-warm" />
            AI Copilot
          </span>
          {activeDataset && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-micro font-mono px-2 py-0.5 rounded-md bg-surface-2 text-t-secondary border border-b-subtle">
              <FileSpreadsheet className="h-3 w-3 text-accent-warm" />
              {activeDataset.filename}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          {!isAuthenticated && (
            <button
              type="button"
              onClick={openAuthModal}
              className="text-micro font-medium text-t-secondary hover:text-t-primary hover:underline"
            >
              Sign In to save
            </button>
          )}
        </div>
      </header>

      {/* Messages Stream Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-7 max-w-4xl w-full mx-auto custom-scrollbar">
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id || index}
              className={`flex ${isUser ? "justify-end" : "justify-start"} animate-in fade-in duration-200`}
            >
              {isUser ? (
                // User Message: UI Sans face inside a right-aligned bubble
                <div className="max-w-[80%] sm:max-w-md rounded-2xl px-4 py-2.5 bg-surface-2 text-t-primary border border-b-subtle shadow-subtle font-sans text-caption leading-relaxed">
                  {msg.content}
                </div>
              ) : (
                // Assistant Message: NOT BUBBLED — full column width, no border/background, memo typography
                <div className="w-full pt-1 pb-4">
                  {msg.content ? (
                    <AssistantMessageContent
                      content={msg.content}
                      onSendMessage={(prompt) => handleSendMessage(prompt)}
                      isStreaming={isStreaming && index === messages.length - 1}
                    />
                  ) : (
                    // Labeled Progress Line naming the active step during streaming
                    <div className="flex items-center gap-2.5 py-3 text-caption text-t-secondary">
                      <span className="h-2 w-2 rounded-full bg-accent-warm breathing-dot shadow-warm-glow shrink-0" />
                      <span className="font-mono text-micro text-accent-warm font-medium">
                        {PROGRESS_STEPS[streamProgressIdx]}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Pinned Bottom Input Bar */}
      <div className="shrink-0 p-4 sm:p-6 bg-gradient-to-t from-canvas via-canvas to-transparent border-t border-b-subtle">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Active Dataset Attachment Chip */}
          {activeDataset && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-2 border border-b-subtle w-fit text-micro text-t-secondary font-mono">
              <FileSpreadsheet className="h-3 w-3 text-accent-warm" />
              <span className="truncate max-w-[180px] text-t-primary">{activeDataset.filename}</span>
              <span>• {activeDataset.row_count.toLocaleString()} rows</span>
              <button
                type="button"
                onClick={handleClearDataset}
                className="text-t-tertiary hover:text-accent-danger ml-1"
                title="Detach dataset"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Composer Box */}
          <div className="rounded-2xl bg-surface-1 p-2.5 shadow-elevated border border-b-subtle focus-within:border-b-hover transition-all">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question or analysis request..."
              rows={1}
              className="w-full resize-none bg-transparent px-3 py-1.5 text-caption sm:text-body text-t-primary placeholder:text-t-tertiary focus:outline-none max-h-32 custom-scrollbar font-sans"
            />

            <div className="flex items-center justify-between pt-1.5 px-2 border-t border-b-subtle mt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-1 text-micro text-t-secondary hover:text-t-primary transition-colors py-1 px-2 rounded hover:bg-surface-2"
                  title="Upload dataset"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Attach</span>
                </button>
              </div>

              {/* Send Button */}
              <motion.button
                type="button"
                whileTap={pressScale.whileTap}
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isStreaming || isUploading}
                animate={{
                  backgroundColor: inputText.trim() ? "var(--accent-warm)" : "var(--surface-3)",
                  color: inputText.trim() ? "#0A0B0F" : "var(--text-tertiary)",
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-all disabled:cursor-not-allowed shadow-subtle"
                title="Send message"
              >
                {isStreaming ? (
                  <RefreshCw className="h-3 w-3 animate-spin text-canvas" />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5" />
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
