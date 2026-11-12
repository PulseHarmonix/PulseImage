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
            follow_on_video INTEGER DEFAULT 0,
            error TEXT DEFAULT '',
            created TEXT DEFAULT (datetime('now')),
            last_updated TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS story_projects (
            id TEXT PRIMARY KEY,
            title TEXT DEFAULT 'Untitled Story',
            premise TEXT DEFAULT '',
            settings TEXT DEFAULT '{}',
            plan TEXT DEFAULT '{}',
            created TEXT DEFAULT (datetime('now')),
            last_updated TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS story_cast (
            story_id TEXT NOT NULL,
            character_asset_id TEXT NOT NULL,
            role_name TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            PRIMARY KEY (story_id, character_asset_id)
        );
        CREATE TABLE IF NOT EXISTS story_scenes (
            id TEXT PRIMARY KEY,
            story_id TEXT NOT NULL,
            scene_number INTEGER NOT NULL,
            title TEXT DEFAULT '',
            synopsis TEXT DEFAULT '',
            location TEXT DEFAULT '',
            time_of_day TEXT DEFAULT '',
            mood TEXT DEFAULT '',
            anchor_image_id TEXT,
            created TEXT DEFAULT (datetime('now')),
            last_updated TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS story_shots (
            id TEXT PRIMARY KEY,
            scene_id TEXT NOT NULL,
            shot_number INTEGER NOT NULL,
            duration REAL DEFAULT 6,
            action TEXT DEFAULT '',
            camera TEXT DEFAULT '',
            image_prompt TEXT DEFAULT '',
            video_prompt TEXT DEFAULT '',
            character_asset_ids TEXT DEFAULT '[]',
            continuity_mode TEXT DEFAULT 'same_scene_frame',
            parent_shot_id TEXT,
            status TEXT DEFAULT 'draft',
            selected_image_id TEXT,
            candidate_image_ids TEXT DEFAULT '[]',
            video_asset_id TEXT,
            error TEXT DEFAULT '',
            settings TEXT DEFAULT '{}',
            created TEXT DEFAULT (datetime('now')),
            last_updated TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS story_scene_assets (
            id TEXT PRIMARY KEY,
            scene_id TEXT NOT NULL,
            asset_id TEXT NOT NULL,
            role TEXT DEFAULT 'background',
            label TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            created TEXT DEFAULT (datetime('now')),
            last_updated TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_story_cast_story
            ON story_cast(story_id);
        CREATE INDEX IF NOT EXISTS idx_story_scenes_story
            ON story_scenes(story_id, scene_number);
        CREATE INDEX IF NOT EXISTS idx_story_shots_scene
            ON story_shots(scene_id, shot_number);
        CREATE INDEX IF NOT EXISTS idx_story_shots_video
            ON story_shots(video_asset_id);
        CREATE INDEX IF NOT EXISTS idx_story_scene_assets_scene
            ON story_scene_assets(scene_id);
        CREATE INDEX IF NOT EXISTS idx_story_scene_assets_asset
            ON story_scene_assets(asset_id);
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
    if "follow_on_video" not in seg_cols:
        conn.execute("ALTER TABLE music_segments ADD COLUMN follow_on_video INTEGER DEFAULT 0")
    slot_cols = [r[1] for r in conn.execute("PRAGMA table_info(music_slots)").fetchall()]
    if "images" not in slot_cols:
        conn.execute("ALTER TABLE music_slots ADD COLUMN images TEXT DEFAULT '[]'")
    scene_cols = [r[1] for r in conn.execute("PRAGMA table_info(story_scenes)").fetchall()]
    scene_columns = {
        "props": "TEXT DEFAULT ''",
        "lighting": "TEXT DEFAULT ''",
        "weather": "TEXT DEFAULT ''",
        "palette": "TEXT DEFAULT ''",
        "negative_prompt": "TEXT DEFAULT ''",
        "anchor_frames": "TEXT DEFAULT '[]'",
        "anchor_source_video": "TEXT DEFAULT ''",
        "anchor_cache_key": "TEXT DEFAULT ''",
        "anchor_frame_index": "INTEGER",
    }
    for column, definition in scene_columns.items():
        if column not in scene_cols:
            conn.execute(f"ALTER TABLE story_scenes ADD COLUMN {column} {definition}")
    conn.commit()
    conn.close()
