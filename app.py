# app.py
import os, io, json, glob, regex as re
import streamlit as st
from dotenv import load_dotenv
from pypdf import PdfReader

# --- LangChain / OpenAI ---
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.chat_models import ChatOllama   # ✅ works with your current setup

# ---------------------------
# Environment & page config
# ---------------------------
load_dotenv()
st.set_page_config(page_title="Medical Report Summarizer & Risk Flagger", layout="wide")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    st.warning("OPENAI_API_KEY not found in environment. Set it in a .env file or your shell.")

# ---------------------------
# Helpers: I/O & redaction
# ---------------------------
def extract_text_from_pdf(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)

RE_EMAIL = re.compile(r'\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b', re.I)
RE_PHONE = re.compile(r'\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b')
RE_SSN   = re.compile(r'\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b')

def quick_redact(text: str) -> str:
    text = RE_SSN.sub('[REDACTED-SSN]', text)
    text = RE_PHONE.sub('[REDACTED-PHONE]', text)
    text = RE_EMAIL.sub('[REDACTED-EMAIL]', text)
    return text

# ---------------------------
# Knowledge Base (KB) loader
# ---------------------------
def load_kb_docs(kb_glob_pattern: str = "kb/*"):
    docs = []
    for path in glob.glob(kb_glob_pattern):
        try:
            if path.lower().endswith(".pdf"):
                loader = PyPDFLoader(path)
            else:
                loader = TextLoader(path, encoding="utf-8")
            loaded = loader.load()
            # attach a source label
            for d in loaded:
                d.metadata["source"] = os.path.basename(path)
            docs.extend(loaded)
        except Exception as e:
            st.warning(f"Failed to load {path}: {e}")
    return docs

def build_retriever(docs, chunk_size=3000, chunk_overlap=400, k=8):
    if not docs:
        return None
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    chunks = splitter.split_documents(docs)
    emb = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vs = FAISS.from_documents(chunks, emb)
    return vs.as_retriever(search_kwargs={"k": k})

def format_docs(docs):
    if not docs:
        return "(no KB excerpts)"
    out = []
    for d in docs:
        src = d.metadata.get("source", "doc")
        page = d.metadata.get("page")
        tag = f"{src}" + (f":p{page}" if page is not None else "")
        out.append(f"[{tag}]\n{d.page_content}")
    return "\n\n---\n\n".join(out)

# ---------------------------
# LLM Prompt / Chain
# ---------------------------
SYSTEM_PROMPT = (
    "You are a clinical writing assistant for laypeople. "
    "Write at an 8th-grade reading level. "
    "Use clear, neutral language. "
    "Cite evidence using [source] tags from the provided context when relevant. "
    "Do NOT provide medical advice—only informational summaries."
)

HUMAN_PROMPT = """You will summarize the PATIENT REPORT and flag potential risks using the KNOWLEDGE BASE EXCERPTS as background.

PATIENT REPORT:
{patient_report}

KNOWLEDGE BASE EXCERPTS:
{kb_context}

REQUIREMENTS:
1) Write a 4–7 sentence lay summary under the heading:
### SUMMARY

2) Provide 3–8 concise bullet key findings (each with at least one [source] citation when relevant) under:
### KEY FINDINGS

3) Produce a compact JSON object under:
### RISKS
with the EXACT schema:
{{
  "risk_flags": [
    {{
      "category": "Abnormal lab|Critical condition|Medication risk|Allergy|Follow-up",
      "name": "string",
      "severity": "low|moderate|high",
      "evidence": [{{"source_id":"string", "quote":"short span"}}],
      "rationale": "one sentence lay explanation",
      "suggested_action": "one sentence (informational only)"
    }}
  ]
}}
Only include risks that are supported by the PATIENT REPORT. If none, return "risk_flags": [].

Be explicit about uncertainty when needed. Keep everything non-prescriptive and informational only.
"""

def make_chain():
    llm = ChatOllama(
        model=os.getenv("OLLAMA_MODEL", "llama3.2"),
        temperature=0.2,
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", HUMAN_PROMPT),
    ])

    # chain expects dict keys: patient_report, kb_context
    return prompt | llm

