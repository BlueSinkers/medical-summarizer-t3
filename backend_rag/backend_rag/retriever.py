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
    chunk_size: int = 800,
    chunk_overlap: int = 120,
    model_name: str = DEFAULT_EMB_MODEL,
) -> Optional[FAISS]:
    if not docs:
        return None
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    chunks = splitter.split_documents(docs)
    emb = HuggingFaceEmbeddings(model_name=model_name)
    return FAISS.from_documents(chunks, emb)


def make_retriever(vs: Optional[FAISS], k: int = 8):
    return vs.as_retriever(search_kwargs={"k": k}) if vs else None


def format_docs(docs: List[Document]):
    if not docs:
        return "[KB:empty]\n(No relevant knowledge found.)"
    out = []
    for d in docs:
        src = d.metadata.get("source", "doc")
        page = d.metadata.get("page")
        tag = f"[KB:{src}" + (f":p{page}]" if page is not None else "]")
        out.append(f"{tag}\n{d.page_content}")
    return "\n\n---\n\n".join(out)


# ------------------- NEW: persistence helpers -------------------

def _fingerprint_files(glob_pattern: str) -> str:
    """
    Stable fingerprint based on (path, size, mtime). If any file changes, the hash changes.
    """
    h = hashlib.sha256()
    for path in sorted(glob.glob(glob_pattern)):
        try:
            st = os.stat(path)
            h.update(path.encode("utf-8"))
            h.update(str(st.st_size).encode("utf-8"))
            h.update(str(int(st.st_mtime)).encode("utf-8"))
        except FileNotFoundError:
            continue
    return h.hexdigest()


def persist_vectorstore(vs: FAISS, index_dir: str, meta: dict):
    os.makedirs(index_dir, exist_ok=True)
    vs.save_local(index_dir)
    with open(os.path.join(index_dir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)


def try_load_vectorstore(index_dir: str, model_name: str = DEFAULT_EMB_MODEL) -> Optional[FAISS]:
    """
    Returns FAISS if on-disk index exists and is loadable; else None.
    """
    if not os.path.isdir(index_dir):
        return None
    # Need same embedding model at load time
    emb = HuggingFaceEmbeddings(model_name=model_name)
    try:
        return FAISS.load_local(index_dir, emb, allow_dangerous_deserialization=True)
    except Exception:
        return None


def index_is_fresh(index_dir: str, expected_fp: str, expected_emb: str) -> bool:
    try:
        with open(os.path.join(index_dir, "meta.json"), "r", encoding="utf-8") as f:
            meta = json.load(f)
        return meta.get("kb_fingerprint") == expected_fp and meta.get("embedding_model") == expected_emb
    except Exception:
        return False


def build_or_load_index(
    docs: List[Document],
    kb_glob: str,
    index_dir: str = "faiss_index",
    chunk_size: int = 800,
    chunk_overlap: int = 120,
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

    # Try to reuse a fresh on-disk index
    if index_is_fresh(index_dir, kb_fp, model_name):
        vs = try_load_vectorstore(index_dir, model_name=model_name)
        if vs:
            return vs, make_retriever(vs, k=k), {
                "status": "loaded",
                "kb_fingerprint": kb_fp,
                "embedding_model": model_name,
                "source": "disk",
            }

    # Build new index
    started = time.time()
    vs = build_vectorstore(docs, chunk_size=chunk_size, chunk_overlap=chunk_overlap, model_name=model_name)
    if not vs:
        return None, None, {"status": "empty", "kb_fingerprint": kb_fp, "embedding_model": model_name}

    meta = {
        "kb_fingerprint": kb_fp,
        "embedding_model": model_name,
        "built_at": int(started),
        "chunk_size": chunk_size,
        "chunk_overlap": chunk_overlap,
    }
    persist_vectorstore(vs, index_dir, meta)
    return vs, make_retriever(vs, k=k), {**meta, "status": "built", "source": "rebuild"}
