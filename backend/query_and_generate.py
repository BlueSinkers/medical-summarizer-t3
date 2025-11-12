#!/usr/bin/env python3
import sys, json, faiss, sqlite3, numpy as np, re, subprocess

def embed_query(q):
    # Placeholder random embedding (replace with a real embedding model later)
    return np.random.rand(768).astype('float32')

def call_llm(prompt):
    """Call a local Ollama model (like llama3 or mistral) to summarize."""
    try:
        # Run Ollama with your preferred model (change 'llama3' if needed)
        result = subprocess.run(
            ["ollama", "run", "llama3"],
            input=prompt,
            text=True,
            capture_output=True
        )

        if result.returncode != 0:
            raise RuntimeError(result.stderr)

        output = result.stdout.strip()
        return {
            'summary': output,
            'bullets': [],
            'risk_flags': {}
        }
    except Exception as e:
        return {'summary': f'Error calling Ollama: {e}', 'bullets': [], 'risk_flags': {}}


def main():
    args = json.load(sys.stdin)
    file_id, query = args['file_id'], args['query']

    # Load FAISS index and metadata
    index = faiss.read_index(f'indexes/{file_id}.index')
    qvec = embed_query(query)
    D, I = index.search(np.expand_dims(qvec, 0), 8)

    conn = sqlite3.connect('metadata.db')
    rows = list(conn.execute('SELECT chunk_id, file_id, line_start, line_end, text FROM chunks WHERE file_id=?', (file_id,)))

    # Get relevant chunks
    hits = []
    for idx, dist in zip(I[0], D[0]):
        if idx < len(rows):
            chunk_id, fid, ls, le, txt = rows[idx]
            hits.append({
                'chunk_id': chunk_id,
                'file_id': fid,
                'line_start': ls,
                'line_end': le,
                'text': txt
            })

    # Combine top chunks into context
    context = "\n\n".join([h['text'] for h in hits])
    prompt = f"""You are a medical report summarizer.
Summarize the following patient report clearly and concisely in plain English.
Highlight key findings, test results, and medical risks.

Report content:
{context}
"""

    llm_out = call_llm(prompt)

    # Optional risk flag detection (simple pattern match)
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
