import sqlite3
import uuid
from pathlib import Path
from datetime import datetime, timezone


DB_PATH = Path(__file__).resolve().parents[2] / "data" / "agriculture_memory.db"


def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_recommendations():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS agriculture_recommendations (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                recommendation TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'chat',
                status TEXT NOT NULL DEFAULT 'saved'
                    CHECK(status IN ('saved', 'approved', 'converted')),
                linked_action_id TEXT,
                created_at TEXT NOT NULL,
                approved_at TEXT,
                converted_at TEXT
            )
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_recommendations_conversation
            ON agriculture_recommendations(conversation_id, created_at DESC)
        """)


def save_recommendation(conversation_id, recommendation, source="chat"):
    try:
        conversation_id = str(uuid.UUID(conversation_id))
    except (ValueError, TypeError, AttributeError):
        raise ValueError("Invalid conversation ID")

    recommendation = recommendation.strip()

    if not recommendation:
        raise ValueError("Recommendation cannot be empty")

    if source not in {"chat", "image"}:
        raise ValueError("Source must be chat or image")

    recommendation_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        conversation = connection.execute(
            "SELECT id FROM conversations WHERE id = ?",
            (conversation_id,)
        ).fetchone()

        if not conversation:
            raise ValueError("Conversation not found")

        existing = connection.execute("""
            SELECT * FROM agriculture_recommendations
            WHERE conversation_id = ?
              AND LOWER(TRIM(recommendation)) = LOWER(TRIM(?))
              AND status IN ('saved', 'approved')
            ORDER BY created_at DESC
            LIMIT 1
        """, (conversation_id, recommendation)).fetchone()

        if existing:
            return dict(existing)

        connection.execute("""
            INSERT INTO agriculture_recommendations (
                id, conversation_id, recommendation,
                source, status, created_at
            )
            VALUES (?, ?, ?, ?, 'saved', ?)
        """, (
            recommendation_id,
            conversation_id,
            recommendation,
            source,
            now
        ))

    return get_recommendation(recommendation_id)


def get_recommendation(recommendation_id):
    with get_connection() as connection:
        row = connection.execute("""
            SELECT * FROM agriculture_recommendations
            WHERE id = ?
        """, (recommendation_id,)).fetchone()

    return dict(row) if row else None


def get_recommendations(conversation_id):
    try:
        conversation_id = str(uuid.UUID(conversation_id))
    except (ValueError, TypeError, AttributeError):
        raise ValueError("Invalid conversation ID")

    with get_connection() as connection:
        rows = connection.execute("""
            SELECT * FROM agriculture_recommendations
            WHERE conversation_id = ?
            ORDER BY created_at DESC
        """, (conversation_id,)).fetchall()

    return [dict(row) for row in rows]


def approve_recommendation(recommendation_id, conversation_id):
    try:
        conversation_id = str(uuid.UUID(conversation_id))
    except (ValueError, TypeError, AttributeError):
        raise ValueError("Invalid conversation ID")

    now = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        row = connection.execute("""
            SELECT * FROM agriculture_recommendations
            WHERE id = ? AND conversation_id = ?
        """, (recommendation_id, conversation_id)).fetchone()

        if not row:
            return None

        if row["status"] == "converted":
            raise ValueError("Recommendation is already converted")

        if row["status"] == "saved":
            connection.execute("""
                UPDATE agriculture_recommendations
                SET status = 'approved', approved_at = ?
                WHERE id = ? AND conversation_id = ?
            """, (now, recommendation_id, conversation_id))

    return get_recommendation(recommendation_id)


def convert_recommendation_to_task(
    recommendation_id,
    conversation_id,
    title,
    due_date=None
):
    try:
        conversation_id = str(uuid.UUID(conversation_id))
    except (ValueError, TypeError, AttributeError):
        raise ValueError("Invalid conversation ID")

    title = title.strip()

    if not title:
        raise ValueError("Task title is required")

    now = datetime.now(timezone.utc).isoformat()
    action_id = str(uuid.uuid4())

    with get_connection() as connection:
        row = connection.execute("""
            SELECT * FROM agriculture_recommendations
            WHERE id = ? AND conversation_id = ?
        """, (recommendation_id, conversation_id)).fetchone()

        if not row:
            raise ValueError("Recommendation not found")

        if row["status"] != "approved":
            raise ValueError("Approve the recommendation before converting it")

        connection.execute("""
            INSERT INTO farm_actions (
                id, conversation_id, title,
                description, status, due_date
            )
            VALUES (?, ?, ?, ?, 'pending', ?)
        """, (
            action_id,
            conversation_id,
            title,
            row["recommendation"],
            due_date
        ))

        connection.execute("""
            UPDATE agriculture_recommendations
            SET status = 'converted',
                linked_action_id = ?,
                converted_at = ?
            WHERE id = ? AND conversation_id = ?
        """, (
            action_id,
            now,
            recommendation_id,
            conversation_id
        ))

    return {
        "recommendation": get_recommendation(recommendation_id),
        "action_id": action_id
    }


initialize_recommendations()
