import os

from langchain_core.runnables import RunnablePassthrough  # (kept in case you use it later)
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_ollama import ChatOllama


def make_chain(retriever):
    llm = ChatOllama(model=os.getenv("OLLAMA_MODEL", "llama3.2"), temperature=0.2)

    prompt = ChatPromptTemplate.from_messages([
        ("system", "You summarize medical reports for a non-expert. 8th-grade level. No medical advice."),
        ("human", """Summarize + flag risks.

CONTEXT:
{context}

REQUIRE:
- 4–7 sentence summary
- 3–8 key findings with [source] citations
- JSON risk_flags list

Return formatted as:

### SUMMARY
...
### KEY FINDINGS
...
### RISKS
{{json}}
""")
    ])

    def format_docs(docs):
        return "\n\n---\n\n".join(
            f"[{d.metadata.get('source','doc')}]\n{d.page_content}"
            for d in docs
        )

    chain = (
        {"context": retriever | format_docs}
        | prompt
        | llm
        | StrOutputParser()
    )

    return chain
