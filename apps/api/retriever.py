import glob
import hashlib
import json
import os
import time
from typing import List, Optional

from langchain_community.docstore.document import Document
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter

DEFAULT_EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def build_vectorstore(
    docs: List[Document],
    chunk_size: int = 750,
    chunk_overlap: int = 150,
    model_name: str = DEFAULT_EMBED_MODEL,
) -> Optional[FAISS]:
    if not docs:
        return None
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
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

    formatted = []
    for doc in docs:
        src = doc.metadata.get("source", "doc")
        page = doc.metadata.get("page")
        if page is None:
            tag = f"[KB:{src}]"
        else:
            tag = f"[KB:{src}:p{page}]"
        formatted.append(f"{tag}\n{doc.page_content}")

    return "\n\n---\n\n".join(formatted)


def _fingerprint_files(glob_pattern: str) -> str:
    # Stable fingerprint based on path/size/mtime to know when KB changed.
    hasher = hashlib.sha256()
    for path in sorted(glob.glob(glob_pattern)):
        try:
            stat = os.stat(path)
            payload = f"{path}|{stat.st_size}|{int(stat.st_mtime)}"
            hasher.update(payload.encode("utf-8"))
        except FileNotFoundError:
            continue
    return hasher.hexdigest()


def _persist_vectorstore(vs: FAISS, index_dir: str, meta: dict):
    os.makedirs(index_dir, exist_ok=True)
    vs.save_local(index_dir)
    with open(os.path.join(index_dir, "meta.json"), "w", encoding="utf-8") as handle:
        json.dump(meta, handle, indent=2)


def _load_if_fresh(index_dir: str, expected_fp: str, model_name: str) -> Optional[FAISS]:
    meta_path = os.path.join(index_dir, "meta.json")
    try:
        with open(meta_path, encoding="utf-8") as handle:
            meta = json.load(handle)
        if meta.get("kb_fingerprint") != expected_fp:
            return None
        if meta.get("embedding_model") != model_name:
            return None

        emb = HuggingFaceEmbeddings(model_name=model_name)
        return FAISS.load_local(index_dir, emb, allow_dangerous_deserialization=True)
    except Exception:
        return None


def build_or_load_index(
    docs: List[Document],
    kb_glob: str,
    index_dir: str = "faiss_index",
    chunk_size: int = 750,
    chunk_overlap: int = 150,
    model_name: str = DEFAULT_EMBED_MODEL,
    k: int = 8,
):
    kb_fp = _fingerprint_files(kb_glob)

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
            },
        )

    vs = build_vectorstore(
        docs,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        model_name=model_name,
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
        {**meta, "status": "built", "source": "rebuild"},
    )
