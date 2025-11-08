import anthropic
import json
from dataclasses import dataclass
from typing import Optional

# Ability to Turn off Grounding Agent
# What Happens when we have no internet?
# What Happens if we have a shit computer?

# Be Aware of "Web Research API"
# Security?
# Gemanai ADK 
# RLHF 

# Gitignore .env file


# Part 1: DATA STRUCTURE

# This dataclass defines the OUTPUT FORMAT of the grounding agent
# It standardizes what information gets returned after validation
# Why: Makes the result easy to work with and type-safe
@dataclass
class ValidationResult:
    """Result of validating an LLM response"""
    is_valid: bool                          # TRUE = response passes validation, FALSE = fails
    confidence: float                       # 0.0-1.0 = how confident the validator is in its decision
    issues: list[str]                       # List of specific problems found (hallucinations, safety issues, etc)
    corrections: Optional[str]              # If invalid, this contains a suggested fixed version (or None)
    safety_flags: list[str]                 # Specific safety categories triggered (e.g., "OVER_CONFIDENT", "UNSAFE_MEDICAL_ADVICE")
    reasoning: str                          # Human-readable explanation of WHY it passed/failed



# SECTION 2: MAIN VALIDATION FUNCTION DEF
# This is the core component that does all the work
def validate_response(
    llm_response: str,                      # INPUT: The LLM's answer we're checking
    conversation_history: list[dict],       # INPUT: Full conversation so far (for context)
    medical_report: str,                    # INPUT: Original medical document (ground truth)
    rag_context: Optional[str] = None,      # INPUT: Retrieved medical knowledge (secondary ground truth)
    api_key: Optional[str] = None           # INPUT: Optional API key (defaults to env var if not provided)
)   -> ValidationResult:
    
    
    
    client = anthropic.Anthropic(api_key=api_key)
    
    

    # STEP 2: CONVERSATION HISTORY COMPRESSION
   
    # PROBLEM THIS SOLVES: Full conversation history = tons of tokens = expensive + slow
    # SOLUTION: Only include last 5 messages (not full history)
    # WHY LAST 5?: Recent context is usually most relevant for validation
    # TRADEOFF: Might miss early context from longer conversations
    conversation_str = "\n".join(
        [f"{msg['role'].upper()}: {msg['content']}" for msg in conversation_history[-5:]]
    )
    # Example output:
    # USER: What does my blood work show?
    # ASSISTANT: Your results show...
    # USER: Should I be worried?
    
    
    
    # STEP 3: BUILD THE VALIDATION PROMPT
    
    # This is the INSTRUCTION given to Claude about what to do
    # It tells Claude to:
    # 1. Act as a medical safety validator
    # 2. CHECK for 4 specific problems
    # 3. RESPOND in JSON format
    # 4. BE STRICT about hallucinations
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
    
    
    
    # STEP 4: Call Claude AIP
    response = client.messages.create(
        model="claude-3-5-haiku-20241022",  # Using Haiku = fast + cheap (good for validation)
        max_tokens=1000,                    # Limit output length (validation doesn't need to be long)
        messages=[
            {
                "role": "user",
                "content": grounding_prompt
            }
        ]
    )
    
    
    # STEP 5: EXTRACT TEXT FROM RESPONSE

    # Claude returns a Message object, we need just the text content
    response_text = response.content[0].text
    # Example: '{"is_valid": true, "confidence": 0.95, ...}'
    


    # Currently Working on RN
    
    # STEP 6: PARSE JSON & HANDLE ERRORS

    # PROBLEM: Claude might return JSON wrapped in markdown code blocks
    # SOLUTION: Try multiple extraction strategies
    # FALLBACK: If parsing fails, return conservative "INVALID" result
    try:
        # STRATEGY 1: Check for ```json code blocks
        if "```json" in response_text:
            json_str = response_text.split("```json")[1].split("```")[0].strip()
        # STRATEGY 2: Check for generic ``` code blocks
        elif "```" in response_text:
            json_str = response_text.split("```")[1].split("```")[0].strip()
        # STRATEGY 3: Assume it's raw JSON
        else:
            json_str = response_text
        
        # Parse the JSON string into a Python dict
        result_data = json.loads(json_str)
        
        # Convert dict to ValidationResult dataclass
        return ValidationResult(
            is_valid=result_data.get("is_valid", False),
            confidence=result_data.get("confidence", 0.0),
            issues=result_data.get("issues", []),
            corrections=result_data.get("corrections"),
            safety_flags=result_data.get("safety_flags", []),
            reasoning=result_data.get("reasoning", "")
        )
    
    # WHAT IF PARSING FAILS?
    except json.JSONDecodeError as e:
        print(f"Failed to parse validation response: {e}")
        print(f"Response was: {response_text}")
        # Return a CONSERVATIVE result (treat as INVALID when in doubt)
        # Better to be cautious in medical domain
        return ValidationResult(
            is_valid=False,
            confidence=0.5,
            issues=["Validation parsing error"],
            corrections=None,
            safety_flags=["VALIDATION_ERROR"],
            reasoning="Could not parse validator response"
        )


# SECTION 3: OUTPUT FORMATTING
# This takes the ValidationResult and makes it human-readable
# Used for printing/displaying results to users or logs
def format_validation_report(result: ValidationResult) -> str:
    """Format validation result for display"""
    # Display a checkmark or X based on validity
    status = "✓ VALID" if result.is_valid else "✗ INVALID"
    
    # Build the report string
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
