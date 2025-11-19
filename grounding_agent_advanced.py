import anthropic
import json
import os
from dataclasses import dataclass
from typing import Optional



# DATA STRUCTURE
@dataclass
class ValidationResult:
    """Result of validating an LLM response"""
    is_valid: bool                    # TRUE = response passes validation
    confidence: int                   # 0-100 = confidence in validation decision
    issues: list[str]                 # List of problems found
    corrections: Optional[str]        # Suggested fix (or None)
    safety_flags: list[str]          # Safety rules violated
    reasoning: str                    # Explanation of pass/fail


# MAIN VALIDATION FUNCTION - REGULAR VERSION (WITH API)
def validate_response(
    llm_response: str,
    conversation_history: list[dict],
    medical_report: str,
    use_api: bool = True,
    api_key: Optional[str] = None
) -> ValidationResult:
    """
    Validates an LLM response for hallucinations, safety, and medical accuracy.
    
    Args:
        llm_response: The LLM's response to validate
        conversation_history: Full conversation context
        medical_report: Original medical document (ground truth)
        use_api: If True, use Claude API. If False, use offline validation
        api_key: Optional API key (defaults to ANTHROPIC_API_KEY env var)
    
    Returns:
        ValidationResult with validation outcome
    """
    
    # NO API VERSION - Use offline validation
    if not use_api:
        return _offline_validation(llm_response, medical_report, conversation_history)
    
    # REGULAR VERSION - Use Claude API
    # Get API key from parameter or environment
    if api_key is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            print("[GROUNDING] No API key found. Falling back to offline validation.")
            return _offline_validation(llm_response, medical_report, conversation_history)
    
    # Initialize Anthropic client
    try:
        client = anthropic.Anthropic(api_key=api_key)
    except Exception as e:
        print(f"[GROUNDING] Failed to initialize API client: {e}")
        return _offline_validation(llm_response, medical_report, conversation_history)
    
    # Compress conversation history (last 5 messages)
    conversation_str = "\n".join(
        [f"{msg['role'].upper()}: {msg['content']}" for msg in conversation_history[-5:]]
    )
    
    # Build validation prompt
    grounding_prompt = f"""You are a medical safety validator. Validate this LLM response for:
1. Hallucinations (claims without support in context)
2. Medical accuracy issues
3. Safety concerns (inappropriate advice, dangerous recommendations)
4. Over-confident claims (presenting uncertainty as fact)

MEDICAL REPORT:
{medical_report}

CONVERSATION CONTEXT:
{conversation_str}

LLM RESPONSE TO VALIDATE:
{llm_response}

Respond ONLY with valid JSON:
{{
    "is_valid": true/false,
    "confidence": 0-100,
    "issues": ["issue1", "issue2"],
    "corrections": "corrected version or null",
    "safety_flags": ["flag1", "flag2"],
    "reasoning": "brief explanation"
}}

Be very STRICT about hallucinations.
"""
    
    # Call Claude API
    try:
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=1000,
            messages=[{"role": "user", "content": grounding_prompt}]
        )
        response_text = response.content[0].text
    except Exception as e:
        print(f"[GROUNDING] API call failed: {e}. Falling back to offline validation.")
        return _offline_validation(llm_response, medical_report, conversation_history)

    # Parse JSON response
    return _parse_validation_response(response_text)


# NO API VERSION - Offline validation using heuristics
def _offline_validation(
    llm_response: str,
    medical_report: str,
    conversation_history: list[dict]
) -> ValidationResult:
    """
    Validate without API calls using simple heuristics.
    Used when API is unavailable or use_api=False.
    """
    
    issues = []
    safety_flags = []
    
    # Check for dangerous keywords
    dangerous_keywords = [
        ("definitely has", "OVERCONFIDENT_DIAGNOSIS"),
        ("will definitely", "OVERCONFIDENT_DIAGNOSIS"),
        ("stop taking", "DANGEROUS_MEDICAL_ADVICE"),
        ("don't take", "DANGEROUS_MEDICAL_ADVICE"),
        ("cure", "CURE_CLAIM"),
        ("cured", "CURE_CLAIM"),
        ("ignore doctor", "CRITICAL_SAFETY"),
        ("don't seek medical help", "CRITICAL_SAFETY"),
    ]
    
    response_lower = llm_response.lower()
    report_lower = medical_report.lower()
    
    for keyword, flag in dangerous_keywords:
        if keyword in response_lower:
            issues.append(f"Contains dangerous keyword: '{keyword}'")
            safety_flags.append(flag)
    
    # Basic hallucination check (simple string matching)
    # Check if response mentions common conditions not in report
    common_conditions = ["diabetes", "cancer", "heart attack", "stroke"]
    for condition in common_conditions:
        if condition in response_lower and condition not in report_lower:
            issues.append(f"Mentions '{condition}' but not in medical report")
            safety_flags.append("POSSIBLE_HALLUCINATION")
    
    is_valid = len(issues) == 0
    confidence = 50 if is_valid else 30  # Lower confidence for offline (heuristic-based)
    
    return ValidationResult(
        is_valid=is_valid,
        confidence=confidence,
        issues=issues,
        corrections=None,
        safety_flags=safety_flags,
        reasoning="Offline validation using keyword matching (limited accuracy)"
    )


# HELPER: Parse Claude's JSON response
def _parse_validation_response(response_text: str) -> ValidationResult:
    """Parse Claude's JSON response into ValidationResult"""

    try:
        # Handle markdown code blocks
        if "```json" in response_text:
            json_str = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            json_str = response_text.split("```")[1].split("```")[0].strip()
        else:
            # Extract JSON from response (may have extra text after)
            json_str = response_text.strip()
            # Find the JSON object boundaries
            if json_str.startswith('{'):
                # Find matching closing brace
                brace_count = 0
                for i, char in enumerate(json_str):
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            json_str = json_str[:i+1]
                            break

        result_data = json.loads(json_str)
        
        return ValidationResult(
            is_valid=result_data.get("is_valid", False),
            confidence=result_data.get("confidence", 0),
            issues=result_data.get("issues", []),
            corrections=result_data.get("corrections"),
            safety_flags=result_data.get("safety_flags", []),
            reasoning=result_data.get("reasoning", "")
        )
    
    except json.JSONDecodeError as e:
        print(f"[GROUNDING] JSON parse error: {e}")
        return ValidationResult(
            is_valid=False,
            confidence=50,
            issues=["Validation parsing error"],
            corrections=None,
            safety_flags=["VALIDATION_ERROR"],
            reasoning="Could not parse validator response"
        )


# OUTPUT FORMATTING
def format_validation_report(result: ValidationResult) -> str:
    """Format validation result for display"""
    
    status = "[VALID]" if result.is_valid else "[INVALID]"
    
    issues_text = "\n".join(f"  - {issue}" for issue in result.issues) if result.issues else "  None"
    flags_text = "\n".join(f"  - {flag}" for flag in result.safety_flags) if result.safety_flags else "  None"
    correction_text = f"\nSuggested Correction:\n{result.corrections}" if result.corrections else ""
    
    report = f"""
VALIDATION REPORT
{status}
Confidence: {result.confidence}%

Issues Found: {len(result.issues)}
{issues_text}

Safety Flags: {len(result.safety_flags)}
{flags_text}

Reasoning:
{result.reasoning}
{correction_text}
"""
    return report

#Test