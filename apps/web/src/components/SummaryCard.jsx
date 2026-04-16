import ReactMarkdown from "react-markdown";

export default function SummaryCard({ summary, onTranslate, translatedSummary, targetLang }) {
  return (
    <section className="card">
      <h2>Summary</h2>
      <div className="content-area">
        {summary ? (
          <div className="markdown">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        ) : (
          <p className="muted">Summary output appears here.</p>
        )}
      </div>
      <div className="button-row">
        <button disabled={!summary.trim()} onClick={() => onTranslate("summary")}>
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
  );
}
