from langchain_community.document_loaders import PyPDFLoader, TextLoader
import glob

def load_kb_docs():
    docs = []
    for path in glob.glob("kb/*"):
        if path.endswith(".pdf"):
            loader = PyPDFLoader(path)
        else:
            loader = TextLoader(path, encoding="utf-8")
        docs.extend(loader.load())
    return docs
