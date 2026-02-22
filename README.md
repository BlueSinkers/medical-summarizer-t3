# Medical Summarizer T3

This repository now contains a clean, runnable integration baseline for a medical report
summarizer with chat support, while preserving valuable branch work from prior prototypes.

## What you get right now

- Runnable **web app** with:
  - a place to paste medical report text
  - summary generation
  - chatbot-style Q&A against report + optional KB retrieval context
  - translation endpoint integration (optional model-backed feature)
- Runnable **API backend** (FastAPI) with:
  - `/health`
  - `/summarize`
  - `/chat`
  - `/translate`
  - optional FAISS-based KB indexing and retrieval
- Preserved UI/prototype assets from other branches under `preserved/` so nothing useful is lost.

## Repository structure

```text
.
├── apps
│   ├── api                # FastAPI backend (RAG + chat + translation)
│   └── web                # Vite React frontend
├── docs
│   └── BRANCH_MAP.md      # branch inventory + integration decisions
├── preserved              # valuable branch components and prototypes kept intact
├── .env.example
├── .gitignore
└── Makefile
```

## Quick start

### 1) Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r apps/api/requirements.txt
cd apps/api
uvicorn server:app --reload --port 8000
```

### 2) Frontend

In a separate terminal:

```bash
cd apps/web
npm install
npm run dev
```

Open: `http://localhost:5173`

## Environment setup

Copy `.env.example` to `.env` (root or `apps/api`) and adjust as needed.

Default behavior is designed to stay runnable:

- If Ollama is not reachable, summarize/chat fall back to a safe mock response mode.
- If KB files are missing, the app still runs in report-first mode.

## Notes on full-stack scope

This baseline intentionally focuses on the core medical summarizer + chatbot loop.
Enterprise-style additions such as robust auth/session persistence, production-grade
document storage, and hardened deployment are not fully wired into the runnable path yet.
See `docs/BRANCH_MAP.md` for exact branch status and preserved work.
