# Grounding Agent - Integration Guide

## Overview

The grounding agent validates LLM responses for:
- **Hallucinations**: Claims not supported by provided context
- **Medical Safety**: Dangerous or inappropriate medical advice
- **Accuracy**: Factual errors relative to medical report + RAG context
- **Confidence Issues**: Presenting uncertainty as fact

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     LLM Response                            │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│            GROUNDING AGENT (validate_response)              │
├─────────────────────────────────────────────────────────────┤
│ Inputs:                                                     │
│ • llm_response: str                                         │
│ • conversation_history: List[Dict]                          │
│ • medical_report: str (original document)                   │
│ • rag_context: Optional[str] (retrieved medical knowledge)  │
└────────────────────────┬────────────────────────────────────┘
                         │
                    Calls Claude
                  (claude-3-5-haiku)
                         │
┌────────────────────────▼────────────────────────────────────┐
│            ValidationResult (Structured Output)             │
├─────────────────────────────────────────────────────────────┤
│ • is_valid: bool                                            │
│ • confidence: float (0.0-1.0)                               │
│ • issues: List[str]                                         │
│ • corrections: Optional[str]                                │
│ • safety_flags: List[str]                                   │
│ • reasoning: str                                            │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Set up your API key

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 2. Basic usage

```python
from grounding_agent import validate_response, format_validation_report

# Your data
medical_report = "Patient blood work shows..."
conversation = [
    {"role": "user", "content": "What do my results mean?"},
    {"role": "assistant", "content": "..."}
]
llm_response = "Your test shows..."
rag_context = "Normal glucose range is 70-100 mg/dL..."

# Validate
result = validate_response(
    llm_response=llm_response,
    conversation_history=conversation,
    medical_report=medical_report,
    rag_context=rag_context
)

# Display results
print(format_validation_report(result))

# Or use the structured data
if not result.is_valid:
    print(f"Issues: {result.issues}")
    if result.corrections:
        print(f"Corrected version: {result.corrections}")
```

### 3. Integration with your RAG + summarization pipeline

```python
from grounding_agent import validate_response

class MedicalSummarizer:
    def __init__(self, rag_system, llm_client):
        self.rag = rag_system
        self.llm = llm_client
        
    def process_medical_report(self, report: str, conversation: list):
        # 1. Generate summary
        summary = self.llm.generate_summary(report, conversation)
        
        # 2. Retrieve medical context via RAG
        rag_context = self.rag.retrieve(summary)
        
        # 3. VALIDATE with grounding agent
        validation = validate_response(
            llm_response=summary,
            conversation_history=conversation,
            medical_report=report,
            rag_context=rag_context
        )
        
        # 4. Return based on validity
        if validation.is_valid:
            return {"status": "approved", "content": summary}
        else:
            if validation.corrections:
                return {"status": "corrected", "content": validation.corrections}
            else:
                return {"status": "rejected", "issues": validation.issues}
```

## Token Budget Strategy

Currently uses **~700-1000 tokens per validation** (Haiku is very efficient).

### To optimize further:

1. **Conversation Truncation** (already implemented)
   - Only sends last 5 messages instead of full history
   - Trade-off: May miss earlier context

2. **Selective Context Inclusion**
   ```python
   # Option: Only include relevant RAG chunks
   relevant_rag = filter_rag_chunks(rag_context, llm_response)
   ```

3. **Batch Validation**
   - Instead of validating after each response, batch every N responses
   - Good for iterative conversations

4. **Caching**
   - Cache validation results for similar responses
   - Implement LRU cache for repeated claims

## Key Design Decisions

### Why Haiku?
- Fast inference (~2-3s for validation)
- Low cost (~$0.80 per 1M input tokens)
- Sufficient reasoning for safety validation
- Can upgrade to Sonnet if validation accuracy needs improvement

### Why JSON output?
- Structured, parseable results
- Easy integration with frontend/backend
- Clear distinction between validation layers

### Why limit conversation to last 5 messages?
- Token efficiency (3-5 messages = ~300-500 tokens)
- Recent context is most relevant for validation
- Can adjust based on your token budget

## Common Integration Points

### With FastAPI backend:
```python
@app.post("/validate")
async def validate_endpoint(request: ValidationRequest):
    result = validate_response(
        llm_response=request.response,
        conversation_history=request.history,
        medical_report=request.report,
        rag_context=request.rag_context
    )
    return result.dict()
```

### With streaming responses:
```python
# Collect full response, then validate
full_response = ""
for chunk in llm_stream(...):
    full_response += chunk
    # ... send to frontend

# After streaming complete:
validation = validate_response(...)
```

## Future Improvements

1. **Multi-turn validation** - Validate chains of reasoning
2. **Citation tracking** - Track which claims come from which sources
3. **Confidence thresholds** - Auto-reject if confidence too low
4. **Fine-tuning** - Fine-tune on medical validation examples
5. **Hierarchical RAG** - Use retrieved docs directly in validation
6. **Async validation** - Validate multiple responses in parallel

## Testing

The file includes a test case at the bottom showing:
- A medical report with realistic blood work results
- A dangerous LLM response (over-confident, prescriptive)
- Expected validation to catch the issues

Run it with:
```bash
export ANTHROPIC_API_KEY="your-key-here"
python grounding_agent.py
```

## Questions for refinement:

1. **Correction strategy**: Should the validator suggest corrections, or just flag issues and let your summarizer retry?
2. **Confidence threshold**: What's your minimum acceptable confidence?
3. **Safety strictness**: Medical domain = high stakes. Want to be conservative (reject more) or permissive (approve more)?
4. **Conversation length**: 5 messages enough? Want full history?