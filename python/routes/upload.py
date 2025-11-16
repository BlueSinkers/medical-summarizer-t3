from fastapi import APIRouter, UploadFile, File
from core.pdf_upload import load_uploaded_pdf
from core.chunker import chunk_text
from core.embedder import get_embedding_model
from core.vectorstore import save_vectorstore
import uuid, os

router = APIRouter()

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    # Read PDF bytes
    pdf_bytes = await file.read()

    # Extract text using LangChain's PDF loader
    docs = load_uploaded_pdf(pdf_bytes, file.filename)
    full_text = "\n".join([d.page_content for d in docs])

    # Create directory for this report
    report_id = str(uuid.uuid4())
    report_dir = f"storage/{report_id}"
    os.makedirs(report_dir, exist_ok=True)

    # Save extracted text
    text_path = f"{report_dir}/text.txt"
    with open(text_path, "w", encoding="utf-8") as f:
        f.write(full_text)

    # Chunk text for RAG
    chunks = chunk_text(full_text)

    # Load embedding model
    embeddings = get_embedding_model()

    # Build and save FAISS vectorstore
    vectorstore_path = save_vectorstore(chunks, embeddings, report_id)

    # Return metadata for Express backend
    return {
        "status": "uploaded",
        "report_id": report_id,
        "filename": file.filename,
        "text_length": len(full_text),
        "pages": len(docs),
        "storage_paths": {
            "text": text_path,
            "vectorstore": vectorstore_path
        },
        "full_text": full_text
    }
