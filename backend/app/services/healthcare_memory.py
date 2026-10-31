import sqlite3
import uuid
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "healthcare_memory.db"


def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_memory():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS healthcare_conversations (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS healthcare_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(conversation_id)
                    REFERENCES healthcare_conversations(id)
            )
        """)
        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_healthcare_messages_conversation
            ON healthcare_messages(conversation_id, id)
        """)


def get_or_create_conversation(conversation_id=None):
    initialize_memory()

    if conversation_id:
        try:
            conversation_id = str(uuid.UUID(str(conversation_id)))
        except (ValueError, TypeError, AttributeError):
            raise ValueError("Invalid conversation ID")

    now = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        if conversation_id:
            existing = connection.execute(
                "SELECT id FROM healthcare_conversations WHERE id = ?",
                (conversation_id,)
            ).fetchone()
            if existing:
                return conversation_id

        new_id = str(uuid.uuid4())
        connection.execute("""
            INSERT INTO healthcare_conversations (id, created_at, updated_at)
            VALUES (?, ?, ?)
        """, (new_id, now, now))
        return new_id


def save_message(conversation_id, role, content):
    if role not in ("user", "assistant"):
        raise ValueError("Invalid message role")

    now = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        connection.execute("""
            INSERT INTO healthcare_messages
            (conversation_id, role, content, created_at)
            VALUES (?, ?, ?, ?)
        """, (conversation_id, role, content, now))

        connection.execute("""
            UPDATE healthcare_conversations
            SET updated_at = ?
            WHERE id = ?
        """, (now, conversation_id))


def get_recent_messages(conversation_id, limit=12):
    initialize_memory()

    with get_connection() as connection:
        rows = connection.execute("""
            SELECT role, content
            FROM healthcare_messages
            WHERE conversation_id = ?
            ORDER BY id DESC
            LIMIT ?
        """, (conversation_id, limit)).fetchall()

    return [
        {"role": row["role"], "content": row["content"]}
        for row in reversed(rows)
    ]


def get_conversation_history(conversation_id):
    initialize_memory()

    try:
        conversation_id = str(uuid.UUID(str(conversation_id)))
    except (ValueError, TypeError, AttributeError):
        raise ValueError("Invalid conversation ID")

    with get_connection() as connection:
        exists = connection.execute(
            "SELECT id FROM healthcare_conversations WHERE id = ?",
            (conversation_id,)
        ).fetchone()

        if not exists:
            return []

        rows = connection.execute("""
            SELECT role, content, created_at
            FROM healthcare_messages
            WHERE conversation_id = ?
            ORDER BY id ASC
        """, (conversation_id,)).fetchall()

    return [
        {
            "role": row["role"],
            "content": row["content"],
            "created_at": row["created_at"]
        }
        for row in rows
    ]


initialize_memory()