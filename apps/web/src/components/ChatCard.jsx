import ReactMarkdown from "react-markdown";

export default function ChatCard({
  question,
  onQuestionChange,
  canChat,
  isChatting,
  onChat,
  onTranslate,
  chat,
  chatErr,
  translatedChat,
  targetLang,
}) {
  return (
    <section className="card">
      <h2>Chatbot</h2>
      <input
        value={question}
        onChange={(e) => onQuestionChange(e.target.value)}
        placeholder="Ask a question about the report..."
      />
      <div className="button-row">
        <button disabled={!canChat || isChatting} onClick={onChat}>
          {isChatting ? "Asking..." : "Ask"}
        </button>
        <button disabled={!chat.trim()} onClick={() => onTranslate("chat")}>
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
  );
}
