"""
PROGRESSIQ — Audit Trail API

GET /projects/{project_id}/audit
GET /activities/{activity_id}/audit
"""
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.connection import get_db
from app.models.models import AuditEvent, ScheduleActivity

router = APIRouter()


@router.get("/projects/{project_id}/audit")
async def get_project_audit(
    project_id: int, event_type: Optional[str] = None, limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get audit trail for a project."""
    q = select(AuditEvent).where(AuditEvent.project_id == project_id)
    if event_type: q = q.where(AuditEvent.event_type == event_type)
    q = q.order_by(AuditEvent.occurred_at.desc()).limit(limit)
    result = await db.execute(q)
    events = result.scalars().all()

    # Resolve activity names in a single query to avoid N+1
    act_ids = [e.activity_id for e in events if e.activity_id]
    act_map = {}
    if act_ids:
        ar = await db.execute(select(ScheduleActivity).where(ScheduleActivity.id.in_(act_ids)))
        act_map = {a.id: a.activity_name for a in ar.scalars().all()}

    return {
        "events": [
            {"id": e.id, "event_type": e.event_type, "actor": e.actor, "summary": e.summary,
             "activity_name": act_map.get(e.activity_id) if e.activity_id else None,
             "occurred_at": e.occurred_at.isoformat()}
            for e in events
        ],
        "total": len(events),
    }


@router.get("/activities/{activity_id}/audit")
async def get_activity_audit(activity_id: int, db: AsyncSession = Depends(get_db)):
    """Get audit trail for a specific activity."""
    result = await db.execute(
        select(AuditEvent).where(AuditEvent.activity_id == activity_id).order_by(AuditEvent.occurred_at.desc())
    )
    events = result.scalars().all()
    return {
        "events": [
            {"id": e.id, "event_type": e.event_type, "actor": e.actor,
             "summary": e.summary, "occurred_at": e.occurred_at.isoformat()}
            for e in events
        ],
        "total": len(events),
    }
