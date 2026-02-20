import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

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

  // Translation state
  const [targetLang, setTargetLang] = useState('es') // default Spanish
  const [translatedReport, setTranslatedReport] = useState('')
  const [translatedSummary, setTranslatedSummary] = useState('')
  const [translatedRisks, setTranslatedRisks] = useState('')
  const [translateError, setTranslateError] = useState('')

  async function doSummarize() {
    setSumOut('')
    setRisks(null)       // keep around but don't render
    setRiskNotes('')     // clear human-readable notes

    // Clear old translations when a new summary is generated
    setTranslatedReport('')
    setTranslatedSummary('')
    setTranslatedRisks('')
    setTranslateError('')

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

  async function doTranslate(kind) {
    // kind: 'report', 'summary', or 'both'
    setTranslateError('')
    setTranslatedReport('')
    setTranslatedSummary('')
    setTranslatedRisks('')

    const items = []

    if ((kind === 'report' || kind === 'both') && report.trim()) {
      items.push({ id: 'report', text: report })
    }
    if ((kind === 'summary' || kind === 'both') && sumOut.trim()) {
      items.push({ id: 'summary', text: sumOut })
      // Also translate risks if available
      if (riskNotes.trim()) {
        items.push({ id: 'risks', text: riskNotes })
      }
    }

    if (!items.length) {
      setTranslateError('Nothing to translate yet.')
      return
    }

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          source_lang: 'en',
          target_lang: targetLang,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }

      const data = await res.json()
      if (data.error) {
        throw new Error(data.error)
      }

      for (const t of data.translations || []) {
        if (t.id === 'report') {
          setTranslatedReport(t.translated || '')
        } else if (t.id === 'summary') {
          setTranslatedSummary(t.translated || '')
        } else if (t.id === 'risks') {
          setTranslatedRisks(t.translated || '')
        }
      }
    } catch (err) {
      console.error(err)
      setTranslateError(err.message || 'Translation failed.')
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', fontFamily: 'system-ui, Arial, sans-serif' }}>
      <h2>Medical Report Summarizer & Chatbot (RAG)</h2>
      <p style={{ color: '#666' }}>Informational demo only — not medical advice.</p>

      {/* Translation target language selector */}
      <div style={{ marginTop: '0.75rem' }}>
        <label>
          Target language:{' '}
          <select
            value={targetLang}
            onChange={e => setTargetLang(e.target.value)}
          >
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="pt">Portuguese</option>
            <option value="zh">Chinese (Simplified)</option>
            <option value="ar">Arabic</option>
          </select>
        </label>
      </div>

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

        {/* Summarize + translation controls */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          <button onClick={doSummarize}>Summarize</button>
          <button onClick={() => doTranslate('report')}>Translate report</button>
          {sumOut && (
            <>
              <button onClick={() => doTranslate('summary')}>Translate summary</button>
              <button onClick={() => doTranslate('both')}>Translate both</button>
            </>
          )}
        </div>

        {sumOut && (
          <>
            <h4 style={{ marginTop: '1rem' }}>Output</h4>
            <div>
              <ReactMarkdown>{sumOut}</ReactMarkdown>
            </div>
          </>
        )}

        {/* Risk summary 
        {riskNotes && (
          <>
            <h4>Risk Summary</h4>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              <ReactMarkdown>{riskNotes}</ReactMarkdown>
            </div>
          </>
        )}
        */}

        {/* Translation results */}
        {translateError && (
          <p style={{ color: 'red', marginTop: '0.75rem' }}>{translateError}</p>
        )}

        {(translatedReport || translatedSummary) && (
          <div style={{ marginTop: '1rem' }}>
            {translatedReport && (
              <>
                <h4>Translated Report ({targetLang})</h4>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  <ReactMarkdown>{translatedReport}</ReactMarkdown>
                </div>
              </>
            )}
            {translatedSummary && (
              <>
                <h4>Translated Summary ({targetLang})</h4>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  <ReactMarkdown>{translatedSummary}</ReactMarkdown>
                </div>
              </>
            )}
            {translatedRisks && (
              <>
                <h4>Translated Risks ({targetLang})</h4>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  <ReactMarkdown>{translatedRisks}</ReactMarkdown>
                </div>
              </>
            )}
          </div>
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
            <div>
              <ReactMarkdown>{chatOut}</ReactMarkdown>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
