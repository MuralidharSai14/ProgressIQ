"""
PROGRESSIQ — Async Background AI Processing Pipeline
Processes field reports, runs semantic matching, updates consistency assessments,
detects risks, and emits real-time events without blocking the web request.
"""
import json
import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.connection import AsyncSessionLocal
from app.models.models import (
    Project, ScheduleActivity, FieldReport, ExtractedUpdate,
    ActivityMatch, LiveFieldUpdate, ActivityAssessment, ConsistencyCheck,
    Conflict, VerificationTask, AuditEvent, WorkerSafetyRisk, MaterialShipment
)
from app.ai.provider import get_ai_provider
from app.ai.embeddings import encode_text, match_to_activities
from app.services.consistency_engine import run_all_checks
from app.services.confidence_engine import compute_confidence, compute_evidence_supported_progress, generate_recommendation
from app.services.conflict_detector import detect_conflicts
from app.services.verification_service import build_verification_task
from app.services.event_broadcaster import emit_project_update
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def process_live_field_update_background(
    update_id: int,
    project_id: int,
    activity_id: int,
    reported_progress: float,
    remarks: str | None,
    evidence_url: str | None,
    reporter_name: str,
):
    """
    Background worker for live field updates submitted from mobile / web.
    Updates schedule activity progress, recalculates consistency and confidence,
    updates activity assessment, creates audit events, and broadcasts SSE.
    """
    async with AsyncSessionLocal() as db:
        try:
            logger.info(f"🔄 Processing live field update #{update_id} for project #{project_id} (Activity #{activity_id})")

            # 1. Fetch activity
            act_res = await db.execute(select(ScheduleActivity).where(ScheduleActivity.id == activity_id))
            activity = act_res.scalar_one_or_none()
            if not activity:
                logger.warning(f"Activity #{activity_id} not found for live update #{update_id}")
                return

            # Save previous progress and update to new progress
            prev_prog = activity.actual_progress
            activity.actual_progress = round(float(reported_progress), 2)
            activity.progress_variance = round(activity.actual_progress - activity.planned_progress, 2)

            if activity.actual_progress >= 100:
                activity.status = "completed"
            elif activity.progress_variance < -20:
                activity.status = "delayed"
            elif activity.actual_progress > 0:
                activity.status = "in_progress"

            # 2. Update LiveFieldUpdate record with previous progress and status
            upd_res = await db.execute(select(LiveFieldUpdate).where(LiveFieldUpdate.id == update_id))
            live_upd = upd_res.scalar_one_or_none()
            if live_upd:
                live_upd.previous_progress = prev_prog
                live_upd.status = "completed"

            # 3. Analyze text remarks using AI (mock or Gemini) for materials & safety
            if remarks:
                ai = get_ai_provider()
                analysis = await ai.extract_field_update(remarks)
                if live_upd:
                    live_upd.ai_confidence = analysis.get("extraction_confidence", 85.0)
                    live_upd.ai_notes = analysis.get("delay_reason")

                # Auto-detect safety hazards if mentioned
                for haz in analysis.get("safety_hazards", []):
                    db.add(WorkerSafetyRisk(
                        project_id=project_id,
                        activity_id=activity_id,
                        title=f"{haz.get('category')} - {activity.activity_name[:50]}",
                        hazard_category=haz.get("category", "General Site"),
                        risk_score=haz.get("risk_score", "medium"),
                        description=haz.get("description", "Detected from field update remarks"),
                        required_ppe=json.dumps(haz.get("ppe", [])),
                        compliance_status="pending_review",
                    ))

            # 4. Consistency & Assessment recalculation
            act_dict = {
                "id": activity.id,
                "db_id": activity.id,
                "activity_id": activity.activity_id,
                "activity_name": activity.activity_name,
                "level": activity.level,
                "planned_progress": activity.planned_progress,
                "actual_progress": activity.actual_progress,
                "reported_progress": activity.actual_progress,
                "dependency": activity.dependency,
            }

            all_acts_res = await db.execute(select(ScheduleActivity).where(ScheduleActivity.project_id == project_id))
            all_acts = [
                {"id": a.id, "db_id": a.id, "activity_id": a.activity_id, "activity_name": a.activity_name,
                 "level": a.level, "planned_progress": a.planned_progress, "actual_progress": a.actual_progress,
                 "reported_progress": a.actual_progress, "dependency": a.dependency}
                for a in all_acts_res.scalars().all()
            ]

            ev_items = []
            if evidence_url:
                ev_items.append({"evidence_type": "photo", "location": activity.activity_name, "description": remarks or "Site photo"})

            check_results = run_all_checks(act_dict, all_acts, ev_items)
            conf = compute_confidence(check_results, 88.0, 85.0, len(ev_items))
            ev_sup = compute_evidence_supported_progress(activity.actual_progress, 85.0, conf["overall_confidence"])
            conflict_dicts = detect_conflicts(act_dict, check_results, project_id)

            failed = [c["check_type"] for c in check_results if not c["passed"]]
            rec = generate_recommendation(activity.activity_name, activity.actual_progress, ev_sup, conf["confidence_label"], failed, len(conflict_dicts))

            # Update or create ActivityAssessment
            ass_res = await db.execute(select(ActivityAssessment).where(ActivityAssessment.activity_id == activity_id))
            assessment = ass_res.scalar_one_or_none()
            if not assessment:
                assessment = ActivityAssessment(activity_id=activity_id)
                db.add(assessment)

            assessment.planned_progress = activity.planned_progress
            assessment.reported_progress = activity.actual_progress
            assessment.evidence_supported_progress = ev_sup
            assessment.overall_confidence = conf["overall_confidence"]
            assessment.confidence_label = conf["confidence_label"]
            assessment.confidence_factors = conf["confidence_factors"]
            assessment.supporting_factors = conf["supporting_factors"]
            assessment.uncertainty_factors = conf["uncertainty_factors"]
            assessment.recommendation = rec
            assessment.requires_verification = (conf["overall_confidence"] < 60 or len(conflict_dicts) > 0 or activity.progress_variance < -20)

            # Auto-create verification task if needed
            if assessment.requires_verification:
                vt_data = build_verification_task(
                    act_dict, project_id, activity.actual_progress, ev_sup,
                    conf["overall_confidence"], len(conflict_dicts), failed, rec
                )
                if vt_data:
                    db.add(VerificationTask(**vt_data))

            # 5. Create Audit Event
            db.add(AuditEvent(
                project_id=project_id,
                activity_id=activity_id,
                event_type="live_field_update",
                actor=reporter_name,
                summary=f"Progress updated to {activity.actual_progress}% ({'+' if activity.actual_progress >= prev_prog else ''}{round(activity.actual_progress - prev_prog, 1)}%) for '{activity.activity_name}'",
                detail=remarks,
            ))

            await db.commit()
            logger.info(f"✅ Successfully processed live field update #{update_id}")

            # 6. Broadcast SSE Event to all connected devices (Laptops, Phones)
            await emit_project_update(
                project_id=project_id,
                event_type="live_field_update_processed",
                data={
                    "update_id": update_id,
                    "activity_id": activity_id,
                    "activity_name": activity.activity_name,
                    "progress": activity.actual_progress,
                    "previous_progress": prev_prog,
                    "reporter": reporter_name,
                    "evidence_url": evidence_url,
                    "overall_confidence": conf["overall_confidence"],
                    "timestamp": datetime.utcnow().isoformat(),
                },
            )

        except Exception as e:
            logger.error(f"Error processing live field update #{update_id}: {e}", exc_info=True)
            await db.rollback()


