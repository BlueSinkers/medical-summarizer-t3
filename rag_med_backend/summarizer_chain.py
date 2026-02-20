# summarizer_chain.py
import os
from langchain_core.runnables import RunnablePassthrough
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_community.chat_models import ChatOllama

SYSTEM_PROMPT = (
    "You are a clinical writing assistant for laypeople. "
    "Write at an 8th-grade reading level in clear, neutral language. "
    "You must ground all statements in the provided REPORT and (if relevant) KB context. "
    "If information is missing or not supported, reply with 'Not enough information.' "
    "Never invent diagnoses or facts. Never provide medical advice—only informational summaries."
)

# IMPORTANT: All literal braces are escaped as {{ }}
HUMAN_PROMPT = """Summarize the PATIENT REPORT and flag potential risks. Use KB only for general background if needed, but all risks must be supported directly by the REPORT.

REPORT (primary source):
{report}

KB CONTEXT (supporting, may be empty):
{kb}

===================== OUTPUT RULES =====================

1) SUMMARY (4–7 sentences)
- Describe symptoms, key findings, and main concerns.
- Do NOT add diagnoses not explicitly stated in the REPORT.
- Use plain language for a layperson.

2) KEY FINDINGS (3–8 bullets)
- Every bullet must end with a citation tag: [REPORT] only.
- DO NOT create new source labels such as LABS, IMAGING, PHYSICAL EXAM.
- All findings come from the REPORT text itself.

3) RISKS (return a JSON object)
Return EXACTLY this structure (no extra commentary outside the JSON):

{{
  "risk_flags": [
    {{
      "category": "Abnormal lab" | "Cardiac concern" | "Follow-up needed",
      "name": "short descriptive label",
      "severity": "low" | "moderate" | "high",
      "evidence": [
        {{"source_id":"REPORT", "quote":"short exact quote from REPORT (preserve original spacing)"}}
      ],
      "rationale": "1 sentence lay explanation",
      "suggested_action": "see SUGGESTED ACTION RULES"
    }}
  ]
}}

===================== SEVERITY GUIDANCE =====================
- Use **moderate** for findings that suggest strain or early disease but are not emergencies.
- Use **high** only for acute danger (e.g., chest pain at rest, syncope, respiratory distress).
- Use **low** for risk factors without an immediate concern.

===================== CITATION RULE =====================
ALL evidence must use: "source_id": "REPORT".
No other source labels are allowed.

===================== SUGGESTED ACTION RULES =====================
- If there is a relevant action in the REPORT's Plan section, the value of "suggested_action" must be a **verbatim snippet (≤15 words)** copied from the Plan text (preserve wording).
- If NO relevant action is present in the Plan, use this exact fallback:
  "Follow the provider's plan and scheduled follow-up."

Examples of acceptable verbatim snippets (if present in the Plan):
- "Schedule echocardiogram to evaluate ejection fraction and valve function."
- "Low-sodium, Mediterranean-style diet"
- "Walk 30 minutes daily, 5 days/week"
- "Refer to Cardiology."
(Do NOT invent medication changes or plans that are not explicitly stated. Do NOT repurpose a BP med adjustment for a lipid risk.)

If the REPORT does not support any risks, output:
{{ "risk_flags": [] }}

===========================================================
Return exactly the three sections in order with these headings:
### SUMMARY
### KEY FINDINGS
### RISKS
"""

def make_summarizer_chain(retriever=None, format_docs_fn=None):
    # Note: retriever/KB is optional context for summarization wording; risks must still be REPORT-grounded.
    llm = ChatOllama(
        model=os.getenv("OLLAMA_MODEL", "llama3.2"),
        temperature=0.0,
    )

    def get_kb(query_text: str):
        if retriever is None or format_docs_fn is None:
            return "[KB:empty]\n(No KB used.)"
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
