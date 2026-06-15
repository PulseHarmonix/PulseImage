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
            metadata TEXT DEFAULT '{}',
            thumbnail BLOB,
            created TEXT,
            last_updated TEXT
        );
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            title TEXT DEFAULT 'New Chat',
            created TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS director_sessions (
            id TEXT PRIMARY KEY,
            title TEXT DEFAULT 'New Director Session',
            settings TEXT DEFAULT '{}',
            main_audio_id TEXT,
            created TEXT DEFAULT (datetime('now')),
            last_updated TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS director_scenes (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            scene_number INTEGER NOT NULL,
            start_time REAL DEFAULT 0,
            duration REAL DEFAULT 5,
            description TEXT DEFAULT '',
            characters TEXT DEFAULT '[]',
            generated_prompt TEXT DEFAULT '',
            candidate_images TEXT DEFAULT '[]',
            selected_image_id TEXT,
            video_id TEXT,
            video_duration REAL,
            audio_muted INTEGER DEFAULT 0,
            dialogue TEXT DEFAULT '',
            lora_name TEXT,
            lora_strength REAL DEFAULT 0.6,
            status TEXT DEFAULT 'draft'
        );
        CREATE TABLE IF NOT EXISTS director_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            scene_data TEXT,
            asset_ids TEXT DEFAULT '[]',
            timestamp TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS director_available_assets (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            asset_id TEXT NOT NULL,
            type TEXT NOT NULL,
            filename TEXT NOT NULL
        );
    """)
    conn.commit()
    conn.close()
