# API (FastAPI)

This service provides:

- `GET /health`
- `POST /summarize`
- `POST /chat`
- `POST /translate`

## Run

```bash
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

## KB behavior

By default, KB indexing looks at `sample_kb/*` and builds FAISS metadata under
`faiss_index/` (local, ignored in git).

If there are no files or indexing fails, summarize/chat still work in report-first mode.

## Environment

See root `.env.example` for settings.
