import sqlite3
import uuid
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "environment_memory.db"
CONVERSATIONS = "environment_conversations"
MESSAGES = "environment_messages"

def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn

def initialize_memory():
    with get_connection() as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS " + CONVERSATIONS + " (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)")
        conn.execute("CREATE TABLE IF NOT EXISTS " + MESSAGES + " (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('user','assistant')), content TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(conversation_id) REFERENCES " + CONVERSATIONS + "(id))")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_environment_messages_conversation ON " + MESSAGES + "(conversation_id, id)")

def get_or_create_conversation(conversation_id=None):
    initialize_memory()
    if conversation_id:
        try: conversation_id = str(uuid.UUID(str(conversation_id)))
        except (ValueError, TypeError, AttributeError): raise ValueError("Invalid conversation ID")
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        if conversation_id:
            row = conn.execute("SELECT id FROM " + CONVERSATIONS + " WHERE id=?", (conversation_id,)).fetchone()
            if row: return conversation_id
        new_id = str(uuid.uuid4())
        conn.execute("INSERT INTO " + CONVERSATIONS + " (id,created_at,updated_at) VALUES (?,?,?)", (new_id, now, now))
        return new_id

def save_message(conversation_id, role, content):
    if role not in ("user", "assistant") or not isinstance(content, str) or not content.strip(): raise ValueError("Invalid message")
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute("INSERT INTO " + MESSAGES + " (conversation_id,role,content,created_at) VALUES (?,?,?,?)", (conversation_id, role, content[:12000], now))
        conn.execute("UPDATE " + CONVERSATIONS + " SET updated_at=? WHERE id=?", (now, conversation_id))

def get_recent_messages(conversation_id, limit=12):
    initialize_memory()
    with get_connection() as conn:
        rows = conn.execute("SELECT role,content FROM " + MESSAGES + " WHERE conversation_id=? ORDER BY id DESC LIMIT ?", (conversation_id, max(1,min(int(limit),30)))).fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]

def get_conversation_history(conversation_id):
    initialize_memory()
    try: conversation_id = str(uuid.UUID(str(conversation_id)))
    except (ValueError, TypeError, AttributeError): raise ValueError("Invalid conversation ID")
    with get_connection() as conn:
        exists = conn.execute("SELECT id FROM " + CONVERSATIONS + " WHERE id=?", (conversation_id,)).fetchone()
        if not exists: return []
        rows = conn.execute("SELECT role,content,created_at FROM " + MESSAGES + " WHERE conversation_id=? ORDER BY id", (conversation_id,)).fetchall()
    return [{"role":r["role"],"content":r["content"],"created_at":r["created_at"]} for r in rows]

initialize_memory()
