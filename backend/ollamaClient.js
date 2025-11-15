import fetch from 'node-fetch';

export async function summarizeWithOllama(text) {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3',
      prompt: 'Summarize this:\n' + text,
      stream: false
    })
  });

  const data = await response.json();
  return data.response;
}
