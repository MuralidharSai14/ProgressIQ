"""
PROGRESSIQ - Worker Safety Risk API
Documents and tracks site-specific safety hazards tied to schedule activities.
Tracks PPE requirements, compliance status, and mitigation plans.
"""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.connection import get_db
from app.models.models import WorkerSafetyRisk, Project, ScheduleActivity
from app.schemas.schemas import (
    WorkerSafetyRiskCreate,
    WorkerSafetyRiskUpdate,
    WorkerSafetyRiskOut,
    SuccessResponse,
)

router = APIRouter()


@router.get("/projects/{project_id}/safety-risks", response_model=dict)
async def list_safety_risks(
    project_id: int,
    risk_score: str | None = None,
    hazard_category: str | None = None,
    activity_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List all worker safety risks for a project with optional filters."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    query = select(WorkerSafetyRisk).where(WorkerSafetyRisk.project_id == project_id)
    if risk_score:
        query = query.where(WorkerSafetyRisk.risk_score == risk_score)
    if hazard_category:
        query = query.where(WorkerSafetyRisk.hazard_category == hazard_category)
    if activity_id:
        query = query.where(WorkerSafetyRisk.activity_id == activity_id)
    query = query.order_by(WorkerSafetyRisk.detected_at.desc())
    rows = (await db.execute(query)).scalars().all()

    all_rows = (await db.execute(
        select(WorkerSafetyRisk).where(WorkerSafetyRisk.project_id == project_id)
    )).scalars().all()

    score_counts: dict = {}
    compliance_counts: dict = {}
    for r in all_rows:
        score_counts[r.risk_score] = score_counts.get(r.risk_score, 0) + 1
        compliance_counts[r.compliance_status] = compliance_counts.get(r.compliance_status, 0) + 1

    total_workers = sum(r.affected_workers or 0 for r in all_rows)
    open_violations = sum(
        1 for r in all_rows
        if r.compliance_status == "violation" and not r.is_resolved
    )

    return {
        "project_id": project_id,
        "total": len(all_rows),
        "filtered": len(rows),
        "score_counts": score_counts,
        "compliance_counts": compliance_counts,
        "total_affected_workers": total_workers,
        "open_violations": open_violations,
        "safety_risks": [WorkerSafetyRiskOut.model_validate(r).model_dump() for r in rows],
    }


@router.post("/projects/{project_id}/safety-risks", response_model=dict, status_code=201)
async def create_safety_risk(
    project_id: int,
    data: WorkerSafetyRiskCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add a new worker safety risk entry for a project."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    if data.activity_id:
        act = await db.execute(
            select(ScheduleActivity).where(ScheduleActivity.id == data.activity_id)
        )
        if not act.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Activity not found")

    # Serialize PPE list to JSON string for storage
    payload = data.model_dump()
    if payload.get("required_ppe") is not None:
        payload["required_ppe"] = json.dumps(payload["required_ppe"])

    risk = WorkerSafetyRisk(project_id=project_id, **payload)
    db.add(risk)
    await db.commit()
    await db.refresh(risk)

    return {
        "success": True,
        "message": f"Safety risk '{risk.title}' added",
        "safety_risk": WorkerSafetyRiskOut.model_validate(risk).model_dump(),
    }


@router.patch("/safety-risks/{risk_id}", response_model=dict)
async def update_safety_risk(
    risk_id: int,
    data: WorkerSafetyRiskUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update compliance status, mitigation plan, or resolve a safety risk."""
    result = await db.execute(
        select(WorkerSafetyRisk).where(WorkerSafetyRisk.id == risk_id)
    )
    risk = result.scalar_one_or_none()
    if not risk:
        raise HTTPException(status_code=404, detail="Safety risk not found")

    updates = data.model_dump(exclude_none=True)
    if "required_ppe" in updates and updates["required_ppe"] is not None:
        updates["required_ppe"] = json.dumps(updates["required_ppe"])
    if updates.get("is_resolved") is True:
        updates["resolved_at"] = datetime.utcnow()

    for field, value in updates.items():
        setattr(risk, field, value)

    await db.commit()
    await db.refresh(risk)

    return {
        "success": True,
        "message": "Safety risk updated",
        "safety_risk": WorkerSafetyRiskOut.model_validate(risk).model_dump(),
    }


@router.delete("/safety-risks/{risk_id}", response_model=SuccessResponse)
async def delete_safety_risk(risk_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a worker safety risk entry."""
    result = await db.execute(
        select(WorkerSafetyRisk).where(WorkerSafetyRisk.id == risk_id)
    )
    risk = result.scalar_one_or_none()
    if not risk:
        raise HTTPException(status_code=404, detail="Safety risk not found")
    await db.delete(risk)
    await db.commit()
    return SuccessResponse(message="Safety risk deleted")


@router.get("/projects/{project_id}/safety-summary", response_model=dict)
async def get_safety_summary(project_id: int, db: AsyncSession = Depends(get_db)):
    """Project-level safety risk score and violation breakdown."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    all_risks = (await db.execute(
        select(WorkerSafetyRisk).where(WorkerSafetyRisk.project_id == project_id)
    )).scalars().all()

    open_risks = [r for r in all_risks if not r.is_resolved]

    score_weights = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    score_sum = sum(score_weights.get(r.risk_score, 1) for r in open_risks)
    max_score = len(open_risks) * 4 if open_risks else 1
    safety_score = max(0, 100 - round(score_sum / max_score * 100)) if open_risks else 100

    category_breakdown = {}
    for r in open_risks:
        category_breakdown[r.hazard_category] = category_breakdown.get(r.hazard_category, 0) + 1

    violations = [
        {
            "id": r.id,
            "title": r.title,
            "hazard_category": r.hazard_category,
            "risk_score": r.risk_score,
            "compliance_status": r.compliance_status,
            "affected_workers": r.affected_workers,
        }
        for r in open_risks if r.compliance_status == "violation"
    ]

    overall_status = (
        "critical" if safety_score < 40
        else "high_risk" if safety_score < 60
        else "at_risk" if safety_score < 80
        else "compliant"
    )

    return {
        "project_id": project_id,
        "safety_score": safety_score,
        "overall_status": overall_status,
        "total_risks": len(all_risks),
        "open_risks": len(open_risks),
        "resolved_risks": len(all_risks) - len(open_risks),
        "open_violations": len(violations),
        "category_breakdown": category_breakdown,
        "violations": violations,
    }


@router.get("/activities/{activity_id}/safety-risks", response_model=dict)
async def get_activity_safety_risks(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get all safety risks linked to a specific schedule activity."""
    rows = (await db.execute(
        select(WorkerSafetyRisk).where(WorkerSafetyRisk.activity_id == activity_id)
    )).scalars().all()

    return {
        "activity_id": activity_id,
        "total": len(rows),
        "safety_risks": [WorkerSafetyRiskOut.model_validate(r).model_dump() for r in rows],
    }
