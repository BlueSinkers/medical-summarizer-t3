const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const ollama = require('ollama');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// ----------------------------
// Helper: Run Python asynchronously
// ----------------------------
function runPythonAsync(script, inputObj) {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', [script]);
    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (data) => { stdout += data.toString(); });
    py.stderr.on('data', (data) => { stderr += data.toString(); });

    py.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr));
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(err);
      }
    });

    py.stdin.write(JSON.stringify(inputObj));
    py.stdin.end();
  });
}

// ----------------------------
// Ingest Endpoint
// ----------------------------
app.post('/api/ingest', async (req, res) => {
  try {
    const { file_id, text } = req.body;

    if (!fs.existsSync('raw')) fs.mkdirSync('raw');
    fs.writeFileSync(`raw/${file_id}.txt`, text);

    // Call Python script to ingest & index into FAISS
    const out = await runPythonAsync('ingest_and_index.py', { file_id, text });
    res.json(out);
  } catch (err) {
    console.error('Error in /api/ingest:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// Query Endpoint
// ----------------------------
app.post('/api/query', async (req, res) => {
  try {
    const { file_id, query } = req.body;

    // 1️⃣ Retrieve relevant chunks from Python/FAISS
    const rag = await runPythonAsync('query_and_generate.py', { file_id, query });

    // 2️⃣ Build prompt for Ollama
    const prompt = `
You are a medical assistant AI.

Here are the most relevant extracted text chunks from the patient PDF:

${rag.sources.map((s, i) => `Chunk ${i+1}: ${s.text}`).join("\n\n")}

Task:
- Provide a concise summary paragraph
- List key findings as bullet points
- Highlight any risk flags or concerns
Do NOT fabricate information.

User question: "${query}"
`;

    // 3️⃣ Call Ollama asynchronously
    const response = await ollama.generate({
      model: 'llama3',
      prompt,
      stream: false
    });

    // 4️⃣ Send back the real summary + chunks
    res.json({
      llm_summary: response.response,
      retrieved_chunks: rag.sources
    });

  } catch (err) {
    console.error('Error in /api/query:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// Start server
// ----------------------------
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend with FAISS + Ollama running on port ${PORT}`);
});
