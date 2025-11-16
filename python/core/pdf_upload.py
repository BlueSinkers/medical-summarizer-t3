import os
from tempfile import NamedTemporaryFile
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.docstore.document import Document

def load_uploaded_pdf(pdf_bytes: bytes, filename: str):
    """Load PDF uploaded via FastAPI and return LangChain Documents."""
    with NamedTemporaryFile(delete=True, suffix=".pdf") as tmp:
        tmp.write(pdf_bytes)
        tmp.flush()

        loader = PyPDFLoader(tmp.name)
        docs = loader.load()

        # Add source metadata
        for d in docs:
            d.metadata["source"] = filename

        return docs
