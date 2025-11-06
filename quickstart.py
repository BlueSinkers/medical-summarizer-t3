import anthropic
import creds

client = anthropic.Anthropic()

message = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=1000,
    messages=[
        {
            "role": "user",
            "content": "Tell me a joke about pizza."
        }
    ]
)
print(message.content)