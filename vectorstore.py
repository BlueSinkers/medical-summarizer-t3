from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

def build_retriever(docs):
    splitter = RecursiveCharacterTextSplitter(chunk_size=3000, chunk_overlap=400)
    chunks = splitter.split_documents(docs)

    emb = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vs = FAISS.from_documents(chunks, emb)

    return vs.as_retriever(search_kwargs={"k": 8})
