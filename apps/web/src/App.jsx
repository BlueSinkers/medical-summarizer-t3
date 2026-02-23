import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";

export default function App() {
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
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, use_kb: useKb }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to summarize report.");
      }
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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, report, use_kb: useKb }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to get chat response.");
      }
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
    if ((kind === "report" || kind === "all") && report.trim()) {
      items.push({ id: "report", text: report });
    }
    if ((kind === "summary" || kind === "all") && summary.trim()) {
      items.push({ id: "summary", text: summary });
    }
    if ((kind === "chat" || kind === "all") && chat.trim()) {
      items.push({ id: "chat", text: chat });
    }
    if (!items.length) {
      setTranslationErr("Nothing to translate yet.");
      return;
    }

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          source_lang: "en",
          target_lang: targetLang,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Translation request failed.");
      }
      if (data.error) {
        setTranslationErr(data.error);
      }
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
        <h1>Medical Report Summarizer + Chat</h1>
        <p className="subtitle">
          Runnable baseline from consolidated branch work. Informational use only,
          not medical advice.
        </p>
        <div className="meta">
          <span className="pill">API: {health ? "connected" : "unknown"}</span>
          {health?.meta?.status && <span className="pill">Index: {health.meta.status}</span>}
          {healthErr && <span className="error">{healthErr}</span>}
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Patient Report Input</h2>
          <textarea
            rows={15}
            value={report}
            onChange={(e) => setReport(e.target.value)}
            placeholder="Paste medical report text here..."
          />
          <div className="controls">
            <label>
              <input
                type="checkbox"
                checked={useKb}
                onChange={(e) => setUseKb(e.target.checked)}
              />
              Use KB retrieval context
            </label>
          </div>
          <div className="button-row">
            <button disabled={!canSummarize || isSummarizing} onClick={doSummarize}>
              {isSummarizing ? "Summarizing..." : "Summarize"}
            </button>
            <button disabled={!report.trim()} onClick={() => doTranslate("report")}>
              Translate report
            </button>
          </div>
          {summaryErr && <p className="error">{summaryErr}</p>}
        </section>

        <section className="card">
          <h2>Summary</h2>
          {summary ? (
            <div className="markdown">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          ) : (
            <p className="muted">Summary output appears here.</p>
          )}
          <div className="button-row">
            <button disabled={!summary.trim()} onClick={() => doTranslate("summary")}>
              Translate summary
            </button>
          </div>
          {translatedSummary && (
            <>
              <h3>Translated Summary ({targetLang})</h3>
              <div className="markdown">
                <ReactMarkdown>{translatedSummary}</ReactMarkdown>
              </div>
            </>
          )}
        </section>

        <section className="card">
          <h2>Chatbot</h2>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about the report..."
          />
          <div className="button-row">
            <button disabled={!canChat || isChatting} onClick={doChat}>
              {isChatting ? "Asking..." : "Ask"}
            </button>
            <button disabled={!chat.trim()} onClick={() => doTranslate("chat")}>
              Translate answer
            </button>
          </div>
          {chatErr && <p className="error">{chatErr}</p>}
          {chat ? (
            <div className="markdown">
              <ReactMarkdown>{chat}</ReactMarkdown>
            </div>
          ) : (
            <p className="muted">Chat answers appear here.</p>
          )}
          {translatedChat && (
            <>
              <h3>Translated Answer ({targetLang})</h3>
              <div className="markdown">
                <ReactMarkdown>{translatedChat}</ReactMarkdown>
              </div>
            </>
          )}
        </section>

        <section className="card">
          <h2>Translation Options</h2>
          <label>
            Target language:
            <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="pt">Portuguese</option>
              <option value="zh">Chinese (Simplified)</option>
              <option value="ar">Arabic</option>
            </select>
          </label>
          <div className="button-row">
            <button onClick={() => doTranslate("all")}>Translate report + summary + chat</button>
          </div>
          {translationErr && <p className="error">{translationErr}</p>}
          {translatedReport && (
            <>
              <h3>Translated Report ({targetLang})</h3>
              <div className="markdown">
                <ReactMarkdown>{translatedReport}</ReactMarkdown>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
