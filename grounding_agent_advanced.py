import anthropic
import json
import os
from dataclasses import dataclass
from typing import Optional
from enum import Enum


# CONFIGURATION & SETTINGS
class ValidatorMode(Enum):
    """Operating modes for grounding agent"""
    ENABLED = "enabled"           # Full validation
    DISABLED = "disabled"         # Skip validation entirely
    OFFLINE = "offline"           # Local-only validation (no API calls)
    LOW_RESOURCE = "low_resource" # Minimal validation for limited resources


@dataclass
class GroundingConfig:
    """Configuration for grounding agent"""
    mode: ValidatorMode = ValidatorMode.ENABLED
    confidence_threshold: float = 0.6  # Reject if confidence below this
    max_retries: int = 2               # Retry uncertain validations
    allow_offline_fallback: bool = True  # Fall back to offline if API fails
    enable_logging: bool = True        # Log validation attempts


# PART 1: DATA STRUCTURE
@dataclass
class ValidationResult:
    """Result of validating an LLM response"""
    is_valid: bool                    # TRUE = response passes validation
    confidence: float                 # 0.0-1.0 = confidence in validation decision
    issues: list[str]                 # List of problems found
    corrections: Optional[str]        # Suggested fix (or None)
    safety_flags: list[str]          # Safety rules violated
    reasoning: str                    # Explanation of pass/fail
    requires_review: bool = False     # TRUE = human should review (low confidence)
    retry_count: int = 0              # How many times validation was retried



# PART 2: MAIN VALIDATION FUNCTION
def validate_response(
    llm_response: str,
    conversation_history: list[dict],
    medical_report: str,
    config: Optional[GroundingConfig] = None,
    api_key: Optional[str] = None
) -> ValidationResult:
    """
    Validates an LLM response for hallucinations, safety, and medical accuracy.
    
    Supports:
    - Offline mode (no internet required)
    - Low-resource mode (minimal computation)
    - Disable mode (skip validation)
    - Confidence thresholds (flag uncertain validations)
    - Automatic retry for uncertain cases
    """
    
    # Use default config if none provided
    if config is None:
        config = GroundingConfig()
    

       # STEP 1: CHECK MODE (Can we even run?) 
    if config.mode == ValidatorMode.DISABLED:
        if config.enable_logging:
            print("[GROUNDING] Validation disabled - approving response")
        return ValidationResult(
            is_valid=True,
            confidence=1.0,
            issues=[],
            corrections=None,
            safety_flags=[],
            reasoning="Validation disabled by configuration"
        )
    
    if config.mode == ValidatorMode.OFFLINE:
        if config.enable_logging:
            print("[GROUNDING] Running in OFFLINE mode - no API calls")
        return _offline_validation(llm_response, medical_report, conversation_history)
    
    if config.mode == ValidatorMode.LOW_RESOURCE:
        if config.enable_logging:
            print("[GROUNDING] Running in LOW_RESOURCE mode - minimal processing")
        return _low_resource_validation(llm_response, medical_report)
    
    
    # STEP 2: INITIALIZE ANTHROPIC CLIENT
    try:
        client = anthropic.Anthropic(api_key=api_key)
    except Exception as e:
        if config.enable_logging:
            print(f"[GROUNDING] Failed to initialize API client: {e}")
        
        if config.allow_offline_fallback:
            if config.enable_logging:
                print("[GROUNDING] Falling back to offline validation")
            return _offline_validation(llm_response, medical_report, conversation_history)
        else:
            return ValidationResult(
                is_valid=False,
                confidence=0.0,
                issues=["Failed to initialize validator"],
                corrections=None,
                safety_flags=["API_ERROR"],
                reasoning="Could not connect to validation API"
            )
    
    # STEP 3: COMPRESS CONVERSATION HISTORY
    conversation_str = "\n".join(
        [f"{msg['role'].upper()}: {msg['content']}" for msg in conversation_history[-5:]]
    )
    
   
    # STEP 4: VALIDATION PROMPT
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
    "confidence": 0.0-1.0,
    "issues": ["issue1", "issue2"],
    "corrections": "corrected version or null",
    "safety_flags": ["flag1", "flag2"],
    "reasoning": "brief explanation"
}}

