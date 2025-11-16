from langchain_community.vectorstores import FAISS
import os

def save_vectorstore(chunks, embeddings, report_id: str):
    """
    Creates and saves a FAISS vectorstore for the uploaded PDF.
    Returns the path to the saved vectorstore.
    """

    vector_dir = f"storage/{report_id}/vectorstore"
    os.makedirs(vector_dir, exist_ok=True)

    # Build FAISS index
    vs = FAISS.from_documents(chunks, embeddings)

    # Save to disk
    vs.save_local(vector_dir)

    return vector_dir
