# Kiara Calls

Kiara Calls is a foundation for real-time Hinglish call coaching in enterprise contact centres. It includes a FastAPI backend, a React dashboard, a WebSocket call-session endpoint, and a mock transcription mode for UI development. Call monitoring, coaching analysis, and alert delivery are not implemented yet.

## Requirements

- Python 3.11 or newer
- Node.js 20.19 or newer and npm

## Configure

Create a root `.env` from the example:

```powershell
Copy-Item .env.example .env
```

The defaults run without credentials:

| Variable | Default | Description |
| --- | --- | --- |
| `MOCK_TRANSCRIPTION` | `true` | Runs the demo WebSocket flow without connecting to Gnani. |
| `GNANI_API_KEY` | empty | Backend-only Gnani API key; required when mock mode is disabled. |
| `GNANI_LANGUAGE_CODE` | `indic-auto` | BCP-47 locale or `indic-auto` for Prisma language detection. |
| `GNANI_SAMPLE_RATE` | `16000` | PCM sample rate in Hz: 8000, 16000, 44100, or 48000. |
| `GNANI_ALERT_WEBHOOK_URL` | empty | Optional HTTP(S) alert webhook URL, reserved for later monitoring work. |

For live transcription, set `MOCK_TRANSCRIPTION=false` and provide `GNANI_API_KEY`. The key is loaded and used only by the backend; do not add it to frontend environment variables. The live WebSocket accepts 1024-byte frames of raw mono, signed 16-bit little-endian PCM audio and forwards them to Gnani Prisma v3.0. No audio capture is included in this foundation.

## Run the backend

From the repository root, create and activate a virtual environment, then install the backend dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
uvicorn app.main:app --app-dir backend --reload
```

The health endpoint is available at <http://localhost:8000/health>. Interactive API documentation is at <http://localhost:8000/docs>.

## Run the frontend

In another terminal, from the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally <http://localhost:5173>). The dashboard checks the backend health endpoint and its **Start mock session** button demonstrates the backend WebSocket flow without sending microphone audio. To point the dashboard at another backend, set `VITE_API_BASE_URL` in the frontend environment (for example, `http://localhost:8000`).

## Project layout

```text
backend/
  app/
    main.py       FastAPI health and WebSocket endpoints
    settings.py   Validated environment configuration
  requirements.txt
frontend/
  src/
    App.tsx       Dashboard shell and mock call workspace
    index.css     Tailwind entry point and global styles
.env.example
README.md
```
