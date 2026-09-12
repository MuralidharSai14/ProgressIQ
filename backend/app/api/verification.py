import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database.connection import get_db
from app.models.models import VerificationTask, VerificationDecision, ScheduleActivity, AuditEvent, Evidence, EvidenceActivityLink
from app.api.evidence import _fmt as _fmt_evidence

router = APIRouter()


@router.get("/projects/{project_id}/verification-queue")
async def get_verification_queue(
    project_id: int, status: str = "pending", db: AsyncSession = Depends(get_db)
):
    """Get verification queue for a project."""
    result = await db.execute(
        select(VerificationTask)
        .where(VerificationTask.project_id == project_id, VerificationTask.status == status)
        .order_by(VerificationTask.created_at.desc())
    )
    tasks = result.scalars().all()

    act_ids = [t.activity_id for t in tasks if t.activity_id]
    act_map = {}
    evidence_map = {}

    if act_ids:
        ar = await db.execute(select(ScheduleActivity).where(ScheduleActivity.id.in_(act_ids)))
        act_map = {a.id: a for a in ar.scalars().all()}

        # Fetch linked evidence items for these activities
        links_result = await db.execute(
            select(EvidenceActivityLink).where(EvidenceActivityLink.activity_id.in_(act_ids))
        )
        links = links_result.scalars().all()
        if links:
            ev_ids = [l.evidence_id for l in links]
            ev_result = await db.execute(select(Evidence).where(Evidence.id.in_(ev_ids)))
            ev_entities = {e.id: e for e in ev_result.scalars().all()}
            for l in links:
                if l.evidence_id in ev_entities:
                    evidence_map.setdefault(l.activity_id, []).append({
                        **_fmt_evidence(ev_entities[l.evidence_id]),
                        "relevance_score": l.relevance_score,
                        "link_reason": l.link_reason,
                        "linked_by": l.linked_by,
                    })

    # Map priority to a UI-friendly colour label
    PRIORITY_COLORS = {"critical": "red", "high": "orange", "medium": "yellow", "low": "blue"}

    return {
        "tasks": [
            {
                "id": t.id, "status": t.status, "priority": t.priority,
                "priority_color": PRIORITY_COLORS.get(t.priority, "gray"),
                "trigger_reason": t.trigger_reason,
                "reported_progress": t.reported_progress,
                "evidence_supported_progress": t.evidence_supported_progress,
                "overall_confidence": t.overall_confidence,
                "conflict_summary": t.conflict_summary,
                "recommendation": t.recommendation,
                "created_at": t.created_at.isoformat(),
                "activity": {
                    "id": act_map[t.activity_id].id,
                    "activity_id": act_map[t.activity_id].activity_id,
                    "activity_name": act_map[t.activity_id].activity_name,
                    "planned_progress": act_map[t.activity_id].planned_progress,
                    "status": act_map[t.activity_id].status,
                } if t.activity_id in act_map else None,
                "evidence": evidence_map.get(t.activity_id, []),
            }
            for t in tasks
        ],
        "total": len(tasks),
        "pending_count": sum(1 for t in tasks if t.status == "pending"),
    }


class CreateVerificationRequest(BaseModel):
    activity_id: int
    priority: Optional[str] = "medium"
    trigger_reason: str
    reported_progress: Optional[float] = None
    evidence_supported_progress: Optional[float] = None
    overall_confidence: Optional[float] = None
    conflict_summary: Optional[str] = None
    recommendation: Optional[str] = None


@router.post("/projects/{project_id}/verification-queue")
async def create_verification_task(
    project_id: int, req: CreateVerificationRequest, db: AsyncSession = Depends(get_db)
):
    """Manually add a task to the verification queue."""
    act_result = await db.execute(select(ScheduleActivity).where(ScheduleActivity.id == req.activity_id))
    act = act_result.scalar_one_or_none()
    if not act:
        raise HTTPException(status_code=404, detail="Schedule activity not found")

    task = VerificationTask(
        project_id=project_id,
        activity_id=req.activity_id,
        status="pending",
        priority=req.priority or "medium",
        trigger_reason=req.trigger_reason,
        reported_progress=req.reported_progress if req.reported_progress is not None else act.actual_progress,
        evidence_supported_progress=req.evidence_supported_progress,
        overall_confidence=req.overall_confidence if req.overall_confidence is not None else 60.0,
        conflict_summary=req.conflict_summary,
        recommendation=req.recommendation,
    )
    db.add(task)
    db.add(AuditEvent(
        project_id=project_id, activity_id=req.activity_id,
        event_type="verification_created", actor="human",
        summary=f"Manual verification item flagged: {(req.trigger_reason or '')[:100]}",
    ))
    await db.commit()
    await db.refresh(task)
    return {"success": True, "message": "Verification task created.", "task_id": task.id}


class DecisionRequest(BaseModel):
    decision: str  # confirmed|rejected|evidence_requested|marked_review
    reviewer: Optional[str] = None
    notes: Optional[str] = None


@router.post("/verification/{task_id}/decide")
async def decide_verification(task_id: int, req: DecisionRequest, db: AsyncSession = Depends(get_db)):
    """Record a human decision on a verification task."""
    VALID = {"confirmed", "rejected", "evidence_requested", "marked_review"}
    if req.decision not in VALID:
        raise HTTPException(status_code=400, detail=f"Decision must be one of: {', '.join(VALID)}")

    task_result = await db.execute(select(VerificationTask).where(VerificationTask.id == task_id))
    task = task_result.scalar_one_or_none()
    if not task: raise HTTPException(status_code=404, detail="Task not found")

    # Update the task status to reflect the human decision
    task.status = req.decision
    db.add(VerificationDecision(
        task_id=task_id, decision=req.decision,
        reviewer=req.reviewer or "Project Manager", notes=req.notes,
    ))
    # Write an audit event so the decision is permanently traceable
    db.add(AuditEvent(
        project_id=task.project_id, activity_id=task.activity_id,
        event_type="verification_decision", actor="human",
        summary=f"Verification {req.decision}: {(task.trigger_reason or '')[:100]}",
    ))
    await db.commit()
    return {"success": True, "message": f"Verification task marked '{req.decision}'.", "task_id": task_id}
