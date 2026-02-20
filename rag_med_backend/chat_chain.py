import os
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_community.chat_models import ChatOllama
from langchain_core.runnables import RunnableLambda

# ensure history of chat is preserved in context window

CHAT_SYSTEM = (
    "You are a careful clinical information assistant. "
    "The PATIENT REPORT is your primary source; use KB CONTEXT only for general background. "
    "Never contradict the report. "
    "Avoid giving medical advice; explain report contents in clear, neutral language for laypeople."
)

CHAT_HUMAN = """
PATIENT REPORT:
{report}

KB CONTEXT:
{kb}

QUESTION:
{question}

Instructions:
- Cite the report with [REPORT] when you quote or rely on it.
- Cite KB sources like [KB:<id>] when you use KB context.
- If the report lacks sufficient detail, state this explicitly.
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

        question = (inputs.get("question") or "").strip()
        if not question:
            return "[KB:empty]\n(No relevant knowledge found.)"

        docs = retriever.invoke(question)
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
