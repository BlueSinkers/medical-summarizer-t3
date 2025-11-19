"""
Quick verification script to test if the API is being called properly
"""

from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()

print("=" * 60)
print("API CONFIGURATION CHECK")
print("=" * 60)

# Check if API key is loaded
api_key = os.getenv("ANTHROPIC_API_KEY")
if api_key:
    print(f"\n[SUCCESS] API Key found!")
    print(f"Key starts with: {api_key[:15]}...")
    print(f"Key length: {len(api_key)} characters")
else:
    print("\n[FAILED] No API key found in environment")
    print("Make sure your .env file contains ANTHROPIC_API_KEY")

# Test the grounding agent with API
print("\n" + "=" * 60)
print("TESTING API CALL")
print("=" * 60)

from grounding_agent_advanced import validate_response

medical_report = """
Patient: Jane Smith
Age: 32
Diagnosis: Common cold
Symptoms: Runny nose, mild fever (99.5°F)
Recommendation: Rest, fluids, over-the-counter pain reliever
"""

llm_response = "You have a common cold with a mild fever of 99.5°F. Rest and drink fluids."

conversation = [
    {"role": "user", "content": "What does my report say?"},
    {"role": "assistant", "content": llm_response}
]

print("\nCalling API with validation request...")
print("-" * 60)

result = validate_response(
    llm_response=llm_response,
    conversation_history=conversation,
    medical_report=medical_report,
    use_api=True  # Force API usage
)

print(f"\nResult received!")
print(f"  - Is Valid: {result.is_valid}")
print(f"  - Confidence: {result.confidence}% (type: {type(result.confidence).__name__})")
print(f"  - Issues: {len(result.issues)}")
print(f"  - Safety Flags: {len(result.safety_flags)}")
print(f"  - Reasoning: {result.reasoning[:100]}")

print("\n" + "=" * 60)
if result.reasoning == "Offline validation using keyword matching (limited accuracy)":
    print("[WARNING] API was not used - fell back to offline validation")
    print("This could mean:")
    print("  1. API key is invalid")
    print("  2. Network connection issue")
    print("  3. API quota exceeded")
else:
    print("[SUCCESS] API was called successfully!")
    print(f"Confidence score is using 0-100 scale: {result.confidence}%")

print("=" * 60)
