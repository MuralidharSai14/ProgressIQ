"""Dashboard summary and risk endpoints."""
from collections import Counter
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database.connection import get_db
from app.models.models import (
    Project, ScheduleActivity, FieldReport, ExtractedUpdate,
    ActivityMatch, Risk
)
from app.services.risk_engine import classify_health, detect_risks
from app.ai.provider import get_ai_provider

router = APIRouter()


@router.get("/projects/{project_id}/dashboard")
async def get_dashboard(project_id: int, db: AsyncSession = Depends(get_db)):
    """
    The main dashboard endpoint.
    Returns everything the overview page needs in one call.
    """
    # Validate project
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Fetch all activities
    act_result = await db.execute(
        select(ScheduleActivity).where(ScheduleActivity.project_id == project_id)
    )
    activities = act_result.scalars().all()

    if not activities:
        return _empty_dashboard(project)

    # ── Progress Calculations ─────────────────────────────────────────────────
    total = len(activities)
    planned_avg = sum(a.planned_progress for a in activities) / total
    actual_avg = sum(a.actual_progress for a in activities) / total
    variance = actual_avg - planned_avg

    # Status counts
    status_counts = Counter(a.status for a in activities)
    on_track = status_counts.get("in_progress", 0) + status_counts.get("completed", 0)
    delayed = status_counts.get("delayed", 0)
    not_started = status_counts.get("not_started", 0)
    completed = status_counts.get("completed", 0)

    # Delayed activities detail (L4-L6 only, sorted by variance)
    delayed_acts = sorted(
        [a for a in activities if a.status == "delayed" and a.level >= 4],
        key=lambda x: x.progress_variance,
    )[:10]

    # Milestones
    milestones = [a for a in activities if a.is_milestone]
    upcoming_milestones = sorted(
        [m for m in milestones if m.planned_finish and m.actual_progress < 100],
        key=lambda x: x.planned_finish,
    )[:5]

    # Delay reasons breakdown
    delay_cats = [a.delay_category for a in activities if a.delay_category and a.status == "delayed"]
    delay_counts = Counter(delay_cats)
    total_delays = sum(delay_counts.values()) or 1
    top_delay_reasons = [
        {"category": cat, "count": cnt, "percentage": round(cnt / total_delays * 100, 1)}
        for cat, cnt in delay_counts.most_common(5)
    ]

    # Fetch risks
    risk_result = await db.execute(
        select(Risk)
        .where(Risk.project_id == project_id)
        .where(Risk.is_resolved == False)
        .order_by(Risk.detected_at.desc())
    )
    risks = risk_result.scalars().all()

    risk_by_level = Counter(r.level for r in risks)
    critical_risks = [r for r in risks if r.level == "critical"]
    high_risks = [r for r in risks if r.level == "high"]

    # Pending reviews
    fr_result = await db.execute(
        select(FieldReport.id).where(FieldReport.project_id == project_id)
    )
    fr_ids = [row[0] for row in fr_result.all()]

    pending_reviews = 0
    avg_confidence = 0.0
    if fr_ids:
        ext_result = await db.execute(
            select(ExtractedUpdate.id).where(ExtractedUpdate.field_report_id.in_(fr_ids))
        )
        ext_ids = [row[0] for row in ext_result.all()]
        if ext_ids:
            match_result = await db.execute(
                select(ActivityMatch).where(
                    ActivityMatch.extracted_update_id.in_(ext_ids)
                )
            )
            matches = match_result.scalars().all()
            pending_reviews = sum(1 for m in matches if m.status == "needs_review")
            if matches:
                avg_confidence = sum(m.confidence_score for m in matches) / len(matches)

    # Overall health
    health = classify_health(variance, delayed, len(critical_risks))

    # AI recommendations
    ai = get_ai_provider()
    top_delay_cat = delay_counts.most_common(1)[0][0] if delay_counts else None
    recommendations = await ai.generate_recommendations({
        "critical_count": len(critical_risks),
        "delayed_count": delayed,
        "pending_reviews": pending_reviews,
        "top_delay_category": top_delay_cat,
        "variance": variance,
    })

    return {
        "project_id": project_id,
        "project_name": project.name,
        "project_description": project.description,
        "organization": project.organization,
        "location": project.location,
        "project_status": project.status,
        "overall_health": health,

        # Progress
        "planned_progress": round(planned_avg, 1),
        "actual_progress": round(actual_avg, 1),
        "progress_variance": round(variance, 1),

        # Activity counts
        "total_activities": total,
        "on_track_count": on_track,
        "delayed_count": delayed,
        "not_started_count": not_started,
        "completed_count": completed,
        "critical_count": len([a for a in activities if a.progress_variance < -25]),

        # Detailed delayed activities
        "delayed_activities": [
            {
                "id": a.id,
                "activity_id": a.activity_id,
                "activity_name": a.activity_name,
                "level": a.level,
                "planned_progress": a.planned_progress,
                "actual_progress": a.actual_progress,
                "progress_variance": a.progress_variance,
                "delay_category": a.delay_category,
                "delay_reason": a.delay_reason,
                "planned_finish": a.planned_finish.isoformat() if a.planned_finish else None,
            }
            for a in delayed_acts
        ],

        # Milestones
        "milestone_count": len(milestones),
        "upcoming_milestones": [
            {
                "id": m.id,
                "activity_id": m.activity_id,
                "activity_name": m.activity_name,
                "planned_finish": m.planned_finish.isoformat() if m.planned_finish else None,
                "actual_progress": m.actual_progress,
                "status": m.status,
            }
            for m in upcoming_milestones
        ],

        # Delays
        "top_delay_reasons": top_delay_reasons,

        # Risks
        "risk_summary": {
            "total": len(risks),
            "critical": risk_by_level.get("critical", 0),
            "high": risk_by_level.get("high", 0),
            "medium": risk_by_level.get("medium", 0),
            "low": risk_by_level.get("low", 0),
        },
        "top_risks": [
            {
                "id": r.id,
                "title": r.title,
                "description": r.description,
                "level": r.level,
                "category": r.category,
                "affected_dependency": r.affected_dependency,
                "recommended_action": r.recommended_action,
            }
            for r in (critical_risks + high_risks)[:5]
        ],

        # AI matching stats
        "pending_reviews": pending_reviews,
        "ai_match_confidence_avg": round(avg_confidence, 1),

        # Recommendations
        "recommendations": recommendations,
    }


