# Branch map and integration decisions

This document records what existed in each branch and how this integration baseline
uses or preserves that work.

## Branch inventory

### main
- Initial scaffold only.

### Multimodal-Vision
- MedCLIP-oriented image/text similarity prototype.
- Preserved under `preserved/multimodal-vision/`.
- Not on the default runnable path.

### UI-design/Alex
- Basic CRA scaffold, limited product logic.
- Not selected as runnable base.

### UI-design/Suhaan
- Nice UI ideas + PDF extraction flow + backend prototype.
- Branch has many tracked env/artifact files.
- Key UI components preserved under `preserved/ui-design-suhaan/`.

### grounding-agent
- Safety/grounding validator prototypes using Anthropic.
- Preserved under `preserved/grounding-agent/`.
- Not wired into default runtime yet.

### swe
- Largest full-stack shell (frontend/backend/auth/doc management) with mixed maturity.
- Good visual and component work preserved under `preserved/swe/`.
- Not used as direct runtime base to avoid integration regressions.

### Suhaan/Rag-cleanup (unrelated history)
- Strong clean RAG baseline (FastAPI + React).
- Key architecture used to shape `apps/api` and `apps/web`.

### kevin/rag-pipeline (unrelated history)
- Most feature-rich RAG path (chat/report context/translation).
- Included large committed artifacts (datasets, FAISS binaries, node_modules) in branch history.
- Core logic extracted into clean structure without carrying tracked binary artifacts.

## Integration strategy used here

1. Build clean runnable app in `apps/api` + `apps/web`.
2. Extract RAG/chat workflow from strongest RAG branches.
3. Keep branch-specific UI/prototype assets in `preserved/` so no valuable work is lost.
4. Keep all existing branches untouched.

## What is still not fully production-complete

- Hardened auth/session integration on the default runtime path
- Managed document persistence and search indexing lifecycle
- Deployment stack (infra, observability, secrets rotation)
- End-to-end test coverage across API + web + model services
