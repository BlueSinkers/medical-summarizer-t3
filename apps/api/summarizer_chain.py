import os

from langchain_community.chat_models import ChatOllama
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda

SYSTEM_PROMPT = """
You are a careful clinical summarization assistant.

Rules:
- Use only the provided report and KB context.
- Prefer the report over KB when they differ.
- Do not provide diagnosis or medical advice.
- If something is not in the report, say "Not stated in the report."
- Keep language clear and patient-friendly.
"""

HUMAN_PROMPT = """
PATIENT REPORT:
{report}

KB CONTEXT:
{kb}

Create a concise response with these sections:

### SUMMARY
- 5-8 sentences in plain language.

### KEY FINDINGS
- Bullet points grounded in the report.

### FOLLOW-UP POINTS
- Bullet points of next-step items explicitly present in the report.
"""


def make_summarizer_chain(retriever=None, format_docs_fn=None):
    llm = ChatOllama(
        model=os.getenv("OLLAMA_MODEL", "llama3.2"),
        temperature=0.0,
    )

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            ("human", HUMAN_PROMPT),
        ]
    )

    def retrieve_kb(inputs: dict) -> str:
        if retriever is None or format_docs_fn is None:
            return "[KB:empty]\n(No KB used.)"
        report = (inputs.get("report") or "").strip()
        if not report:
            return "[KB:empty]\n(No KB used.)"
        docs = retriever.invoke(report)
        return format_docs_fn(docs)

    kb_runnable = RunnableLambda(retrieve_kb)

    chain = (
        {
            "report": lambda x: x.get("report", ""),
            "kb": kb_runnable,
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    return chain
