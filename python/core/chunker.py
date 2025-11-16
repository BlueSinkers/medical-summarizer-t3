from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.docstore.document import Document

def chunk_text(full_text: str, size=1000, overlap=200):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=size,
        chunk_overlap=overlap
    )
    docs = splitter.create_documents([full_text])
    return docs
