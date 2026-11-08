# === Standard Library ===
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

# === Third Party ===
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response

# === Local Application ===
from routers import generations, uploads, settings, ollama, comfy, admin, music, frames, tts, songs
from services.settings_service import refresh_loras
from services.database_service import init_db
from services.music_video_service import reset_interrupted_segments
from config import ensure_settings_in_db

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Initialize DB and refresh LoRAs on startup; clean up on shutdown."""
    init_db()
    reset_interrupted_segments()
    ensure_settings_in_db()
    await refresh_loras()
    yield

# Ensure required folders exist
os.makedirs("audio", exist_ok=True)
os.makedirs("images", exist_ok=True)
os.makedirs("videos", exist_ok=True)
os.makedirs("thumbnails", exist_ok=True)

app = FastAPI(title="Pulse Image", lifespan=lifespan)

# CORS — allow requests from the Tauri webview (and dev origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(uploads.router)
app.include_router(generations.router)
app.include_router(settings.router)
app.include_router(ollama.router)
app.include_router(comfy.router)
app.include_router(music.router)
app.include_router(frames.router)
app.include_router(admin.router)
app.include_router(tts.router)
app.include_router(songs.router)
app.mount("/images", StaticFiles(directory="images"), name="images")
app.mount("/videos", StaticFiles(directory="videos"), name="videos")
app.mount("/audio", StaticFiles(directory="audio"), name="audio")
app.mount("/thumbnails", StaticFiles(directory="thumbnails"), name="thumbnails")

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "frontend", "dist")
FRONTEND_INDEX = os.path.join(FRONTEND_DIST, "index.html")

if os.path.isdir(os.path.join(FRONTEND_DIST, "assets")):
    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")),
        name="app-assets",
    )


def _serve_frontend() -> Response:
    """Return the built React index, or a friendly setup message."""
    if not os.path.isfile(FRONTEND_INDEX):
        return HTMLResponse(
            "<h1>Pulse Image UI is not built</h1><p>Run <code>npm run build</code> in <code>frontend/</code>.</p>",
            status_code=503,
        )
    return FileResponse(FRONTEND_INDEX, media_type="text/html")


@app.get("/", response_class=HTMLResponse)
async def home() -> Response:
    """Serve the React studio index."""
    return _serve_frontend()


@app.get("/app")
@app.get("/app/{full_path:path}")
async def legacy_app_redirect(full_path: str = "") -> RedirectResponse:
    """Redirect legacy /app bookmarks to the root UI."""
    target = f"/{full_path}" if full_path else "/"
    return RedirectResponse(url=target, status_code=308)


@app.get("/{full_path:path}", response_class=HTMLResponse)
async def spa_fallback(full_path: str) -> Response:
    """Return the React index for client-side routes."""
    return _serve_frontend()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
