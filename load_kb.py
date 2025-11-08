from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_community.docstore.document import Document
import pandas as pd
import glob

def load_kb_docs(kb_glob_pattern: str = "kb/*"):
    docs = []
    for path in glob.glob(kb_glob_pattern):
        try:
            if path.lower().endswith(".pdf"):
                loader = PyPDFLoader(path)
                loaded = loader.load()

            elif path.lower().endswith(".csv"):
                df = pd.read_csv(path)
                for _, row in df.iterrows():
                    text = "\n".join(f"{col}: {row[col]}" for col in df.columns)
                    docs.append(Document(page_content=text, metadata={"source": os.path.basename(path)}))

            else:
                loader = TextLoader(path, encoding="utf-8")
                loaded = loader.load()
                docs.extend(loaded)
                continue

            # Attach source metadata for PDFs
            for d in loaded:
                d.metadata["source"] = os.path.basename(path)
            docs.extend(loaded)

        except Exception as e:
            st.warning(f"Failed to load {path}: {e}")

    return docs

