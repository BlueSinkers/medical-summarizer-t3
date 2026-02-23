import os

from langchain_community.chat_models import ChatOllama
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda

CHAT_SYSTEM = (
    "You are a careful clinical information assistant. "
    "The patient report is your primary source. Use KB context only as secondary support. "
    "Never provide direct medical advice."
)

CHAT_HUMAN = """
PATIENT REPORT:
{report}

KB CONTEXT:
{kb}

QUESTION:
{question}

Instructions:
- Cite report-grounded statements with [REPORT].
- Cite retrieved context with [KB:<id>] when used.
- If details are missing, state that clearly.
"""


def make_chat_chain(retriever=None, format_docs_fn=None):
    llm = ChatOllama(
        model=os.getenv("OLLAMA_MODEL", "llama3.2"),
        temperature=0.0,
    )

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", CHAT_SYSTEM),
            ("human", CHAT_HUMAN),
        ]
    )

    def retrieve_kb(inputs: dict) -> str:
        if retriever is None or format_docs_fn is None:
            return "[KB:empty]\n(No relevant knowledge found.)"
        question = (inputs.get("question") or "").strip()
        if not question:
            return "[KB:empty]\n(No relevant knowledge found.)"
        docs = retriever.invoke(question)
        return format_docs_fn(docs)

    kb_runnable = RunnableLambda(retrieve_kb)

    chain = (
        {
            "question": lambda x: x.get("question", ""),
            "report": lambda x: (x.get("report") or ""),
            "kb": kb_runnable,
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    return chain
