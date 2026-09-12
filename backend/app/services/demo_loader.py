"""
PROGRESSIQ — Demo Data Loader

This module seeds the database with a complete, realistic demo project.
When a user clicks "Load Demo Project", this runs in seconds and populates
all tables with believable data showing the full PROGRESSIQ pipeline.

It creates:
  - 1 Demo Project
  - 70 Schedule Activities (L1-L6)
  - 1 Field Report
  - 12 Extracted Updates (from the field report)
  - 12 Activity Matches (with confidence scores)
  - Risks (auto-detected)
  - Review Queue items (low-confidence matches)
"""
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.models import (
    Project, ScheduleActivity, FieldReport, ExtractedUpdate,
    ActivityMatch, Risk
)
from app.processors.schedule import parse_schedule_file
from app.ai.embeddings import encode_text
from app.services.risk_engine import detect_risks, classify_activity_status
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

SAMPLE_DIR = Path(__file__).parent.parent.parent.parent / "data" / "sample"


# ── Pre-built extracted updates (what the AI would find in the field report) ──

DEMO_EXTRACTED_UPDATES = [
    {
        "activity_description": "Pump house foundation grade beam casting",
        "status": "Delayed",
        "progress": 72.0,
        "delay_reason": "Reinforcement steel delivery partially incomplete — 18 MT of 28 MT received",
        "delay_category": "Material",
        "risk_level": "High",
        "source_text": "Pump house foundation work is progressing very slowly due to continued material delivery issues. Reinforcement steel bars (Fe-500) for the grade beam casting have been only partially delivered.",
        "source_page": 1,
        "extraction_confidence": 91.5,
        "schedule_match": "L5-001",  # Which schedule activity this should match
        "match_confidence": 92.0,
    },
    {
        "activity_description": "Column concreting Axis-B Level 1 pump house",
        "status": "Delayed",
        "progress": 60.0,
        "delay_reason": "Formwork material shortage — contractor's formwork not returned from another site",
        "delay_category": "Equipment",
        "risk_level": "Medium",
        "source_text": "Column concreting on Axis-B is only 60% complete against the planned 100%. Delay is attributed to formwork material shortage.",
        "source_page": 1,
        "extraction_confidence": 87.0,
        "schedule_match": "L6-007",
        "match_confidence": 88.0,
    },
    {
        "activity_description": "Roof slab shuttering — not started",
        "status": "Delayed",
        "progress": 38.0,
        "delay_reason": "Structural drawing revision (Rev-3) pending approval from PMC. Concrete batching plant under maintenance.",
        "delay_category": "Approval",
        "risk_level": "High",
        "source_text": "Roof slab shuttering has not commenced as planned. Only 38% of planned progress achieved. The structural drawing revision (Rev-3) from Design is pending approval from the PMC.",
        "source_page": 1,
        "extraction_confidence": 89.0,
        "schedule_match": "L5-007",
        "match_confidence": 85.0,
    },
    {
        "activity_description": "600mm MS pipe laying rising main",
        "status": "Delayed",
        "progress": 22.0,
        "delay_reason": "Pipe delivery severely delayed — manufacturer machine breakdown at factory. Only 112 of 480 pipes delivered.",
        "delay_category": "Material",
        "risk_level": "Critical",
        "source_text": "Pipe laying has been severely affected by delay in pipe delivery from the manufacturer. Out of 480 pipes required for Phase-1, only 112 pipes have been delivered to site.",
        "source_page": 2,
        "extraction_confidence": 94.0,
        "schedule_match": "L5-012",
        "match_confidence": 94.0,
    },
    {
        "activity_description": "Thrust block construction",
        "status": "Delayed",
        "progress": 10.0,
        "delay_reason": "Work stalled as pipe laying is incomplete — dependent activity not progressing",
        "delay_category": "Dependency",
        "risk_level": "Medium",
        "source_text": "Thrust block work has not been started as pipe laying is incomplete. Planned progress was 35% but actual is only 10%.",
        "source_page": 2,
        "extraction_confidence": 83.0,
        "schedule_match": "L4-015",
        "match_confidence": 79.0,  # Below threshold → goes to review queue
    },
    {
        "activity_description": "Pump foundation concrete casting behind schedule",
        "status": "Delayed",
        "progress": 55.0,
        "delay_reason": "RCC design for pump pedestal was revised — contractor received revised drawing 12 days late",
        "delay_category": "Approval",
        "risk_level": "High",
        "source_text": "Pump foundation concrete casting is progressing but behind schedule. Civil work is at 55% against planned 80%. Reason: RCC design for pump pedestal was revised.",
        "source_page": 2,
        "extraction_confidence": 88.5,
        "schedule_match": "L5-018",
        "match_confidence": 86.0,
    },
    {
        "activity_description": "Main centrifugal pump supply and delivery",
        "status": "Delayed",
        "progress": 48.0,
        "delay_reason": "Only 2 out of 4 pumps delivered. Balance expected by September 15.",
        "delay_category": "Material",
        "risk_level": "Medium",
        "source_text": "Main centrifugal pumps (4 nos.) have been supplied by M/s Kirloskar Brothers Limited. 2 out of 4 pumps have been delivered to site.",
        "source_page": 2,
        "extraction_confidence": 92.0,
        "schedule_match": "L4-018",
        "match_confidence": 91.0,
    },
    {
        "activity_description": "Pump installation and alignment work",
        "status": "Delayed",
        "progress": 5.0,
        "delay_reason": "Pump foundation still incomplete — installation cannot proceed",
        "delay_category": "Dependency",
        "risk_level": "High",
        "source_text": "Pump installation and alignment work is at 5% as pump foundation is still incomplete. Planned progress was 30%.",
        "source_page": 3,
        "extraction_confidence": 91.0,
        "schedule_match": "L4-019",
        "match_confidence": 90.0,
    },
    {
        "activity_description": "HT electrical line erection",
        "status": "In Progress",
        "progress": 50.0,
        "delay_reason": None,
        "delay_category": None,
        "risk_level": "Low",
        "source_text": "HT line erection is on track. 50% of erection complete against planned 60%. Minor variation is expected to be recovered.",
        "source_page": 3,
        "extraction_confidence": 85.0,
        "schedule_match": "L5-024",
        "match_confidence": 83.0,
    },
    {
        "activity_description": "Intake screen chamber wall construction",
        "status": "In Progress",
        "progress": 70.0,
        "delay_reason": "Heavy rainfall during August 28-31 caused slight shortfall",
        "delay_category": "Weather",
        "risk_level": "Low",
        "source_text": "Screen chamber wall construction is progressing well. Currently at 70% against planned 85%. Slight shortfall due to heavy rainfall during August 28-31.",
        "source_page": 3,
        "extraction_confidence": 86.0,
        "schedule_match": "L5-019",
        "match_confidence": 88.0,
    },
    {
        "activity_description": "Stop log gate supply and delivery",
        "status": "Delayed",
        "progress": 25.0,
        "delay_reason": "Transportation clearance issues — gate not delivered from manufacturer",
        "delay_category": "External",
        "risk_level": "High",
        "source_text": "Stop log gate has not been delivered. Order was placed in July 2026 but delivery is stuck due to transportation clearance issues.",
        "source_page": 3,
        "extraction_confidence": 90.0,
        "schedule_match": "L5-021",
        "match_confidence": 88.0,
    },
    {
        "activity_description": "Transformer installation electrical works",
        "status": "In Progress",
        "progress": 20.0,
        "delay_reason": None,
        "delay_category": None,
        "risk_level": "Low",
        "source_text": "Transformer has been delivered to site and civil foundation is ready. Installation work will commence on September 8, 2026. Current progress 20% against planned 25% — on track.",
        "source_page": 3,
        "extraction_confidence": 88.0,
        "schedule_match": "L5-025",
        "match_confidence": 73.0,  # Low confidence → review queue
    },
]


