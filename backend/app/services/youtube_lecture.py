import os
import re
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from youtube_transcript_api import YouTubeTranscriptApi
from app.services.ai_service import client, MODEL_NAME

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "youtube_lectures.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

def db():
    conn = sqlite3.connect(str(DB_PATH), timeout=20)
    conn.row_factory = sqlite3.Row
    return conn

def initialize_db():
    with db() as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS lectures (
            id TEXT PRIMARY KEY,
            video_id TEXT NOT NULL,
            video_url TEXT NOT NULL,
            title TEXT NOT NULL,
            transcript TEXT NOT NULL,
            summary TEXT NOT NULL,
            notes TEXT NOT NULL,
            concepts TEXT NOT NULL,
            formulas TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_lecture_video ON lectures(video_id)"
        )

initialize_db()

def extract_video_id(url):
    value = url.strip()
    patterns = [
        r"(?:youtube\.com/watch\?.*?v=)([A-Za-z0-9_-]{11})",
        r"(?:youtu\.be/)([A-Za-z0-9_-]{11})",
        r"(?:youtube\.com/embed/)([A-Za-z0-9_-]{11})",
        r"(?:youtube\.com/shorts/)([A-Za-z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, value)
        if match:
            return match.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", value):
        return value
    raise ValueError("Please provide a valid YouTube video URL.")

def extract_transcript(video_id):
    api = YouTubeTranscriptApi()
    fetched = api.fetch(video_id, languages=["en", "hi"])
    snippets = getattr(fetched, "snippets", [])
    transcript = "\n".join(
        str(item.text).strip()
        for item in snippets
        if getattr(item, "text", "").strip()
    )
    if not transcript:
        raise ValueError("No usable captions were found for this video.")
    return transcript

def ai_call(system_prompt, user_prompt, max_tokens=1800):
    result = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.25,
        max_tokens=max_tokens,
    )
    return result.choices[0].message.content or ""

def chunks(text, size=10000):
    words = text.split()
    result, current = [], []
    length = 0
    for word in words:
        if length + len(word) + 1 > size and current:
            result.append(" ".join(current))
            current, length = [], 0
        current.append(word)
        length += len(word) + 1
    if current:
        result.append(" ".join(current))
    return result

def analyze_transcript(transcript):
    parts = chunks(transcript)
    partial_summaries = []

    for index, part in enumerate(parts, 1):
        partial_summaries.append(ai_call(
            "You are an accurate academic lecture analyst. "
            "Use only the supplied transcript. Do not invent facts.",
            f"Summarize lecture segment {index}/{len(parts)}. "
            "Preserve important explanations, examples and terminology.\n\n"
            + part,
            1200,
        ))

    combined = "\n\n".join(partial_summaries)

    result = ai_call(
        "You are SARVAM Education AI, an expert academic note maker. "
        "Use only the provided transcript-derived material. "
        "If information is absent, say it is not covered. "
        "Never invent formulas, definitions or claims. "
        "Return valid JSON only.",
        """
Create a structured study resource from the lecture.

Return JSON with exactly these keys:
{
 "summary": "clear comprehensive summary",
 "notes": "detailed organized notes using headings and bullet points",
 "concepts": ["important concepts and definitions"],
 "formulas": ["only formulas explicitly supported by the lecture"]
}

Lecture material:
""" + combined,
        3000,
    )

    try:
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", result.strip())
        data = json.loads(cleaned)
        return {
            "summary": str(data.get("summary", "")),
            "notes": str(data.get("notes", "")),
            "concepts": data.get("concepts", []),
            "formulas": data.get("formulas", []),
        }
    except (ValueError, TypeError):
        return {
            "summary": combined,
            "notes": combined,
            "concepts": [],
            "formulas": [],
        }

