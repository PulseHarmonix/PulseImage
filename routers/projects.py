import uuid
from datetime import datetime
from fastapi import APIRouter, Request
from services.project_service import (
    load_projects,
    save_project,
    update_project,
    delete_project,
)

router = APIRouter()

# ==================== PROJECT ROUTES ====================

@router.get("/projects")
async def get_projects():
    return load_projects()

@router.post("/save-project")
async def save_project_endpoint(request: Request):
    try:
        data = await request.json()
        if not isinstance(data, dict):
            return {"success": False, "error": "project object required"}
        pid = save_project(data)
        return {"success": True, "id": pid}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

@router.post("/update-project")
async def update_project_endpoint(request: Request):
    try:
        data = await request.json()
        pid = data.get("id")
        if not pid:
            return {"success": False, "error": "id is required"}
        updates = {k: v for k, v in data.items() if k != "id"}
        if not updates:
            return {"success": False, "error": "no valid updates provided"}
        success = update_project(pid, updates)
        if success:
            return {"success": True}
        return {"success": False, "error": "project not found"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

@router.post("/delete-project")
async def delete_project_endpoint(request: Request):
    try:
        data = await request.json()
        pid = data.get("id")
        if not pid:
            return {"success": False, "error": "id is required"}
        ok = delete_project(pid)
        return {"success": ok}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

@router.post("/projects/{project_id}/apply-story-to-timeline")
async def apply_story_to_timeline(project_id: str, request: Request):
    """
    Creates (or replaces) cues from the approved scenes in the project's story.
    A scene is considered ready if it has a selected_image_id.
    We map: time=start_time, name=title, prompt=the rich prompt, selected_image_id, video_id,
    video_prompt (fallback to prompt), lora_name (if we snapshot it on scene).
    """
    try:
        body = await request.json() if await request.body() else {}
        incoming_story = body.get("story")

        projects = load_projects()
        proj = None
        for p in projects:
            if p.get("id") == project_id:
                proj = p
                break
        if not proj:
            return {"success": False, "error": "project not found"}

        story = incoming_story or proj.get("story")
        if not story or not isinstance(story, dict):
            return {"success": False, "error": "no story on project (or provided in body)"}

        scenes = story.get("scenes") or []
        new_cues = []
        for sc in scenes:
            if not isinstance(sc, dict):
                continue
            if not sc.get("selected_image_id"):
                # only approved scenes with a chosen keyframe become cues
                continue

            cue = {
                "id": str(uuid.uuid4()),
                "time": float(sc.get("start_time") or 0),
                "name": sc.get("title") or f"Scene {sc.get('scene_number', '')}",
                "prompt": sc.get("prompt") or sc.get("high_level_description") or "",
                "candidates": [],
                "selected_image_id": sc.get("selected_image_id"),
                "video_id": sc.get("video_id"),
                "video_prompt": sc.get("video_prompt") or (sc.get("prompt") or "") + ", cinematic motion, music sync",
                "mute_audio": False,
                "video_start_offset": 0,
                "lora_name": sc.get("lora_name") or None,
            }
            # If the scene carried a lora snapshot with strength, we could store it; current cue model only has name.
            # Downstream gens from the cue dialog will still let user pick lora again.
            new_cues.append(cue)

        # Sort and (for clean "director" result) replace the cue list.
        # If you prefer append + dedupe, change the next line.
        new_cues.sort(key=lambda c: c.get("time") or 0)
        proj["cues"] = new_cues

        # Adjust project duration to cover the full story length.
        # Use the greater of: story's total_duration (requested sequence length), 
        # the max end time from scenes, or the existing audio duration.
        max_scene_end = 0.0
        for sc in scenes:
            if isinstance(sc, dict):
                end = float(sc.get("start_time") or 0) + float(sc.get("duration") or 0)
                if end > max_scene_end:
                    max_scene_end = end

        story_total = 0.0
        if isinstance(story, dict):
            story_total = float(story.get("total_duration") or 0)

        desired_len = max(max_scene_end, story_total)
        current_dur = float(proj.get("audio_duration") or 0)
        proj["audio_duration"] = max(current_dur, desired_len)

        proj["last_updated"] = datetime.now().isoformat()

        # Persist
        save_project(proj)  # this will re-load + overwrite the matching project

        return {"success": True, "cues_created": len(new_cues), "project": proj}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
