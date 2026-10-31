import json
import sqlite3
import uuid
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "module_records.db"

ALLOWED_MODULES = {"healthcare", "government", "environment", "finance"}

def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection

def initialize_records():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS module_records (
                id TEXT PRIMARY KEY,
                module TEXT NOT NULL,
                workspace_id TEXT NOT NULL,
                title TEXT NOT NULL,
                data_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_module_records_workspace
            ON module_records(module, workspace_id, created_at)
        """)

def create_record(module, workspace_id, title, data):
    initialize_records()
    if module not in ALLOWED_MODULES:
        raise ValueError("Unsupported module")
    if not isinstance(data, dict):
        raise ValueError("Record data must be an object")
    if len(json.dumps(data, ensure_ascii=False)) > 50000:
        raise ValueError("Record data is too large")

    record_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        connection.execute("""
            INSERT INTO module_records
            (id, module, workspace_id, title, data_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            record_id, module, workspace_id, title.strip(),
            json.dumps(data, ensure_ascii=False), now, now
        ))

    return get_record(record_id, module, workspace_id)

def get_record(record_id, module, workspace_id):
    initialize_records()
    with get_connection() as connection:
        row = connection.execute("""
            SELECT * FROM module_records
            WHERE id = ? AND module = ? AND workspace_id = ?
        """, (record_id, module, workspace_id)).fetchone()

    if not row:
        return None

    result = dict(row)
    result["data"] = json.loads(result.pop("data_json"))
    return result

def list_records(module, workspace_id, limit=100):
    initialize_records()
    if module not in ALLOWED_MODULES:
        raise ValueError("Unsupported module")

    with get_connection() as connection:
        rows = connection.execute("""
            SELECT * FROM module_records
            WHERE module = ? AND workspace_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (module, workspace_id, limit)).fetchall()

    records = []
    for row in rows:
        item = dict(row)
        item["data"] = json.loads(item.pop("data_json"))
        records.append(item)
    return records

def delete_record(record_id, module, workspace_id):
    initialize_records()
    with get_connection() as connection:
        cursor = connection.execute("""
            DELETE FROM module_records
            WHERE id = ? AND module = ? AND workspace_id = ?
        """, (record_id, module, workspace_id))
        return cursor.rowcount > 0


def update_record(record_id, module, workspace_id, title, data):
    """Replace a workspace record's title and data, scoped to its workspace."""
    initialize_records()
    if module not in ALLOWED_MODULES:
        raise ValueError("Unsupported module")
    if not isinstance(data, dict):
        raise ValueError("Record data must be an object")
    if len(json.dumps(data, ensure_ascii=False)) > 50000:
        raise ValueError("Record data is too large")
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as connection:
        cursor = connection.execute(
            "UPDATE module_records SET title = ?, data_json = ?, updated_at = ? "
            "WHERE id = ? AND module = ? AND workspace_id = ?",
            (title.strip(), json.dumps(data, ensure_ascii=False), now, record_id, module, workspace_id)
        )
        if cursor.rowcount == 0:
            return None
    return get_record(record_id, module, workspace_id)
