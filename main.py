# === Standard Library ===
import os

# === Third Party ===
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse

# === Local Application ===
from routers import generations, projects, story, uploads, settings,ollama,comfy
from services.settings_service import refresh_loras

# Ensure required folders exist
os.makedirs("audio", exist_ok=True)
os.makedirs("images", exist_ok=True)
os.makedirs("videos", exist_ok=True)

app = FastAPI(title="Pulse Image")
app.include_router(projects.router)
app.include_router(uploads.router)
app.include_router(generations.router)
app.include_router(settings.router)
app.include_router(story.router)
app.include_router(ollama.router)
app.include_router(comfy.router)
app.mount("/images", StaticFiles(directory="images"), name="images")
app.mount("/videos", StaticFiles(directory="videos"), name="videos")
app.mount("/audio", StaticFiles(directory="audio"), name="audio")
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/templates", StaticFiles(directory="templates"), name="templates")
templates = Jinja2Templates(directory="templates")

@app.on_event("startup")
async def on_startup():
    """Fetch available LoRAs from ComfyUI at server startup so settings can list them."""
    await refresh_loras()

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
