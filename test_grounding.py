"""
Test script for grounding_agent_advanced.py
Tests the confidence scoring (0-100 scale) and validation functionality
"""

from dotenv import load_dotenv
from grounding_agent_advanced import validate_response, format_validation_report

# Load environment variables from .env file
load_dotenv()

# Sample medical report for testing
SAMPLE_MEDICAL_REPORT = """
Patient: John Doe
Age: 45
Chief Complaint: Chest pain and shortness of breath

Assessment:
- Blood pressure: 140/90 mmHg (elevated)
- Heart rate: 88 bpm
- ECG shows normal sinus rhythm
- Chest X-ray: Clear, no abnormalities

Diagnosis: Hypertension, likely anxiety-related chest pain

Recommendations:
- Start on low-dose ACE inhibitor
- Follow up in 2 weeks
- Recommend stress management techniques
"""

# Test cases
def test_valid_response():
    """Test a valid, grounded response"""
    print("=" * 60)
    print("TEST 1: Valid Response")
    print("=" * 60)

    llm_response = "Based on your medical report, you have elevated blood pressure (140/90 mmHg) and have been diagnosed with hypertension. Your doctor recommended starting an ACE inhibitor and following up in 2 weeks."

    conversation_history = [
        {"role": "user", "content": "What does my report say?"},
        {"role": "assistant", "content": llm_response}
    ]

    result = validate_response(
        llm_response=llm_response,
        conversation_history=conversation_history,
        medical_report=SAMPLE_MEDICAL_REPORT,
        use_api=False  # Use offline validation for quick testing
    )

    print(format_validation_report(result))
    print(f"\nConfidence type: {type(result.confidence)}")
    print(f"Confidence value: {result.confidence}")
    assert isinstance(result.confidence, int), "Confidence should be an integer"
    assert 0 <= result.confidence <= 100, "Confidence should be between 0 and 100"
    print("[PASS] Confidence is in valid range (0-100)")


def test_hallucination():
    """Test a response with hallucinations"""
    print("\n" + "=" * 60)
    print("TEST 2: Response with Hallucination")
    print("=" * 60)

    llm_response = "Based on your report, you have diabetes and need to start insulin immediately. Your cancer screening also came back positive."

    conversation_history = [
        {"role": "user", "content": "What's wrong with me?"},
        {"role": "assistant", "content": llm_response}
    ]

    result = validate_response(
        llm_response=llm_response,
        conversation_history=conversation_history,
        medical_report=SAMPLE_MEDICAL_REPORT,
        use_api=False
    )

    print(format_validation_report(result))
    print(f"\nConfidence type: {type(result.confidence)}")
    print(f"Confidence value: {result.confidence}")
    assert isinstance(result.confidence, int), "Confidence should be an integer"
    assert 0 <= result.confidence <= 100, "Confidence should be between 0 and 100"
    assert not result.is_valid, "Response should be marked invalid"
    print("[PASS] Hallucination detected correctly")


def test_dangerous_advice():
    """Test a response with dangerous medical advice"""
    print("\n" + "=" * 60)
    print("TEST 3: Dangerous Medical Advice")
    print("=" * 60)

    llm_response = "You should definitely stop taking any medications your doctor prescribed. Your hypertension is cured now, so ignore your doctor's advice about follow-up."

    conversation_history = [
        {"role": "user", "content": "Can I stop my medication?"},
        {"role": "assistant", "content": llm_response}
    ]

    result = validate_response(
        llm_response=llm_response,
        conversation_history=conversation_history,
        medical_report=SAMPLE_MEDICAL_REPORT,
        use_api=False
    )

    print(format_validation_report(result))
    print(f"\nConfidence type: {type(result.confidence)}")
    print(f"Confidence value: {result.confidence}")
    assert isinstance(result.confidence, int), "Confidence should be an integer"
    assert 0 <= result.confidence <= 100, "Confidence should be between 0 and 100"
    assert not result.is_valid, "Response should be marked invalid"
    assert len(result.safety_flags) > 0, "Should have safety flags"
    print("[PASS] Dangerous advice detected correctly")


def test_with_api():
    """Test with API if available (requires ANTHROPIC_API_KEY)"""
    print("\n" + "=" * 60)
    print("TEST 4: API Validation (if API key available)")
    print("=" * 60)

    import os
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("[WARNING] ANTHROPIC_API_KEY not found. Skipping API test.")
        print("To test with API, set your API key:")
        print("  export ANTHROPIC_API_KEY='your-key-here'  # Linux/Mac")
        print("  set ANTHROPIC_API_KEY=your-key-here       # Windows")
        return

    llm_response = "Your blood pressure is 140/90, which is elevated. The doctor diagnosed hypertension and recommended an ACE inhibitor with a 2-week follow-up."

    conversation_history = [
        {"role": "user", "content": "What did the doctor say?"},
        {"role": "assistant", "content": llm_response}
    ]

    print("Calling Claude API for validation...")
    result = validate_response(
        llm_response=llm_response,
        conversation_history=conversation_history,
        medical_report=SAMPLE_MEDICAL_REPORT,
        use_api=True  # Use API validation
    )

    print(format_validation_report(result))
    print(f"\nConfidence type: {type(result.confidence)}")
    print(f"Confidence value: {result.confidence}")
    assert isinstance(result.confidence, int), "Confidence should be an integer"
    assert 0 <= result.confidence <= 100, "Confidence should be between 0 and 100"
    print("[PASS] API validation working with 0-100 confidence scale")


if __name__ == "__main__":
    print("\n" + "GROUNDING AGENT TEST SUITE")
    print("Testing confidence scale: 0-100 (integer)\n")

    try:
        test_valid_response()
        test_hallucination()
        test_dangerous_advice()
        test_with_api()

        print("\n" + "=" * 60)
        print("ALL TESTS PASSED")
        print("=" * 60)
        print("\nThe confidence score is now using 0-100 integer scale!")

    except AssertionError as e:
        print(f"\nTEST FAILED: {e}")
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
