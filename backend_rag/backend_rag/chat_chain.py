import os
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_community.chat_models import ChatOllama
from langchain_core.runnables import RunnableLambda

CHAT_SYSTEM = (
    "You are a careful clinical information assistant. "
    "Answer questions using ONLY the retrieved KB context. "
    "If the answer is not in KB, say 'Not enough information in the KB.' "
    "Avoid medical advice; provide neutral, informational answers for laypeople."
)

CHAT_HUMAN = """Question:
{question}

KB CONTEXT:
{kb}

Answer with short paragraphs and cite sources like [KB:<id>] when relevant."""

def make_chat_chain(retriever, format_docs_fn):
    llm = ChatOllama(model=os.getenv("OLLAMA_MODEL", "llama3.2"), temperature=0.0)
    prompt = ChatPromptTemplate.from_messages([
        ("system", CHAT_SYSTEM),
        ("human", CHAT_HUMAN),
    ])

    def retrieve_kb(q: str):
        if retriever is None or format_docs_fn is None:
            return "[KB:empty]\n(No relevant knowledge found.)"
        try:
            docs = retriever.invoke(q)
        except AttributeError:
            docs = retriever.get_relevant_documents(q)
        return format_docs_fn(docs)

    identity = RunnableLambda(lambda x: x)

    chain = (
        {
            "question": identity,
            "kb": identity | RunnableLambda(retrieve_kb),
        }
        | prompt
        | llm
        | StrOutputParser()
    )
    return chain