import glob
import os

import pandas as pd
from langchain_community.docstore.document import Document
from langchain_community.document_loaders import PyPDFLoader, TextLoader


def load_kb_docs(kb_glob_pattern: str = "sample_kb/*"):
    docs = []
    for path in glob.glob(kb_glob_pattern):
        try:
            base = os.path.basename(path)
            lower = path.lower()
            if lower.endswith(".pdf"):
                loaded = PyPDFLoader(path).load()
                for doc in loaded:
                    doc.metadata["source"] = base
                docs.extend(loaded)
            elif lower.endswith(".csv"):
                df = pd.read_csv(path)
                for _, row in df.iterrows():
                    text = "\n".join(f"{col}: {row[col]}" for col in df.columns)
                    docs.append(Document(page_content=text, metadata={"source": base}))
            else:
                loaded = TextLoader(path, encoding="utf-8").load()
                for doc in loaded:
                    doc.metadata["source"] = base
                docs.extend(loaded)
        except Exception as exc:
            print(f"[KB loader] Failed to load {path}: {exc}")
    return docs
