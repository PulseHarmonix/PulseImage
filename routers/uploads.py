from fastapi import APIRouter, UploadFile, File
import shutil
import os
import uuid

router = APIRouter()

@router.post("/upload")
async def upload_asset(file: UploadFile = File(...)):
    """Upload an image or audio file and store it in the appropriate directory."""
    if not file.filename:
        return {"error": "No file provided"}

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    content_type = (file.content_type or "").lower()

    is_audio = content_type.startswith("audio/") or ext in ["mp3", "wav", "ogg", "m4a", "flac", "aac", "webm"]

    if is_audio:
        folder = "audio"
        ftype = "audio"
    else:
        folder = "images"
        ftype = "image"

    new_filename = f"{uuid.uuid4().hex}.{ext}"
    dest_path = os.path.join(folder, new_filename)

    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"filename": new_filename, "type": ftype}
    except Exception as e:
        return {"error": str(e)}