# ---------------------------
# Parse RISKS JSON from output
# ---------------------------
def extract_risks_block(full_text: str) -> str | None:
    """
    Grab everything after '### RISKS' and try to find a JSON object.
    """
    if not full_text:
        return None
    # Find the RISKS section
    m = re.search(r"###\s*RISKS\s*(.+)$", full_text, re.S | re.I)
    if not m:
        return None
    tail = m.group(1).strip()

    # Heuristic: find first JSON object
    start = tail.find("{")
    end = tail.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    return tail[start:end+1]

def parse_risks_json(full_text: str):
    blk = extract_risks_block(full_text)
    if not blk:
        return None, "No RISKS JSON block detected."
    try:
        data = json.loads(blk)
        if isinstance(data, dict) and "risk_flags" in data:
            return data, None
        return None, "RISKS JSON parsed but missing 'risk_flags' key."
    except json.JSONDecodeError as e:
        return None, f"JSON parse error: {e}"

# ---------------------------
# UI
# ---------------------------
st.title("Medical Report Summarizer & Risk Flagger (RAG MVP)")
st.caption("⚠️ Informational only. Not medical advice.")

# Sidebar: KB controls
with st.sidebar:
    st.header("Knowledge Base")
    st.write("Place PDFs / TXT files in the `kb/` folder next to this app.")
    kb_rebuild = st.button("Rebuild KB Index")
    st.markdown("---")
    st.write("Index settings")
    k_top = st.slider("KB top-k", min_value=3, max_value=12, value=8, step=1)

# Cache KB retriever in session
if "retriever" not in st.session_state or kb_rebuild:
    with st.spinner("Loading KB and building index…"):
        kb_docs = load_kb_docs("kb/*")
        st.session_state["kb_docs_count"] = len(kb_docs)
        st.session_state["retriever"] = build_retriever(kb_docs, k=k_top) if kb_docs else None

# Input panel
col1, col2 = st.columns(2)
with col1:
    st.subheader("Input")
    uploaded = st.file_uploader("Upload patient report PDF (optional)", type=["pdf"])
    raw_text = st.text_area("…or paste report text", height=260, placeholder="Paste the medical report here")
    if uploaded and not raw_text:
        raw_text = extract_text_from_pdf(uploaded.read())
    redact = st.checkbox("Redact obvious identifiers (prototype)", value=True)
    use_kb = st.checkbox("Use knowledge base context (RAG)", value=True)

with col2:
    st.subheader("Preview")
    if raw_text:
        preview = quick_redact(raw_text) if redact else raw_text
        st.text_area("Source preview (read-only)", value=preview[:8000], height=260)

run = st.button("Summarize & Flag Risks")

# Run pipeline
if run:
    if not raw_text:
        st.error("Please upload a PDF or paste text.")
        st.stop()

    patient_report = quick_redact(raw_text) if redact else raw_text

    # Build KB context
    kb_context = "(no KB excerpts)"
    if use_kb and st.session_state.get("retriever"):
        query = "medical risk flags, abnormal labs, critical conditions, medications, follow-up guidance relevant to this report"
        try:
            kb_docs = st.session_state["retriever"].invoke(query)
        except AttributeError:
            kb_docs = st.session_state["retriever"].get_relevant_documents(query)
        kb_context = format_docs(kb_docs)

    chain = make_chain()

    with st.spinner("Generating summary & risks…"):
        resp = chain.invoke({"patient_report": patient_report, "kb_context": kb_context})

    # Display
    if hasattr(resp, "content"):
        output_text = resp.content
    elif isinstance(resp, dict) and "content" in resp:
        output_text = resp["content"]
    else:
        output_text = str(resp)

    st.success("Done.")
    st.subheader("Summary & Findings")
    st.markdown(output_text)

    # Parse JSON risks into a neat panel
    risks_json, err = parse_risks_json(output_text)
    with st.expander("Parsed RISKS JSON"):
        if risks_json:
            st.json(risks_json)
        else:
            st.info("Could not parse RISKS JSON automatically.")
            if err:
                st.caption(err)

    # Show the raw KB context used
    with st.expander("Show KB excerpts used"):
        st.markdown(kb_context)

# Footer safety note
st.markdown("---")
st.caption("This tool is for educational/demo purposes only and does not provide medical advice.")
