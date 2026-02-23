import asyncio
import os
import re
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from chat_chain import make_chat_chain
from kb_loader import load_kb_docs
from retriever import build_or_load_index, format_docs
from summarizer_chain import make_summarizer_chain
from translation import translate_texts

load_dotenv()

INDEX_DIR = os.getenv("FAISS_INDEX_DIR", "faiss_index")
KB_GLOB = os.getenv("KB_GLOB", "sample_kb/*")
EMBED_MODEL = os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "120"))
TOP_K = int(os.getenv("TOP_K", "8"))
ENABLE_RAG_INDEX = os.getenv("ENABLE_RAG_INDEX", "1") == "1"
ALLOW_MOCK_FALLBACK = os.getenv("ALLOW_MOCK_FALLBACK", "1") == "1"

app = FastAPI(title="Medical Summarizer API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

KB_DOCS = []
VS = None
RETRIEVER = None
READY_EVENT = asyncio.Event()
READY_META = {"status": "initializing"}
LAST_REPORT_TEXT: Optional[str] = None


class SummarizeReq(BaseModel):
    report: str
    use_kb: bool = True


class ChatReq(BaseModel):
    question: str
    report: Optional[str] = None
    use_kb: bool = True


class TranslateItem(BaseModel):
    id: str
    text: str


class TranslateReq(BaseModel):
    items: List[TranslateItem]
    target_lang: str
    source_lang: str = "en"


def normalize_report_text(text: str) -> str:
    if not text:
        return text
    normalized = text.replace("\u00A0", " ").replace("\u2009", " ")
    normalized = re.sub(r"(?<=[A-Za-z])(?=\d)", " ", normalized)
    normalized = re.sub(r"(?<=\d)(?=[A-Za-zµ%/])", " ", normalized)
    normalized = re.sub(r"(?<=[A-Za-z0-9%/µ])(?=[<>≤≥])", " ", normalized)
    normalized = re.sub(r"([<>≤≥])(?=[0-9])", r"\1 ", normalized)
    normalized = re.sub(r"\s*([<>≤≥])\s*", r" \1 ", normalized)
    normalized = re.sub(r"[ \t\f\v]+", " ", normalized)
    return normalized.strip()


def _mock_summary(report: str) -> str:
    text = (report or "").strip()
    if not text:
        return "### SUMMARY\nNo report content provided."

    sentences = re.split(r"(?<=[.!?])\s+", text)
    sentences = [entry.strip() for entry in sentences if entry.strip()]
    overview = " ".join(sentences[:4]) if sentences else text[:400]

    finding_lines = []
    for token in ["pain", "blood", "pressure", "heart", "chest", "lab", "imaging", "follow-up"]:
        if re.search(rf"\b{re.escape(token)}\b", text, re.IGNORECASE):
            finding_lines.append(f"- Mentions {token} [REPORT]")
    if not finding_lines:
        finding_lines = [
            "- The report text was captured and can be reviewed in chat [REPORT]",
            "- Add more specific details for a richer summary [REPORT]",
        ]

    return (
        "### SUMMARY\n"
        f"{overview}\n\n"
        "### KEY FINDINGS\n"
        + "\n".join(finding_lines[:6])
        + "\n\n### FOLLOW-UP POINTS\n- Not explicitly stated in the report."
    )


def _mock_chat_answer(question: str, report: str) -> str:
    q = (question or "").strip()
    report = (report or "").strip()
    if not q:
        return "Please ask a specific question."
    if not report:
        return "No patient report is available. Paste a report first, then ask your question."

    low_q = q.lower()
    if "summary" in low_q:
        return "I can summarize this report. Use the Summarize action, then ask follow-up questions. [REPORT]"
    if "risk" in low_q or "concern" in low_q:
        return (
            "Potential concerns should be interpreted by a clinician. "
            "I can point out mentions from the report, but not diagnose. [REPORT]"
        )
    if "medication" in low_q or "drug" in low_q:
        return "I can list medication mentions found in the report text. [REPORT]"

    snippet = report[:350] + ("..." if len(report) > 350 else "")
    return (
        "I do not have a live model response right now, but I can still ground to your report.\n\n"
        f"Report excerpt: {snippet}\n\n"
        "Ask a narrower question (medications, labs, follow-up, imaging) for a more focused answer. [REPORT]"
    )


async def _async_build_index():
    global KB_DOCS, VS, RETRIEVER, READY_META
    try:
        if not ENABLE_RAG_INDEX:
            READY_META = {"ok": True, "status": "disabled", "reason": "ENABLE_RAG_INDEX=0"}
            return

        KB_DOCS = load_kb_docs(KB_GLOB)
        VS, RETRIEVER, meta = build_or_load_index(
            KB_DOCS,
            kb_glob=KB_GLOB,
            index_dir=INDEX_DIR,
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            model_name=EMBED_MODEL,
            k=TOP_K,
        )
        READY_META = {"ok": True, "kb_docs": len(KB_DOCS), **meta}
    except Exception as exc:
        # Keep app available even if indexing fails.
        READY_META = {"ok": False, "status": "index_error", "error": str(exc)}
    finally:
        READY_EVENT.set()


@app.on_event("startup")
async def on_startup():
    asyncio.create_task(_async_build_index())


@app.get("/health")
async def health():
    return {"ready": READY_EVENT.is_set(), "meta": READY_META}


@app.post("/summarize")
async def summarize(req: SummarizeReq):
    global LAST_REPORT_TEXT
    report = normalize_report_text(req.report)
    if not report:
        raise HTTPException(status_code=400, detail="report cannot be empty")

    LAST_REPORT_TEXT = report

    if not READY_EVENT.is_set() and req.use_kb:
        return {
            "text": "KB index is still building. Retry shortly or disable KB for now.",
            "risks": None,
            "risk_notes": None,
            "ready": False,
            "meta": READY_META,
        }

    chain = make_summarizer_chain(
        retriever=RETRIEVER if (req.use_kb and RETRIEVER) else None,
        format_docs_fn=format_docs,
    )

    try:
        output = chain.invoke({"report": report})
    except Exception as exc:
        if not ALLOW_MOCK_FALLBACK:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        output = _mock_summary(report)

    return {
        "text": output,
        "risks": None,
        "risk_notes": None,
        "ready": True,
        "meta": READY_META,
    }


@app.post("/chat")
async def chat(req: ChatReq):
    report = normalize_report_text(req.report or LAST_REPORT_TEXT or "")
    question = (req.question or "").strip()

    if not question:
        raise HTTPException(status_code=400, detail="question cannot be empty")
    if not report:
        return {
            "text": (
                "No patient report is available. Paste a report and summarize first, "
                "or include report text directly in this request."
            ),
            "ready": False,
        }

    chain = make_chat_chain(
        retriever=RETRIEVER if (req.use_kb and RETRIEVER) else None,
        format_docs_fn=format_docs,
    )
    try:
        answer = chain.invoke({"question": question, "report": report})
    except Exception as exc:
        if not ALLOW_MOCK_FALLBACK:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        answer = _mock_chat_answer(question, report)

    return {"text": answer, "ready": True, "meta": READY_META}


@app.post("/translate")
async def translate(req: TranslateReq):
    if not req.items:
        return {"translations": [], "error": "No items provided."}

    texts = [item.text for item in req.items]
    try:
        translated = translate_texts(
            texts,
            source_lang=req.source_lang,
            target_lang=req.target_lang,
        )
        results = []
        for item, out_text in zip(req.items, translated):
            results.append(
                {
                    "id": item.id,
                    "original": item.text,
                    "translated": out_text,
                }
            )
        return {
            "translations": results,
            "source_lang": req.source_lang,
            "target_lang": req.target_lang,
        }
    except Exception as exc:
        if not ALLOW_MOCK_FALLBACK:
            return {"translations": [], "error": str(exc)}
        # Soft fallback keeps UX functional if model stack is unavailable.
        passthrough = []
        for item in req.items:
            passthrough.append(
                {
                    "id": item.id,
                    "original": item.text,
                    "translated": item.text,
                }
            )
        return {
            "translations": passthrough,
            "source_lang": req.source_lang,
            "target_lang": req.target_lang,
            "error": f"Translation model unavailable: {exc}",
        }
