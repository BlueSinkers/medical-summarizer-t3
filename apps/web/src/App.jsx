import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { useAuthFetch } from "./hooks/useAuthFetch";
import AuthBar from "./components/AuthBar";
import ViewToggle from "./components/ViewToggle";
import ReportInputCard from "./components/ReportInputCard";
import SummaryCard from "./components/SummaryCard";
import ChatCard from "./components/ChatCard";
import TranslationCard from "./components/TranslationCard";

export default function App({ onSignOut }) {
  const [health, setHealth] = useState(null);
  const [healthErr, setHealthErr] = useState("");

  const [report, setReport] = useState("");
  const [useKb, setUseKb] = useState(true);
  const [summary, setSummary] = useState("");
  const [summaryErr, setSummaryErr] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);

  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState("");
  const [chatErr, setChatErr] = useState("");
  const [isChatting, setIsChatting] = useState(false);

  const [view, setView] = useState("both");

  const [targetLang, setTargetLang] = useState("es");
  const [translatedReport, setTranslatedReport] = useState("");
  const [translatedSummary, setTranslatedSummary] = useState("");
  const [translatedChat, setTranslatedChat] = useState("");
  const [translationErr, setTranslationErr] = useState("");

  const canSummarize = useMemo(() => report.trim().length > 0, [report]);
  const canChat = useMemo(
    () => question.trim().length > 0 && report.trim().length > 0,
    [question, report]
  );

  const authFetch = useAuthFetch();

  useEffect(() => {
    const loadHealth = async () => {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        setHealth(data);
      } catch (err) {
        setHealthErr(err.message || "Could not reach API health endpoint.");
      }
    };
    loadHealth();
  }, []);

  async function doSummarize() {
    setIsSummarizing(true);
    setSummary("");
    setSummaryErr("");
    setTranslationErr("");
    setTranslatedSummary("");
    setTranslatedChat("");

    try {
      const res = await authFetch("/api/summarize", {
        method: "POST",
        body: JSON.stringify({ report, use_kb: useKb }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to summarize report.");
      setSummary(data.text || "");
    } catch (err) {
      setSummaryErr(err.message || "Failed to summarize report.");
    } finally {
      setIsSummarizing(false);
    }
  }

  async function doChat() {
    setIsChatting(true);
    setChat("");
    setChatErr("");
    setTranslationErr("");
    setTranslatedChat("");

    try {
      const res = await authFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ question, report, use_kb: useKb }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to get chat response.");
      setChat(data.text || "");
    } catch (err) {
      setChatErr(err.message || "Failed to get chat response.");
    } finally {
      setIsChatting(false);
    }
  }

  async function doTranslate(kind) {
    setTranslationErr("");
    setTranslatedReport("");
    setTranslatedSummary("");
    setTranslatedChat("");

    const items = [];
    if ((kind === "report" || kind === "all") && report.trim()) items.push({ id: "report", text: report });
    if ((kind === "summary" || kind === "all") && summary.trim()) items.push({ id: "summary", text: summary });
    if ((kind === "chat" || kind === "all") && chat.trim()) items.push({ id: "chat", text: chat });

    if (!items.length) {
      setTranslationErr("Nothing to translate yet.");
      return;
    }

    try {
      const res = await authFetch("/api/translate", {
        method: "POST",
        body: JSON.stringify({ items, source_lang: "en", target_lang: targetLang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Translation request failed.");
      if (data.error) setTranslationErr(data.error);
      for (const entry of data.translations || []) {
        if (entry.id === "report") setTranslatedReport(entry.translated || "");
        if (entry.id === "summary") setTranslatedSummary(entry.translated || "");
        if (entry.id === "chat") setTranslatedChat(entry.translated || "");
      }
    } catch (err) {
      setTranslationErr(err.message || "Translation failed.");
    }
  }

  return (
    <div className="app-shell">
      <header>
        <div className="header-top">
          <div>
            <h1>Medical Report Summarizer + Chat</h1>
            <p className="subtitle">
              Runnable baseline from consolidated branch work. Informational use only,
              not medical advice.
            </p>
          </div>
          <AuthBar onSignOut={onSignOut} />
        </div>
        <div className="meta">
          <span className="pill">API: {health ? "connected" : "unknown"}</span>
          {health?.meta?.status && <span className="pill">Index: {health.meta.status}</span>}
          {healthErr && <span className="error">{healthErr}</span>}
        </div>
      </header>

      <ViewToggle view={view} onViewChange={setView} />

      <main className="grid">
        {(view === "report" || view === "both") && (
          <ReportInputCard
            report={report}
            onReportChange={setReport}
            useKb={useKb}
            onUseKbChange={setUseKb}
            canSummarize={canSummarize}
            isSummarizing={isSummarizing}
            onSummarize={doSummarize}
            onTranslate={doTranslate}
            summaryErr={summaryErr}
          />
        )}

        {(view === "summary" || view === "both") && (
          <SummaryCard
            summary={summary}
            onTranslate={doTranslate}
            translatedSummary={translatedSummary}
            targetLang={targetLang}
          />
        )}

        <ChatCard
          question={question}
          onQuestionChange={setQuestion}
          canChat={canChat}
          isChatting={isChatting}
          onChat={doChat}
          onTranslate={doTranslate}
          chat={chat}
          chatErr={chatErr}
          translatedChat={translatedChat}
          targetLang={targetLang}
        />

        <TranslationCard
          targetLang={targetLang}
          onTargetLangChange={setTargetLang}
          onTranslate={doTranslate}
          translationErr={translationErr}
          translatedReport={translatedReport}
        />
      </main>
    </div>
  );
}