async def load_demo_project(db: AsyncSession) -> dict:
    """
    Loads the complete demo project into the database.
    Deletes any existing demo project first (idempotent).
    Returns summary of what was created.
    """
    logger.info("🚀 Loading demo project...")

    # ── Step 1: Delete existing demo project ─────────────────────────────────
    existing = await db.execute(select(Project).where(Project.is_demo == True))
    for proj in existing.scalars().all():
        await db.execute(delete(Risk).where(Risk.project_id == proj.id))
        # Cascade handles the rest via SQLAlchemy relationships
        await db.delete(proj)
    await db.commit()

    # ── Step 2: Create Project ────────────────────────────────────────────────
    project = Project(
        name="Indravati River Pumping Station",
        description="Construction of 3×40 MLD capacity pumping station with rising main and associated civil, mechanical, and electrical works for the Bastar Water Supply Scheme, Chhattisgarh.",
        organization="Oil India Limited — Infrastructure Division",
        location="Jagdalpur, Chhattisgarh",
        status="active",
        planned_start=datetime(2026, 1, 1),
        planned_end=datetime(2026, 12, 31),
        is_demo=True,
    )
    db.add(project)
    await db.flush()  # Get the project.id without committing
    project_id = project.id
    logger.info(f"  Created project: id={project_id}")

    # ── Step 3: Parse and insert schedule activities ──────────────────────────
    schedule_path = SAMPLE_DIR / "sample_schedule.csv"
    with open(schedule_path, "rb") as f:
        schedule_bytes = f.read()
    raw_activities = parse_schedule_file(schedule_bytes, "sample_schedule.csv")

    # Build activity_id → DB id map for risk engine
    act_id_to_db: dict[str, int] = {}
    db_activities = []

    for act_data in raw_activities:
        # Compute embedding for semantic matching
        embedding = encode_text(act_data["activity_name"])
        embedding_json = json.dumps(embedding) if embedding else None

        act = ScheduleActivity(
            project_id=project_id,
            activity_id=act_data["activity_id"],
            activity_name=act_data["activity_name"],
            level=act_data["level"],
            parent_id=act_data.get("parent_id"),
            planned_start=act_data.get("planned_start"),
            planned_finish=act_data.get("planned_finish"),
            planned_progress=act_data["planned_progress"],
            actual_progress=act_data["actual_progress"],
            progress_variance=act_data["progress_variance"],
            dependency=act_data.get("dependency"),
            is_milestone=act_data["is_milestone"],
            status=act_data["status"],
            embedding=embedding_json,
        )
        db.add(act)
        db_activities.append((act_data, act))

    await db.flush()

    # Map activity_id strings → DB integer ids
    for act_data, act in db_activities:
        act_id_to_db[act_data["activity_id"]] = act.id

    logger.info(f"  Created {len(db_activities)} schedule activities")

    # ── Step 4: Create Field Report ───────────────────────────────────────────
    report_path = SAMPLE_DIR / "sample_field_report.txt"
    with open(report_path, "r", encoding="utf-8") as f:
        raw_text = f.read()

    field_report = FieldReport(
        project_id=project_id,
        filename="DPR-2026-248_Indravati_Pumping_Station.txt",
        file_type="txt",
        raw_text=raw_text,
        report_date=datetime(2026, 9, 5),
        source_label="Daily Progress Report — 05 September 2026",
        uploaded_at=datetime.utcnow(),
    )
    db.add(field_report)
    await db.flush()
    report_id = field_report.id
    logger.info(f"  Created field report: id={report_id}")

    # ── Step 5: Create Extracted Updates & Matches ────────────────────────────
    REVIEW_THRESHOLD = settings.confidence_threshold
    pending_review_count = 0
    matched_count = 0

    for upd_data in DEMO_EXTRACTED_UPDATES:
        # Create extracted update
        extracted = ExtractedUpdate(
            field_report_id=report_id,
            activity_description=upd_data["activity_description"],
            status=upd_data["status"],
            progress=upd_data["progress"],
            delay_reason=upd_data.get("delay_reason"),
            delay_category=upd_data.get("delay_category"),
            risk_level=upd_data["risk_level"],
            dependency_mentioned=None,
            source_text=upd_data["source_text"],
            source_page=upd_data["source_page"],
            ai_provider=settings.ai_provider,
            extraction_confidence=upd_data["extraction_confidence"],
        )
        db.add(extracted)
        await db.flush()

        # Find the matched activity DB id
        target_act_id = upd_data["schedule_match"]
        matched_db_id = act_id_to_db.get(target_act_id)

        if matched_db_id is None:
            logger.warning(f"  Could not find schedule activity '{target_act_id}' for demo match")
            continue

        confidence = upd_data["match_confidence"]
        match_status = "needs_review" if confidence < REVIEW_THRESHOLD else "approved"
        if match_status == "needs_review":
            pending_review_count += 1

        # Build 2 alternative matches for context
        alts = []
        for act_data, act in db_activities[:3]:
            if act.id != matched_db_id:
                alts.append({
                    "id": act.id,
                    "activity_id": act_data["activity_id"],
                    "activity_name": act.activity_name,
                    "confidence_score": round(confidence * 0.7, 1),
                })
        alts = alts[:2]

        match = ActivityMatch(
            extracted_update_id=extracted.id,
            activity_id=matched_db_id,
            confidence_score=confidence,
            status=match_status,
            alternative_matches=json.dumps(alts),
        )
        db.add(match)
        matched_count += 1

        # Update schedule activity with actual progress from field report
        stmt = select(ScheduleActivity).where(ScheduleActivity.id == matched_db_id)
        result = await db.execute(stmt)
        act_obj = result.scalar_one_or_none()
        if act_obj and upd_data.get("delay_category"):
            act_obj.delay_category = upd_data["delay_category"]
            if upd_data.get("delay_reason"):
                act_obj.delay_reason = upd_data["delay_reason"][:200]

    await db.flush()
    logger.info(f"  Created {matched_count} activity matches ({pending_review_count} need review)")

    # ── Step 6: Run Risk Engine ───────────────────────────────────────────────
    # Fetch all activities for risk analysis
    result = await db.execute(
        select(ScheduleActivity).where(ScheduleActivity.project_id == project_id)
    )
    all_activities = result.scalars().all()

    act_dicts = []
    for a in all_activities:
        act_dicts.append({
            "db_id": a.id,
            "activity_id": a.activity_id,
            "activity_name": a.activity_name,
            "level": a.level,
            "planned_progress": a.planned_progress,
            "actual_progress": a.actual_progress,
            "progress_variance": a.progress_variance,
            "planned_finish": a.planned_finish,
            "is_milestone": a.is_milestone,
            "status": a.status,
            "dependency": a.dependency,
            "delay_category": a.delay_category,
        })

    risks_data = detect_risks(act_dicts, project_id)
    for risk_data in risks_data:
        risk = Risk(
            project_id=risk_data["project_id"],
            activity_id=risk_data.get("activity_id"),
            title=risk_data["title"],
            description=risk_data["description"],
            level=risk_data["level"],
            category=risk_data.get("category"),
            affected_dependency=risk_data.get("affected_dependency"),
            recommended_action=risk_data.get("recommended_action"),
        )
        db.add(risk)

    await db.commit()
    logger.info(f"  Created {len(risks_data)} risks")

    return {
        "project_id": project_id,
        "project_name": project.name,
        "activities_count": len(db_activities),
        "field_reports": 1,
        "extracted_updates": len(DEMO_EXTRACTED_UPDATES),
        "matches": matched_count,
        "pending_review": pending_review_count,
        "risks": len(risks_data),
        "message": "Demo project loaded successfully!",
    }
