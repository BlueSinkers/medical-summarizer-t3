export default function ReportInputCard({
  report,
  onReportChange,
  useKb,
  onUseKbChange,
  canSummarize,
  isSummarizing,
  onSummarize,
  onTranslate,
  summaryErr,
}) {
  return (
    <section className="card">
      <h2>Patient Report Input</h2>
      <div className="content-area">
        <textarea
          value={report}
          onChange={(e) => onReportChange(e.target.value)}
          placeholder="Paste medical report text here..."
        />
      </div>
      <div className="button-row">
        <button disabled={!canSummarize || isSummarizing} onClick={onSummarize}>
          {isSummarizing ? "Summarizing..." : "Summarize"}
        </button>
        <button disabled={!report.trim()} onClick={() => onTranslate("report")}>
          Translate report
        </button>
      </div>
      <div className="controls">
        <label className="toggle-label">
          <span>Use KB:</span>
          <div
            className={`toggle${useKb ? " toggle--on" : ""}`}
            onClick={() => onUseKbChange(!useKb)}
          >
            <div className="toggle-thumb" />
          </div>
        </label>
      </div>
      {summaryErr && <p className="error">{summaryErr}</p>}
    </section>
  );
}
