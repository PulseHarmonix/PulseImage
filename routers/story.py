"""Story mode endpoints.

V1 flow: premise -> AI storyboard -> keyframes -> FastH3 clips -> ZIP export.
"""
import io

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from services.story_service import (
    StoryError,
    add_cast,
    add_scene,
    add_scene_asset,
    add_shot,
    build_story_export,
    create_story,
    delete_scene,
    delete_shot,
    delete_story,
    generate_scene_anchor,
    generate_scene_asset,
    generate_shot_clip,
    generate_shot_keyframes,
    generate_story_plan,
    get_shot_context,
    get_story,
    list_stories,
    remove_cast,
    remove_scene_asset,
    select_scene_anchor_frame,
    select_shot_frame,
    select_shot_image,
    update_scene,
    update_shot,
    update_story,
)

router = APIRouter()


def _error(exc: Exception, default_status: int = 500) -> JSONResponse:
    if isinstance(exc, StoryError):
        return JSONResponse({"error": str(exc)}, status_code=exc.status_code)
    return JSONResponse({"error": str(exc)}, status_code=default_status)


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


# === Stories ===

@router.get("/stories")
async def get_stories():
    """List stories, newest-updated first."""
    return {"stories": list_stories()}


@router.post("/stories")
async def create_story_project(request: Request):
    """Create a new story project."""
    data = await _body(request)
    try:
        story = create_story(
            data.get("title") or "Untitled Story",
            data.get("premise") or "",
            data.get("settings") if isinstance(data.get("settings"), dict) else None,
        )
    except Exception as exc:
        return _error(exc)
    return {"story": story}


@router.get("/stories/{story_id}")
async def get_story_project(story_id: str):
    """Return a story with its cast and ordered scenes/shots."""
    story = get_story(story_id)
    if not story:
        return JSONResponse({"error": "Story not found"}, status_code=404)
    return story


@router.post("/stories/{story_id}")
async def update_story_project(story_id: str, request: Request):
    """Update a story's title, premise and/or settings."""
    data = await _body(request)
    try:
        story = update_story(story_id, data)
    except Exception as exc:
        return _error(exc)
    if not story:
        return JSONResponse({"error": "Story not found"}, status_code=404)
    return {"story": story}


@router.delete("/stories/{story_id}")
async def delete_story_project(story_id: str):
    """Delete a story and all of its cast, scenes and shots."""
    return {"success": delete_story(story_id)}


# === Cast ===

@router.post("/stories/{story_id}/cast")
async def add_story_cast(story_id: str, request: Request):
    """Add or update a cast member."""
    data = await _body(request)
    try:
        entry = add_cast(
            story_id,
            data.get("character_asset_id") or "",
            data.get("role_name") or "",
            data.get("notes") or "",
        )
    except Exception as exc:
        return _error(exc)
    if not entry:
        return JSONResponse({"error": "Story not found"}, status_code=404)
    return {"cast": entry}


@router.delete("/stories/{story_id}/cast/{character_asset_id}")
async def delete_story_cast(story_id: str, character_asset_id: str):
    """Remove a cast member from a story."""
    return {"success": remove_cast(story_id, character_asset_id)}


# === Scenes ===

@router.post("/stories/{story_id}/scenes")
async def add_story_scene(story_id: str, request: Request):
    """Add a scene to a story."""
    data = await _body(request)
    try:
        scene = add_scene(story_id, data)
    except Exception as exc:
        return _error(exc)
    if not scene:
        return JSONResponse({"error": "Story not found"}, status_code=404)
    return {"scene": scene}


@router.post("/stories/{story_id}/scenes/{scene_id}")
async def update_story_scene(story_id: str, scene_id: str, request: Request):
    """Update a scene."""
    data = await _body(request)
    try:
        scene = update_scene(story_id, scene_id, data)
    except Exception as exc:
        return _error(exc)
    if not scene:
        return JSONResponse({"error": "Scene not found"}, status_code=404)
    return {"scene": scene}


@router.delete("/stories/{story_id}/scenes/{scene_id}")
async def delete_story_scene(story_id: str, scene_id: str):
    """Delete a scene and its shots."""
    return {"success": delete_scene(story_id, scene_id)}


# === Scene reference assets and anchor ===

@router.post("/stories/{story_id}/scenes/{scene_id}/assets")
async def add_story_scene_asset(story_id: str, scene_id: str, request: Request):
    """Attach a Library image asset to a scene reference kit."""
    data = await _body(request)
    try:
        asset = add_scene_asset(story_id, scene_id, data)
    except Exception as exc:
        return _error(exc)
    if not asset:
        return JSONResponse({"error": "Scene not found"}, status_code=404)
    return {"asset": asset}


