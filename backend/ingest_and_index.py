#!/usr/bin/env python3
import sys, json, sqlite3, faiss, numpy as np
from pathlib import Path
from sentence_transformers import SentenceTransformer

# ----------------------------
# Load embedding model once
# ----------------------------
embed_model = SentenceTransformer('all-MiniLM-L6-v2')  # fast, good for FAISS

def embed_texts(texts):
    return embed_model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)

def chunk_text(text, max_chars=2000):
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    chunks, current = [], ''
    for p in paragraphs:
        if len(current) + len(p) > max_chars:
            chunks.append(current.strip())
            current = p
        else:
            current += '\n\n' + p
    if current.strip():
        chunks.append(current.strip())
    return chunks

def init_db():
    conn = sqlite3.connect('metadata.db')
    conn.execute('''CREATE TABLE IF NOT EXISTS chunks (
        chunk_id TEXT PRIMARY KEY,
        file_id TEXT,
        section TEXT,
        line_start INTEGER,
        line_end INTEGER,
        char_start INTEGER,
        char_end INTEGER,
        text TEXT
    )''')
    conn.commit()
    return conn

def main():
    args = json.load(sys.stdin)
    file_id, text = args['file_id'], args['text']
    chunks = chunk_text(text)
    vectors = embed_texts(chunks)

    dim = vectors.shape[1]
    Path('indexes').mkdir(exist_ok=True)
    index_path = f'indexes/{file_id}.index'
    index = faiss.IndexFlatIP(dim)  # cosine similarity

    conn = init_db()
    for i, (chunk, vec) in enumerate(zip(chunks, vectors)):
        index.add(np.expand_dims(vec, 0))
        cid = f'{file_id}_chunk_{i:05d}'
        conn.execute('INSERT OR REPLACE INTO chunks VALUES (?,?,?,?,?,?,?,?)',
                     (cid, file_id, 'unknown', i*100, i*100+len(chunk.splitlines()), 0, len(chunk), chunk))
    conn.commit()
    faiss.write_index(index, index_path)

    print(json.dumps({'status': 'ok', 'indexed_chunks': len(chunks)}))

if __name__ == '__main__':
    main()
