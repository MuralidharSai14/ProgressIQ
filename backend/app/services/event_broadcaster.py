"""
PROGRESSIQ — Real-Time Event Broadcaster
Manages Server-Sent Events (SSE) subscriber queues for multi-device real-time sync.
"""
import asyncio
import json
import logging
from typing import Any, AsyncGenerator

logger = logging.getLogger(__name__)

class EventBroadcaster:
    """Pub/Sub broker for SSE connections."""
    def __init__(self):
        self.subscribers: list[asyncio.Queue] = []

    async def subscribe(self) -> AsyncGenerator[str, None]:
        queue = asyncio.Queue()
        self.subscribers.append(queue)
        logger.info(f"📡 Real-time client connected (Total subscribers: {len(self.subscribers)})")
        try:
            while True:
                data = await queue.get()
                yield data
        except asyncio.CancelledError:
            pass
        finally:
            if queue in self.subscribers:
                self.subscribers.remove(queue)
            logger.info(f"🔌 Real-time client disconnected (Remaining subscribers: {len(self.subscribers)})")

    async def broadcast(self, event_type: str, data: dict[str, Any], project_id: int | None = None):
        """Broadcast an event payload to all active SSE subscribers."""
        payload = {
            "event": event_type,
            "project_id": project_id,
            "data": data,
        }
        message = f"event: {event_type}\ndata: {json.dumps(payload)}\n\n"
        for queue in list(self.subscribers):
            try:
                await queue.put(message)
            except Exception:
                pass


broadcaster = EventBroadcaster()


async def emit_project_update(project_id: int, event_type: str, data: dict[str, Any]):
    """Helper to emit an event across connected devices."""
    await broadcaster.broadcast(event_type, data, project_id=project_id)
