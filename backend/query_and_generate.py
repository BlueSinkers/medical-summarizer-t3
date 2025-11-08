#!/usr/bin/env python3
import sys, json, faiss, sqlite3, numpy as np, re

def embed_query(q): return np.random.rand(768).astype('float32')

def call_llm(prompt):
    # mock LLM output
    return {
        'summary': 'Mock summary: This patient ...',
        'bullets': [
            {'text': 'INR 3.4 — high bleeding risk', 'citations': ['file123_chunk_00005:122-124']},
            {'text': 'Recent fall — potential head trauma risk', 'citations': ['file123_chunk_00007:20-21']}
        ],
        'risk_flags': {'high_bleeding_risk': True, 'urgent_followup': False}
    }

def main():
    args = json.load(sys.stdin)
    file_id, query = args['file_id'], args['query']
    index = faiss.read_index(f'indexes/{file_id}.index')
    qvec = embed_query(query)
    D, I = index.search(np.expand_dims(qvec, 0), 8)
    conn = sqlite3.connect('metadata.db')
    rows = list(conn.execute('SELECT chunk_id, file_id, line_start, line_end, text FROM chunks'))
    hits = []
    for idx, dist in zip(I[0], D[0]):
        if idx < len(rows):
            chunk_id, fid, ls, le, txt = rows[idx]
            hits.append({'chunk_id': chunk_id, 'file_id': fid, 'line_start': ls, 'line_end': le, 'text': txt})
    llm_out = call_llm('fake prompt')
    for h in hits:
        m = re.search(r'INR\s*[:=]?\s*(\d+(\.\d+)?)', h['text'])
        if m and float(m.group(1)) > 3:
            llm_out['risk_flags']['high_bleeding_risk'] = True
    print(json.dumps({
        'summary': llm_out['summary'],
        'bullets': llm_out['bullets'],
        'risk_flags': llm_out['risk_flags'],
        'sources': hits
    }))

if __name__ == '__main__':
    main()
