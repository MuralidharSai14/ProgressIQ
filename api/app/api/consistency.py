"""
PROGRESSIQ — Consistency & Assessment API

POST /projects/{project_id}/consistency/run
GET  /projects/{project_id}/consistency
GET  /activities/{activity_id}/assessment
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func

from app.database.connection import get_db
from app.utils.auth_deps import get_project_or_404
from app.models.models import (
    Project, ScheduleActivity, ExtractedUpdate, ActivityMatch,
    FieldReport, Evidence, EvidenceActivityLink, ConsistencyCheck,
    Conflict, ActivityAssessment, VerificationTask
)
from app.services.consistency_engine import run_all_checks
from app.services.confidence_engine import (
    compute_confidence, compute_evidence_supported_progress, generate_recommendation
)
from app.services.conflict_detector import detect_conflicts
from app.services.verification_service import build_verification_task

router = APIRouter()


@router.post("/projects/{project_id}/consistency/run")
async def run_consistency(project_id: int, db: AsyncSession = Depends(get_db)):
    """Run all consistency checks, compute assessments, detect conflicts, populate verification queue."""
    project = await get_project_or_404(project_id, db)

    acts_result = await db.execute(
        select(ScheduleActivity).where(ScheduleActivity.project_id == project_id, ScheduleActivity.level >= 4)
    )
    activities = acts_result.scalars().all()
    if not activities:
        return {"success": True, "message": "No activities to check", "checked": 0}

    all_act_dicts = [
        {"id": a.id, "db_id": a.id, "activity_id": a.activity_id, "activity_name": a.activity_name,
         "level": a.level, "planned_progress": a.planned_progress, "actual_progress": a.actual_progress,
         "dependency": a.dependency, "reported_progress": a.actual_progress}
        for a in activities
    ]

    # ── Gather semantic match confidence and extraction confidence per activity ──
    fr_result = await db.execute(select(FieldReport.id).where(FieldReport.project_id == project_id))
    fr_ids = [r[0] for r in fr_result.all()]
    match_conf_map: dict[int, float] = {}
    extract_conf_map: dict[int, float] = {}

    if fr_ids:
        ext_result = await db.execute(
            select(ExtractedUpdate).where(ExtractedUpdate.field_report_id.in_(fr_ids))
        )
        exts = {e.id: e for e in ext_result.scalars().all()}
        if exts:
            m_result = await db.execute(
                select(ActivityMatch).where(ActivityMatch.extracted_update_id.in_(list(exts.keys())))
            )
            for m in m_result.scalars().all():
                match_conf_map[m.activity_id] = m.confidence_score
                ext = exts.get(m.extracted_update_id)
                if ext: extract_conf_map[m.activity_id] = ext.extraction_confidence or 80.0

    # ── Gather evidence items linked to each activity ───────────────────────────
    ev_link_result = await db.execute(select(EvidenceActivityLink))
    all_links = ev_link_result.scalars().all()
    ev_ids_all = list({l.evidence_id for l in all_links})
    ev_db_map: dict[int, Evidence] = {}
    if ev_ids_all:
        ev_r = await db.execute(select(Evidence).where(Evidence.id.in_(ev_ids_all)))
        ev_db_map = {e.id: e for e in ev_r.scalars().all()}
    ev_by_act: dict[int, list[dict]] = {}
    for link in all_links:
        ev = ev_db_map.get(link.evidence_id)
        if ev:
            ev_by_act.setdefault(link.activity_id, []).append({
                "evidence_type": ev.evidence_type, "location": ev.location, "description": ev.description
            })

    # ── Clear old data for this project before re-running ───────────────────────
    act_ids = [a.id for a in activities]
    await db.execute(delete(ConsistencyCheck).where(ConsistencyCheck.activity_id.in_(act_ids)))
    await db.execute(delete(Conflict).where(Conflict.project_id == project_id))
    await db.execute(delete(ActivityAssessment).where(ActivityAssessment.activity_id.in_(act_ids)))
    await db.execute(delete(VerificationTask).where(
        VerificationTask.project_id == project_id, VerificationTask.status == "pending"
    ))
    await db.flush()

    checks_c = conflicts_c = vt_c = 0

    for act in activities:
        act_dict = next((d for d in all_act_dicts if d["id"] == act.id), None)
        if not act_dict: continue

        ev_items = ev_by_act.get(act.id, [])
        match_conf = match_conf_map.get(act.id, 75.0)
        extract_conf = extract_conf_map.get(act.id, 80.0)

        # Run the 6-check consistency battery
        check_results = run_all_checks(activity=act_dict, all_activities=all_act_dicts, evidence_items=ev_items)

        for cr in check_results:
            db.add(ConsistencyCheck(
                activity_id=act.id, check_type=cr["check_type"], passed=cr["passed"],
                score=cr["score"], finding=cr["finding"], detail=cr.get("detail")
            ))
            checks_c += 1

        # Compute weighted confidence and evidence-supported progress
        conf = compute_confidence(check_results, match_conf, extract_conf, len(ev_items))
        resource_score = next((c["score"] for c in check_results if c["check_type"] == "resource"), 80.0)
        ev_sup = compute_evidence_supported_progress(act.actual_progress, resource_score, conf["overall_confidence"])

        # Detect and persist conflicts
        conflict_dicts = detect_conflicts(act_dict, check_results, project_id)
        for cd in conflict_dicts:
            db.add(Conflict(**cd))
            conflicts_c += 1

        # Generate plain-language recommendation
        failed = [c["check_type"] for c in check_results if not c["passed"]]
        rec = generate_recommendation(
            act.activity_name, act.actual_progress, ev_sup, conf["confidence_label"], failed, len(conflict_dicts)
        )

        db.add(ActivityAssessment(
            activity_id=act.id, planned_progress=act.planned_progress,
            reported_progress=act.actual_progress, evidence_supported_progress=ev_sup,
            overall_confidence=conf["overall_confidence"], confidence_label=conf["confidence_label"],
            confidence_factors=conf["confidence_factors"], supporting_factors=conf["supporting_factors"],
            uncertainty_factors=conf["uncertainty_factors"], recommendation=rec,
            requires_verification=(conf["overall_confidence"] < 60 or len(conflict_dicts) > 0),
        ))

        # Create a VerificationTask if thresholds are exceeded
        vt_data = build_verification_task(
            act_dict, project_id, act.actual_progress, ev_sup,
            conf["overall_confidence"], len(conflict_dicts), failed, rec
        )
        if vt_data:
            db.add(VerificationTask(**vt_data))
            vt_c += 1

    await db.commit()
    return {
        "success": True, "activities_checked": len(activities),
        "consistency_checks_created": checks_c, "conflicts_detected": conflicts_c,
        "verification_tasks_created": vt_c,
        "message": f"Consistency analysis complete for {len(activities)} activities.",
    }


@router.get("/projects/{project_id}/consistency")
async def get_consistency(project_id: int, db: AsyncSession = Depends(get_db)):
    """Get all consistency results and conflicts for a project."""
    acts_result = await db.execute(select(ScheduleActivity).where(ScheduleActivity.project_id == project_id))
    activities = {a.id: a for a in acts_result.scalars().all()}

    checks_result = await db.execute(
        select(ConsistencyCheck).where(ConsistencyCheck.activity_id.in_(list(activities.keys())))
    )
    checks = checks_result.scalars().all()

    conflicts_result = await db.execute(
        select(Conflict).where(Conflict.project_id == project_id, Conflict.is_resolved == False)
        .order_by(Conflict.detected_at.desc())
    )
    conflicts = conflicts_result.scalars().all()

    assessments_result = await db.execute(
        select(ActivityAssessment).where(ActivityAssessment.activity_id.in_(list(activities.keys())))
    )
    assessments = {a.activity_id: a for a in assessments_result.scalars().all()}

    return {
        "conflicts": [
            {
                "id": c.id, "conflict_type": c.conflict_type, "severity": c.severity,
                "title": c.title, "description": c.description,
                "reported_value": c.reported_value, "expected_value": c.expected_value,
                "recommended_action": c.recommended_action,
                "activity_name": activities[c.activity_id].activity_name if c.activity_id and c.activity_id in activities else None,
                "detected_at": c.detected_at.isoformat(),
            }
            for c in conflicts
        ],
        "conflict_count": len(conflicts),
        "checks_summary": {
            "total": len(checks),
            "passed": sum(1 for c in checks if c.passed),
            "failed": sum(1 for c in checks if not c.passed),
        },
        "assessment_summary": {
            "total": len(assessments),
            "high_confidence": sum(1 for a in assessments.values() if a.confidence_label == "high"),
            "medium_confidence": sum(1 for a in assessments.values() if a.confidence_label == "medium"),
            "low_confidence": sum(1 for a in assessments.values() if a.confidence_label == "low"),
            "requires_verification": sum(1 for a in assessments.values() if a.requires_verification),
        },
    }


@router.get("/activities/{activity_id}/assessment")
async def get_activity_assessment(activity_id: int, db: AsyncSession = Depends(get_db)):
    """Full intelligence view for a single activity."""
    act = (await db.execute(select(ScheduleActivity).where(ScheduleActivity.id == activity_id))).scalar_one_or_none()
    if not act: raise HTTPException(status_code=404, detail="Activity not found")

    assessment = (await db.execute(select(ActivityAssessment).where(ActivityAssessment.activity_id == activity_id))).scalar_one_or_none()
    checks = (await db.execute(select(ConsistencyCheck).where(ConsistencyCheck.activity_id == activity_id))).scalars().all()
    conflicts = (await db.execute(
        select(Conflict).where(Conflict.activity_id == activity_id, Conflict.is_resolved == False)
    )).scalars().all()
    links = (await db.execute(select(EvidenceActivityLink).where(EvidenceActivityLink.activity_id == activity_id))).scalars().all()
    ev_ids = [l.evidence_id for l in links]
    evidence_items = []
    if ev_ids:
        evidence_items = (await db.execute(select(Evidence).where(Evidence.id.in_(ev_ids)))).scalars().all()

    def pj(s):
        """Safely parse a JSON string stored in a text column."""
        try: return json.loads(s) if s else None
        except: return None

    return {
        "activity": {
            "id": act.id, "activity_id": act.activity_id, "activity_name": act.activity_name,
            "level": act.level,
            "planned_start": act.planned_start.isoformat() if act.planned_start else None,
            "planned_finish": act.planned_finish.isoformat() if act.planned_finish else None,
            "planned_progress": act.planned_progress, "actual_progress": act.actual_progress,
            "status": act.status, "dependency": act.dependency,
            "delay_reason": act.delay_reason, "delay_category": act.delay_category,
        },
        "assessment": {
            "planned_progress": assessment.planned_progress,
            "reported_progress": assessment.reported_progress,
            "evidence_supported_progress": assessment.evidence_supported_progress,
            "overall_confidence": assessment.overall_confidence,
            "confidence_label": assessment.confidence_label,
            "confidence_factors": pj(assessment.confidence_factors),
            "supporting_factors": pj(assessment.supporting_factors),
            "uncertainty_factors": pj(assessment.uncertainty_factors),
            "recommendation": assessment.recommendation,
            "requires_verification": assessment.requires_verification,
        } if assessment else None,
        "consistency_checks": [
            {"check_type": c.check_type, "passed": c.passed, "score": c.score, "finding": c.finding, "detail": c.detail}
            for c in checks
        ],
        "conflicts": [
            {"id": c.id, "conflict_type": c.conflict_type, "severity": c.severity,
             "title": c.title, "description": c.description, "recommended_action": c.recommended_action}
            for c in conflicts
        ],
        "evidence": [
            {"id": e.id, "evidence_type": e.evidence_type, "filename": e.filename,
             "description": e.description, "is_demo": e.is_demo}
            for e in evidence_items
        ],
    }
