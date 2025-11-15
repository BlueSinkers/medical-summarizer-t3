#!/usr/bin/env python3
import sys, json, faiss, sqlite3, numpy as np, re, subprocess
from sentence_transformers import SentenceTransformer

# ----------------------------
# Load embedding model once
# ----------------------------
embed_model = SentenceTransformer('all-MiniLM-L6-v2')

def embed_query(q):
    return embed_model.encode([q], convert_to_numpy=True, normalize_embeddings=True)[0]

def call_llm(prompt):
    """Call Ollama CLI and return text."""
    try:
        result = subprocess.run(
            ["ollama", "run", "llama3"],  # make sure llama3 exists locally
            input=prompt,
            text=True,
            capture_output=True,
            check=True
        )
        return {
            'summary': result.stdout.strip(),
            'bullets': [],
            'risk_flags': {}
        }
    except subprocess.CalledProcessError as e:
        return {'summary': f'Error calling Ollama: {e.stderr}', 'bullets': [], 'risk_flags': {}}

def main():
    args = json.load(sys.stdin)
    file_id, query = args['file_id'], args['query']

    # Load FAISS index
    index = faiss.read_index(f'indexes/{file_id}.index')
    qvec = embed_query(query)
    D, I = index.search(np.expand_dims(qvec, 0), 8)

    # Load chunk metadata
    conn = sqlite3.connect('metadata.db')
    rows = list(conn.execute('SELECT chunk_id, file_id, line_start, line_end, text FROM chunks WHERE file_id=?', (file_id,)))

    # Retrieve top hits
    hits = []
    for idx in I[0]:
        if idx < len(rows):
            chunk_id, fid, ls, le, txt = rows[idx]
            hits.append({'chunk_id': chunk_id, 'file_id': fid, 'line_start': ls, 'line_end': le, 'text': txt})

    # Build prompt for LLM
    context = "\n\n".join([h['text'] for h in hits])
    prompt = f"""You are a medical report summarizer.
Summarize the following patient report clearly and concisely in plain English.
Highlight key findings, test results, and medical risks.

Report content:
{context}
"""

    llm_out = call_llm(prompt)

    # Simple risk detection example
    for h in hits:
        m = re.search(r'INR\s*[:=]?\s*(\d+(\.\d+)?)', h['text'])
        if m and float(m.group(1)) > 3:
            llm_out['risk_flags']['high_bleeding_risk'] = True

    print(json.dumps({
        'summary': llm_out['summary'],
        'bullets': llm_out.get('bullets', []),
        'risk_flags': llm_out.get('risk_flags', {}),
        'sources': hits
    }))

if __name__ == '__main__':
    main()
