const express = require('express');
const bodyParser = require('body-parser');
const { spawnSync } = require('child_process');
const fs = require('fs');
const app = express();
const cors = require('cors');


app.use(cors());
app.use(express.json());
app.use(bodyParser.json({ limit: '10mb' }));

function runPython(script, inputObj) {
  const result = spawnSync('python3', [script], {
    input: JSON.stringify(inputObj),
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

app.post('/api/ingest', function (req, res) {
  try {
    const fileId = req.body.file_id;
    const text = req.body.text;
    if (!fs.existsSync('raw')) fs.mkdirSync('raw');
    fs.writeFileSync(`raw/${fileId}.txt`, text);
    const out = runPython('ingest_and_index.py', { file_id: fileId, text: text });
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/query', function (req, res) {
  try {
    const { file_id, query } = req.body;
    const out = runPython('query_and_generate.py', { file_id, query });
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, function () {
  console.log('RAG backend running on port 3001');
});
