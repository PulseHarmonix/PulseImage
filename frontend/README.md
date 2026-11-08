# Pulse Image Studio (React UI)

The React studio frontend lives here and is served by FastAPI at `/`.

## Development

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`. The dev build calls the FastAPI backend at
`http://127.0.0.1:8000`, so start the Python server first.

## Production build

```powershell
cd frontend
npm run build
```

FastAPI serves `frontend/dist` at `/`. Run the build after changing the frontend.

## Tauri

The Tauri window uses the Vite dev server during development and the bundled
`frontend/dist` for production. The React app detects the Tauri webview and
calls the local FastAPI server at `http://127.0.0.1:8000`.

## Structure

- `src/components/shell` — sidebar, queue, app shell.
- `src/components/prompt` — floating prompt composer.
- `src/components/media` — media cards and inspector.
- `src/pages` — Studio, Library, Music Video, Single Frame, Voices, Models,
  Settings, Admin.
- `src/lib` — API client, React Query hooks, generation flow.
- `src/stores` — prompt tabs, queue, UI state.