@router.get("/projects/{project_id}/risks")
async def get_risks(project_id: int, level: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Risk).where(Risk.project_id == project_id)
    if level:
        q = q.where(Risk.level == level)
    result = await db.execute(q.order_by(Risk.detected_at.desc()))
    risks = result.scalars().all()
    return {
        "risks": [
            {
                "id": r.id,
                "title": r.title,
                "description": r.description,
                "level": r.level,
                "category": r.category,
                "affected_dependency": r.affected_dependency,
                "recommended_action": r.recommended_action,
                "is_resolved": r.is_resolved,
                "detected_at": r.detected_at.isoformat() if r.detected_at else None,
            }
            for r in risks
        ],
        "total": len(risks),
    }


@router.get("/projects/{project_id}/progress")
async def get_progress(project_id: int, db: AsyncSession = Depends(get_db)):
    """Detailed planned-vs-actual for chart display."""
    act_result = await db.execute(
        select(ScheduleActivity)
        .where(ScheduleActivity.project_id == project_id)
        .where(ScheduleActivity.level >= 3)
        .order_by(ScheduleActivity.activity_id)
    )
    activities = act_result.scalars().all()

    return {
        "activities": [
            {
                "activity_id": a.activity_id,
                "activity_name": a.activity_name[:40],
                "level": a.level,
                "planned": a.planned_progress,
                "actual": a.actual_progress,
                "variance": a.progress_variance,
                "status": a.status,
                "is_milestone": a.is_milestone,
            }
            for a in activities
        ]
    }


def _empty_dashboard(project):
    return {
        "project_id": project.id,
        "project_name": project.name,
        "overall_health": "unknown",
        "planned_progress": 0,
        "actual_progress": 0,
        "progress_variance": 0,
        "total_activities": 0,
        "message": "No schedule data. Upload a schedule or load the demo project.",
    }
