import json
import re

from app.services.ai_service import client, MODEL_NAME


QUIZ_SYSTEM_PROMPT = """
You are SARVAM Education AI Quiz Generator.

Generate accurate educational multiple-choice questions.

RULES:
- Generate exactly the requested number of questions.
- Each question must have exactly four options: A, B, C, D.
- Exactly one option must be correct.
- Questions must match the requested topic and difficulty.
- Avoid ambiguous or duplicate questions.
- Every question must have a clear explanation.
- Never invent facts or use misleading answer keys.
- Return ONLY valid JSON. No Markdown or additional text.

Required JSON structure:
{
  "questions": [
    {
      "question": "Question text",
      "options": {
        "A": "Option A",
        "B": "Option B",
        "C": "Option C",
        "D": "Option D"
      },
      "correct_answer": "A",
      "explanation": "Explanation of the correct answer"
    }
  ]
}
"""


def generate_quiz_questions(topic, difficulty="beginner", count=5):
    if not isinstance(topic, str) or not topic.strip():
        raise ValueError("Quiz topic is required.")

    if len(topic.strip()) > 200:
        raise ValueError("Quiz topic must not exceed 200 characters.")

    difficulty = str(difficulty).strip().lower()

    if difficulty not in {"beginner", "intermediate", "advanced"}:
        raise ValueError("Invalid quiz difficulty.")

    if isinstance(count, bool) or not isinstance(count, int) or not 3 <= count <= 10:
        raise ValueError("Question count must be between 3 and 10.")

    completion = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": QUIZ_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Topic: {topic.strip()}\n"
                    f"Difficulty: {difficulty}\n"
                    f"Number of questions: {count}\n"
                    "Generate the quiz in the exact required JSON structure."
                )
            }
        ],
        temperature=0.2,
        max_tokens=2500,
        response_format={"type": "json_object"}
    )

    raw = completion.choices[0].message.content

    if not raw or not raw.strip():
        raise RuntimeError("AI returned an empty quiz.")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as error:
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            raise RuntimeError("AI returned invalid quiz JSON.") from error

    questions = data.get("questions") if isinstance(data, dict) else None

    if not isinstance(questions, list) or len(questions) != count:
        raise RuntimeError("AI generated an unexpected number of questions.")

    validated = []

    for index, item in enumerate(questions):
        if not isinstance(item, dict):
            raise RuntimeError(f"Invalid question structure at question {index + 1}.")

        question = item.get("question")
        options = item.get("options")
        correct = item.get("correct_answer")
        explanation = item.get("explanation")

        if not isinstance(question, str) or not question.strip():
            raise RuntimeError(f"Question {index + 1} is empty.")

        if not isinstance(options, dict) or set(options.keys()) != {"A", "B", "C", "D"}:
            raise RuntimeError(f"Question {index + 1} must have four options.")

        if correct not in {"A", "B", "C", "D"}:
            raise RuntimeError(f"Question {index + 1} has an invalid answer key.")

        if any(
            not isinstance(value, str) or not value.strip()
            for value in options.values()
        ):
            raise RuntimeError(f"Question {index + 1} has an empty option.")

        if len({value.strip().casefold() for value in options.values()}) != 4:
            raise RuntimeError(f"Question {index + 1} has duplicate options.")

        if not isinstance(explanation, str) or not explanation.strip():
            raise RuntimeError(f"Question {index + 1} has no explanation.")

        validated.append({
            "question": question.strip(),
            "options": {key: value.strip() for key, value in options.items()},
            "correct_answer": correct,
            "explanation": explanation.strip()
        })

    return validated