Be very STRICT about hallucinations.
"""
    
    # STEP 5: CALLING API
    
    try:
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=1000,
            messages=[{"role": "user", "content": grounding_prompt}]
        )
        response_text = response.content[0].text
    except Exception as e:
        if config.enable_logging:
            print(f"[GROUNDING] API call failed: {e}")
        
        if config.allow_offline_fallback:
            return _offline_validation(llm_response, medical_report, conversation_history)
        else:
            return ValidationResult(
                is_valid=False,
                confidence=0.0,
                issues=["API validation failed"],
                corrections=None,
                safety_flags=["API_ERROR"],
                reasoning=f"Validation API error: {str(e)}"
            )
    
    
    # STEP 6: PARSE JSON
    
    result = _parse_validation_response(response_text)
    
    # ========================================================================
    # STEP 7: APPLY CONFIDENCE THRESHOLD
    # ========================================================================
    
    if result.confidence < config.confidence_threshold:
        if config.enable_logging:
            print(f"[GROUNDING] Low confidence ({result.confidence:.1%}) < threshold ({config.confidence_threshold:.1%})")
        result.requires_review = True
        
        # Retry if we haven't exceeded max retries
        if result.retry_count < config.max_retries:
            if config.enable_logging:
                print(f"[GROUNDING] Retrying validation (attempt {result.retry_count + 1}/{config.max_retries})")
            
            # Create new config for retry with slightly adjusted parameters
            retry_config = GroundingConfig(
                mode=config.mode,
                confidence_threshold=config.confidence_threshold * 0.95,  # Slightly lower for retry
                max_retries=config.max_retries,
                allow_offline_fallback=config.allow_offline_fallback,
                enable_logging=config.enable_logging
            )
            
            retry_result = validate_response(
                llm_response=llm_response,
                conversation_history=conversation_history,
                medical_report=medical_report,
                config=retry_config,
                api_key=api_key
            )
            retry_result.retry_count = result.retry_count + 1
            return retry_result
    
    if config.enable_logging:
        print(f"[GROUNDING] Validation complete: valid={result.is_valid}, confidence={result.confidence:.1%}")
    
    return result


# ============================================================================
# HELPER: OFFLINE VALIDATION
# ============================================================================

def _offline_validation(
    llm_response: str,
    medical_report: str,
    conversation_history: list[dict]
) -> ValidationResult:
    """
    Validate without API calls using simple heuristics.
    Good for: no internet, low resources, offline environments
    """
    
    issues = []
    safety_flags = []
    
    # Check for dangerous keywords (no API needed)
    dangerous_keywords = [
        ("definitely has", "OVERCONFIDENT_DIAGNOSIS"),
        ("will definitely", "OVERCONFIDENT_DIAGNOSIS"),
        ("stop taking", "DANGEROUS_MEDICAL_ADVICE"),
        ("don't take", "DANGEROUS_MEDICAL_ADVICE"),
        ("cure", "CURE_CLAIM"),
        ("cured", "CURE_CLAIM"),
    ]
    
    response_lower = llm_response.lower()
    for keyword, flag in dangerous_keywords:
        if keyword in response_lower:
            issues.append(f"Contains dangerous keyword: '{keyword}'")
            safety_flags.append(flag)
    
    # Check for basic hallucinations (simple string matching)
    report_lower = medical_report.lower()
    if "diabetes" in response_lower and "diabetes" not in report_lower:
        issues.append("Mentions 'diabetes' but not in medical report")
        safety_flags.append("POSSIBLE_HALLUCINATION")
    
    is_valid = len(issues) == 0
    confidence = 0.5 if is_valid else 0.3  # Lower confidence for offline (heuristic-based)
    
    return ValidationResult(
        is_valid=is_valid,
        confidence=confidence,
        issues=issues,
        corrections=None,
        safety_flags=safety_flags,
        reasoning="Offline validation using keyword matching (limited accuracy)"
    )


# ============================================================================
# HELPER: LOW-RESOURCE VALIDATION
# ============================================================================

def _low_resource_validation(
    llm_response: str,
    medical_report: str
) -> ValidationResult:
    """
    Minimal validation for low-resource environments.
    Checks only critical safety issues.
    """
    
    issues = []
    safety_flags = []
    
    # Only check for CRITICAL safety issues
    critical_keywords = [
        ("stop taking medication", "CRITICAL_SAFETY"),
        ("ignore doctor", "CRITICAL_SAFETY"),
        ("don't seek medical help", "CRITICAL_SAFETY"),
    ]
    
    response_lower = llm_response.lower()
    for keyword, flag in critical_keywords:
        if keyword in response_lower:
            issues.append(f"CRITICAL: Contains '{keyword}'")
            safety_flags.append(flag)
    
    is_valid = len(issues) == 0
    confidence = 0.7 if is_valid else 0.4
    
    return ValidationResult(
        is_valid=is_valid,
        confidence=confidence,
        issues=issues,
        corrections=None,
        safety_flags=safety_flags,
        reasoning="Low-resource validation - only critical safety checks"
    )


# ============================================================================
# HELPER: PARSE VALIDATION RESPONSE
# ============================================================================

def _parse_validation_response(response_text: str) -> ValidationResult:
    """Parse Claude's JSON response"""
    
    try:
        # Handle markdown code blocks
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
        print(f"[GROUNDING] JSON parse error: {e}")
        return ValidationResult(
            is_valid=False,
            confidence=0.5,
            issues=["Validation parsing error"],
            corrections=None,
            safety_flags=["VALIDATION_ERROR"],
            reasoning="Could not parse validator response"
        )


# ============================================================================
# SECTION 3: OUTPUT FORMATTING
# ============================================================================

def format_validation_report(result: ValidationResult) -> str:
    """Format validation result for display"""
    
    status = "✓ VALID" if result.is_valid else "✗ INVALID"
    
    # Format issues
    if result.issues:
        issues_text = "\n".join(f"  - {issue}" for issue in result.issues)
    else:
        issues_text = "  None"
    
    # Format safety flags
    if result.safety_flags:
        flags_text = "\n".join(f"  - {flag}" for flag in result.safety_flags)
    else:
        flags_text = "  None"
    
    # Format correction
    correction_text = ""
    if result.corrections:
        correction_text = f"\nSuggested Correction:\n{result.corrections}"
    
    # Add review flag if needed
    review_text = ""
    if result.requires_review:
        review_text = "\n⚠️  REQUIRES HUMAN REVIEW (Low confidence in validation)"
    
    report = f"""
VALIDATION REPORT
{status}
Confidence: {result.confidence:.1%}

Issues Found: {len(result.issues)}
{issues_text}

Safety Flags: {len(result.safety_flags)}
{flags_text}

Reasoning:
{result.reasoning}
{correction_text}
{review_text}
"""
    return report

