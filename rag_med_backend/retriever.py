# retriever.py
import os, glob, json, hashlib, time
from typing import List, Optional

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.docstore.document import Document

DEFAULT_EMB_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

def build_vectorstore(
    docs: List[Document],
    chunk_size: int = 750,
    chunk_overlap: int = 150,
    model_name: str = DEFAULT_EMB_MODEL,
) -> Optional[FAISS]:
    if not docs:
        return None
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )
    chunks = splitter.split_documents(docs)
    emb = HuggingFaceEmbeddings(model_name=model_name)
    return FAISS.from_documents(chunks, emb)

def make_retriever(vs: Optional[FAISS], k: int = 8):
    if vs is None:
        return None
    return vs.as_retriever(search_kwargs={"k": k})

def format_docs(docs: List[Document]):
    if not docs:
        return "[KB:empty]\n(No relevant knowledge found.)"
    out = []
    for d in docs:
        src = d.metadata.get("source", "doc")
        page = d.metadata.get("page")
        if page is not None:
            tag = f"[KB:{src}:p{page}]"
        else:
            tag = f"[KB:{src}]"
        out.append(f"{tag}\n{d.page_content}")
    return "\n\n---\n\n".join(out)

# ------------------- NEW: persistence helpers -------------------

def _fingerprint_files(glob_pattern: str) -> str:
    """Stable fingerprint based on (path, size, mtime). If any file changes, the hash changes."""
    h = hashlib.sha256()
    for path in sorted(glob.glob(glob_pattern)):
        try:
            st = os.stat(path)
            fingerprint_data = f"{path}{st.st_size}{int(st.st_mtime)}"
            h.update(fingerprint_data.encode("utf-8"))
        except FileNotFoundError:
            continue
    return h.hexdigest()

def _persist_vectorstore(vs: FAISS, index_dir: str, meta: dict):
    """Save FAISS index and metadata to disk."""
    os.makedirs(index_dir, exist_ok=True)
    vs.save_local(index_dir)
    with open(os.path.join(index_dir, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

def _load_if_fresh(index_dir: str, expected_fp: str, model_name: str) -> Optional[FAISS]:
    """Load FAISS index only if it exists, is fresh, and uses the same embedding model."""
    meta_path = os.path.join(index_dir, "meta.json")
    try:
        with open(meta_path) as f:
            meta = json.load(f)
        # Check freshness before loading (avoid unnecessary embedding model initialization)
        kb_fp_matches = meta.get("kb_fingerprint") == expected_fp
        model_matches = meta.get("embedding_model") == model_name
        if not kb_fp_matches or not model_matches:
            return None
        emb = HuggingFaceEmbeddings(model_name=model_name)
        return FAISS.load_local(
            index_dir,
            emb,
            allow_dangerous_deserialization=True
        )
    except Exception:
        return None

# ------------------- NEW: persistence helpers -------------------

def build_or_load_index(
    docs: List[Document],
    kb_glob: str,
    index_dir: str = "faiss_index",
    chunk_size: int = 750,
    chunk_overlap: int = 150,
    model_name: str = DEFAULT_EMB_MODEL,
    k: int = 8,
):
    """
    Fast path:
      - If a persisted index exists AND its metadata fingerprint matches the KB, load it.
    Slow path:
      - Build FAISS from docs, then persist to disk for next time.
    Returns: (vectorstore, retriever, ready_meta_dict)
    """
    kb_fp = _fingerprint_files(kb_glob)

    # Fast path: load fresh index from disk
    vs = _load_if_fresh(index_dir, kb_fp, model_name)
    if vs:
        return (
            vs,
            make_retriever(vs, k=k),
            {
                "status": "loaded",
                "source": "disk",
                "kb_fingerprint": kb_fp,
                "embedding_model": model_name,
            }
        )

    # Slow path: build new index
    vs = build_vectorstore(
        docs,
        chunk_size,
        chunk_overlap,
        model_name
    )
    if not vs:
        return None, None, {"status": "empty", "kb_fingerprint": kb_fp}

    meta = {
        "kb_fingerprint": kb_fp,
        "embedding_model": model_name,
        "built_at": int(time.time()),
        "chunk_size": chunk_size,
        "chunk_overlap": chunk_overlap,
    }

    _persist_vectorstore(vs, index_dir, meta)
    return (
        vs,
        make_retriever(vs, k=k),
        {**meta, "status": "built", "source": "rebuild"}
    )
