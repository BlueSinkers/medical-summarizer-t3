import os
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

def check_for_hallucinations(llm_response, source_documents, user_query):
    """
    Simple grounding agent using Claude
    """
    
    grounding_prompt = f"""You are a medical grounding agent. Your job is to check if the AI's response is accurate and safe.

USER'S QUESTION:
{user_query}

AI'S RESPONSE TO CHECK:
{llm_response}

SOURCE DOCUMENTS:
{source_documents}

Analyze if the AI's response:
1. Makes claims NOT supported by the source documents (hallucinations)
2. Contains medical safety concerns
3. Contradicts the source material

Respond in this format:
HALLUCINATION_DETECTED: [Yes/No]
SAFETY_CONCERNS: [List any concerns, or "None"]
CONTRADICTIONS: [List any contradictions, or "None"]
CONFIDENCE: [0.0-1.0]
EXPLANATION: [Brief explanation]
"""

    # Call Claude to do the grounding check
    message = client.messages.create(
        model="claude-3-5-haiku-20241022",  # Cheapest and fastest Claude model
        max_tokens=1024,
        messages=[
            {"role": "user", "content": grounding_prompt}
        ],
        temperature=0.0  # Low temperature for consistent validation
    )
    
    return message.content[0].text


# Test it out
if __name__ == "__main__":
    user_query = "What does my blood test show?"
    
    llm_response = """Your blood test shows elevated white blood cell count at 15,000 cells/μL, 
    which is above the normal range. This could indicate an infection or inflammation."""
    
    source_docs = """Blood Test Results:
    - White Blood Cells: 15,000 cells/μL (Normal: 4,000-11,000)
    - Red Blood Cells: Normal
    - Platelets: Normal"""
    
    result = check_for_hallucinations(llm_response, source_docs, user_query)
    print(result)