def save_lecture(video_id, url, transcript, analysis):
    lecture_id = str(uuid.uuid4())
    created = datetime.now(timezone.utc).isoformat()

    with db() as conn:
        conn.execute("""
        INSERT INTO lectures
        (id, video_id, video_url, title, transcript, summary,
         notes, concepts, formulas, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            lecture_id, video_id, url, "YouTube Lecture " + video_id,
            transcript, analysis["summary"], analysis["notes"],
            json.dumps(analysis["concepts"], ensure_ascii=False),
            json.dumps(analysis["formulas"], ensure_ascii=False),
            created,
        ))

    return get_lecture(lecture_id)

def get_lecture(lecture_id):
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM lectures WHERE id = ?", (lecture_id,)
        ).fetchone()
    if not row:
        return None
    data = dict(row)
    data["concepts"] = json.loads(data["concepts"])
    data["formulas"] = json.loads(data["formulas"])
    return data

def list_lectures():
    with db() as conn:
        rows = conn.execute("""
            SELECT id, video_id, video_url, title, summary, created_at
            FROM lectures ORDER BY created_at DESC LIMIT 100
        """).fetchall()
    return [dict(row) for row in rows]

def ask_lecture(lecture_id, question):
    lecture = get_lecture(lecture_id)
    if not lecture:
        raise ValueError("Lecture not found.")

    transcript = lecture["transcript"]
    relevant = transcript[:24000]

    return ai_call(
        "You are SARVAM Lecture Tutor. Answer strictly from the "
        "provided lecture transcript. If the answer is not present, "
        "clearly say that the lecture does not cover it. "
        "Do not pretend to have watched the video.",
        "LECTURE TRANSCRIPT:\n" + relevant +
        "\n\nSTUDENT QUESTION:\n" + question,
        1200,
    )


# ---------- SARVAM LECTURE INTELLIGENCE V2 ----------

def extract_verified_formulas(transcript):
    """Extract formula-like expressions only when present in source."""
    patterns = [
        r'\b[A-Z][a-z]?\d*(?:[A-Z][a-z]?\d*)+\b',
        r'\b[A-Za-z][A-Za-z0-9]*\s*=\s*[A-Za-z0-9+\-*/(). ]{1,50}',
    ]
    found = []
    for pattern in patterns:
        for match in re.finditer(pattern, transcript):
            value = match.group(0).strip()
            if value and value not in found:
                found.append(value)
    return found[:30]


def analyze_transcript(transcript):
    parts = chunks(transcript, size=10000)
    summaries = []

    for index, part in enumerate(parts, 1):
        summaries.append(ai_call(
            "You are a careful academic lecture analyst. "
            "Use ONLY information explicitly present in the transcript. "
            "Never add outside facts, formulas, examples or definitions.",
            f"Summarize segment {index} of {len(parts)}. "
            "Preserve the original meaning and important details.\n\n" + part,
            1100,
        ))

    combined = "\n\n".join(summaries)

    result = ai_call(
        "You are SARVAM Education AI. Return valid JSON only. "
        "Use only the supplied transcript-derived material. "
        "Do not invent chemical formulas, equations, examples or facts. "
        "Use ASCII notation such as CO2 and H2O instead of Unicode subscripts. "
        "If a concept is not covered, do not add it.",
        """
Return JSON with exactly:
{
 "summary": "comprehensive concise summary",
 "notes": "organized detailed notes with headings and bullets",
 "concepts": ["concepts explicitly explained in the lecture"]
}

LECTURE MATERIAL:
""" + combined,
        3000,
    )

    try:
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", result.strip())
        data = json.loads(cleaned)
    except (ValueError, TypeError):
        data = {
            "summary": combined,
            "notes": combined,
            "concepts": [],
        }

    # Formula list is source-derived, not freely generated by the LLM.
    verified = extract_verified_formulas(transcript)

    return {
        "summary": str(data.get("summary", "")),
        "notes": str(data.get("notes", "")),
        "concepts": data.get("concepts", []) if isinstance(data.get("concepts"), list) else [],
        "formulas": verified,
    }


def retrieve_relevant_transcript(transcript, question, max_chars=24000):
    """Rank transcript sections by question-term overlap."""
    import re

    stop_words = {
        "what", "when", "where", "which", "who", "whom", "why", "how",
        "the", "and", "for", "are", "was", "were", "is", "this", "that",
        "with", "from", "into", "does", "can", "could", "would", "should",
        "explain", "tell", "about", "please", "lecture"
    }

    terms = {
        word.lower()
        for word in re.findall(r"[A-Za-z0-9]{3,}", question)
        if word.lower() not in stop_words
    }

    sections = chunks(transcript, size=2500)
    ranked = []

    for index, section in enumerate(sections):
        words = set(
            word.lower()
            for word in re.findall(r"[A-Za-z0-9]{3,}", section)
        )
        score = len(terms.intersection(words))
        ranked.append((score, index, section))

    ranked.sort(key=lambda item: (-item[0], item[1]))

    selected = []
    total = 0

    for score, index, section in ranked:
        if total + len(section) > max_chars:
            continue
        if score == 0 and selected:
            continue
        selected.append((index, section))
        total += len(section)

    selected.sort(key=lambda item: item[0])

    if not selected:
        selected = [(i, s) for i, s in enumerate(sections[:4])]

    return "\n\n".join(section for _, section in selected)


def ask_lecture(lecture_id, question):
    lecture = get_lecture(lecture_id)
    if not lecture:
        raise ValueError("Lecture not found.")

    relevant = retrieve_relevant_transcript(
        lecture["transcript"], question
    )

    return ai_call(
        "You are SARVAM Lecture Tutor. Answer ONLY using the supplied "
        "lecture excerpts. Do not invent facts or use outside knowledge. "
        "If the excerpts do not contain the answer, explicitly say that "
        "the available lecture transcript does not provide the answer. "
        "Distinguish direct lecture facts from reasonable interpretation.",
        "RELEVANT LECTURE EXCERPTS:\n" + relevant +
        "\n\nSTUDENT QUESTION:\n" + question,
        1400,
    )


# ---------- PERSISTENT LECTURE QUIZZES ----------

def initialize_quiz_db():
    with db() as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS lecture_quizzes (
            id TEXT PRIMARY KEY,
            lecture_id TEXT NOT NULL,
            questions TEXT NOT NULL,
            answer_key TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """)

