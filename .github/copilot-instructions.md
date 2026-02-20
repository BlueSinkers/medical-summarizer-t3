# Medical RAG Project - Copilot Instructions

## Project Overview
This is a medical Retrieval-Augmented Generation (RAG) application with:
- **Backend**: Python FastAPI server using LangChain, FAISS vector store, and Ollama LLMs
- **Frontend**: React + Vite SPA with modern JavaScript/JSX
- **Purpose**: Summarize medical reports and answer questions using relevant knowledge base documents.

---

## General Principles

### Code Style
- **Readability First**: Prioritize clear, understandable code over cleverness
- **Consistency**: Match existing patterns in the codebase
- **Documentation**: Add comments for complex logic, especially in prompt engineering and data transformations
- **Type Safety**: Use type hints in Python, PropTypes or TypeScript types in React where applicable

### Architecture
- **Separation of Concerns**: Keep retrieval, LLM chains, and API routes cleanly separated
- **Modularity**: Each Python module should have a single, well-defined responsibility
- **Error Handling**: Always handle errors gracefully with informative messages

---

## Prompt Engineering Rules

### LLM Prompt Design
- **Clarity**: Use explicit instructions, avoid ambiguity
- **Structure**: Use clear section headers
- **Constraints**: Define what NOT to do (no invented diagnoses, no medical advice)

### Medical Domain Specifics
- **Layperson Language**: Target 8th-grade reading level
- **Neutral Tone**: Informational only, never diagnostic or prescriptive
- **Grounding**: All claims must cite the patient report

---

## Performance Considerations

### Backend
- Cache FAISS index in memory (don't rebuild on each request)
- Use async for I/O operations
- Limit retriever top_k to reasonable values (8-12)
- Monitor embedding model load time
