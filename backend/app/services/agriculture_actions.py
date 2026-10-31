from pathlib import Path
import sqlite3
import uuid

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "agriculture_memory.db"


def initialize_actions():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS farm_actions (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                due_date TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)


def create_action(conversation_id, title, description="", due_date=None):
    if not title or not title.strip():
        raise ValueError("Task title is required")

    action_id = str(uuid.uuid4())

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            INSERT INTO farm_actions
            (id, conversation_id, title, description, due_date)
            VALUES (?, ?, ?, ?, ?)
        """, (
            action_id,
            conversation_id,
            title.strip(),
            description,
            due_date
        ))

    return get_action(action_id)


def get_action(action_id):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM farm_actions WHERE id = ?",
            (action_id,)
        ).fetchone()

    return dict(row) if row else None


def get_actions(conversation_id):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""
            SELECT * FROM farm_actions
            WHERE conversation_id = ?
            ORDER BY
                CASE status WHEN 'pending' THEN 0 ELSE 1 END,
                due_date IS NULL,
                due_date ASC,
                created_at DESC
        """, (conversation_id,)).fetchall()

    return [dict(row) for row in rows]


def update_action(action_id, status=None, description=None):
    allowed_statuses = {"pending", "in_progress", "completed"}

    if status is not None and status not in allowed_statuses:
        raise ValueError("Invalid task status")

    action = get_action(action_id)
    if not action:
        return None

    new_status = status if status is not None else action["status"]
    new_description = (
        description if description is not None else action["description"]
    )

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            UPDATE farm_actions
            SET status = ?, description = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (new_status, new_description, action_id))

    return get_action(action_id)


initialize_actions()
