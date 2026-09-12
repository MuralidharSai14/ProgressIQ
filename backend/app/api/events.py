"""
PROGRESSIQ — Real-Time SSE Stream Endpoint
Allows frontend clients on phones, laptops, and tablets to receive instant notifications.
"""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.services.event_broadcaster import broadcaster

router = APIRouter(tags=["Real-Time Events"])


@router.get("/events/stream")
async def events_stream():
    """
    Server-Sent Events (SSE) stream.
    Clients connect via EventSource to receive instant updates.
    """
    return StreamingResponse(
        broadcaster.subscribe(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