initialize_quiz_db()


def generate_lecture_quiz(lecture_id, count=5, difficulty="medium"):
    lecture = get_lecture(lecture_id)
    if not lecture:
        raise ValueError("Lecture not found.")

    transcript = lecture["transcript"]
    sections = chunks(transcript, size=10000)

    # Use representative lecture sections for long transcripts.
    if len(sections) > 5:
        indexes = [round(i * (len(sections) - 1) / 4) for i in range(5)]
        selected = [sections[i] for i in sorted(set(indexes))]
    else:
        selected = sections

    source = "\n\n".join(selected)

    raw = ai_call(
        "You create academically accurate multiple-choice quizzes. "
        "Every question and correct answer MUST be supported by the "
        "provided lecture transcript. Never use outside knowledge. "
        "Each question must have exactly four distinct options and one "
        "unambiguous correct answer. Return valid JSON only.",
        f"""
Create exactly {count} {difficulty} difficulty MCQs.

JSON format:
{{
 "questions": [
  {{
   "question": "question text",
   "options": ["A", "B", "C", "D"],
   "correct_answer": 0,
   "explanation": "brief explanation supported by the lecture"
  }}
 ]
}}

LECTURE TRANSCRIPT:
{source}
""",
        3000,
    )

    try:
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
        parsed = json.loads(cleaned)
        raw_questions = parsed["questions"]
    except (ValueError, TypeError, KeyError):
        raise ValueError("AI could not produce valid quiz questions. Please retry.")

    questions = []
    answer_key = {}

    for item in raw_questions:
        if len(questions) >= count:
            break

        options = item.get("options")
        answer = item.get("correct_answer")

        if (
            not isinstance(item.get("question"), str)
            or not isinstance(options, list)
            or len(options) != 4
            or not all(isinstance(x, str) for x in options)
            or not isinstance(answer, int)
            or isinstance(answer, bool)
            or answer not in range(4)
        ):
            continue

        question_id = str(uuid.uuid4())
        questions.append({
            "id": question_id,
            "question": item["question"],
            "options": options,
        })
        answer_key[question_id] = {
            "correct_answer": answer,
            "explanation": str(item.get("explanation", "")),
        }

    if len(questions) != count:
        raise ValueError(
            f"AI generated only {len(questions)} valid questions. Retry the quiz."
        )

    quiz_id = str(uuid.uuid4())
    created = datetime.now(timezone.utc).isoformat()

    with db() as conn:
        conn.execute("""
        INSERT INTO lecture_quizzes
        (id, lecture_id, questions, answer_key, created_at)
        VALUES (?, ?, ?, ?, ?)
        """, (
            quiz_id,
            lecture_id,
            json.dumps(questions, ensure_ascii=False),
            json.dumps(answer_key, ensure_ascii=False),
            created,
        ))

    return {
        "quiz_id": quiz_id,
        "lecture_id": lecture_id,
        "difficulty": difficulty,
        "questions": questions,
        "total_questions": len(questions),
    }


