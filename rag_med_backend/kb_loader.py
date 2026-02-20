import os, glob
import pandas as pd
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_community.docstore.document import Document

def load_kb_docs(kb_glob_pattern: str = "kb/*"):
    docs = []
    for path in glob.glob(kb_glob_pattern):
        try:
            base = os.path.basename(path)
            if path.lower().endswith(".pdf"):
                loader = PyPDFLoader(path)
                loaded = loader.load()
                for d in loaded:
                    d.metadata["source"] = base
                docs.extend(loaded)
            elif path.lower().endswith(".csv"):
                df = pd.read_csv(path)
                for _, row in df.iterrows():
                    text = "\n".join(f"{col}: {str(row[col])}" for col in df.columns)
                    docs.append(Document(page_content=text, metadata={"source": base}))
            else:
                loader = TextLoader(path, encoding="utf-8")
                loaded = loader.load()
                for d in loaded:
                    d.metadata["source"] = base
                docs.extend(loaded)
        except Exception as e:
            print(f"[KB loader] Failed to load {path}: {e}")
    return docs
