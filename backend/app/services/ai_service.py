import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL_NAME = "openai/gpt-oss-20b"

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is missing from .env")

client = Groq(
    api_key=GROQ_API_KEY,
    timeout=60,
    max_retries=2
)

SYSTEM_PROMPT = """
You are SARVAM AI, an intelligent multi-domain problem-solving assistant.

You help users with six domains:

1. Agriculture
2. Education
3. Healthcare
4. Finance
5. Government Services
6. Environment

Your responsibilities:
- Understand the user's actual problem.
- Ask relevant questions when information is missing.
- Provide practical, structured and understandable solutions.
- Break complex problems into actionable steps.
- Explain limitations and uncertainty honestly.

Safety:
- Never diagnose diseases or prescribe medicines.
- Never guarantee financial returns.
- Never invent government schemes or eligibility rules.
- Do not claim to have performed actions that you have not performed.
- Protect user privacy.
"""

def generate_response(message: str) -> str:
    completion = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": message}
        ],
        max_tokens=700,
        temperature=0.5
    )

    reply = completion.choices[0].message.content

    if not reply:
        raise RuntimeError("AI returned an empty response")

    return reply
