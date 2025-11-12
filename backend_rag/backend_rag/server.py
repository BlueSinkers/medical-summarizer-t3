# main.py
import os, json, re, asyncio
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from kb_loader import load_kb_docs
from retriever import (
    build_or_load_index, format_docs,
    try_load_vectorstore, make_retriever,  # available if needed
)
from summarizer_chain import make_summarizer_chain
from chat_chain import make_chat_chain

INDEX_DIR = os.getenv("FAISS_INDEX_DIR", "faiss_index")
KB_GLOB = os.getenv("KB_GLOB", "kb/*")
EMBED_MODEL = os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "120"))
TOP_K = int(os.getenv("TOP_K", "8"))

# ----- API -----
app = FastAPI(title="Medical RAG Backend", version="1.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# Global state (populated asynchronously)
KB_DOCS = []
VS = None
RETRIEVER = None
READY_EVENT = asyncio.Event()
READY_META = {"status": "initializing"}

class SummarizeReq(BaseModel):
    report: str
    use_kb: bool = True

class ChatReq(BaseModel):
    question: str


# -------------------------
# Text normalization helpers
# -------------------------

_WS = " \t\f\v"

def normalize_report_text(text: str) -> str:
    """
    Lightly normalize inline lab tables and cramped tokens so the LLM output reads better.
    This DOES NOT change the JSON risks; it's only used on the input report string.

    - Insert space between letters and digits: "BNP220" -> "BNP 220", "A1c8.1%" -> "A1c 8.1%"
    - Insert space between number and unit if missing: "220pg/mL" -> "220 pg/mL"
    - Insert spaces around comparators: "<, >, ≤, ≥" e.g., "pg/mL<100" -> "pg/mL < 100"
    - Collapse excessive whitespace
    """
    if not text:
        return text

    s = text

    # Normalize unicode thin/non-breaking spaces to regular space
    s = s.replace("\u00A0", " ").replace("\u2009", " ")

    # 1) Letter immediately followed by digit => add space (BNP220 -> BNP 220, A1c8.1 -> A1c 8.1)
    s = re.sub(r'(?<=[A-Za-z])(?=\d)', ' ', s)

    # 2) Digit immediately followed by unit symbol/letter => add space (220mg/dL -> 220 mg/dL)
    s = re.sub(r'(?<=\d)(?=[A-Za-zµ%/])', ' ', s)

    # 3) Ensure space before and after comparators (<, >, ≤, ≥)
    s = re.sub(r'(?<=[A-Za-z0-9%/µ])(?=[<>≤≥])', ' ', s)  # before
    s = re.sub(r'([<>≤≥])(?=[0-9])', r'\1 ', s)           # after if number
    s = re.sub(r'\s*([<>≤≥])\s*', r' \1 ', s)             # general pad

    # 4) Collapse runs of spaces
    s = re.sub(r'[ \t\f\v]+', ' ', s)

    # 5) Fix common lab unit clusters missing a space before them
    #    (kept generic via rule #2, but this helps when punctuation slips through)
    # no-op if already spaced

    return s.strip()


def pretty_quote_for_display(q: str) -> str:
    """
    Display-only prettifier for evidence quotes. Keeps JSON intact elsewhere.
    """
    if not q:
        return q
    p = normalize_report_text(q)

    # Small readability tweaks: ensure punctuation spacing
    p = re.sub(r'\s*,\s*', ', ', p)
    p = re.sub(r'\s*\.\s*', '. ', p)

    # Collapse spaces again after tweaks
    p = re.sub(r'[ \t\f\v]+', ' ', p).strip()
    return p


# -------------------------
# RISKS handling
# -------------------------

def _extract_risks_json(raw_text: str):
    """Find the RISKS JSON block after the '### RISKS' heading and parse it."""
    try:
        m = re.search(r"###\s*RISKS\s*(.+)$", raw_text, re.S | re.I)
        if not m:
            return None
        tail = m.group(1).strip()
        start, end = tail.find("{"), tail.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        return json.loads(tail[start:end+1])
    except Exception:
        return None


def _strip_risks_section(raw_text: str) -> str:
    """Remove the entire '### RISKS ...' section from the model output."""
    return re.sub(r"###\s*RISKS[\s\S]+", "", raw_text).strip()


def humanize_risks(risks: dict) -> str:
    """
    Turn the RISKS JSON into readable bullet notes.
    Returns a simple, human-friendly string (Markdown-compatible).
    (Display-only; JSON remains unchanged)
    """
    if not risks or "risk_flags" not in risks or not risks["risk_flags"]:
        return "No specific risks were identified."

    lines = []
    for r in risks["risk_flags"]:
        category = r.get("category", "")
        name = r.get("name", "(unnamed)")
        severity = r.get("severity", "unknown")
        rationale = r.get("rationale", "")
        evidence = r.get("evidence") or []
        suggested_action = r.get("suggested_action")

        lines.append(f"- **{name}** (_{category}, severity: {severity}_)")
        if rationale:
            lines.append(f"  - Rationale: {rationale}")
        if evidence:
            lines.append("  - Evidence (from report):")
            for e in evidence:
                quote = (e.get("quote") or "").strip()
                if quote:
                    lines.append(f"    - “{pretty_quote_for_display(quote)}”")
        if suggested_action:
            lines.append(f"  - Suggested action: {suggested_action}")

    return "\n".join(lines)


# -------------------------
# Startup build / endpoints
# -------------------------

async def _async_build_index():
    global KB_DOCS, VS, RETRIEVER, READY_META
    try:
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
    except Exception as e:
        READY_META = {"ok": False, "error": str(e)}
    finally:
        READY_EVENT.set()


@app.on_event("startup")
async def on_startup():
    # Fast startup; heavy work in the background
    asyncio.create_task(_async_build_index())


@app.get("/health")
async def health():
    is_ready = READY_EVENT.is_set()
    return {
        "ready": is_ready,
        "meta": READY_META,
    }


@app.post("/summarize")
async def summarize(req: SummarizeReq):
    if not READY_EVENT.is_set():
        return {
            "text": "KB index is building… try again shortly.",
            "risks": None,
            "risk_notes": None,
            "ready": False,
            "meta": READY_META,
        }

    # Normalize the incoming report for better readability downstream.
    normalized_report = normalize_report_text(req.report)

    chain = make_summarizer_chain(
        retriever=RETRIEVER if (req.use_kb and RETRIEVER) else None,
        format_docs_fn=format_docs
    )
    raw_text = chain.invoke(normalized_report)

    risks = _extract_risks_json(raw_text)
    cleaned_text = _strip_risks_section(raw_text)
    risk_notes = humanize_risks(risks)

    return {
        "text": cleaned_text,   # SUMMARY + KEY FINDINGS only
        "risks": risks,         # structured JSON (kept for validation/analytics)
        "risk_notes": risk_notes,  # human-readable bullet list (pretty quotes)
        "ready": True
    }


@app.post("/chat")
async def chat(req: ChatReq):
    if not READY_EVENT.is_set() or not RETRIEVER:
        return {"text": "KB index is building or unavailable.", "ready": False, "meta": READY_META}

    chain = make_chat_chain(retriever=RETRIEVER, format_docs_fn=format_docs)
    answer = chain.invoke(req.question.strip())
    return {"text": answer, "ready": True}
