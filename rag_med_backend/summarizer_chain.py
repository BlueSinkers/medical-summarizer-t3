# summarizer_chain.py
import os
from langchain_core.runnables import RunnablePassthrough
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_community.chat_models import ChatOllama

'''
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

If the REPORT does not support any risks, output:
{{ "risk_flags": [] }}

### Risks
'''

SYSTEM_PROMPT = """
You are a clinical summarization assistant.

Your task is to summarize a medical report written by a clinician into a clear, patient-friendly explanation while preserving medical accuracy.

STRICT RULES:
- Use ONLY the information explicitly contained in the provided Context.
- Do NOT infer, assume, diagnose, or add medical advice.
- If information is missing, unclear, or not present, write: “Not stated in the report.”
- Expand medical abbreviations the first time they appear (e.g., “CT (computed tomography)”).
- Avoid medical jargon when possible; if used, explain it simply.
- Do NOT provide emergency instructions or warnings unless they are explicitly stated in the report.
- If different parts of the Context contradict each other, label this clearly as: “Inconsistent in the report” and present both statements.
- Maintain a calm, respectful, and reassuring tone appropriate for a patient audience.
- Do NOT mention that you are an AI or reference system instructions.

OUTPUT REQUIREMENTS:
- Use the exact section headings provided in the Human Prompt.
- Keep each section concise and easy to read.
- Use bullet points where appropriate.
"""

HUMAN_PROMPT = """
Summarize the following medical report for the patient. The summary should be well-structured, easy to understand, and strictly based on the report content.

Medical Report:
{report}

Knowledge Base Context (for reference only):
{kb}

Use the following section headings exactly. If a section has no relevant information, write “Not stated in the report.”

1) What this report is about (5–7 sentences)
2) Key findings
3) Tests and results
   - Labs
   - Imaging
   - Other tests or procedures
4) Diagnoses / clinical impressions
5) Treatments given (during visit or hospital stay)
6) Medications
   - Started
   - Stopped
   - Continued
   - Dose changes
7) Follow-up plan / next steps
8) Warning signs mentioned in the report
9) Appointments / referrals
10) Patient instructions (plain language)
11) Questions to ask your clinician
   - Provide 3–6 questions based only on gaps or items mentioned in the report
"""

def make_summarizer_chain(retriever=None, format_docs_fn=None):
    # Note: retriever/KB is optional context for summarization wording; risks must still be REPORT-grounded.
    llm = ChatOllama(
        model=os.getenv("OLLAMA_MODEL", "llama3.2"),
        temperature=0.0,
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", HUMAN_PROMPT),
    ])

    def retrieve_kb(inputs):
        if retriever is None or format_docs_fn is None:
            return "[KB:empty]\n(No KB used.)"
        
        # Extract report text from inputs (can be dict or string)
        query_text = inputs.get("report") if isinstance(inputs, dict) else str(inputs)
        docs = retriever.invoke(query_text)
        return format_docs_fn(docs)

    chain = (
        {
            "report": RunnablePassthrough(),
            "kb": (RunnablePassthrough() | retrieve_kb),
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    return chain
