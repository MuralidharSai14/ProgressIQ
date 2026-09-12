"""
PROGRESSIQ â€” Demo Data Loader

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
    ActivityMatch, Risk, Evidence, EvidenceActivityLink,
    ConsistencyCheck, Conflict, ActivityAssessment, VerificationTask, AuditEvent,
    MaterialShipment, WorkerSafetyRisk,
)

from app.processors.schedule import parse_schedule_file
from app.ai.embeddings import encode_text
from app.services.risk_engine import detect_risks, classify_activity_status
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

SAMPLE_DIR = Path(__file__).parent.parent.parent.parent / "data" / "sample"

TEMPLATES_CATALOG = [
    {
        "id": "infrastructure",
        "name": "Indravati River Pumping Station & Pipeline",
        "category": "Infrastructure & Utilities",
        "organization": "National Infrastructure & Energy Corp",
        "location": "Indravati River Basin, Odisha",
        "description": "70 WBS activities across intake structures, pumping houses, pipeline trenching, thrust blocks, and HT transmission lines.",
        "badge": "Water & Pipeline",
        "activities_count": 70,
        "icon": "piping",
    },
    {
        "id": "construction",
        "name": "Skyline Heights Commercial Center & Tower",
        "category": "Commercial Real Estate & Civil",
        "organization": "Apex Urban Developments",
        "location": "Sector 62, Metro City",
        "description": "22 WBS activities covering deep excavation, raft foundation, shear walls, MEP installation, curtain wall facade, and finishing.",
        "badge": "Building & Civil",
        "activities_count": 22,
        "icon": "building",
    },
    {
        "id": "software",
        "name": "NextGen Enterprise Cloud Platform",
        "category": "Software & Information Technology",
        "organization": "Synapse Digital Solutions",
        "location": "Global / Multi-Region Cloud (AWS & GCP)",
        "description": "18 WBS activities across microservices architecture, OAuth2 & RBAC, AI vector search, CI/CD pipeline, pentesting, and App Store launch.",
        "badge": "IT & Software",
        "activities_count": 18,
        "icon": "code",
    },
    {
        "id": "energy",
        "name": "SuryaKiran 50MW Solar Power Plant",
        "category": "Renewable Energy & Power",
        "organization": "GreenGrid Clean Power Ltd",
        "location": "Bhadla Solar Park, Rajasthan",
        "description": "20 WBS activities covering 200-acre land grading, 110k PV modules, inverter stations, 33kV switchyard, and SCADA telemetry.",
        "badge": "Clean Energy",
        "activities_count": 20,
        "icon": "sun",
    },
]

# ── Pre-built extracted updates (what the AI would find in the field report) ──

DEMO_EXTRACTED_UPDATES = [
    {
        "activity_description": "Pump house foundation grade beam casting",
        "status": "Delayed",
        "progress": 72.0,
        "delay_reason": "Reinforcement steel delivery partially incomplete â€” 18 MT of 28 MT received",
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
        "delay_reason": "Formwork material shortage â€” contractor's formwork not returned from another site",
        "delay_category": "Equipment",
        "risk_level": "Medium",
        "source_text": "Column concreting on Axis-B is only 60% complete against the planned 100%. Delay is attributed to formwork material shortage.",
        "source_page": 1,
        "extraction_confidence": 87.0,
        "schedule_match": "L6-007",
        "match_confidence": 88.0,
    },
    {
        "activity_description": "Roof slab shuttering â€” not started",
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
        "delay_reason": "Pipe delivery severely delayed â€” manufacturer machine breakdown at factory. Only 112 of 480 pipes delivered.",
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
        "delay_reason": "Work stalled as pipe laying is incomplete â€” dependent activity not progressing",
        "delay_category": "Dependency",
        "risk_level": "Medium",
        "source_text": "Thrust block work has not been started as pipe laying is incomplete. Planned progress was 35% but actual is only 10%.",
        "source_page": 2,
        "extraction_confidence": 83.0,
        "schedule_match": "L4-015",
        "match_confidence": 79.0,  # Below threshold â†’ goes to review queue
    },
    {
        "activity_description": "Pump foundation concrete casting behind schedule",
        "status": "Delayed",
        "progress": 55.0,
        "delay_reason": "RCC design for pump pedestal was revised â€” contractor received revised drawing 12 days late",
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
        "delay_reason": "Pump foundation still incomplete â€” installation cannot proceed",
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
        "delay_reason": "Transportation clearance issues â€” gate not delivered from manufacturer",
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
        "source_text": "Transformer has been delivered to site and civil foundation is ready. Installation work will commence on September 8, 2026. Current progress 20% against planned 25% â€” on track.",
        "source_page": 3,
        "extraction_confidence": 88.0,
        "schedule_match": "L5-025",
        "match_confidence": 73.0,  # Low confidence â†’ review queue
    },
]


TEMPLATE_CONFIGS = {
    "infrastructure": {
        "name": "Indravati River Pumping Station",
        "description": "Construction of 3×40 MLD capacity pumping station with rising main and associated civil, mechanical, and electrical works for the Bastar Water Supply Scheme, Chhattisgarh.",
        "organization": "National Infrastructure & Energy Corp",
        "location": "Jagdalpur, Chhattisgarh",
    },
    "construction": {
        "name": "Skyline Heights Commercial Center & Tower",
        "description": "G+24 high-rise commercial center with 3 basements, diaphragm walls, raft foundation, post-tensioned slabs, unitized curtain wall glazing, and centralized HVAC.",
        "organization": "Apex Urban Developments Ltd",
        "location": "Sector 62, Metro City",
    },
    "software": {
        "name": "NextGen Enterprise Cloud Platform",
        "description": "Multi-tenant cloud platform featuring distributed event streaming, OAuth2 RBAC authentication, React micro-frontends, AI vector embeddings, and SOC2 compliance.",
        "organization": "Synapse Digital Solutions",
        "location": "Global / Multi-Region Cloud (AWS & GCP)",
    },
    "energy": {
        "name": "SuryaKiran 50MW Solar Power Plant",
        "description": "Utility-scale 50MW photovoltaic solar farm with single-axis tracking, 110,000 bifacial monocrystalline modules, central inverter stations, and 33kV/132kV grid substation.",
        "organization": "GreenGrid Clean Power Ltd",
        "location": "Bhadla Solar Park, Rajasthan",
    },
}


async def load_demo_project(db: AsyncSession, template_type: str = "infrastructure") -> dict:
    """
    Loads a complete demo project into the database based on the selected industry template.
    Deletes any existing demo project first (idempotent).
    Returns summary of what was created.
    """
    logger.info(f"🚀 Loading demo project (template: {template_type})...")
    template_info = TEMPLATE_CONFIGS.get(template_type, TEMPLATE_CONFIGS["infrastructure"])

    # ── Step 1: Delete existing demo project ─────────────────────────────────
    existing = await db.execute(select(Project).where(Project.is_demo == True))
    for proj in existing.scalars().all():
        await db.execute(delete(AuditEvent).where(AuditEvent.project_id == proj.id))
        await db.execute(delete(VerificationTask).where(VerificationTask.project_id == proj.id))
        await db.execute(delete(Conflict).where(Conflict.project_id == proj.id))
        await db.execute(delete(Evidence).where(Evidence.project_id == proj.id))
        await db.execute(delete(Risk).where(Risk.project_id == proj.id))
        await db.execute(delete(MaterialShipment).where(MaterialShipment.project_id == proj.id))
        await db.execute(delete(WorkerSafetyRisk).where(WorkerSafetyRisk.project_id == proj.id))

        frs = await db.execute(select(FieldReport.id).where(FieldReport.project_id == proj.id))
        fr_ids = [r[0] for r in frs.all()]
        if fr_ids:
            exts = await db.execute(select(ExtractedUpdate.id).where(ExtractedUpdate.field_report_id.in_(fr_ids)))
            ext_ids = [r[0] for r in exts.all()]
            if ext_ids:
                await db.execute(delete(ActivityMatch).where(ActivityMatch.extracted_update_id.in_(ext_ids)))
            await db.execute(delete(ExtractedUpdate).where(ExtractedUpdate.field_report_id.in_(fr_ids)))
            await db.execute(delete(FieldReport).where(FieldReport.project_id == proj.id))

        acts = await db.execute(select(ScheduleActivity.id).where(ScheduleActivity.project_id == proj.id))
        act_ids = [r[0] for r in acts.all()]
        if act_ids:
            await db.execute(delete(ActivityAssessment).where(ActivityAssessment.activity_id.in_(act_ids)))
            await db.execute(delete(ConsistencyCheck).where(ConsistencyCheck.activity_id.in_(act_ids)))
            await db.execute(delete(EvidenceActivityLink).where(EvidenceActivityLink.activity_id.in_(act_ids)))
            await db.execute(delete(ScheduleActivity).where(ScheduleActivity.project_id == proj.id))

        await db.delete(proj)
    await db.commit()

    # ── Step 2: Create Project ───────────────────────────────────────────────
    project = Project(
        name=template_info["name"],
        description=template_info["description"],
        organization=template_info["organization"],
        location=template_info["location"],
        status="active",
        planned_start=datetime(2026, 1, 1),
        planned_end=datetime(2026, 12, 31),
        is_demo=True,
    )
    db.add(project)
    await db.flush()  # Get the project.id without committing
    project_id = project.id
    logger.info(f"  Created project: id={project_id} ({project.name})")

    # â”€â”€ Step 3: Parse and insert schedule activities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    schedule_path = SAMPLE_DIR / "sample_schedule.csv"
    with open(schedule_path, "rb") as f:
        schedule_bytes = f.read()
    raw_activities, _, _ = parse_schedule_file(schedule_bytes, "sample_schedule.csv")

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

    # Map activity_id strings â†’ DB integer ids
    for act_data, act in db_activities:
        act_id_to_db[act_data["activity_id"]] = act.id

    logger.info(f"  Created {len(db_activities)} schedule activities")

    # â”€â”€ Step 4: Create Field Report â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    report_path = SAMPLE_DIR / "sample_field_report.txt"
    with open(report_path, "r", encoding="utf-8") as f:
        raw_text = f.read()

    field_report = FieldReport(
        project_id=project_id,
        filename="DPR-2026-248_Indravati_Pumping_Station.txt",
        file_type="txt",
        raw_text=raw_text,
        report_date=datetime(2026, 9, 5),
        source_label="Daily Progress Report â€” 05 September 2026",
        uploaded_at=datetime.utcnow(),
    )
    db.add(field_report)
    await db.flush()
    report_id = field_report.id
    logger.info(f"  Created field report: id={report_id}")

    # â”€â”€ Step 5: Create Extracted Updates & Matches â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    # â”€â”€ Step 6: Run Risk Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    # ── Step 7: Demo Evidence ──────────────────────────────────────────────────────────
    DEMO_EVIDENCE = [
        {"evidence_type": "photo", "filename": "demo_reinforcement_blockA.jpg",
         "description": "Site photograph showing reinforcement steel placement for pump house foundation grade beam",
         "location": "Block A / Pump House", "reported_date": datetime(2026, 9, 5),
         "ai_analysis": json.dumps({"detected_indicators": ["Reinforcement steel visible", "Foundation construction visible", "Construction workers present"], "evidence_relevance": "High", "progress_estimation": "Evidence supports activity execution, but is insufficient to independently estimate exact completion percentage.", "note": "[DEMO / SIMULATED]"}),
         "schedule_match": "L5-001", "relevance_score": 91.0},
        {"evidence_type": "material_record", "filename": "demo_steel_delivery_record.csv",
         "description": "Reinforcement steel (Fe-500) delivery record", "location": "Site Store",
         "material_name": "Reinforcement Steel Fe-500", "expected_quantity": "28 MT",
         "recorded_quantity": "18 MT", "reported_date": datetime(2026, 9, 4),
         "schedule_match": "L5-001", "relevance_score": 95.0},
        {"evidence_type": "photo", "filename": "demo_pipe_laying_site.jpg",
         "description": "Photo of 600mm MS pipe staging area — only 112 of 480 pipes on site",
         "location": "Rising Main Route", "reported_date": datetime(2026, 9, 5),
         "ai_analysis": json.dumps({"detected_indicators": ["Pipe installation visible", "Partial material delivery evident"], "evidence_relevance": "High", "progress_estimation": "Evidence confirms severely limited material availability. Supports low progress report.", "note": "[DEMO / SIMULATED]"}),
         "schedule_match": "L5-012", "relevance_score": 94.0},
        {"evidence_type": "material_record", "filename": "demo_pipe_delivery_log.xlsx",
         "description": "600mm MS pipe delivery log", "material_name": "600mm MS Pipe",
         "expected_quantity": "480 pipes", "recorded_quantity": "112 pipes",
         "reported_date": datetime(2026, 9, 3), "schedule_match": "L5-012", "relevance_score": 96.0},
        {"evidence_type": "document", "filename": "demo_structural_drawing_rev3_pending.pdf",
         "description": "Structural drawing revision Rev-3 — pending PMC approval for roof slab",
         "reported_date": datetime(2026, 9, 1), "schedule_match": "L5-007", "relevance_score": 88.0},
        {"evidence_type": "equipment_record", "filename": "demo_pump_delivery.txt",
         "description": "Delivery confirmation for 2 of 4 centrifugal pumps from Kirloskar Brothers Limited",
         "equipment_name": "Main Centrifugal Pump (Kirloskar)",
         "reported_date": datetime(2026, 9, 2), "schedule_match": "L4-018", "relevance_score": 91.0},
    ]

    for ev_data in DEMO_EVIDENCE:
        ev = Evidence(
            project_id=project_id,
            evidence_type=ev_data["evidence_type"],
            filename=ev_data["filename"],
            description=ev_data.get("description"),
            location=ev_data.get("location"),
            reported_date=ev_data.get("reported_date"),
            material_name=ev_data.get("material_name"),
            expected_quantity=ev_data.get("expected_quantity"),
            recorded_quantity=ev_data.get("recorded_quantity"),
            equipment_name=ev_data.get("equipment_name"),
            ai_analysis=ev_data.get("ai_analysis"),
            is_demo=True,
        )
        db.add(ev)
        await db.flush()
        target_db_id = act_id_to_db.get(ev_data["schedule_match"])
        if target_db_id:
            db.add(EvidenceActivityLink(
                evidence_id=ev.id, activity_id=target_db_id,
                relevance_score=ev_data["relevance_score"],
                link_reason="[DEMO] AI-linked based on description and location context.",
                linked_by="ai",
            ))
    await db.flush()
    logger.info(f"  Created {len(DEMO_EVIDENCE)} demo evidence items")

    # ── Step 8: Run consistency + assessments + verification tasks ───────────────────
    from app.services.consistency_engine import run_all_checks
    from app.services.confidence_engine import (
        compute_confidence, compute_evidence_supported_progress, generate_recommendation
    )
    from app.services.conflict_detector import detect_conflicts
    from app.services.verification_service import build_verification_task

    result = await db.execute(select(ScheduleActivity).where(ScheduleActivity.project_id == project_id))
    all_acts = result.scalars().all()
    all_act_dicts_full = [
        {"id": a.id, "db_id": a.id, "activity_id": a.activity_id, "activity_name": a.activity_name,
         "level": a.level, "planned_progress": a.planned_progress, "actual_progress": a.actual_progress,
         "dependency": a.dependency, "reported_progress": a.actual_progress}
        for a in all_acts
    ]

    ev_link_result = await db.execute(select(EvidenceActivityLink))
    all_ev_links = ev_link_result.scalars().all()
    ev_ids_demo = list({l.evidence_id for l in all_ev_links})
    ev_db_map = {}
    if ev_ids_demo:
        ev_r = await db.execute(select(Evidence).where(Evidence.id.in_(ev_ids_demo)))
        ev_db_map = {e.id: e for e in ev_r.scalars().all()}
    ev_by_act: dict[int, list[dict]] = {}
    for link in all_ev_links:
        ev = ev_db_map.get(link.evidence_id)
        if ev:
            ev_by_act.setdefault(link.activity_id, []).append(
                {"evidence_type": ev.evidence_type, "location": ev.location, "description": ev.description}
            )

    match_conf_map2 = {upd["schedule_match"]: upd["match_confidence"] for upd in DEMO_EXTRACTED_UPDATES}
    consistency_cnt = conflict_cnt_d = assessment_cnt = vt_cnt = 0

    for a in all_acts:
        if a.level < 4: continue
        act_dict = next((d for d in all_act_dicts_full if d["id"] == a.id), None)
        if not act_dict: continue

        ev_items = ev_by_act.get(a.id, [])
        match_conf = match_conf_map2.get(a.activity_id, 75.0)

        check_results = run_all_checks(activity=act_dict, all_activities=all_act_dicts_full, evidence_items=ev_items)
        for cr in check_results:
            db.add(ConsistencyCheck(
                activity_id=a.id, check_type=cr["check_type"], passed=cr["passed"],
                score=cr["score"], finding=cr["finding"], detail=cr.get("detail")
            ))
            consistency_cnt += 1

        conf = compute_confidence(check_results, match_conf, 85.0, len(ev_items))
        resource_score = next((c["score"] for c in check_results if c["check_type"] == "resource"), 80.0)
        ev_sup = compute_evidence_supported_progress(a.actual_progress, resource_score, conf["overall_confidence"])

        conflict_dicts = detect_conflicts(act_dict, check_results, project_id)
        for cd in conflict_dicts:
            db.add(Conflict(**cd))
            conflict_cnt_d += 1

        failed = [c["check_type"] for c in check_results if not c["passed"]]
        rec = generate_recommendation(a.activity_name, a.actual_progress, ev_sup, conf["confidence_label"], failed, len(conflict_dicts))

        db.add(ActivityAssessment(
            activity_id=a.id, planned_progress=a.planned_progress,
            reported_progress=a.actual_progress, evidence_supported_progress=ev_sup,
            overall_confidence=conf["overall_confidence"], confidence_label=conf["confidence_label"],
            confidence_factors=conf["confidence_factors"], supporting_factors=conf["supporting_factors"],
            uncertainty_factors=conf["uncertainty_factors"], recommendation=rec,
            requires_verification=(conf["overall_confidence"] < 60 or len(conflict_dicts) > 0),
        ))
        assessment_cnt += 1

        vt_data = build_verification_task(
            act_dict, project_id, a.actual_progress, ev_sup,
            conf["overall_confidence"], len(conflict_dicts), failed, rec
        )
        if vt_data:
            db.add(VerificationTask(**vt_data))
            vt_cnt += 1

    # ── Step 9: Audit events ────────────────────────────────────────────────────────
    for ev_data in [
        {"event_type": "extraction", "actor": "ai", "summary": "AI extracted 12 field updates from DPR-2026-248"},
        {"event_type": "matching", "actor": "ai", "summary": "Semantic matching: 12 matches, 2 flagged for review"},
        {"event_type": "evidence_upload", "actor": "system", "summary": f"[DEMO] {len(DEMO_EVIDENCE)} evidence items loaded"},
        {"event_type": "consistency_check", "actor": "system", "summary": f"Consistency engine ran on {assessment_cnt} activities"},
        {"event_type": "conflict_detected", "actor": "system", "summary": f"{conflict_cnt_d} conflicts detected"},
    ]:
        db.add(AuditEvent(project_id=project_id, event_type=ev_data["event_type"],
                          actor=ev_data["actor"], summary=ev_data["summary"]))

    await db.commit()
    logger.info(f"  Demo: {consistency_cnt} checks, {conflict_cnt_d} conflicts, {assessment_cnt} assessments, {vt_cnt} verification tasks")

    # ── Step 10: Demo Material Shipments ────────────────────────────────────────
    DEMO_MATERIALS = [
        {
            "material_name": "Reinforcement Steel Fe-500",
            "category": "Steel",
            "supplier_name": "SAIL — Bhilai Steel Plant",
            "unit": "MT",
            "required_quantity": 28.0,
            "ordered_quantity": 28.0,
            "delivered_quantity": 18.0,
            "status": "shortage",
            "priority": "critical",
            "expected_delivery": datetime(2026, 9, 12),
            "actual_delivery": None,
            "delay_reason": "Partial delivery — 10 MT balance delayed due to transport strike",
            "notes": "Fe-500 grade bars for pump house grade beam casting",
            "schedule_match": "L5-001",
        },
        {
            "material_name": "600mm MS Pipe (Class C)",
            "category": "Piping",
            "supplier_name": "Man Industries Ltd.",
            "unit": "nos",
            "required_quantity": 480.0,
            "ordered_quantity": 480.0,
            "delivered_quantity": 112.0,
            "status": "shortage",
            "priority": "critical",
            "expected_delivery": datetime(2026, 9, 20),
            "actual_delivery": None,
            "delay_reason": "Manufacturer machine breakdown — production halted. Balance 368 pipes to be dispatched.",
            "notes": "Critical path item for rising main laying",
            "schedule_match": "L5-012",
        },
        {
            "material_name": "Centrifugal Pump (Kirloskar KDS-40)",
            "category": "Mechanical",
            "supplier_name": "Kirloskar Brothers Limited",
            "unit": "nos",
            "required_quantity": 4.0,
            "ordered_quantity": 4.0,
            "delivered_quantity": 2.0,
            "status": "in_transit",
            "priority": "high",
            "expected_delivery": datetime(2026, 9, 15),
            "actual_delivery": None,
            "delay_reason": "2 pumps dispatched from Pune factory — expected on Sept 15",
            "notes": "Main duty + standby pumps for 3×40 MLD station",
            "schedule_match": "L4-018",
        },
        {
            "material_name": "11KV Transformer (2 MVA)",
            "category": "Electrical",
            "supplier_name": "BHEL — Bhopal",
            "unit": "nos",
            "required_quantity": 1.0,
            "ordered_quantity": 1.0,
            "delivered_quantity": 1.0,
            "status": "delivered",
            "priority": "medium",
            "expected_delivery": datetime(2026, 9, 2),
            "actual_delivery": datetime(2026, 9, 2),
            "delay_reason": None,
            "notes": "Delivered on schedule. Civil foundation ready. Installation Sept 8.",
            "schedule_match": "L5-025",
        },
        {
            "material_name": "Stop Log Gate Assembly",
            "category": "Structural",
            "supplier_name": "Triveni Engineering",
            "unit": "sets",
            "required_quantity": 2.0,
            "ordered_quantity": 2.0,
            "delivered_quantity": 0.0,
            "status": "delayed",
            "priority": "high",
            "expected_delivery": datetime(2026, 9, 10),
            "actual_delivery": None,
            "delay_reason": "Transportation clearance stuck — oversize load permit pending with NHAI",
            "notes": "Ordered July 2026 — transport clearance issues remain unresolved",
            "schedule_match": "L5-021",
        },
        {
            "material_name": "M25 Ready Mix Concrete",
            "category": "Concrete",
            "supplier_name": "RMC India — Jagdalpur Plant",
            "unit": "m³",
            "required_quantity": 420.0,
            "ordered_quantity": 420.0,
            "delivered_quantity": 315.0,
            "status": "in_transit",
            "priority": "medium",
            "expected_delivery": datetime(2026, 9, 8),
            "actual_delivery": None,
            "delay_reason": None,
            "notes": "Batching plant operational. On-demand supply continuing.",
            "schedule_match": "L6-007",
        },
        {
            "material_name": "HT XLPE Cable (11KV, 3C×150mm²)",
            "category": "Electrical",
            "supplier_name": "Polycab India Ltd.",
            "unit": "m",
            "required_quantity": 1800.0,
            "ordered_quantity": 1800.0,
            "delivered_quantity": 900.0,
            "status": "in_transit",
            "priority": "medium",
            "expected_delivery": datetime(2026, 9, 18),
            "actual_delivery": None,
            "delay_reason": None,
            "notes": "Balance 900m to be delivered in second consignment",
            "schedule_match": "L5-024",
        },
        {
            "material_name": "GI Formwork Panels",
            "category": "Civil",
            "supplier_name": "Site Store — On Loan",
            "unit": "nos",
            "required_quantity": 120.0,
            "ordered_quantity": 80.0,
            "delivered_quantity": 50.0,
            "status": "shortage",
            "priority": "high",
            "expected_delivery": datetime(2026, 9, 7),
            "actual_delivery": None,
            "delay_reason": "Contractor's formwork panels not yet returned from Bilaspur project site",
            "notes": "Formwork shortage directly causing column concreting delay",
            "schedule_match": "L6-007",
        },
    ]

    # Pre-compute material shortage count before pop() mutates the dicts
    material_shortage_count = sum(1 for m in DEMO_MATERIALS if m.get("status") in ("shortage", "delayed"))

    material_count = 0
    for m_data in DEMO_MATERIALS:
        activity_db_id = act_id_to_db.get(m_data.pop("schedule_match", None))

        shipment = MaterialShipment(
            project_id=project_id,
            activity_id=activity_db_id,
            is_demo=True,
            **m_data,
        )
        db.add(shipment)
        material_count += 1

    await db.flush()
    logger.info(f"  Created {material_count} material shipment records")

    # ── Step 11: Demo Worker Safety Risks ────────────────────────────────────────

    DEMO_SAFETY_RISKS = [
        {
            "title": "Working at Height — Pump House Roof Slab Shuttering",
            "hazard_category": "Working at Height",
            "risk_score": "high",
            "description": "Workers erecting shuttering and reinforcement for roof slab at 4.5m height. Risk of fall from formwork platform. No permanent edge protection installed.",
            "required_ppe": json.dumps(["Safety Harness", "Helmet", "Non-slip Footwear", "Safety Net", "Full-body Harness"]),
            "mitigation_plan": "Install scaffolding edge guardrails before work commences. All workers must wear full-body harness anchored to certified tie-off points. Daily toolbox talk mandatory.",
            "compliance_status": "warning",
            "affected_workers": 12,
            "schedule_match": "L5-007",
        },
        {
            "title": "Excavation & Trench Work — Rising Main Route",
            "hazard_category": "Excavation",
            "risk_score": "critical",
            "description": "Deep trench excavation for 600mm rising main pipe laying. Trench depth 2.5–3.2m in loose alluvial soil. High risk of trench collapse without adequate shoring.",
            "required_ppe": json.dumps(["Helmet", "Steel-toe Boots", "Hi-Vis Vest", "Shoring Supports", "Confined Space Permit"]),
            "mitigation_plan": "Install hydraulic trench shoring at every 1.5m. No workers permitted in unsupported trenches. Soil stability check every 4 hours by site supervisor. Emergency evacuation plan displayed at site.",
            "compliance_status": "violation",
            "affected_workers": 18,
            "schedule_match": "L5-012",
        },
        {
            "title": "Heavy Lifting — Centrifugal Pump Installation",
            "hazard_category": "Heavy Equipment",
            "risk_score": "high",
            "description": "Installation of main centrifugal pumps (~1.8 MT each) using mobile crane. Risk of dropped load, crane overload, and crush injury during pump alignment.",
            "required_ppe": json.dumps(["Helmet", "Hi-Vis Vest", "Steel-toe Boots", "Rigger Gloves", "Tag Lines"]),
            "mitigation_plan": "Certified rigger and crane operator mandatory. Pre-lift meeting and load chart verification. Exclusion zone of 3m radius enforced during lifting. Hydraulic jack for final alignment only.",
            "compliance_status": "pending_review",
            "affected_workers": 8,
            "schedule_match": "L4-019",
        },
        {
            "title": "Electrical Hazard — HT Cable Laying & Termination",
            "hazard_category": "Electrical Hazard",
            "risk_score": "critical",
            "description": "Laying and termination of 11KV XLPE cable. Live HT line in vicinity during cable routing. Risk of electrocution, arc flash, and equipment damage.",
            "required_ppe": json.dumps(["Insulated Gloves (Class 2)", "Arc Flash PPE", "Helmet with Face Shield", "Insulated Safety Boots", "Live Line Indicator"]),
            "mitigation_plan": "Obtain PTW (Permit to Work) from utility before commencement. Isolate and earth HT line. Only certified electrical workers. LOTO (Lock Out Tag Out) procedure strictly followed.",
            "compliance_status": "warning",
            "affected_workers": 6,
            "schedule_match": "L5-024",
        },
        {
            "title": "Chemical Exposure — Transformer Oil Handling",
            "hazard_category": "Chemical Exposure",
            "risk_score": "medium",
            "description": "Handling and filling of transformer insulating oil (mineral oil) during installation. Risk of skin and eye contact, inhalation of vapours, and environmental contamination if spilled.",
            "required_ppe": json.dumps(["Chemical Resistant Gloves", "Safety Goggles", "Respirator (P100)", "Protective Apron", "Spill Kit"]),
            "mitigation_plan": "Oil handling only in ventilated area. Spill containment tray under transformer. MSDS available at work site. Dispose of contaminated material via registered waste handler.",
            "compliance_status": "compliant",
            "affected_workers": 4,
            "schedule_match": "L5-025",
        },
        {
            "title": "Fire & Explosion Risk — Welding & Cutting (Pipe Works)",
            "hazard_category": "Fire & Explosion",
            "risk_score": "high",
            "description": "Oxy-acetylene cutting and electric arc welding on MS pipes near storage area. Risk of fire from weld sparks igniting stored materials and LPG cylinders.",
            "required_ppe": json.dumps(["Welding Shield", "Fire-Resistant Clothing", "Welding Gloves", "Safety Boots", "Fire Extinguisher (CO2)"]),
            "mitigation_plan": "Hot work permit required. Fire watch posted during and 30 min after welding. LPG cylinders stored 10m away from welding area. Flashback arrestor on all oxy-acetylene sets.",
            "compliance_status": "compliant",
            "affected_workers": 10,
            "schedule_match": "L5-001",
        },
        {
            "title": "Manual Handling — Reinforcement Steel Bar Handling",
            "hazard_category": "Manual Handling",
            "risk_score": "medium",
            "description": "Manual handling of 12m long Fe-500 rebars (up to 60 kg/bar). Risk of back injury, crush injury from dropped bars, and laceration from sharp bar ends.",
            "required_ppe": json.dumps(["Heavy Duty Gloves", "Steel-toe Boots", "Helmet", "Hi-Vis Vest"]),
            "mitigation_plan": "Minimum 4 workers for bars >30 kg. Bar ends to be fitted with plastic caps. Mechanical assistance (bar bender/cutter) to be used for cutting. Lifting team briefed daily.",
            "compliance_status": "compliant",
            "affected_workers": 20,
            "schedule_match": "L5-001",
        },
        {
            "title": "Noise & Vibration — Concrete Batching & Compaction",
            "hazard_category": "Noise & Vibration",
            "risk_score": "low",
            "description": "Prolonged exposure to noise from concrete batching plant and pneumatic vibrators during concrete pouring. Noise levels measured at 88–92 dB near plant.",
            "required_ppe": json.dumps(["Earplugs (SNR 28dB)", "Ear Muffs", "Anti-Vibration Gloves"]),
            "mitigation_plan": "All workers within 15m of batching plant to wear hearing protection. Vibrator operation limited to 30-min continuous periods. Hearing test records to be maintained quarterly.",
            "compliance_status": "compliant",
            "affected_workers": 15,
            "schedule_match": "L6-007",
        },
    ]

    # Pre-compute safety violation count before pop() mutates the dicts
    safety_violation_count = sum(1 for s in DEMO_SAFETY_RISKS if s.get("compliance_status") in ("violation", "warning"))

    safety_count = 0
    for s_data in DEMO_SAFETY_RISKS:
        activity_db_id = act_id_to_db.get(s_data.pop("schedule_match", None))
        safety_risk = WorkerSafetyRisk(
            project_id=project_id,
            activity_id=activity_db_id,
            is_demo=True,
            **s_data,
        )
        db.add(safety_risk)
        safety_count += 1

    await db.flush()
    logger.info(f"  Created {safety_count} worker safety risk records")

    # ── Step 12: Additional audit events for new features ────────────────────────
    db.add(AuditEvent(
        project_id=project_id,
        event_type="logistics_loaded",
        actor="system",
        summary=f"[DEMO] {material_count} material shipment records seeded — {material_shortage_count} shortages/delays detected",
    ))
    db.add(AuditEvent(
        project_id=project_id,
        event_type="safety_loaded",
        actor="system",
        summary=f"[DEMO] {safety_count} worker safety risk records seeded — {safety_violation_count} compliance issues flagged",
    ))


    await db.commit()
    logger.info(f"  Demo project fully loaded.")

    return {
        "project_id": project_id,
        "project_name": project.name,
        "activities_count": len(db_activities),
        "field_reports": 1,
        "extracted_updates": len(DEMO_EXTRACTED_UPDATES),
        "matches": matched_count,
        "pending_review": pending_review_count,
        "risks": len(risks_data),
        "evidence_items": len(DEMO_EVIDENCE),
        "conflicts": conflict_cnt_d,
        "verification_tasks": vt_cnt,
        "material_shipments": material_count,
        "worker_safety_risks": safety_count,
        "message": "Demo project loaded with logistics, safety, and evidence-backed intelligence!",
    }



