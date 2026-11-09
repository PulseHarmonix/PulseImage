import sqlite3
import os

DB_FILE = "pulseimage.db"


def get_db() -> sqlite3.Connection:
    """Return a new SQLite connection to the pulseimage database."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create all required tables if they do not exist."""
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS generations (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL DEFAULT 'image',
            prompt TEXT DEFAULT '',
            filename TEXT NOT NULL DEFAULT '',
            width INTEGER DEFAULT 0,
            height INTEGER DEFAULT 0,
            aspect_ratio TEXT DEFAULT '3:2',
            duration REAL,
            parent_id TEXT,
            favorite INTEGER DEFAULT 0,
            character INTEGER DEFAULT 0,
            voice INTEGER DEFAULT 0,
            metadata TEXT DEFAULT '{}',
            thumbnail BLOB,
            created TEXT,
            last_updated TEXT
        );
        CREATE TABLE IF NOT EXISTS music_projects (
            id TEXT PRIMARY KEY,
            title TEXT DEFAULT 'Untitled Music Video',
            settings TEXT DEFAULT '{}',
            audio TEXT DEFAULT '{}',
            created TEXT DEFAULT (datetime('now')),
            last_updated TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS music_slots (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            slot_number INTEGER NOT NULL,
            name TEXT DEFAULT '',
            image TEXT DEFAULT '{}',
            images TEXT DEFAULT '[]',
            created TEXT DEFAULT (datetime('now')),
            last_updated TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS music_segments (
            id TEXT PRIMARY KEY,
            slot_id TEXT NOT NULL,
            start_time REAL DEFAULT 0,
            end_time REAL DEFAULT 0,
            prompt TEXT DEFAULT '',
            status TEXT DEFAULT 'draft',
            video_asset_id TEXT,
            video_filename TEXT,
            follow_on INTEGER DEFAULT 0,
            error TEXT DEFAULT '',
            created TEXT DEFAULT (datetime('now')),
            last_updated TEXT DEFAULT (datetime('now'))
        );
    """)
    # Rename old default slot labels; no-ops once applied.
    conn.execute("UPDATE music_slots SET name = 'Group' WHERE name = 'Character 5'")
    conn.execute("UPDATE music_slots SET name = 'Piano' WHERE name = 'Character 6'")
    # Add the character flag to older databases.
    gen_cols = [r[1] for r in conn.execute("PRAGMA table_info(generations)").fetchall()]
    if "character" not in gen_cols:
        conn.execute("ALTER TABLE generations ADD COLUMN character INTEGER DEFAULT 0")
    if "voice" not in gen_cols:
        conn.execute("ALTER TABLE generations ADD COLUMN voice INTEGER DEFAULT 0")
    seg_cols = [r[1] for r in conn.execute("PRAGMA table_info(music_segments)").fetchall()]
    if "follow_on" not in seg_cols:
        conn.execute("ALTER TABLE music_segments ADD COLUMN follow_on INTEGER DEFAULT 0")
    slot_cols = [r[1] for r in conn.execute("PRAGMA table_info(music_slots)").fetchall()]
    if "images" not in slot_cols:
        conn.execute("ALTER TABLE music_slots ADD COLUMN images TEXT DEFAULT '[]'")
    conn.commit()
    conn.close()
