import json
import sqlite3
import uuid
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "education_memory.db"


def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_quiz_tables():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS education_quizzes (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                topic TEXT NOT NULL,
                difficulty TEXT NOT NULL,
                questions_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(conversation_id)
                    REFERENCES education_conversations(id)
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS education_quiz_attempts (
                id TEXT PRIMARY KEY,
                quiz_id TEXT NOT NULL,
                conversation_id TEXT NOT NULL,
                answers_json TEXT NOT NULL,
                score INTEGER NOT NULL,
                total_questions INTEGER NOT NULL,
                percentage REAL NOT NULL,
                submitted_at TEXT NOT NULL,
                FOREIGN KEY(quiz_id) REFERENCES education_quizzes(id),
                FOREIGN KEY(conversation_id)
                    REFERENCES education_conversations(id)
            )
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_education_quizzes_conversation
            ON education_quizzes(conversation_id, created_at)
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_education_attempts_conversation
            ON education_quiz_attempts(conversation_id, submitted_at)
        """)


def create_quiz(conversation_id, topic, difficulty, questions):
    if not isinstance(questions, list) or not questions:
        raise ValueError("Quiz must contain at least one question.")

    quiz_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        exists = connection.execute(
            "SELECT id FROM education_conversations WHERE id = ?",
            (conversation_id,)
        ).fetchone()

        if not exists:
            raise ValueError("Education conversation not found.")

        connection.execute("""
            INSERT INTO education_quizzes (
                id, conversation_id, topic, difficulty,
                questions_json, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            quiz_id,
            conversation_id,
            topic,
            difficulty,
            json.dumps(questions, ensure_ascii=False),
            now
        ))

    return {
        "id": quiz_id,
        "conversation_id": conversation_id,
        "topic": topic,
        "difficulty": difficulty,
        "total_questions": len(questions),
        "created_at": now
    }


def get_quiz(quiz_id, conversation_id):
    try:
        quiz_id = str(uuid.UUID(str(quiz_id)))
        conversation_id = str(uuid.UUID(str(conversation_id)))
    except (ValueError, TypeError, AttributeError):
        raise ValueError("Invalid quiz or conversation ID.")

    with get_connection() as connection:
        row = connection.execute("""
            SELECT *
            FROM education_quizzes
            WHERE id = ? AND conversation_id = ?
        """, (quiz_id, conversation_id)).fetchone()

    if not row:
        raise ValueError("Quiz not found.")

    return {
        "id": row["id"],
        "conversation_id": row["conversation_id"],
        "topic": row["topic"],
        "difficulty": row["difficulty"],
        "questions": json.loads(row["questions_json"]),
        "created_at": row["created_at"]
    }


def submit_quiz(quiz_id, conversation_id, answers):
    if not isinstance(answers, dict):
        raise ValueError("Answers must be an object.")

    quiz = get_quiz(quiz_id, conversation_id)
    questions = quiz["questions"]

    if len(answers) != len(questions):
        raise ValueError("Please answer every question before submitting.")

    results = []
    score = 0

    for index, question in enumerate(questions):
        question_id = str(index + 1)
        selected = answers.get(question_id)

        if not isinstance(selected, str):
            raise ValueError(f"Invalid answer for question {question_id}.")

        correct = question["correct_answer"]
        is_correct = selected == correct

        if is_correct:
            score += 1

        results.append({
            "question_id": question_id,
            "selected_answer": selected,
            "correct_answer": correct,
            "is_correct": is_correct,
            "explanation": question["explanation"]
        })

    percentage = round((score / len(questions)) * 100, 2)
    attempt_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        connection.execute("""
            INSERT INTO education_quiz_attempts (
                id, quiz_id, conversation_id, answers_json,
                score, total_questions, percentage, submitted_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            attempt_id,
            quiz_id,
            conversation_id,
            json.dumps(answers, ensure_ascii=False),
            score,
            len(questions),
            percentage,
            now
        ))

    return {
        "attempt_id": attempt_id,
        "quiz_id": quiz_id,
        "topic": quiz["topic"],
        "score": score,
        "total_questions": len(questions),
        "percentage": percentage,
        "results": results,
        "submitted_at": now
    }


def get_quiz_history(conversation_id, limit=20):
    try:
        conversation_id = str(uuid.UUID(str(conversation_id)))
    except (ValueError, TypeError, AttributeError):
        raise ValueError("Invalid conversation ID.")

    limit = max(1, min(int(limit), 100))

    with get_connection() as connection:
        rows = connection.execute("""
            SELECT a.id, a.quiz_id, q.topic, q.difficulty,
                   a.score, a.total_questions, a.percentage,
                   a.submitted_at
            FROM education_quiz_attempts a
            JOIN education_quizzes q ON q.id = a.quiz_id
            WHERE a.conversation_id = ?
            ORDER BY a.submitted_at DESC
            LIMIT ?
        """, (conversation_id, limit)).fetchall()

    return [dict(row) for row in rows]


def get_quiz_progress(conversation_id):
    history = get_quiz_history(conversation_id, limit=100)

    if not history:
        return {
            "total_attempts": 0,
            "average_percentage": 0,
            "best_percentage": 0,
            "total_questions_answered": 0
        }

    percentages = [item["percentage"] for item in history]

    return {
        "total_attempts": len(history),
        "average_percentage": round(
            sum(percentages) / len(percentages), 2
        ),
        "best_percentage": max(percentages),
        "total_questions_answered": sum(
            item["total_questions"] for item in history
        )
    }


initialize_quiz_tables()

