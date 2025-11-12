import { useState } from 'react'

export default function App() {
  const [report, setReport] = useState('')
  const [useKb, setUseKb] = useState(true)
  const [sumOut, setSumOut] = useState('')

  // Keep structured JSON available (hidden from users)
  const [risks, setRisks] = useState(null)

  // Human-readable risk notes returned by backend
  const [riskNotes, setRiskNotes] = useState('')

  const [question, setQuestion] = useState('')
  const [chatOut, setChatOut] = useState('')

  async function doSummarize() {
    setSumOut('')
    setRisks(null)       // keep around but don't render
    setRiskNotes('')     // clear human-readable notes

    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report, use_kb: useKb })
    })
    const data = await res.json()
    setSumOut(data.text || '')
    setRisks(data.risks || null)            // JSON kept in state (hidden)
    setRiskNotes(data.risk_notes || '')     // human-readable bullets/text
  }

  async function doChat() {
    setChatOut('')
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    })
    const data = await res.json()
    setChatOut(data.text || '')
  }

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', fontFamily: 'system-ui, Arial, sans-serif' }}>
      <h2>Medical Report Summarizer & Chatbot (RAG)</h2>
      <p style={{ color: '#666' }}>Informational demo only — not medical advice.</p>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>Summarize & Flag Risks</h3>
        <textarea
          value={report}
          onChange={e => setReport(e.target.value)}
          placeholder="Paste the patient report text here"
          rows={10}
          style={{ width: '100%', fontFamily: 'monospace' }}
        />
        <div style={{ margin: '0.5rem 0' }}>
          <label>
            <input
              type="checkbox"
              checked={useKb}
              onChange={e => setUseKb(e.target.checked)}
            />
            {' '}Use KB (RAG)
          </label>
        </div>
        <button onClick={doSummarize}>Summarize</button>

        {sumOut && (
          <>
            <h4 style={{ marginTop: '1rem' }}>Output</h4>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{sumOut}</pre>
          </>
        )}

        {riskNotes && (
          <>
            <h4>Risk Summary</h4>
            {/* riskNotes is a Markdown-like bullet list; render as pre-wrapped text */}
            <pre style={{ whiteSpace: 'pre-wrap' }}>{riskNotes}</pre>
          </>
        )}

        {/* The parsed JSON 'risks' remains available in state for future use,
            but is intentionally not rendered to users. */}
      </section>

      <hr style={{ margin: '2rem 0' }} />

      <section>
        <h3>Chat with the KB</h3>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask a question about the KB"
          style={{ width: '100%', padding: '8px' }}
        />
        <div>
          <button onClick={doChat} style={{ marginTop: '0.5rem' }}>Ask</button>
        </div>
        {chatOut && (
          <>
            <h4 style={{ marginTop: '1rem' }}>Answer</h4>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{chatOut}</pre>
          </>
        )}
      </section>
    </div>
  )
}