async def process_field_report_background(field_report_id: int, project_id: int):
    """
    Background worker for field reports.
    Extracts text chunks, runs AI extraction, performs semantic activity matching,
    and updates report status to completed.
    """
    async with AsyncSessionLocal() as db:
        try:
            logger.info(f"📄 Processing field report #{field_report_id} in background")
            rep_res = await db.execute(select(FieldReport).where(FieldReport.id == field_report_id))
            report = rep_res.scalar_one_or_none()
            if not report:
                return

            report.status = "processing"
            await db.commit()

            from app.processors.document import split_into_paragraphs
            paragraphs = split_into_paragraphs(report.raw_text or "", min_length=50)
            if not paragraphs:
                paragraphs = [(report.raw_text or "")[:1000]]
            paragraphs = paragraphs[:20]

            ai = get_ai_provider()
            for para in paragraphs:
                try:
                    extraction = await ai.extract_field_update(para)
                except Exception:
                    extraction = {
                        "activity_description": para[:100],
                        "status": "In Progress",
                        "progress": None,
                        "delay_reason": None,
                        "extraction_confidence": 60.0,
                        "ai_provider": "fallback",
                    }

                update = ExtractedUpdate(
                    field_report_id=field_report_id,
                    activity_description=extraction.get("activity_description"),
                    status=extraction.get("status"),
                    progress=extraction.get("progress"),
                    actual_start=extraction.get("actual_start"),
                    actual_finish=extraction.get("actual_finish"),
                    delay_reason=extraction.get("delay_reason"),
                    delay_category=extraction.get("delay_category"),
                    risk_level=extraction.get("risk_level"),
                    dependency_mentioned=extraction.get("dependency_mentioned"),
                    source_text=para[:500],
                    ai_provider=extraction.get("ai_provider", settings.ai_provider),
                    extraction_confidence=extraction.get("extraction_confidence"),
                )
                db.add(update)

            report.status = "completed"
            await db.commit()

            # Broadcast SSE Event
            await emit_project_update(
                project_id=project_id,
                event_type="field_report_processed",
                data={
                    "field_report_id": field_report_id,
                    "filename": report.filename,
                    "status": "completed",
                    "timestamp": datetime.utcnow().isoformat(),
                },
            )
            logger.info(f"✅ Field report #{field_report_id} processing complete")

        except Exception as e:
            logger.error(f"Error processing field report #{field_report_id}: {e}", exc_info=True)
            await db.rollback()
