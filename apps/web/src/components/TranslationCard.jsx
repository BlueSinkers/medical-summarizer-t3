import ReactMarkdown from "react-markdown";

const LANGUAGES = [
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "zh", label: "Chinese (Simplified)" },
  { value: "ar", label: "Arabic" },
];

export default function TranslationCard({
  targetLang,
  onTargetLangChange,
  onTranslate,
  translationErr,
  translatedReport,
}) {
  return (
    <section className="card">
      <h2>Translation Options</h2>
      <label>
        Target language:
        <select value={targetLang} onChange={(e) => onTargetLangChange(e.target.value)}>
          {LANGUAGES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="button-row">
        <button onClick={() => onTranslate("all")}>Translate report + summary + chat</button>
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
  );
}
