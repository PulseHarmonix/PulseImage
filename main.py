# === Standard Library ===
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

# === Third Party ===
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse

# === Local Application ===
from routers import chat, director, generations, uploads, settings,ollama,comfy,admin
from services.settings_service import refresh_loras
from services.database_service import init_db

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Initialize DB and refresh LoRAs on startup; clean up on shutdown."""
    init_db()
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
        "tauri://localhost",
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
app.include_router(director.router)
app.include_router(chat.router)
app.include_router(admin.router)
app.mount("/images", StaticFiles(directory="images"), name="images")
app.mount("/videos", StaticFiles(directory="videos"), name="videos")
app.mount("/audio", StaticFiles(directory="audio"), name="audio")
app.mount("/thumbnails", StaticFiles(directory="thumbnails"), name="thumbnails")
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/templates", StaticFiles(directory="templates"), name="templates")
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
async def home(request: Request) -> HTMLResponse:
    """Serve the main application index page."""
    return templates.TemplateResponse(request=request, name="index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
