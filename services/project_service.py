import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

# ==================== PROJECTS PERSISTENCE (for waveform timeline + cue sequencing) ====================

PROJECTS_FILE = "projects.json"

def load_projects():
    if not os.path.exists(PROJECTS_FILE):
        return []

    with open(PROJECTS_FILE, "r") as f:
        projects = json.load(f)

    needs_save = False
    for p in projects:
        if "id" not in p:
            p["id"] = str(uuid.uuid4())
            needs_save = True
        if "cues" not in p or not isinstance(p.get("cues"), list):
            p["cues"] = []
            needs_save = True
        if "created" not in p:
            p["created"] = datetime.now().isoformat()
            needs_save = True
        if "last_updated" not in p:
            p["last_updated"] = datetime.now().isoformat()
            needs_save = True
        if "resolution" not in p:
            p["resolution"] = "720p"
            needs_save = True
        if "aspect_ratio" not in p:
            p["aspect_ratio"] = "3:2"
            needs_save = True
        for c in p.get("cues", []):
            if "id" not in c:
                c["id"] = str(uuid.uuid4())
                needs_save = True
            if "candidates" not in c or not isinstance(c.get("candidates"), list):
                c["candidates"] = []
                needs_save = True
            if "time" not in c:
                c["time"] = 0.0
                needs_save = True
            if "prompt" not in c:
                c["prompt"] = ""
                needs_save = True
            if "video_id" not in c:
                c["video_id"] = None
                needs_save = True
            if "selected_image_id" not in c:
                c["selected_image_id"] = None
                needs_save = True
            if "video_prompt" not in c:
                c["video_prompt"] = ""
                needs_save = True
            if "mute_audio" not in c:
                c["mute_audio"] = False
                needs_save = True
            if "video_start_offset" not in c or not isinstance(c.get("video_start_offset"), (int, float)):
                c["video_start_offset"] = 0
                needs_save = True
            if "lora_name" not in c:
                c["lora_name"] = None
                needs_save = True

        # Story Mode extension (optional sub-object). Keep it when present; normalize scenes/characters defensively.
        if "story" in p and p.get("story"):
            st = p["story"]
            if not isinstance(st, dict):
                p["story"] = None
                needs_save = True
            else:
                if "characters" not in st or not isinstance(st.get("characters"), list):
                    st["characters"] = []
                    needs_save = True
                if "scenes" not in st or not isinstance(st.get("scenes"), list):
                    st["scenes"] = []
                    needs_save = True
                for sc in st.get("scenes", []):
                    if isinstance(sc, dict):
                        if "id" not in sc:
                            sc["id"] = str(uuid.uuid4())
                            needs_save = True
                        if "candidates" not in sc or not isinstance(sc.get("candidates"), list):
                            sc["candidates"] = []
                            needs_save = True
                        if "selected_image_id" not in sc:
                            sc["selected_image_id"] = None
                            needs_save = True
                        if "video_id" not in sc:
                            sc["video_id"] = None
                            needs_save = True
                        if "status" not in sc:
                            sc["status"] = "draft"
                            needs_save = True
                        if "prompt" not in sc:
                            sc["prompt"] = ""
                            needs_save = True
                        if "high_level_description" not in sc:
                            sc["high_level_description"] = sc.get("title", "")
                            needs_save = True
    if needs_save:
        with open(PROJECTS_FILE, "w") as f:
            json.dump(projects, f, indent=2)
    return projects

def save_project(project: dict):
    projects = load_projects()
    found = False
    now = datetime.now().isoformat()
    for i, p in enumerate(projects):
        if p.get("id") == project.get("id"):
            project["last_updated"] = now
            if "created" not in project:
                project["created"] = p.get("created", now)
            projects[i] = project
            found = True
            break
    if not found:
        if "id" not in project or not project["id"]:
            project["id"] = str(uuid.uuid4())
        if "created" not in project:
            project["created"] = now
        project["last_updated"] = now
        if "cues" not in project or not isinstance(project.get("cues"), list):
            project["cues"] = []
        projects.append(project)
    with open(PROJECTS_FILE, "w") as f:
        json.dump(projects, f, indent=2)
    return project["id"]

def update_project(project_id: str, updates: dict):
    """Top-level updates only (for full cue edits prefer save_project with full object)."""
    projects = load_projects()
    for p in projects:
        if p.get("id") == project_id:
            p.update(updates)
            p["last_updated"] = datetime.now().isoformat()
            with open(PROJECTS_FILE, "w") as f:
                json.dump(projects, f, indent=2)
            return True
    return False


def delete_project(project_id: str):
    projects = load_projects()
    new_list = [p for p in projects if p.get("id") != project_id]
    with open(PROJECTS_FILE, "w") as f:
        json.dump(new_list, f, indent=2)
    return True