@router.delete("/stories/{story_id}/scenes/{scene_id}/assets/{asset_id}")
async def delete_story_scene_asset(story_id: str, scene_id: str, asset_id: str):
    """Detach an asset from a scene reference kit."""
    return {"success": remove_scene_asset(story_id, scene_id, asset_id)}


@router.post("/stories/{story_id}/scenes/{scene_id}/assets/generate")
async def generate_story_scene_asset(story_id: str, scene_id: str, request: Request):
    """Generate an environment/prop reference image for a scene."""
    data = await _body(request)
    try:
        result = await generate_scene_asset(story_id, scene_id, data)
    except Exception as exc:
        return _error(exc, default_status=502)
    return result


@router.post("/stories/{story_id}/scenes/{scene_id}/anchor")
async def create_story_scene_anchor(story_id: str, scene_id: str):
    """Generate a one-second casting clip and expose its 24 anchor frames."""
    try:
        result = await generate_scene_anchor(story_id, scene_id)
    except Exception as exc:
        return _error(exc, default_status=502)
    return result


@router.post("/stories/{story_id}/scenes/{scene_id}/select-anchor-frame")
async def select_story_scene_anchor(story_id: str, scene_id: str, request: Request):
    """Save a chosen scene-anchor frame as the scene anchor image."""
    data = await _body(request)
    try:
        result = select_scene_anchor_frame(story_id, scene_id, data.get("frame_index", 0))
    except Exception as exc:
        return _error(exc)
    return result


# === Shots ===

@router.post("/stories/{story_id}/scenes/{scene_id}/shots")
async def add_story_shot(story_id: str, scene_id: str, request: Request):
    """Add a shot to a scene."""
    data = await _body(request)
    try:
        shot = add_shot(story_id, scene_id, data)
    except Exception as exc:
        return _error(exc)
    if not shot:
        return JSONResponse({"error": "Scene not found"}, status_code=404)
    return {"shot": shot}


@router.post("/stories/{story_id}/shots/{shot_id}")
async def update_story_shot(story_id: str, shot_id: str, request: Request):
    """Update a shot."""
    data = await _body(request)
    try:
        shot = update_shot(story_id, shot_id, data)
    except Exception as exc:
        return _error(exc)
    if not shot:
        return JSONResponse({"error": "Shot not found"}, status_code=404)
    return {"shot": shot}


@router.delete("/stories/{story_id}/shots/{shot_id}")
async def delete_story_shot(story_id: str, shot_id: str):
    """Delete a shot."""
    return {"success": delete_shot(story_id, shot_id)}


# === AI storyboard ===

@router.post("/stories/{story_id}/plan")
async def plan_story(story_id: str):
    """Generate an AI storyboard and replace existing scenes/shots."""
    try:
        result = await generate_story_plan(story_id)
    except Exception as exc:
        return _error(exc)
    return {"success": True, **result}


# === Keyframes and clips ===

@router.post("/stories/{story_id}/shots/{shot_id}/keyframes")
async def create_story_keyframes(story_id: str, shot_id: str, request: Request):
    """Generate keyframe candidates for a shot."""
    data = await _body(request)
    count = data.get("count")
    try:
        result = await generate_shot_keyframes(story_id, shot_id, count)
    except Exception as exc:
        return _error(exc, default_status=502)
    return {"success": True, **result}


@router.post("/stories/{story_id}/shots/{shot_id}/select-frame")
async def select_story_frame(story_id: str, shot_id: str, request: Request):
    """Save a casting-clip frame as the shot starting image."""
    data = await _body(request)
    try:
        result = select_shot_frame(story_id, shot_id, data.get("frame_index", 0))
    except Exception as exc:
        return _error(exc)
    return {"success": True, **result}


@router.post("/stories/{story_id}/shots/{shot_id}/select-image")
async def select_story_keyframe(story_id: str, shot_id: str, request: Request):
    """Approve an existing image asset as a shot keyframe."""
    data = await _body(request)
    try:
        shot = select_shot_image(story_id, shot_id, data.get("asset_id") or "")
    except Exception as exc:
        return _error(exc)
    return {"shot": shot}


@router.post("/stories/{story_id}/shots/{shot_id}/generate")
async def generate_story_clip(story_id: str, shot_id: str):
    """Generate a FastH3 clip from the shot's approved keyframe."""
    try:
        result = await generate_shot_clip(story_id, shot_id)
    except Exception as exc:
        return _error(exc, default_status=502)
    return {"success": True, **result}


# === Export ===

@router.get("/stories/{story_id}/export")
async def export_story(story_id: str):
    """Download the storyboard and selected clips as an in-memory ZIP."""
    try:
        payload, filename = build_story_export(story_id)
    except Exception as exc:
        return _error(exc)
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        io.BytesIO(payload), media_type="application/zip", headers=headers
    )
