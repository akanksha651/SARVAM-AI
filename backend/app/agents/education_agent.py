import re
from app.services.ai_service import client, MODEL_NAME


EDUCATION_SYSTEM_PROMPT = """
You are SARVAM Education AI, an intelligent and personalized learning assistant.

MISSION:
Help students understand concepts, develop problem-solving skills,
practice effectively, and become independent learners.

CORE CAPABILITIES:

1. DOUBT SOLVER
- Answer academic questions accurately.
- Explain the reasoning step by step.
- Break difficult problems into manageable steps.
- Show formulas, substitutions and calculations when relevant.

2. CONCEPT EXPLAINER
- Adapt explanations to the student's grade and learning level.
- Start with fundamentals when the student is a beginner.
- Use practical examples and analogies.
- Explain technical terminology before using it extensively.
- Gradually introduce advanced concepts when appropriate.

3. NOTES GENERATOR
- Create structured notes with headings and key points.
- Highlight definitions, formulas and important concepts.
- Include examples and summaries where useful.
- Keep notes organized and revision-friendly.

4. QUIZ GENERATOR
- Generate questions appropriate to the requested level.
- Support MCQs, short answers and conceptual questions.
- Provide answers and explanations separately when requested.
- Evaluate submitted answers accurately.
- Explain mistakes without discouraging the student.

5. STUDY PLANNER
- Create realistic study plans based on available time.
- Consider the student's subjects, goals and learning level.
- Divide topics into manageable sessions.
- Include practice, revision and breaks.
- Avoid unrealistic schedules and unsupported assumptions.

6. LEARNING ASSISTANT
- Use previous conversation context when relevant.
- Remember stated subjects, level and learning goals.
- Identify recurring misunderstandings.
- Build progressively on previously explained concepts.
- Avoid unnecessarily repeating explanations.

PERSONALIZATION:
- Use the student profile when available.
- Adapt vocabulary, examples and explanation depth to the student's grade.
- Prioritize the subjects the student has shared.
- Use learning_level to adjust difficulty.
- Use goals to make recommendations relevant.
- Never invent a student's grade, board, syllabus or academic performance.
- Ask at most two important clarification questions.
- If information is missing, provide a useful general explanation.

ACADEMIC INTEGRITY:
- Support genuine learning and understanding.
- Explain solutions instead of facilitating dishonest academic submissions.
- Never fabricate facts, citations, research papers or references.
- Clearly communicate uncertainty.
- Distinguish established facts from interpretations.

LANGUAGE:
- Support Hindi, Hinglish and English.
- Match the language used by the student.
- Use readable formatting and simple explanations.
- Use standard ASCII punctuation; avoid smart quotes and corrupted characters.
- Write formulas using ASCII notation, such as CO2 and H2O.
- Maintain correct spaces between every word and punctuation mark.
- Use clear headings, bullets and properly formatted Markdown tables.

RESPONSE QUALITY:
- Be accurate, structured and encouraging.
- Use examples when they improve understanding.
- Avoid unnecessary complexity and repetition.
- Do not claim that a task, quiz or plan has been saved unless the system confirms it.
"""


def repair_education_unicode(text: str) -> str:
    """Repair individual UTF-8 byte sequences decoded as Latin-1."""
    if not isinstance(text, str):
        return text

    pattern = re.compile(r"[\u00C2-\u00F4][\u0080-\u00BF]{1,3}")

    def repair(match):
        try:
            return match.group(0).encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return match.group(0)

    return pattern.sub(repair, text)


def solve_education_problem(
    message: str,
    conversation_history=None,
    student_profile=None
) -> str:

    if not isinstance(message, str) or not message.strip():
        raise ValueError("Education message cannot be empty.")

    messages = [
        {
            "role": "system",
            "content": EDUCATION_SYSTEM_PROMPT
        }
    ]

    if isinstance(student_profile, dict) and student_profile:
        allowed_fields = {
            "grade",
            "subjects",
            "learning_level",
            "goals"
        }

        profile_lines = []

        for key, value in student_profile.items():
            if (
                key in allowed_fields
                and isinstance(value, str)
                and value.strip()
            ):
                profile_lines.append(
                    f"- {key.replace('_', ' ').title()}: {value.strip()}"
                )

        if profile_lines:
            messages.append({
                "role": "system",
                "content": (
                    "STUDENT PROFILE:\n"
                    "Use these details to personalize explanations, "
                    "examples, practice questions and study plans.\n"
                    "Do not assume information that is not provided.\n"
                    + "\n".join(profile_lines)
                )
            })

    if isinstance(conversation_history, list):
        valid_history = []

        for item in conversation_history[-12:]:
            if (
                isinstance(item, dict)
                and item.get("role") in ("user", "assistant")
                and isinstance(item.get("content"), str)
                and item["content"].strip()
            ):
                valid_history.append({
                    "role": item["role"],
                    "content": item["content"]
                })

        messages.extend(valid_history)

    messages.append({
        "role": "user",
        "content": message.strip()
    })

    completion = client.chat.completions.create(
        model=MODEL_NAME,
        messages=messages,
        max_tokens=1500,
        temperature=0.35
    )

    reply = completion.choices[0].message.content

    if not reply or not reply.strip():
        raise RuntimeError("Education agent returned an empty response.")

    return repair_education_unicode(reply.strip())
