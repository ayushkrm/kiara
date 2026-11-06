import asyncio
import json
from contextlib import suppress
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.settings import get_settings

settings = get_settings()

app = FastAPI(title="Kiara Calls API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "transcription_mode": "mock" if settings.mock_transcription else "gnani",
    }


@app.websocket("/ws/calls/{call_id}")
async def call_stream(websocket: WebSocket, call_id: str) -> None:
    await websocket.accept()

    if settings.mock_transcription:
        await websocket.send_json(
            {"type": "ready", "call_id": call_id, "mode": "mock"}
        )
        try:
            while True:
                message: Any = await websocket.receive_json()
                if not isinstance(message, dict):
                    await websocket.send_json(
                        {"type": "error", "message": "Expected a JSON control message"}
                    )
                    continue
                if message.get("type") == "demo":
                    await websocket.send_json(
                        {
                            "type": "transcript",
                            "text": "Namaste, main aapki kis tarah madad kar sakta hoon?",
                            "is_final": True,
                        }
                    )
                elif message.get("type") == "end":
                    await websocket.close()
                    return
                elif message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                else:
                    await websocket.send_json(
                        {"type": "error", "message": "Unsupported control message"}
                    )
        except WebSocketDisconnect:
            return

    from gnani.stt import (
        GnaniSTTStreamClient,
        StreamErrorEvent,
        StreamTranscriptEvent,
    )

    api_key = settings.gnani_api_key
    if api_key is None:
        await websocket.close(code=1011, reason="Live transcription is unavailable")
        return

    stream = GnaniSTTStreamClient(
        api_key=api_key.get_secret_value(),
        language_code=settings.gnani_language_code,
        model="prisma-v3.0",
        sample_rate=settings.gnani_sample_rate,
        format="codemix",
        language_candidates=(
            ["hi-IN", "en-IN"]
            if settings.gnani_language_code == "indic-auto"
            else None
        ),
    )
    await stream.connect()
    sent_segment_ids: set[str] = set()

    async def send_transcript(event: StreamTranscriptEvent) -> None:
        if event.segment_id in sent_segment_ids:
            return
        await websocket.send_json(
            {
                "type": "transcript",
                "text": event.text,
                "is_final": True,
                "detected_language_code": event.detected_language_code,
            }
        )
        sent_segment_ids.add(event.segment_id)

    async def send_transcripts() -> None:
        async for event in stream:
            if isinstance(event, StreamTranscriptEvent):
                await send_transcript(event)
            elif isinstance(event, StreamErrorEvent):
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": "The transcription provider reported an error",
                    }
                )

    transcript_task: asyncio.Task[None] | None = None
    client_connected = True
    try:
        await websocket.send_json(
            {"type": "ready", "call_id": call_id, "mode": "gnani"}
        )
        transcript_task = asyncio.create_task(send_transcripts())
        while True:
            message = await websocket.receive()
            audio = message.get("bytes")
            if audio is not None:
                await stream.send_audio(audio)
                continue

            control = message.get("text")
            if control is not None:
                try:
                    command = json.loads(control)
                except json.JSONDecodeError:
                    await websocket.send_json(
                        {"type": "error", "message": "Invalid JSON control message"}
                    )
                    continue
                if not isinstance(command, dict):
                    await websocket.send_json(
                        {"type": "error", "message": "Expected a JSON control message"}
                    )
                    continue
                if command.get("type") == "end":
                    break
    except WebSocketDisconnect:
        client_connected = False
    finally:
        try:
            final_transcripts = await stream.close()
        finally:
            if transcript_task is not None:
                transcript_task.cancel()
                with suppress(asyncio.CancelledError):
                    await transcript_task

    if client_connected:
        for event in final_transcripts:
            await send_transcript(event)
