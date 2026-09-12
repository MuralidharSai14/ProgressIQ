"""Activity matching endpoints — semantic matching + human review."""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database.connection import get_db
from app.models.models import (
    ExtractedUpdate, ScheduleActivity, ActivityMatch, ReviewDecision, FieldReport
)
from app.schemas.schemas import ReviewDecisionCreate
from app.ai.embeddings import encode_text, match_to_activities
from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.post("/matching/run")
async def run_matching(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    Run semantic matching for a specific field report or all unmatched extractions.
    payload: { "project_id": int, "field_report_id": int (optional) }
    """
    project_id = payload.get("project_id")
    field_report_id = payload.get("field_report_id")

    if not project_id:
        raise HTTPException(status_code=400, detail="project_id is required")

    # Load schedule activities (only L4-L6 for detailed matching)
    act_result = await db.execute(
        select(ScheduleActivity)
        .where(ScheduleActivity.project_id == project_id)
        .where(ScheduleActivity.level >= 4)
    )
    activities = act_result.scalars().all()
    if not activities:
        raise HTTPException(status_code=404, detail="No schedule activities found for this project (levels 4-6).")

    act_dicts = [
        {
            "id": a.id,
            "activity_id": a.activity_id,
            "activity_name": a.activity_name,
            "embedding": a.embedding,
        }
        for a in activities
    ]

    # Load unmatched extracted updates
    q = select(ExtractedUpdate)
    if field_report_id:
        q = q.where(ExtractedUpdate.field_report_id == field_report_id)
    else:
        # Get all extractions for this project's field reports
        fr_result = await db.execute(
            select(FieldReport.id).where(FieldReport.project_id == project_id)
        )
        fr_ids = [row[0] for row in fr_result.all()]
        if not fr_ids:
            return {"success": True, "message": "No field reports found", "matches_created": 0}
        q = q.where(ExtractedUpdate.field_report_id.in_(fr_ids))

    ext_result = await db.execute(q)
    extractions = ext_result.scalars().all()

    THRESHOLD = settings.confidence_threshold
    matches_created = 0

    for ext in extractions:
        # Skip if already matched
        existing = await db.execute(
            select(ActivityMatch).where(ActivityMatch.extracted_update_id == ext.id)
        )
        if existing.scalar_one_or_none():
            continue

        if not ext.activity_description:
            continue

        # Run semantic matching
        query_emb = encode_text(ext.activity_description)
        top_matches = match_to_activities(
            ext.activity_description,
            act_dicts,
            query_embedding=query_emb,
            top_k=5,
        )

        if not top_matches:
            continue

        best = top_matches[0]
        confidence = best["confidence_score"]
        status = "needs_review" if confidence < THRESHOLD else "approved"

        # Build alternatives list (top 2 after best)
        alternatives = [
            {
                "id": m["id"],
                "activity_id": m["activity_id"],
                "activity_name": m["activity_name"],
                "confidence_score": m["confidence_score"],
            }
            for m in top_matches[1:3]
        ]

        match = ActivityMatch(
            extracted_update_id=ext.id,
            activity_id=best["id"],
            confidence_score=confidence,
            status=status,
            alternative_matches=json.dumps(alternatives),
        )
        db.add(match)
        matches_created += 1

    await db.commit()
    return {
        "success": True,
        "message": f"Matching complete: {matches_created} matches created",
        "matches_created": matches_created,
        "threshold": THRESHOLD,
    }


@router.get("/projects/{project_id}/matches")
async def get_matches(
    project_id: int,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Get all activity matches for a project, with full context."""
    # Get field reports for this project
    fr_result = await db.execute(
        select(FieldReport.id).where(FieldReport.project_id == project_id)
    )
    fr_ids = [row[0] for row in fr_result.all()]

    if not fr_ids:
        return {"matches": [], "total": 0}

    # Get extractions → matches
    ext_q = select(ExtractedUpdate).where(ExtractedUpdate.field_report_id.in_(fr_ids))
    ext_result = await db.execute(ext_q)
    extractions = {e.id: e for e in ext_result.scalars().all()}

    match_q = select(ActivityMatch).where(
        ActivityMatch.extracted_update_id.in_(list(extractions.keys()))
    )
    if status:
        match_q = match_q.where(ActivityMatch.status == status)
    match_result = await db.execute(match_q.order_by(ActivityMatch.matched_at.desc()))
    matches = match_result.scalars().all()

    # Enrich with activity names
    act_ids = [m.activity_id for m in matches]
    if act_ids:
        act_result = await db.execute(
            select(ScheduleActivity).where(ScheduleActivity.id.in_(act_ids))
        )
        act_map = {a.id: a for a in act_result.scalars().all()}
    else:
        act_map = {}

    response_matches = []
    for m in matches:
        ext = extractions.get(m.extracted_update_id, {})
        act = act_map.get(m.activity_id)
        alts = json.loads(m.alternative_matches) if m.alternative_matches else []

        response_matches.append({
            "id": m.id,
            "status": m.status,
            "confidence_score": m.confidence_score,
            "needs_review": m.status == "needs_review",
            "matched_at": m.matched_at.isoformat() if m.matched_at else None,
            "reviewed_at": m.reviewed_at.isoformat() if m.reviewed_at else None,
            "reviewer_notes": m.reviewer_notes,
            "extracted_update": {
                "id": ext.id if hasattr(ext, 'id') else None,
                "activity_description": ext.activity_description if hasattr(ext, 'activity_description') else None,
                "status": ext.status if hasattr(ext, 'status') else None,
                "progress": ext.progress if hasattr(ext, 'progress') else None,
                "delay_reason": ext.delay_reason if hasattr(ext, 'delay_reason') else None,
                "delay_category": ext.delay_category if hasattr(ext, 'delay_category') else None,
                "risk_level": ext.risk_level if hasattr(ext, 'risk_level') else None,
                "source_text": ext.source_text if hasattr(ext, 'source_text') else None,
                "extraction_confidence": ext.extraction_confidence if hasattr(ext, 'extraction_confidence') else None,
                "ai_provider": ext.ai_provider if hasattr(ext, 'ai_provider') else None,
            },
            "matched_activity": {
                "id": act.id if act else None,
                "activity_id": act.activity_id if act else None,
                "activity_name": act.activity_name if act else "Unknown",
                "level": act.level if act else None,
                "planned_progress": act.planned_progress if act else None,
                "actual_progress": act.actual_progress if act else None,
            } if act else None,
            "alternative_matches": alts,
        })

    return {
        "matches": response_matches,
        "total": len(response_matches),
        "needs_review_count": sum(1 for m in response_matches if m["needs_review"]),
    }


@router.post("/matches/{match_id}/review")
async def review_match(
    match_id: int,
    decision: ReviewDecisionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Human review of a match — approve, reject, or reassign to another activity."""
    result = await db.execute(select(ActivityMatch).where(ActivityMatch.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if decision.decision not in ("approved", "rejected", "reassigned"):
        raise HTTPException(status_code=400, detail="Decision must be 'approved', 'rejected', or 'reassigned'")

    if decision.decision == "reassigned" and not decision.chosen_activity_id:
        raise HTTPException(status_code=400, detail="chosen_activity_id is required for reassignment")

    # Update match status
    match.status = decision.decision
    match.reviewer_notes = decision.notes
    match.reviewed_at = datetime.utcnow()

    if decision.decision == "reassigned" and decision.chosen_activity_id:
        match.activity_id = decision.chosen_activity_id

    # Record review decision
    review = ReviewDecision(
        match_id=match_id,
        decision=decision.decision,
        notes=decision.notes,
        chosen_activity_id=decision.chosen_activity_id,
    )
    db.add(review)
    await db.commit()

    return {"success": True, "message": f"Match {decision.decision}", "match_id": match_id}
