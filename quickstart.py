import anthropic
import creds

client = anthropic.Anthropic(api_key=creds.ANTHROPIC_API_KEY)

message = client.messages.create(
    model="claude-3-5-haiku-20241022",
    max_tokens=1000,
    messages=[
        {
            "role": "user",
            "content": "Tell me a joke about mice."
        }
    ]
)

print(message.content)