from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS

def build_retriever(docs):
    splitter = RecursiveCharacterTextSplitter(chunk_size=3000, chunk_overlap=400)
    chunks = splitter.split_documents(docs)

    emb = OpenAIEmbeddings(model="text-embedding-3-small")
    vs = FAISS.from_documents(chunks, emb)

    return vs.as_retriever(search_kwargs={"k": 8})
