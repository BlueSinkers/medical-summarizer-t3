import os
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_community.chat_models import ChatOllama
from langchain_core.runnables import RunnableLambda

CHAT_SYSTEM = (
    "You are a careful clinical information assistant. "
    "Your PRIMARY source of truth is the PATIENT REPORT shown to you. "
    "Use the KB CONTEXT only for general background if needed, but never "
    "ignore or contradict the report. "
    "If the report does not contain the answer, say "
    "'Not enough information in the patient report.' "
    "Avoid giving medical advice; instead, explain what the report says "
    "in clear, neutral language for laypeople."
)

CHAT_HUMAN = """PATIENT REPORT:
{report}

KB CONTEXT:
{kb}

QUESTION:
{question}

Answer the question using the PATIENT REPORT as your main source.
If you use KB information to provide background, keep it clearly separate
from what is explicitly stated in the report.

- Cite the report with [REPORT] when you quote or rely on it.
- Cite KB sources like [KB:<id>] when you use KB context.
- If the report does not provide enough detail to answer, say so explicitly.
"""

def make_chat_chain(retriever=None, format_docs_fn=None):
    llm = ChatOllama(
        model=os.getenv("OLLAMA_MODEL", "llama3.2"),
        temperature=0.0,
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", CHAT_SYSTEM),
        ("human", CHAT_HUMAN),
    ])

    def retrieve_kb(inputs: dict) -> str:
        """
        inputs: {"question": str, "report": str | None}
        We use the QUESTION as the retrieval query.
        """
        if retriever is None or format_docs_fn is None:
            return "[KB:empty]\n(No relevant knowledge found.)"

        q = (inputs.get("question") or "").strip()
        if not q:
            return "[KB:empty]\n(No relevant knowledge found.)"

        try:
            docs = retriever.invoke(q)
        except AttributeError:
            docs = retriever.get_relevant_documents(q)

        return format_docs_fn(docs)

    kb_runnable = RunnableLambda(retrieve_kb)

    # Input to the chain will be a dict: {"question": ..., "report": ...}
    chain = (
        {
            "question": lambda x: x["question"],
            "report": lambda x: (x.get("report") or ""),
            "kb": kb_runnable,
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    return chain