def submit_lecture_quiz(quiz_id, answers):
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM lecture_quizzes WHERE id = ?",
            (quiz_id,),
        ).fetchone()

    if not row:
        raise ValueError("Quiz not found.")

    questions = json.loads(row["questions"])
    key = json.loads(row["answer_key"])

    correct = 0
    results = []

    for question in questions:
        qid = question["id"]
        submitted = answers.get(qid)
        expected = key[qid]["correct_answer"]
        is_correct = submitted == expected

        if is_correct:
            correct += 1

        results.append({
            "question_id": qid,
            "correct": is_correct,
            "correct_answer": expected,
            "explanation": key[qid]["explanation"],
        })

    total = len(questions)
    percentage = round(correct / total * 100, 2) if total else 0
    created = datetime.now(timezone.utc).isoformat()
    attempt_id = str(uuid.uuid4())

    with db() as conn:
        conn.execute("""
            INSERT INTO lecture_quiz_attempts
            (id, quiz_id, lecture_id, score, total, percentage,
             answers, results, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            attempt_id,
            quiz_id,
            row["lecture_id"],
            correct,
            total,
            percentage,
            json.dumps(answers, ensure_ascii=False),
            json.dumps(results, ensure_ascii=False),
            created,
        ))

    return {
        "quiz_id": quiz_id,
        "attempt_id": attempt_id,
        "score": correct,
        "total": total,
        "percentage": percentage,
        "results": results,
    }



# ---------- PERSISTENT QUIZ ATTEMPT HISTORY ----------

def initialize_quiz_attempts_db():
    with db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS lecture_quiz_attempts (
                id TEXT PRIMARY KEY,
                quiz_id TEXT NOT NULL,
                lecture_id TEXT NOT NULL,
                score INTEGER NOT NULL,
                total INTEGER NOT NULL,
                percentage REAL NOT NULL,
                answers TEXT NOT NULL,
                results TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_lecture_attempts
            ON lecture_quiz_attempts(lecture_id, created_at)
        """)


initialize_quiz_attempts_db()


def get_lecture_quiz_history(lecture_id):
    with db() as conn:
        rows = conn.execute("""
            SELECT id, quiz_id, lecture_id, score, total,
                   percentage, created_at
            FROM lecture_quiz_attempts
            WHERE lecture_id = ?
            ORDER BY created_at DESC
            LIMIT 100
        """, (lecture_id,)).fetchall()

    return [dict(row) for row in rows]

