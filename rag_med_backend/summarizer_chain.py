# summarizer_chain.py
import os
from langchain_core.runnables import RunnablePassthrough
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_ollama import ChatOllama

SYSTEM_PROMPT = (
    "You are a clinical writing assistant for laypeople. "
    "Write at an 8th-grade reading level in clear, neutral language. "
    "All summaries should be simple, human-readable, and contain plain text bullets and headings. "
    "Never include Markdown, JSON, or special symbols. "
    "Ground all statements in the provided REPORT and (if relevant) KB context. "
    "If information is missing or not supported, reply with 'Not enough information.'"
)

HUMAN_PROMPT = """Summarize the PATIENT REPORT and flag potential risks in a plain-language format for non-technical readers.

REPORT (primary source):
{report}

KB CONTEXT (supporting, may be empty):
{kb}

OUTPUT FORMAT RULES:
1) SUMMARY: 4–7 sentences, describing symptoms, key findings, and main concerns.
2) KEY FINDINGS: Use short, simple bullet points. Each must be supported by the report.
3) RISKS / CONCERNS: Use short, plain-language bullets. Include the reason it's a concern and any actions mentioned in the report.

Do not use JSON, Markdown symbols, hashtags, or asterisks. Headings should be clear and readable. Bullets should be short and simple.
Example format:

SUMMARY
-------
The patient is a [age]-year-old [gender] with [chief symptoms]. [Additional key details].

KEY FINDINGS
------------
- [Key finding 1 from report]
- [Key finding 2 from report]

RISKS / CONCERNS
----------------
- [Risk 1: plain explanation. Suggested action if present in the report.]
- [Risk 2: plain explanation. Suggested action if present in the report.]
"""

def make_summarizer_chain(retriever=None, format_docs_fn=None):
    """
    Create a summarizer chain that returns plain-language summaries with clear headings and bullets.
    """
    llm = ChatOllama(
        model=os.getenv("OLLAMA_MODEL", "llama3.2"),
        temperature=0.0,
    )

    def get_kb(query_text: str):
        if retriever is None or format_docs_fn is None:
            return "[KB:empty] (No KB used.)"
        try:
            docs = retriever.invoke(query_text)
        except AttributeError:
            docs = retriever.get_relevant_documents(query_text)
        return format_docs_fn(docs)

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", HUMAN_PROMPT),
    ])

    chain = (
        {
            "report": RunnablePassthrough(),
            "kb": (RunnablePassthrough() | get_kb),
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    return chain