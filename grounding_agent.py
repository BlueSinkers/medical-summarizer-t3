import anthropic
import json
from dataclasses import dataclass
from typing import Optional

@dataclass
class ValidationResult:
    """Result of validating an LLM response"""
    is_valid: bool
    confidence: float  # 0.0 to 1.0
    issues: list[str]
    corrections: Optional[str]
    safety_flags: list[str]
    reasoning: str


def validate_response(
    llm_response: str,
    conversation_history: list[dict],
    medical_report: str,
    rag_context: Optional[str] = None,
    api_key: Optional[str] = None
) -> ValidationResult:
    """
    Validates an LLM response for hallucinations, safety issues, and medical accuracy.
    
    Args:
        llm_response: The LLM's generated response to validate
        conversation_history: List of dicts with 'role' and 'content' keys
        medical_report: The original medical report being analyzed
        rag_context: Retrieved context from medical knowledge base (optional)
        api_key: Anthropic API key (loads from env if not provided)
    
    Returns:
        ValidationResult with validation details
    """
    
    client = anthropic.Anthropic(api_key=api_key)
    
    # Format conversation history for the prompt
    conversation_str = "\n".join(
        [f"{msg['role'].upper()}: {msg['content']}" for msg in conversation_history[-5:]]  # Last 5 messages to save tokens
    )
    
    # Build the grounding prompt
    grounding_prompt = f"""You are a medical safety validator. Your job is to validate an LLM's response for:
                        1. Hallucinations (claims without support in the provided context)
                        2. Medical accuracy issues
                        3. Safety concerns (inappropriate medical advice, dangerous recommendations)
                        4. Over-confident claims (presenting uncertainty as fact)
                        MEDICAL REPORT:
                        {medical_report}

                        CONVERSATION CONTEXT:
                        {conversation_str}

                        {"RAG CONTEXT (Medical Knowledge Base):" + rag_context if rag_context else ""}

                        LLM RESPONSE TO VALIDATE:
                        {llm_response}

                        Analyze this response carefully. Respond ONLY with valid JSON in this exact format:
                        {{
                            "is_valid": true/false,
                            "confidence": 0.0-1.0,
                            "issues": ["issue1", "issue2"],
                            "corrections": "corrected version or null if none needed",
                            "safety_flags": ["flag1", "flag2"],
                            "reasoning": "brief explanation of validation"
                        }}

                        Be strict about hallucinations. If claims aren't grounded in the provided context, flag them.
                        """
    
    response = client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=1000,
        messages=[
            {
                "role": "user",
                "content": grounding_prompt
            }
        ]
    )
    
    # Parse the response
    response_text = response.content[0].text
    
    # Try to extract JSON from response
    try:
        # Handle potential markdown code blocks
        if "```json" in response_text:
            json_str = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            json_str = response_text.split("```")[1].split("```")[0].strip()
        else:
            json_str = response_text
            
        result_data = json.loads(json_str)
        
        return ValidationResult(
            is_valid=result_data.get("is_valid", False),
            confidence=result_data.get("confidence", 0.0),
            issues=result_data.get("issues", []),
            corrections=result_data.get("corrections"),
            safety_flags=result_data.get("safety_flags", []),
            reasoning=result_data.get("reasoning", "")
        )
    except json.JSONDecodeError as e:
        print(f"Failed to parse validation response: {e}")
        print(f"Response was: {response_text}")
        # Return a conservative "invalid" result if parsing fails
        return ValidationResult(
            is_valid=False,
            confidence=0.5,
            issues=["Validation parsing error"],
            corrections=None,
            safety_flags=["VALIDATION_ERROR"],
            reasoning="Could not parse validator response"
        )


def format_validation_report(result: ValidationResult) -> str:
    """Format validation result for display"""
    status = "✓ VALID" if result.is_valid else "✗ INVALID"
    
    report = f"""
VALIDATION REPORT
{status}
Confidence: {result.confidence:.1%}

Issues Found: {len(result.issues)}
{chr(10).join(f"  - {issue}" for issue in result.issues) if result.issues else "  None"}

Safety Flags: {len(result.safety_flags)}
{chr(10).join(f"  - {flag}" for flag in result.safety_flags) if result.safety_flags else "  None"}

Reasoning:
{result.reasoning}

{'Suggested Correction:' + chr(10) + result.corrections if result.corrections else ""}
"""
    return report


# Example usage
if __name__ == "__main__":
    # Mock data for testing
    medical_report = """
    Patient: John Doe
    Date: 2024-11-08
    Test: Blood Work
    
    Results:
    - Glucose: 105 mg/dL (normal: 70-100)
    - Cholesterol: 220 mg/dL (high: >200 concerning)
    - HDL: 35 mg/dL (low: <40 is risk factor)
    - LDL: 150 mg/dL (high: >130 is high)
    """
    
    conversation = [
        {"role": "user", "content": "What does my blood work show?"},
        {"role": "assistant", "content": "Your blood work shows slightly elevated glucose..."},
        {"role": "user", "content": "Should I be worried about my cholesterol?"}
    ]
    
    llm_response = "Your cholesterol of 220 is elevated. You should start taking medication immediately and cut out all fats from your diet. This indicates you will definitely have a heart attack within 5 years."
    
    rag_context = """
    Elevated cholesterol (>200) is a risk factor for heart disease but not a diagnosis. 
    Treatment typically starts with lifestyle changes (diet, exercise) before medication.
    Individual risk depends on many factors including HDL/LDL ratios, family history, age, and other comorbidities.
    """
    
    print("Testing Grounding Agent...")
    result = validate_response(
        llm_response=llm_response,
        conversation_history=conversation,
        medical_report=medical_report,
        rag_context=rag_context
    )
    
    print(format_validation_report(result))