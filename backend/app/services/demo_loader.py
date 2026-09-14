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
        "description": "23 WBS activities across intake structures, pumping houses, pipeline trenching, thrust blocks, and HT transmission lines.",
        "badge": "Water & Pipeline",
        "activities_count": 23,
        "icon": "piping",
    },
    {
        "id": "construction",
        "name": "Skyline Heights Commercial Center & Tower",
        "category": "Commercial Real Estate & Civil",
        "organization": "Apex Urban Developments",
        "location": "Sector 62, Metro City",
        "description": "23 WBS activities covering deep excavation, raft foundation, shear walls, MEP installation, curtain wall facade, and finishing.",
        "badge": "Building & Civil",
        "activities_count": 23,
        "icon": "building",
    },
    {
        "id": "energy",
        "name": "SuryaKiran 50MW Solar Power Plant",
        "category": "Renewable Energy & Power",
        "organization": "GreenGrid Clean Power Ltd",
        "location": "Bhadla Solar Park, Rajasthan",
        "description": "24 WBS activities covering 200-acre land grading, 110k PV modules, inverter stations, 33kV switchyard, and SCADA telemetry.",
        "badge": "Clean Energy",
        "activities_count": 24,
        "icon": "sun",
    },
]


# ═══════════════════════════════════════════════════════════════════════════════
# INFRASTRUCTURE TEMPLATE — Indravati River Pumping Station
# ═══════════════════════════════════════════════════════════════════════════════

INFRA_ACTIVITIES = [
    {"activity_id": "L1-001", "activity_name": "Indravati River Pumping Station & Pipeline", "level": 1, "parent_id": None, "planned_start": "2026-01-01", "planned_finish": "2026-12-31", "planned_progress": 45.0, "actual_progress": 38.0, "is_milestone": False, "status": "Delayed", "dependency": None},
    {"activity_id": "L2-001", "activity_name": "Civil Works — Intake & Pump House", "level": 2, "parent_id": "L1-001", "planned_start": "2026-01-05", "planned_finish": "2026-08-31", "planned_progress": 62.0, "actual_progress": 51.0, "is_milestone": False, "status": "Delayed", "dependency": None},
    {"activity_id": "L3-001", "activity_name": "Intake Structure", "level": 3, "parent_id": "L2-001", "planned_start": "2026-01-05", "planned_finish": "2026-05-15", "planned_progress": 85.0, "actual_progress": 70.0, "is_milestone": False, "status": "Delayed", "dependency": None},
    {"activity_id": "L4-001", "activity_name": "Riverbed Excavation & Dewatering", "level": 4, "parent_id": "L3-001", "planned_start": "2026-01-05", "planned_finish": "2026-02-28", "planned_progress": 100.0, "actual_progress": 100.0, "is_milestone": False, "status": "Completed", "dependency": None},
    {"activity_id": "L5-019", "activity_name": "Intake Screen Chamber Wall Construction", "level": 5, "parent_id": "L4-001", "planned_start": "2026-02-01", "planned_finish": "2026-04-30", "planned_progress": 85.0, "actual_progress": 70.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-001"},
    {"activity_id": "L5-021", "activity_name": "Stop Log Gate Supply & Installation", "level": 5, "parent_id": "L4-001", "planned_start": "2026-05-01", "planned_finish": "2026-07-31", "planned_progress": 40.0, "actual_progress": 25.0, "is_milestone": False, "status": "Delayed", "dependency": "L5-019"},
    {"activity_id": "L3-002", "activity_name": "Pump House Civil Works", "level": 3, "parent_id": "L2-001", "planned_start": "2026-02-01", "planned_finish": "2026-09-30", "planned_progress": 55.0, "actual_progress": 42.0, "is_milestone": False, "status": "Delayed", "dependency": None},
    {"activity_id": "L4-002", "activity_name": "Foundation & Substructure", "level": 4, "parent_id": "L3-002", "planned_start": "2026-02-01", "planned_finish": "2026-05-31", "planned_progress": 80.0, "actual_progress": 65.0, "is_milestone": False, "status": "Delayed", "dependency": None},
    {"activity_id": "L5-001", "activity_name": "Pump House Foundation Grade Beam Casting", "level": 5, "parent_id": "L4-002", "planned_start": "2026-03-01", "planned_finish": "2026-05-15", "planned_progress": 90.0, "actual_progress": 72.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-001"},
    {"activity_id": "L5-007", "activity_name": "Roof Slab Shuttering & Concreting", "level": 5, "parent_id": "L4-002", "planned_start": "2026-06-01", "planned_finish": "2026-08-31", "planned_progress": 50.0, "actual_progress": 38.0, "is_milestone": False, "status": "Delayed", "dependency": "L5-001"},
    {"activity_id": "L6-007", "activity_name": "Column Concreting Axis-B Level-1", "level": 6, "parent_id": "L5-007", "planned_start": "2026-04-01", "planned_finish": "2026-06-30", "planned_progress": 100.0, "actual_progress": 60.0, "is_milestone": False, "status": "Delayed", "dependency": "L5-001"},
    {"activity_id": "L2-002", "activity_name": "Mechanical Works — Pumps & Piping", "level": 2, "parent_id": "L1-001", "planned_start": "2026-04-01", "planned_finish": "2026-11-30", "planned_progress": 35.0, "actual_progress": 24.0, "is_milestone": False, "status": "Delayed", "dependency": "L2-001"},
    {"activity_id": "L3-003", "activity_name": "Rising Main Pipeline", "level": 3, "parent_id": "L2-002", "planned_start": "2026-04-01", "planned_finish": "2026-10-31", "planned_progress": 30.0, "actual_progress": 18.0, "is_milestone": False, "status": "Delayed", "dependency": None},
    {"activity_id": "L4-015", "activity_name": "Pipeline Thrust Blocks & Supports", "level": 4, "parent_id": "L3-003", "planned_start": "2026-06-01", "planned_finish": "2026-09-30", "planned_progress": 35.0, "actual_progress": 10.0, "is_milestone": False, "status": "Delayed", "dependency": "L5-012"},
    {"activity_id": "L5-012", "activity_name": "600mm MS Pipe Laying — Rising Main", "level": 5, "parent_id": "L4-015", "planned_start": "2026-04-15", "planned_finish": "2026-09-15", "planned_progress": 40.0, "actual_progress": 22.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-002"},
    {"activity_id": "L3-004", "activity_name": "Pump & Motor Installation", "level": 3, "parent_id": "L2-002", "planned_start": "2026-06-01", "planned_finish": "2026-11-30", "planned_progress": 30.0, "actual_progress": 18.0, "is_milestone": False, "status": "Delayed", "dependency": "L3-002"},
    {"activity_id": "L4-018", "activity_name": "Main Centrifugal Pump Supply & Delivery", "level": 4, "parent_id": "L3-004", "planned_start": "2026-06-01", "planned_finish": "2026-08-31", "planned_progress": 75.0, "actual_progress": 48.0, "is_milestone": False, "status": "Delayed", "dependency": None},
    {"activity_id": "L5-018", "activity_name": "Pump Foundation Concrete Casting", "level": 5, "parent_id": "L4-018", "planned_start": "2026-07-01", "planned_finish": "2026-09-15", "planned_progress": 80.0, "actual_progress": 55.0, "is_milestone": False, "status": "Delayed", "dependency": "L5-001"},
    {"activity_id": "L4-019", "activity_name": "Pump Installation & Alignment", "level": 4, "parent_id": "L3-004", "planned_start": "2026-08-01", "planned_finish": "2026-11-30", "planned_progress": 30.0, "actual_progress": 5.0, "is_milestone": False, "status": "Delayed", "dependency": "L5-018"},
    {"activity_id": "L2-003", "activity_name": "Electrical & HT Works", "level": 2, "parent_id": "L1-001", "planned_start": "2026-05-01", "planned_finish": "2026-12-15", "planned_progress": 40.0, "actual_progress": 35.0, "is_milestone": False, "status": "In Progress", "dependency": None},
    {"activity_id": "L5-024", "activity_name": "HT XLPE Cable Laying & Termination", "level": 5, "parent_id": "L2-003", "planned_start": "2026-06-01", "planned_finish": "2026-10-31", "planned_progress": 60.0, "actual_progress": 50.0, "is_milestone": False, "status": "In Progress", "dependency": None},
    {"activity_id": "L5-025", "activity_name": "11KV Transformer Installation", "level": 5, "parent_id": "L2-003", "planned_start": "2026-08-01", "planned_finish": "2026-10-15", "planned_progress": 25.0, "actual_progress": 20.0, "is_milestone": False, "status": "In Progress", "dependency": "L5-024"},
    {"activity_id": "M-001", "activity_name": "Mechanical Completion Milestone", "level": 4, "parent_id": "L2-002", "planned_start": "2026-12-01", "planned_finish": "2026-12-01", "planned_progress": 0.0, "actual_progress": 0.0, "is_milestone": True, "status": "Not Started", "dependency": "L4-019"},
]

INFRA_EXTRACTED_UPDATES = [
    {"activity_description": "Pump house foundation grade beam casting", "status": "Delayed", "progress": 72.0, "delay_reason": "Reinforcement steel delivery partially incomplete — 18 MT of 28 MT received", "delay_category": "Material", "risk_level": "High", "source_text": "Pump house foundation work is progressing very slowly due to continued material delivery issues. Reinforcement steel bars (Fe-500) for the grade beam casting have been only partially delivered.", "source_page": 1, "extraction_confidence": 91.5, "schedule_match": "L5-001", "match_confidence": 92.0},
    {"activity_description": "Column concreting Axis-B Level 1 pump house", "status": "Delayed", "progress": 60.0, "delay_reason": "Formwork material shortage — contractor's formwork not returned from another site", "delay_category": "Equipment", "risk_level": "Medium", "source_text": "Column concreting on Axis-B is only 60% complete against the planned 100%. Delay is attributed to formwork material shortage.", "source_page": 1, "extraction_confidence": 87.0, "schedule_match": "L6-007", "match_confidence": 88.0},
    {"activity_description": "Roof slab shuttering not started", "status": "Delayed", "progress": 38.0, "delay_reason": "Structural drawing revision (Rev-3) pending approval from PMC. Concrete batching plant under maintenance.", "delay_category": "Approval", "risk_level": "High", "source_text": "Roof slab shuttering has not commenced as planned. Only 38% of planned progress achieved. The structural drawing revision (Rev-3) from Design is pending approval from the PMC.", "source_page": 1, "extraction_confidence": 89.0, "schedule_match": "L5-007", "match_confidence": 85.0},
    {"activity_description": "600mm MS pipe laying rising main", "status": "Delayed", "progress": 22.0, "delay_reason": "Pipe delivery severely delayed — manufacturer machine breakdown. Only 112 of 480 pipes delivered.", "delay_category": "Material", "risk_level": "Critical", "source_text": "Pipe laying has been severely affected by delay in pipe delivery from the manufacturer. Out of 480 pipes required for Phase-1, only 112 pipes have been delivered to site.", "source_page": 2, "extraction_confidence": 94.0, "schedule_match": "L5-012", "match_confidence": 94.0},
    {"activity_description": "Thrust block construction", "status": "Delayed", "progress": 10.0, "delay_reason": "Work stalled as pipe laying is incomplete — dependent activity not progressing", "delay_category": "Dependency", "risk_level": "Medium", "source_text": "Thrust block work has not been started as pipe laying is incomplete. Planned progress was 35% but actual is only 10%.", "source_page": 2, "extraction_confidence": 83.0, "schedule_match": "L4-015", "match_confidence": 79.0},
    {"activity_description": "Pump foundation concrete casting behind schedule", "status": "Delayed", "progress": 55.0, "delay_reason": "RCC design for pump pedestal was revised — contractor received revised drawing 12 days late", "delay_category": "Approval", "risk_level": "High", "source_text": "Pump foundation concrete casting is progressing but behind schedule. Civil work is at 55% against planned 80%.", "source_page": 2, "extraction_confidence": 88.5, "schedule_match": "L5-018", "match_confidence": 86.0},
    {"activity_description": "Main centrifugal pump supply and delivery", "status": "Delayed", "progress": 48.0, "delay_reason": "Only 2 out of 4 pumps delivered. Balance expected by September 15.", "delay_category": "Material", "risk_level": "Medium", "source_text": "Main centrifugal pumps (4 nos.) have been supplied by M/s Kirloskar Brothers Limited. 2 out of 4 pumps have been delivered to site.", "source_page": 2, "extraction_confidence": 92.0, "schedule_match": "L4-018", "match_confidence": 91.0},
    {"activity_description": "Pump installation and alignment work", "status": "Delayed", "progress": 5.0, "delay_reason": "Pump foundation still incomplete — installation cannot proceed", "delay_category": "Dependency", "risk_level": "High", "source_text": "Pump installation and alignment work is at 5% as pump foundation is still incomplete. Planned progress was 30%.", "source_page": 3, "extraction_confidence": 91.0, "schedule_match": "L4-019", "match_confidence": 90.0},
    {"activity_description": "HT electrical line erection", "status": "In Progress", "progress": 50.0, "delay_reason": None, "delay_category": None, "risk_level": "Low", "source_text": "HT line erection is on track. 50% of erection complete against planned 60%. Minor variation is expected to be recovered.", "source_page": 3, "extraction_confidence": 85.0, "schedule_match": "L5-024", "match_confidence": 83.0},
    {"activity_description": "Intake screen chamber wall construction", "status": "In Progress", "progress": 70.0, "delay_reason": "Heavy rainfall during August 28-31 caused slight shortfall", "delay_category": "Weather", "risk_level": "Low", "source_text": "Screen chamber wall construction is progressing well. Currently at 70% against planned 85%. Slight shortfall due to heavy rainfall.", "source_page": 3, "extraction_confidence": 86.0, "schedule_match": "L5-019", "match_confidence": 88.0},
    {"activity_description": "Stop log gate supply and delivery", "status": "Delayed", "progress": 25.0, "delay_reason": "Transportation clearance issues — gate not delivered from manufacturer", "delay_category": "External", "risk_level": "High", "source_text": "Stop log gate has not been delivered. Order was placed in July 2026 but delivery is stuck due to transportation clearance issues.", "source_page": 3, "extraction_confidence": 90.0, "schedule_match": "L5-021", "match_confidence": 88.0},
    {"activity_description": "Transformer installation electrical works", "status": "In Progress", "progress": 20.0, "delay_reason": None, "delay_category": None, "risk_level": "Low", "source_text": "Transformer has been delivered to site and civil foundation is ready. Installation work will commence on September 8, 2026. Current progress 20% against planned 25% — on track.", "source_page": 3, "extraction_confidence": 88.0, "schedule_match": "L5-025", "match_confidence": 73.0},
]

INFRA_FIELD_REPORT = """DAILY PROGRESS REPORT — DPR-2026-248
Project: Indravati River Pumping Station & Pipeline
Date: 05 September 2026 | Prepared by: Site Engineer Suresh Babu

CIVIL WORKS STATUS:
Pump house foundation grade beam casting is at 72% against planned 90%. Reinforcement steel (Fe-500) delivery is partially complete — only 18 MT of 28 MT received from SAIL Bhilai. Contractor has been asked to expedite balance delivery. Column concreting on Axis-B Level-1 is at 60% against planned 100% due to formwork shortage. Roof slab shuttering has not commenced — structural drawing revision Rev-3 pending PMC approval.

PIPELINE WORKS:
600mm MS pipe laying (rising main) is severely impacted. Only 112 of 480 pipes have been delivered to site. Manufacturer Man Industries Ltd. reported machine breakdown at factory. Thrust block construction is stalled at 10% — dependent on pipe laying. Pump foundation casting is at 55% against planned 80%. RCC design for pump pedestal was revised and contractor received revised drawing 12 days late.

MECHANICAL WORKS:
Main centrifugal pumps — 2 of 4 delivered from Kirloskar Brothers. Balance 2 pumps expected September 15. Pump installation cannot proceed as foundation is incomplete (5% vs 30% planned).

ELECTRICAL WORKS:
HT cable laying progressing at 50% (planned 60%) — on near-track. 11KV Transformer delivered and civil foundation ready. Installation commences September 8. HT line erection is 50% complete.

SAFETY: Trench shoring non-compliant at rising main chainage 120m — violation raised. Working at height PPE inspection required for roof slab team.
"""

INFRA_EVIDENCE = [
    {"evidence_type": "photo", "filename": "infra_reinforcement_blockA.jpg", "description": "Site photograph showing reinforcement steel placement for pump house foundation grade beam", "location": "Block A / Pump House", "reported_date": datetime(2026, 9, 5), "ai_analysis": json.dumps({"detected_indicators": ["Reinforcement steel visible", "Foundation construction visible", "Construction workers present"], "evidence_relevance": "High", "progress_estimation": "Evidence supports 72% progress claim.", "note": "[DEMO]"}), "schedule_match": "L5-001", "relevance_score": 91.0},
    {"evidence_type": "material_record", "filename": "infra_steel_delivery_record.csv", "description": "Reinforcement steel (Fe-500) delivery record — 18 MT received of 28 MT ordered", "location": "Site Store", "material_name": "Reinforcement Steel Fe-500", "expected_quantity": "28 MT", "recorded_quantity": "18 MT", "reported_date": datetime(2026, 9, 4), "schedule_match": "L5-001", "relevance_score": 95.0},
    {"evidence_type": "photo", "filename": "infra_pipe_staging_area.jpg", "description": "Photo of 600mm MS pipe staging area — only 112 of 480 pipes on site", "location": "Rising Main Route", "reported_date": datetime(2026, 9, 5), "ai_analysis": json.dumps({"detected_indicators": ["Pipe installation visible", "Partial material delivery evident"], "evidence_relevance": "High", "progress_estimation": "Evidence confirms severely limited material availability.", "note": "[DEMO]"}), "schedule_match": "L5-012", "relevance_score": 94.0},
    {"evidence_type": "material_record", "filename": "infra_pipe_delivery_log.xlsx", "description": "600mm MS pipe delivery log — 112 of 480 received", "material_name": "600mm MS Pipe", "expected_quantity": "480 pipes", "recorded_quantity": "112 pipes", "reported_date": datetime(2026, 9, 3), "schedule_match": "L5-012", "relevance_score": 96.0},
    {"evidence_type": "document", "filename": "infra_structural_drawing_rev3.pdf", "description": "Structural drawing revision Rev-3 — pending PMC approval for roof slab", "reported_date": datetime(2026, 9, 1), "schedule_match": "L5-007", "relevance_score": 88.0},
    {"evidence_type": "equipment_record", "filename": "infra_pump_delivery.txt", "description": "Delivery confirmation for 2 of 4 centrifugal pumps from Kirloskar Brothers Limited", "equipment_name": "Main Centrifugal Pump (Kirloskar)", "reported_date": datetime(2026, 9, 2), "schedule_match": "L4-018", "relevance_score": 91.0},
]

INFRA_MATERIALS = [
    {"material_name": "Reinforcement Steel Fe-500", "category": "Steel", "supplier_name": "SAIL — Bhilai Steel Plant", "unit": "MT", "required_quantity": 28.0, "ordered_quantity": 28.0, "delivered_quantity": 18.0, "status": "shortage", "priority": "critical", "expected_delivery": datetime(2026, 9, 12), "actual_delivery": None, "delay_reason": "Partial delivery — 10 MT balance delayed due to transport strike", "notes": "Fe-500 grade bars for pump house grade beam casting", "schedule_match": "L5-001"},
    {"material_name": "600mm MS Pipe (Class C)", "category": "Piping", "supplier_name": "Man Industries Ltd.", "unit": "nos", "required_quantity": 480.0, "ordered_quantity": 480.0, "delivered_quantity": 112.0, "status": "shortage", "priority": "critical", "expected_delivery": datetime(2026, 9, 20), "actual_delivery": None, "delay_reason": "Manufacturer machine breakdown — production halted. Balance 368 pipes to be dispatched.", "notes": "Critical path item for rising main laying", "schedule_match": "L5-012"},
    {"material_name": "Centrifugal Pump (Kirloskar KDS-40)", "category": "Mechanical", "supplier_name": "Kirloskar Brothers Limited", "unit": "nos", "required_quantity": 4.0, "ordered_quantity": 4.0, "delivered_quantity": 2.0, "status": "in_transit", "priority": "high", "expected_delivery": datetime(2026, 9, 15), "actual_delivery": None, "delay_reason": "2 pumps dispatched from Pune factory — expected on Sept 15", "notes": "Main duty + standby pumps for 3x40 MLD station", "schedule_match": "L4-018"},
    {"material_name": "11KV Transformer (2 MVA)", "category": "Electrical", "supplier_name": "BHEL — Bhopal", "unit": "nos", "required_quantity": 1.0, "ordered_quantity": 1.0, "delivered_quantity": 1.0, "status": "delivered", "priority": "medium", "expected_delivery": datetime(2026, 9, 2), "actual_delivery": datetime(2026, 9, 2), "delay_reason": None, "notes": "Delivered on schedule. Installation Sept 8.", "schedule_match": "L5-025"},
    {"material_name": "GI Formwork Panels", "category": "Civil", "supplier_name": "Site Store — On Loan", "unit": "nos", "required_quantity": 120.0, "ordered_quantity": 80.0, "delivered_quantity": 50.0, "status": "shortage", "priority": "high", "expected_delivery": datetime(2026, 9, 7), "actual_delivery": None, "delay_reason": "Contractor's formwork panels not yet returned from Bilaspur project site", "notes": "Formwork shortage directly causing column concreting delay", "schedule_match": "L6-007"},
]

INFRA_SAFETY = [
    {"title": "Working at Height — Roof Slab Shuttering", "hazard_category": "Working at Height", "risk_score": "high", "description": "Workers erecting shuttering at 4.5m height. Risk of fall from formwork platform.", "required_ppe": json.dumps(["Safety Harness", "Helmet", "Non-slip Footwear", "Safety Net"]), "mitigation_plan": "Install scaffolding edge guardrails. All workers must wear full-body harness anchored to certified tie-off points.", "compliance_status": "warning", "affected_workers": 12, "schedule_match": "L5-007"},
    {"title": "Excavation — Rising Main Trench", "hazard_category": "Excavation", "risk_score": "critical", "description": "Deep trench excavation 2.5-3.2m in loose alluvial soil. High risk of collapse without adequate shoring.", "required_ppe": json.dumps(["Helmet", "Steel-toe Boots", "Hi-Vis Vest", "Shoring Supports"]), "mitigation_plan": "Install hydraulic trench shoring at every 1.5m. No workers in unsupported trenches.", "compliance_status": "violation", "affected_workers": 18, "schedule_match": "L5-012"},
    {"title": "Heavy Lifting — Centrifugal Pump Installation", "hazard_category": "Heavy Equipment", "risk_score": "high", "description": "Installation of main centrifugal pumps (~1.8 MT each) using mobile crane. Risk of dropped load.", "required_ppe": json.dumps(["Helmet", "Hi-Vis Vest", "Steel-toe Boots", "Rigger Gloves"]), "mitigation_plan": "Certified rigger and crane operator mandatory. Pre-lift meeting and load chart verification.", "compliance_status": "pending_review", "affected_workers": 8, "schedule_match": "L4-019"},
    {"title": "Electrical Hazard — HT Cable Laying", "hazard_category": "Electrical Hazard", "risk_score": "critical", "description": "Laying and termination of 11KV XLPE cable. Live HT line in vicinity during cable routing.", "required_ppe": json.dumps(["Insulated Gloves Class 2", "Arc Flash PPE", "Helmet with Face Shield"]), "mitigation_plan": "Obtain PTW from utility before commencement. Isolate and earth HT line. LOTO procedure strictly followed.", "compliance_status": "warning", "affected_workers": 6, "schedule_match": "L5-024"},
]


# ═══════════════════════════════════════════════════════════════════════════════
# CONSTRUCTION TEMPLATE — Skyline Heights Commercial Center & Tower
# ═══════════════════════════════════════════════════════════════════════════════

CONSTRUCTION_ACTIVITIES = [
    {"activity_id": "L1-001", "activity_name": "Skyline Heights Commercial Center & Tower — G+24", "level": 1, "parent_id": None, "planned_start": "2026-01-01", "planned_finish": "2026-12-31", "planned_progress": 52.0, "actual_progress": 44.0, "is_milestone": False, "status": "Delayed", "dependency": None},
    {"activity_id": "L2-001", "activity_name": "Substructure & Basement Works", "level": 2, "parent_id": "L1-001", "planned_start": "2026-01-01", "planned_finish": "2026-06-30", "planned_progress": 95.0, "actual_progress": 88.0, "is_milestone": False, "status": "Delayed", "dependency": None},
    {"activity_id": "L3-001", "activity_name": "Diaphragm Wall Construction", "level": 3, "parent_id": "L2-001", "planned_start": "2026-01-01", "planned_finish": "2026-03-15", "planned_progress": 100.0, "actual_progress": 100.0, "is_milestone": False, "status": "Completed", "dependency": None},
    {"activity_id": "L4-001", "activity_name": "Deep Excavation — B3 to B1 Level", "level": 4, "parent_id": "L3-001", "planned_start": "2026-01-15", "planned_finish": "2026-04-30", "planned_progress": 100.0, "actual_progress": 100.0, "is_milestone": False, "status": "Completed", "dependency": "L3-001"},
    {"activity_id": "L4-002", "activity_name": "Raft Foundation Concrete (M40 Grade)", "level": 4, "parent_id": "L3-001", "planned_start": "2026-03-01", "planned_finish": "2026-05-31", "planned_progress": 100.0, "actual_progress": 92.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-001"},
    {"activity_id": "L3-002", "activity_name": "Basement B3 Construction", "level": 3, "parent_id": "L2-001", "planned_start": "2026-04-01", "planned_finish": "2026-06-30", "planned_progress": 95.0, "actual_progress": 85.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-002"},
    {"activity_id": "L4-003", "activity_name": "B3 Shear Walls & Columns", "level": 4, "parent_id": "L3-002", "planned_start": "2026-04-01", "planned_finish": "2026-05-31", "planned_progress": 100.0, "actual_progress": 88.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-002"},
    {"activity_id": "L4-004", "activity_name": "B3 Slab — Post Tensioned (PT)", "level": 4, "parent_id": "L3-002", "planned_start": "2026-05-15", "planned_finish": "2026-06-30", "planned_progress": 90.0, "actual_progress": 75.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-003"},
    {"activity_id": "L2-002", "activity_name": "Superstructure — Ground to Level 12", "level": 2, "parent_id": "L1-001", "planned_start": "2026-06-01", "planned_finish": "2026-10-31", "planned_progress": 60.0, "actual_progress": 48.0, "is_milestone": False, "status": "Delayed", "dependency": "L2-001"},
    {"activity_id": "L3-003", "activity_name": "Core Wall — RC Shear Core", "level": 3, "parent_id": "L2-002", "planned_start": "2026-06-01", "planned_finish": "2026-09-30", "planned_progress": 70.0, "actual_progress": 55.0, "is_milestone": False, "status": "Delayed", "dependency": "L2-001"},
    {"activity_id": "L4-005", "activity_name": "Jump Form — Core Wall Level 1-6", "level": 4, "parent_id": "L3-003", "planned_start": "2026-06-01", "planned_finish": "2026-07-31", "planned_progress": 100.0, "actual_progress": 100.0, "is_milestone": False, "status": "Completed", "dependency": "L2-001"},
    {"activity_id": "L4-006", "activity_name": "Jump Form — Core Wall Level 7-12", "level": 4, "parent_id": "L3-003", "planned_start": "2026-07-15", "planned_finish": "2026-09-30", "planned_progress": 65.0, "actual_progress": 48.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-005"},
    {"activity_id": "L3-004", "activity_name": "Perimeter Columns & Flat Slabs", "level": 3, "parent_id": "L2-002", "planned_start": "2026-06-15", "planned_finish": "2026-10-31", "planned_progress": 55.0, "actual_progress": 40.0, "is_milestone": False, "status": "Delayed", "dependency": "L3-003"},
    {"activity_id": "L4-007", "activity_name": "Column Casting Level 1-6", "level": 4, "parent_id": "L3-004", "planned_start": "2026-06-15", "planned_finish": "2026-08-15", "planned_progress": 100.0, "actual_progress": 82.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-005"},
    {"activity_id": "L4-008", "activity_name": "Flat Slab Level 1-6 (250mm PT Slab)", "level": 4, "parent_id": "L3-004", "planned_start": "2026-07-01", "planned_finish": "2026-09-15", "planned_progress": 70.0, "actual_progress": 52.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-007"},
    {"activity_id": "L2-003", "activity_name": "Facade & Curtain Wall", "level": 2, "parent_id": "L1-001", "planned_start": "2026-09-01", "planned_finish": "2026-12-31", "planned_progress": 20.0, "actual_progress": 8.0, "is_milestone": False, "status": "Delayed", "dependency": "L2-002"},
    {"activity_id": "L3-005", "activity_name": "Unitized Curtain Wall System", "level": 3, "parent_id": "L2-003", "planned_start": "2026-09-01", "planned_finish": "2026-12-15", "planned_progress": 20.0, "actual_progress": 8.0, "is_milestone": False, "status": "Delayed", "dependency": "L2-002"},
    {"activity_id": "L4-009", "activity_name": "Anchor Bracket Fixing — Facade", "level": 4, "parent_id": "L3-005", "planned_start": "2026-09-01", "planned_finish": "2026-10-31", "planned_progress": 35.0, "actual_progress": 15.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-008"},
    {"activity_id": "L4-010", "activity_name": "Curtain Wall Panel Installation", "level": 4, "parent_id": "L3-005", "planned_start": "2026-10-01", "planned_finish": "2026-12-15", "planned_progress": 10.0, "actual_progress": 2.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-009"},
    {"activity_id": "L2-004", "activity_name": "MEP Rough-in Works", "level": 2, "parent_id": "L1-001", "planned_start": "2026-07-01", "planned_finish": "2026-12-31", "planned_progress": 35.0, "actual_progress": 25.0, "is_milestone": False, "status": "Delayed", "dependency": "L2-002"},
    {"activity_id": "L4-011", "activity_name": "HVAC Ductwork — Level 1-6", "level": 4, "parent_id": "L2-004", "planned_start": "2026-07-01", "planned_finish": "2026-10-31", "planned_progress": 45.0, "actual_progress": 30.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-008"},
    {"activity_id": "L4-012", "activity_name": "Fire Suppression — Sprinkler Rough-in", "level": 4, "parent_id": "L2-004", "planned_start": "2026-08-01", "planned_finish": "2026-11-30", "planned_progress": 30.0, "actual_progress": 18.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-008"},
    {"activity_id": "M-001", "activity_name": "Structure Topping Out Milestone", "level": 3, "parent_id": "L2-002", "planned_start": "2026-11-15", "planned_finish": "2026-11-15", "planned_progress": 0.0, "actual_progress": 0.0, "is_milestone": True, "status": "Not Started", "dependency": "L4-006"},
]

CONSTRUCTION_EXTRACTED_UPDATES = [
    {"activity_description": "Core wall jump form Level 7-12 behind schedule", "status": "Delayed", "progress": 48.0, "delay_reason": "Jump form crane (Tower Crane TC-2) had hydraulic cylinder failure on August 28 — repair took 6 days", "delay_category": "Equipment", "risk_level": "High", "source_text": "Core wall jump form is at 48% against planned 65% for Levels 7-12. Delay caused by TC-2 crane hydraulic failure on August 28. Crane resumed on September 3 after repair.", "source_page": 1, "extraction_confidence": 93.0, "schedule_match": "L4-006", "match_confidence": 92.0},
    {"activity_description": "Column casting Level 1-6 incomplete", "status": "Delayed", "progress": 82.0, "delay_reason": "Concrete pump breakdown on August 25 caused 2-day stoppage. Concrete supply resumed from alternate plant.", "delay_category": "Equipment", "risk_level": "Medium", "source_text": "Column casting for Levels 1-6 is at 82% against planned 100%. Concrete pump pump-1 had mechanical failure on August 25. Alternate concrete supply arranged from Readymix Plant B.", "source_page": 1, "extraction_confidence": 90.0, "schedule_match": "L4-007", "match_confidence": 91.0},
    {"activity_description": "PT flat slab Level 1-6 behind schedule", "status": "Delayed", "progress": 52.0, "delay_reason": "Post-tensioning cable supply delayed — only 60% of PT strands received from supplier", "delay_category": "Material", "risk_level": "High", "source_text": "Post-tensioned flat slab for Levels 1-6 is at 52% against planned 70%. PT cable (strands) supply from Usha Martin is only 60% delivered due to production backlog at manufacturer.", "source_page": 1, "extraction_confidence": 91.0, "schedule_match": "L4-008", "match_confidence": 90.0},
    {"activity_description": "Raft foundation concrete not fully complete", "status": "Delayed", "progress": 92.0, "delay_reason": "Final pour zone delay due to rebar inspection punch list from structural consultant — 11 items raised", "delay_category": "Approval", "risk_level": "Low", "source_text": "Raft foundation is 92% complete. The final pour zone (Grid 8-10, Row D-F) is pending structural consultant inspection. 11 punch list items raised on Sept 1 — expected clearance by Sept 10.", "source_page": 2, "extraction_confidence": 87.0, "schedule_match": "L4-002", "match_confidence": 88.0},
    {"activity_description": "Facade anchor bracket fixing delayed", "status": "Delayed", "progress": 15.0, "delay_reason": "Curtain wall consultant drawing revision Rev-2 issued late — fabricator required 3 weeks to update shop drawings", "delay_category": "Approval", "risk_level": "Medium", "source_text": "Curtain wall anchor bracket fixing is at 15% against planned 35%. Delay due to late issue of Rev-2 drawings from the facade consultant. Fabricator updated shop drawings — installation resumed Sept 4.", "source_page": 2, "extraction_confidence": 88.0, "schedule_match": "L4-009", "match_confidence": 87.0},
    {"activity_description": "HVAC ductwork Level 1-6 behind schedule", "status": "Delayed", "progress": 30.0, "delay_reason": "Coordination clash between HVAC duct and structural beam at Level 4 slab soffit — 38 clash points detected in BIM review", "delay_category": "Approval", "risk_level": "Medium", "source_text": "HVAC ductwork is at 30% against planned 45%. BIM coordination revealed 38 clash points at Level 4 slab soffit where duct route conflicts with structural beam. RFI raised to structural consultant.", "source_page": 2, "extraction_confidence": 86.0, "schedule_match": "L4-011", "match_confidence": 85.0},
    {"activity_description": "Fire sprinkler rough-in behind schedule", "status": "Delayed", "progress": 18.0, "delay_reason": "Access restricted due to ongoing slab formwork and concrete works in floors 3-5", "delay_category": "Dependency", "risk_level": "Low", "source_text": "Fire suppression sprinkler rough-in is at 18% against planned 30%. MEP contractor unable to access Floors 3-5 as slab formwork and concrete pouring is still in progress.", "source_page": 3, "extraction_confidence": 84.0, "schedule_match": "L4-012", "match_confidence": 82.0},
    {"activity_description": "Curtain wall panel installation barely started", "status": "Delayed", "progress": 2.0, "delay_reason": "Only 12 of 180 panels fabricated. Factory production delayed due to glass shortage from supplier", "delay_category": "Material", "risk_level": "Critical", "source_text": "Curtain wall panel installation is at 2% — only 12 panels installed out of 180 planned for Phase 1. Factory production is significantly behind due to tempered glass shortage.", "source_page": 3, "extraction_confidence": 95.0, "schedule_match": "L4-010", "match_confidence": 94.0},
]

CONSTRUCTION_FIELD_REPORT = """WEEKLY PROGRESS REPORT — WPR-2026-36
Project: Skyline Heights Commercial Center & Tower (G+24)
Week Ending: 07 September 2026 | Site Manager: Arun Verma, Project Manager: Meera Krishnan

SUBSTRUCTURE STATUS:
Raft foundation is 92% complete. Final pour zone (Grid 8-10, Row D-F) pending structural consultant inspection clearance — 11 punch list items raised, clearance expected by September 10. Basement B3 shear walls and columns are 88% complete. B3 PT slab at 75%.

SUPERSTRUCTURE — CORE & COLUMNS:
Core wall jump form (Levels 7-12) is at 48% against planned 65%. Tower Crane TC-2 had a hydraulic cylinder failure on August 28 — crane resumed operation after 6-day repair on September 3. Recovery program prepared — additional concrete pours planned for weekend. Column casting (Level 1-6) at 82% vs 100% planned; delay due to concrete pump failure August 25.

SLABS:
Post-tensioned flat slab Level 1-6 is at 52% against planned 70%. PT strand supply from Usha Martin is only 60% delivered — production backlog at manufacturer. Stressing scheduled when balance supply arrives (estimated September 14).

FACADE & CURTAIN WALL:
Anchor bracket fixing at 15% vs 35% planned. Rev-2 curtain wall drawings issued late by facade consultant. Curtain wall panels — only 12 of 180 panels installed. Tempered glass shortage at manufacturer is causing severe delay. Critical path risk.

MEP:
HVAC ductwork Level 1-6 at 30% (planned 45%). 38 BIM coordination clashes detected at Level 4 slab soffit. Fire sprinkler rough-in at 18% (planned 30%) — access restricted by ongoing slab works.

SAFETY OBSERVATIONS: Fall arrest nets below Level 6 slab edge found inadequate — corrective action issued. Scaffolding inspection overdue on east facade — red-tagged pending inspection.
"""

CONSTRUCTION_EVIDENCE = [
    {"evidence_type": "photo", "filename": "construction_core_wall_l7.jpg", "description": "Photograph of jump form system at core wall Level 7-8. Shows TC-2 crane and jump form platform.", "location": "Core Wall Level 7-8", "reported_date": datetime(2026, 9, 5), "ai_analysis": json.dumps({"detected_indicators": ["Jump form visible", "Tower crane TC-2 visible", "Concrete core wall under construction"], "evidence_relevance": "High", "progress_estimation": "Visual confirms approximately 48-52% progress on Level 7-12 core wall.", "note": "[DEMO]"}), "schedule_match": "L4-006", "relevance_score": 93.0},
    {"evidence_type": "material_record", "filename": "construction_pt_strand_delivery.xlsx", "description": "Post-tensioning strand delivery record — 60% of required material received", "location": "Site Store", "material_name": "PT Strand (12.7mm, Grade 1860)", "expected_quantity": "18.5 MT", "recorded_quantity": "11.1 MT", "reported_date": datetime(2026, 9, 3), "schedule_match": "L4-008", "relevance_score": 96.0},
    {"evidence_type": "photo", "filename": "construction_curtain_wall_panels.jpg", "description": "Site photo showing only 12 curtain wall panels installed out of 180 planned — severe shortage of tempered glass.", "location": "Tower Podium — East Facade", "reported_date": datetime(2026, 9, 6), "ai_analysis": json.dumps({"detected_indicators": ["Curtain wall frame visible", "Limited panels installed", "Facade work in early stage"], "evidence_relevance": "High", "progress_estimation": "Panel installation at approximately 2-3% only.", "note": "[DEMO]"}), "schedule_match": "L4-010", "relevance_score": 95.0},
    {"evidence_type": "document", "filename": "construction_bim_clash_report.pdf", "description": "BIM coordination clash report — 38 clashes between HVAC ductwork and Level 4 structural beams", "reported_date": datetime(2026, 9, 2), "schedule_match": "L4-011", "relevance_score": 90.0},
    {"evidence_type": "equipment_record", "filename": "construction_crane_tc2_repair.txt", "description": "Tower Crane TC-2 hydraulic cylinder failure and repair record — 6-day downtime Aug 28 to Sep 3", "equipment_name": "Tower Crane Liebherr TC-2", "reported_date": datetime(2026, 9, 3), "schedule_match": "L4-006", "relevance_score": 92.0},
]

CONSTRUCTION_MATERIALS = [
    {"material_name": "PT Strand (12.7mm Grade 1860)", "category": "Structural Steel", "supplier_name": "Usha Martin Ltd.", "unit": "MT", "required_quantity": 18.5, "ordered_quantity": 18.5, "delivered_quantity": 11.1, "status": "shortage", "priority": "critical", "expected_delivery": datetime(2026, 9, 14), "actual_delivery": None, "delay_reason": "Production backlog at manufacturer — balance 7.4 MT delayed by 3 weeks", "notes": "PT strands for flat slab Levels 1-6. Critical path item.", "schedule_match": "L4-008"},
    {"material_name": "Tempered Glass (10mm & 12mm)", "category": "Facade", "supplier_name": "Saint-Gobain India", "unit": "sqm", "required_quantity": 8400.0, "ordered_quantity": 8400.0, "delivered_quantity": 1200.0, "status": "shortage", "priority": "critical", "expected_delivery": datetime(2026, 10, 15), "actual_delivery": None, "delay_reason": "Float glass raw material shortage at manufacturer. Production restart delayed.", "notes": "Unitized curtain wall panels require tempered & laminated glass panels", "schedule_match": "L4-010"},
    {"material_name": "M40 Ready Mix Concrete", "category": "Concrete", "supplier_name": "ACC Readymix — Sector 58", "unit": "m3", "required_quantity": 3200.0, "ordered_quantity": 3200.0, "delivered_quantity": 2800.0, "status": "in_transit", "priority": "high", "expected_delivery": datetime(2026, 9, 10), "actual_delivery": None, "delay_reason": None, "notes": "Raft and shear wall concrete — supply ongoing from main plant", "schedule_match": "L4-002"},
    {"material_name": "GI Spiral Duct (600mm dia)", "category": "MEP", "supplier_name": "Duct India Pvt Ltd", "unit": "m", "required_quantity": 2400.0, "ordered_quantity": 2400.0, "delivered_quantity": 1600.0, "status": "in_transit", "priority": "medium", "expected_delivery": datetime(2026, 9, 20), "actual_delivery": None, "delay_reason": None, "notes": "HVAC supply and return ductwork — Levels 1-6", "schedule_match": "L4-011"},
    {"material_name": "MS Anchor Brackets — Facade", "category": "Facade", "supplier_name": "Hilti India / Custom Fabrication", "unit": "nos", "required_quantity": 4200.0, "ordered_quantity": 4200.0, "delivered_quantity": 3100.0, "status": "in_transit", "priority": "high", "expected_delivery": datetime(2026, 9, 15), "actual_delivery": None, "delay_reason": "Rev-2 drawing change required fabrication rework on 280 brackets", "notes": "Slab edge embedded anchors for unitized curtain wall system", "schedule_match": "L4-009"},
]

CONSTRUCTION_SAFETY = [
    {"title": "Fall Arrest — Slab Edge Level 6", "hazard_category": "Working at Height", "risk_score": "critical", "description": "Fall arrest nets below Level 6 slab edge found inadequate during safety inspection. Workers operating near unguarded slab opening at Level 5.", "required_ppe": json.dumps(["Full Body Harness", "Helmet", "Safety Net", "Edge Protection Barrier"]), "mitigation_plan": "Install edge protection barriers immediately. Suspend work at slab edge until safety measures installed. Daily inspection checklist.", "compliance_status": "violation", "affected_workers": 22, "schedule_match": "L4-008"},
    {"title": "Crane Operation — Tower Crane TC-2", "hazard_category": "Heavy Equipment", "risk_score": "high", "description": "Post-repair Tower Crane TC-2 operation — risk of second hydraulic failure during heavy lifts of jump form (16 MT system).", "required_ppe": json.dumps(["Helmet", "Hi-Vis Vest", "Steel-toe Boots", "Tag Lines", "Exclusion Zone Barrier"]), "mitigation_plan": "Independent inspection of TC-2 by OEM certified engineer before resuming heavy lifts. Load test to 110% SWL required. Weekly hydraulic check.", "compliance_status": "pending_review", "affected_workers": 15, "schedule_match": "L4-006"},
    {"title": "Scaffolding Safety — East Facade", "hazard_category": "Working at Height", "risk_score": "high", "description": "East facade scaffolding inspection overdue. Scaffolding red-tagged pending engineering inspection. Workers observed on scaffolding without inspection clearance.", "required_ppe": json.dumps(["Helmet", "Full Body Harness", "Non-slip Boots", "Scaffolding Tag System"]), "mitigation_plan": "Engage certified scaffolding engineer for immediate inspection. Workers prohibited from red-tagged scaffolding. Restart clearance certificate required.", "compliance_status": "violation", "affected_workers": 8, "schedule_match": "L4-009"},
    {"title": "Concrete Pump — High Pressure Hose Failure Risk", "hazard_category": "Mechanical", "risk_score": "medium", "description": "Concrete pump P-1 repaired after failure. High pressure hose coupling replacement needed — risk of burst at 200 bar operating pressure.", "required_ppe": json.dumps(["Helmet", "Hi-Vis Vest", "Face Shield", "Rubber Boots"]), "mitigation_plan": "Replace all high-pressure hose couplings before resuming. Operator behind blast shield during initial pressurization. Weekly hose inspection protocol.", "compliance_status": "warning", "affected_workers": 5, "schedule_match": "L4-007"},
]


# ═══════════════════════════════════════════════════════════════════════════════
# ENERGY TEMPLATE — SuryaKiran 50MW Solar Power Plant
# ═══════════════════════════════════════════════════════════════════════════════

ENERGY_ACTIVITIES = [
    {"activity_id": "L1-001", "activity_name": "SuryaKiran 50MW Solar Power Plant — Bhadla", "level": 1, "parent_id": None, "planned_start": "2026-01-01", "planned_finish": "2026-12-31", "planned_progress": 58.0, "actual_progress": 49.0, "is_milestone": False, "status": "Delayed", "dependency": None},
    {"activity_id": "L2-001", "activity_name": "Civil & Site Preparation Works", "level": 2, "parent_id": "L1-001", "planned_start": "2026-01-01", "planned_finish": "2026-05-31", "planned_progress": 100.0, "actual_progress": 95.0, "is_milestone": False, "status": "Delayed", "dependency": None},
    {"activity_id": "L3-001", "activity_name": "Site Clearing & Grading", "level": 3, "parent_id": "L2-001", "planned_start": "2026-01-01", "planned_finish": "2026-02-28", "planned_progress": 100.0, "actual_progress": 100.0, "is_milestone": False, "status": "Completed", "dependency": None},
    {"activity_id": "L3-002", "activity_name": "Internal Roads & Cable Trenches", "level": 3, "parent_id": "L2-001", "planned_start": "2026-02-01", "planned_finish": "2026-04-30", "planned_progress": 100.0, "actual_progress": 95.0, "is_milestone": False, "status": "Delayed", "dependency": "L3-001"},
    {"activity_id": "L4-001", "activity_name": "Cable Trench Excavation & Backfill", "level": 4, "parent_id": "L3-002", "planned_start": "2026-02-15", "planned_finish": "2026-04-30", "planned_progress": 100.0, "actual_progress": 95.0, "is_milestone": False, "status": "Delayed", "dependency": "L3-001"},
    {"activity_id": "L2-002", "activity_name": "Mounting Structure & Foundation Works", "level": 2, "parent_id": "L1-001", "planned_start": "2026-03-01", "planned_finish": "2026-07-31", "planned_progress": 85.0, "actual_progress": 72.0, "is_milestone": False, "status": "Delayed", "dependency": "L2-001"},
    {"activity_id": "L3-003", "activity_name": "Pile Foundation — Single-Axis Tracker", "level": 3, "parent_id": "L2-002", "planned_start": "2026-03-01", "planned_finish": "2026-06-30", "planned_progress": 90.0, "actual_progress": 78.0, "is_milestone": False, "status": "Delayed", "dependency": "L3-002"},
    {"activity_id": "L4-002", "activity_name": "Pile Driving — Zone A & B (400 piles)", "level": 4, "parent_id": "L3-003", "planned_start": "2026-03-01", "planned_finish": "2026-05-31", "planned_progress": 100.0, "actual_progress": 100.0, "is_milestone": False, "status": "Completed", "dependency": "L3-001"},
    {"activity_id": "L4-003", "activity_name": "Pile Driving — Zone C & D (350 piles)", "level": 4, "parent_id": "L3-003", "planned_start": "2026-05-01", "planned_finish": "2026-07-31", "planned_progress": 80.0, "actual_progress": 62.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-002"},
    {"activity_id": "L3-004", "activity_name": "Single-Axis Tracker Installation", "level": 3, "parent_id": "L2-002", "planned_start": "2026-05-01", "planned_finish": "2026-08-31", "planned_progress": 70.0, "actual_progress": 55.0, "is_milestone": False, "status": "Delayed", "dependency": "L3-003"},
    {"activity_id": "L4-004", "activity_name": "Tracker Rail & Torque Tube Assembly", "level": 4, "parent_id": "L3-004", "planned_start": "2026-05-01", "planned_finish": "2026-07-31", "planned_progress": 80.0, "actual_progress": 62.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-003"},
    {"activity_id": "L4-005", "activity_name": "Actuator & Motor Drive Assembly", "level": 4, "parent_id": "L3-004", "planned_start": "2026-06-01", "planned_finish": "2026-08-31", "planned_progress": 60.0, "actual_progress": 42.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-004"},
    {"activity_id": "L2-003", "activity_name": "PV Module Supply & Installation", "level": 2, "parent_id": "L1-001", "planned_start": "2026-06-01", "planned_finish": "2026-11-30", "planned_progress": 55.0, "actual_progress": 40.0, "is_milestone": False, "status": "Delayed", "dependency": "L2-002"},
    {"activity_id": "L3-005", "activity_name": "PV Module Delivery & Warehousing", "level": 3, "parent_id": "L2-003", "planned_start": "2026-06-01", "planned_finish": "2026-09-30", "planned_progress": 65.0, "actual_progress": 48.0, "is_milestone": False, "status": "Delayed", "dependency": None},
    {"activity_id": "L4-006", "activity_name": "Module Mounting & String Assembly", "level": 4, "parent_id": "L3-005", "planned_start": "2026-07-01", "planned_finish": "2026-11-30", "planned_progress": 45.0, "actual_progress": 32.0, "is_milestone": False, "status": "Delayed", "dependency": "L3-004"},
    {"activity_id": "L2-004", "activity_name": "Electrical — DC Wiring & Inverters", "level": 2, "parent_id": "L1-001", "planned_start": "2026-07-01", "planned_finish": "2026-12-15", "planned_progress": 40.0, "actual_progress": 28.0, "is_milestone": False, "status": "Delayed", "dependency": "L2-003"},
    {"activity_id": "L3-006", "activity_name": "DC String Cabling & Combiner Boxes", "level": 3, "parent_id": "L2-004", "planned_start": "2026-07-01", "planned_finish": "2026-11-30", "planned_progress": 45.0, "actual_progress": 30.0, "is_milestone": False, "status": "Delayed", "dependency": "L3-005"},
    {"activity_id": "L4-007", "activity_name": "DC String Cable Laying (UV Resistant)", "level": 4, "parent_id": "L3-006", "planned_start": "2026-07-01", "planned_finish": "2026-10-31", "planned_progress": 50.0, "actual_progress": 32.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-006"},
    {"activity_id": "L4-008", "activity_name": "String Combiner Box Installation", "level": 4, "parent_id": "L3-006", "planned_start": "2026-08-01", "planned_finish": "2026-11-30", "planned_progress": 35.0, "actual_progress": 20.0, "is_milestone": False, "status": "Delayed", "dependency": "L4-007"},
    {"activity_id": "L3-007", "activity_name": "Central Inverter Station Installation", "level": 3, "parent_id": "L2-004", "planned_start": "2026-08-01", "planned_finish": "2026-12-15", "planned_progress": 30.0, "actual_progress": 18.0, "is_milestone": False, "status": "Delayed", "dependency": "L3-006"},
    {"activity_id": "L4-009", "activity_name": "Inverter Transformer Package (3MVA)", "level": 4, "parent_id": "L3-007", "planned_start": "2026-08-01", "planned_finish": "2026-11-30", "planned_progress": 35.0, "actual_progress": 15.0, "is_milestone": False, "status": "Delayed", "dependency": "L3-005"},
    {"activity_id": "L2-005", "activity_name": "Grid Substation — 33/132kV", "level": 2, "parent_id": "L1-001", "planned_start": "2026-04-01", "planned_finish": "2026-12-31", "planned_progress": 45.0, "actual_progress": 35.0, "is_milestone": False, "status": "Delayed", "dependency": None},
    {"activity_id": "L4-010", "activity_name": "132kV GIS Equipment Installation", "level": 4, "parent_id": "L2-005", "planned_start": "2026-07-01", "planned_finish": "2026-12-15", "planned_progress": 40.0, "actual_progress": 25.0, "is_milestone": False, "status": "Delayed", "dependency": None},
    {"activity_id": "M-001", "activity_name": "First Power Generation Milestone", "level": 3, "parent_id": "L2-004", "planned_start": "2026-12-15", "planned_finish": "2026-12-15", "planned_progress": 0.0, "actual_progress": 0.0, "is_milestone": True, "status": "Not Started", "dependency": "L3-007"},
]

ENERGY_EXTRACTED_UPDATES = [
    {"activity_description": "Pile driving Zone C & D behind schedule", "status": "Delayed", "progress": 62.0, "delay_reason": "Pile driving rig RIG-3 had boom cable snapping incident on August 20 — rig under repair. Only RIG-1 and RIG-2 operational", "delay_category": "Equipment", "risk_level": "High", "source_text": "Pile driving in Zone C & D is at 62% against planned 80%. RIG-3 had a boom cable failure on August 20 and has been under repair since. Only 2 rigs are currently operational instead of 3.", "source_page": 1, "extraction_confidence": 92.0, "schedule_match": "L4-003", "match_confidence": 91.0},
    {"activity_description": "Single-axis tracker rail assembly behind schedule", "status": "Delayed", "progress": 62.0, "delay_reason": "Tracker rail profile steel supply from Tata Steel delayed — only 68% of required profiles delivered due to rolling mill maintenance", "delay_category": "Material", "risk_level": "High", "source_text": "Tracker rail and torque tube assembly is at 62% against planned 80%. Supply of tracker rail profiles from Tata Steel is delayed. Only 68% of required profiles received due to rolling mill maintenance shutdown.", "source_page": 1, "extraction_confidence": 91.0, "schedule_match": "L4-004", "match_confidence": 90.0},
    {"activity_description": "PV module delivery and warehousing behind schedule", "status": "Delayed", "progress": 48.0, "delay_reason": "Customs clearance delay at Mundra Port — 6 containers of Longi LR5-72HPH modules held for additional documentation", "delay_category": "External", "risk_level": "Critical", "source_text": "PV module delivery is at 48% against planned 65%. 6 shipping containers (3,600 modules) from Longi Solar are held at Mundra Port customs for additional ALMM (Approved List of Models and Manufacturers) documentation verification.", "source_page": 2, "extraction_confidence": 95.0, "schedule_match": "L3-005", "match_confidence": 94.0},
    {"activity_description": "Module mounting and string assembly delayed", "status": "Delayed", "progress": 32.0, "delay_reason": "Module installation cannot proceed at full speed due to pending tracker assembly and module shortage", "delay_category": "Dependency", "risk_level": "High", "source_text": "Module mounting and string assembly is at 32% against planned 45%. Installation is limited by both incomplete tracker rail assembly in Zone C-D and insufficient module stock from delayed customs clearance.", "source_page": 2, "extraction_confidence": 89.0, "schedule_match": "L4-006", "match_confidence": 88.0},
    {"activity_description": "DC string cable laying well below plan", "status": "Delayed", "progress": 32.0, "delay_reason": "UV-resistant DC cable supply (4mm2 and 6mm2) short — alternate sourcing from Polycab at higher cost approved", "delay_category": "Material", "risk_level": "Medium", "source_text": "DC string cable laying is at 32% against planned 50%. The specified UV-resistant DC cable (PV-ZZ-F type) from the main supplier has run short. Procurement team has approved alternate supply from Polycab at 12% premium.", "source_page": 2, "extraction_confidence": 87.0, "schedule_match": "L4-007", "match_confidence": 86.0},
    {"activity_description": "Inverter transformer package severely behind", "status": "Delayed", "progress": 15.0, "delay_reason": "3MVA inverter transformer packages delayed from ABB India — factory production slot pushed due to higher priority export order", "delay_category": "Material", "risk_level": "Critical", "source_text": "Inverter transformer package (3 MVA, 0.8kV/33kV) installation is at 15% against planned 35%. ABB India has pushed the production slot from August to November citing a higher priority export order. This is a critical path risk.", "source_page": 3, "extraction_confidence": 94.0, "schedule_match": "L4-009", "match_confidence": 93.0},
    {"activity_description": "GIS 132kV equipment installation delayed", "status": "Delayed", "progress": 25.0, "delay_reason": "GIS switchgear bay 2 and 3 equipment delivery from Siemens delayed by 8 weeks — manufacturing delay at Kalwa factory", "delay_category": "Material", "risk_level": "High", "source_text": "132kV GIS equipment installation is at 25% against planned 40%. Siemens India has notified an 8-week delay for Bay 2 and Bay 3 GIS panels due to component supply issues at their Kalwa, Thane manufacturing facility.", "source_page": 3, "extraction_confidence": 92.0, "schedule_match": "L4-010", "match_confidence": 91.0},
    {"activity_description": "Actuator and motor drive assembly behind", "status": "Delayed", "progress": 42.0, "delay_reason": "Harness cable for actuator motor units found to be wrong specification — batch of 200 units to be returned and replaced", "delay_category": "Material", "risk_level": "Medium", "source_text": "Actuator and motor drive assembly for single-axis trackers is at 42% against planned 60%. Quality inspection revealed that a batch of 200 actuator harness cable units are wrong specification (IP65 instead of IP67). Return and replacement ordered.", "source_page": 3, "extraction_confidence": 88.0, "schedule_match": "L4-005", "match_confidence": 87.0},
]

ENERGY_FIELD_REPORT = """MONTHLY PROGRESS REPORT — MPR-2026-08
Project: SuryaKiran 50MW Solar Power Plant, Bhadla Solar Park, Rajasthan
Report Month: August 2026 | Prepared by: Project Manager Ravi Shankar

CIVIL & GROUND WORKS:
Site clearing and grading (100% complete). Internal roads and cable trenches at 95% — final section pending near substation boundary. Cable trench excavation at 95%.

MOUNTING STRUCTURE:
Pile driving Zone A & B — COMPLETE (100%). Pile driving Zone C & D at 62% vs 80% planned. RIG-3 boom cable failure on August 20 — under repair, only 2 rigs operational. Recovery plan: weekend overtime shifts. Tracker rail assembly at 62% vs 80% — Tata Steel rolling profiles delayed (68% delivered). Actuator/motor drive at 42% vs 60% — batch of 200 actuator harness cable units found wrong spec (IP65 vs IP67 required). Return and replacement ordered.

PV MODULES:
Module delivery at 48% vs 65% planned. 6 containers (3,600 modules — Longi LR5-72HPH 540W) held at Mundra Port customs. ALMM documentation verification pending with MNRE. Customs clearance expected by September 12. Module mounting at 32% (planned 45%) — directly impacted by tracker delay and module shortage.

ELECTRICAL:
DC string cable laying at 32% (planned 50%) — UV-resistant PV cable stock depleted. Alternate supply from Polycab approved at 12% premium. Combiner box installation at 20% (planned 35%). Inverter transformer packages (3 MVA) — CRITICAL: ABB India pushed delivery from August to November. Recovery options being explored including hiring alternate supplier. 132kV GIS switchgear — 25% complete (planned 40%). Siemens Kalwa factory delay of 8 weeks for Bay 2 & 3.

SAFETY: Sand storm protocol activated twice during August. Workers in Zone C provided cooling stations and mandatory hydration schedule (Rajasthan heat — 44°C peak). 3 near-misses involving cable reel movement without spotter — toolbox talks issued.
"""

ENERGY_EVIDENCE = [
    {"evidence_type": "photo", "filename": "energy_pile_driving_zone_c.jpg", "description": "Photograph of pile driving operations Zone C — RIG-1 and RIG-2 operational, RIG-3 missing (under repair)", "location": "Zone C — Row 45 to 70", "reported_date": datetime(2026, 9, 3), "ai_analysis": json.dumps({"detected_indicators": ["Pile driving rig visible", "Solar farm ground preparation", "Only 2 rigs operational"], "evidence_relevance": "High", "progress_estimation": "Confirms RIG-3 absence — consistent with 62% progress report.", "note": "[DEMO]"}), "schedule_match": "L4-003", "relevance_score": 93.0},
    {"evidence_type": "material_record", "filename": "energy_module_customs_hold.pdf", "description": "Mundra Port customs hold notice for 6 containers of Longi LR5-72HPH modules — ALMM documentation pending", "location": "Mundra Port, Gujarat", "material_name": "Longi LR5-72HPH 540W Bifacial Module", "expected_quantity": "110,000 modules", "recorded_quantity": "52,800 modules (delivered)", "reported_date": datetime(2026, 9, 1), "schedule_match": "L3-005", "relevance_score": 96.0},
    {"evidence_type": "document", "filename": "energy_abb_delivery_delay.pdf", "description": "ABB India formal notification — 3MVA inverter transformer delivery pushed from August to November 2026", "reported_date": datetime(2026, 9, 2), "schedule_match": "L4-009", "relevance_score": 95.0},
    {"evidence_type": "material_record", "filename": "energy_tracker_rail_delivery.xlsx", "description": "Tata Steel tracker rail profile delivery log — 68% received vs 100% required", "location": "Site Laydown Area", "material_name": "Tracker Rail C-Profile (4mm galvanized)", "expected_quantity": "8,400 MT", "recorded_quantity": "5,712 MT", "reported_date": datetime(2026, 8, 30), "schedule_match": "L4-004", "relevance_score": 94.0},
    {"evidence_type": "photo", "filename": "energy_module_installation.jpg", "description": "Photo of module mounting in Zone A — string assembly in progress. Zone C-D empty waiting for tracker assembly.", "location": "Zone A — Module Mounting", "reported_date": datetime(2026, 9, 5), "ai_analysis": json.dumps({"detected_indicators": ["Solar panels being installed", "Single-axis tracker rails visible", "Workers with modules on ground"], "evidence_relevance": "High", "progress_estimation": "Visual consistent with 32% module installation progress.", "note": "[DEMO]"}), "schedule_match": "L4-006", "relevance_score": 91.0},
]

ENERGY_MATERIALS = [
    {"material_name": "Longi LR5-72HPH 540W Bifacial Module", "category": "Solar PV", "supplier_name": "Longi Solar — China (Imported)", "unit": "nos", "required_quantity": 110000.0, "ordered_quantity": 110000.0, "delivered_quantity": 52800.0, "status": "shortage", "priority": "critical", "expected_delivery": datetime(2026, 9, 12), "actual_delivery": None, "delay_reason": "6 containers held at Mundra Port customs — ALMM documentation verification pending with MNRE", "notes": "Monofacial bifacial modules for 50MW DC capacity", "schedule_match": "L3-005"},
    {"material_name": "3MVA Inverter Transformer Package", "category": "Electrical", "supplier_name": "ABB India Ltd.", "unit": "nos", "required_quantity": 10.0, "ordered_quantity": 10.0, "delivered_quantity": 1.0, "status": "delayed", "priority": "critical", "expected_delivery": datetime(2026, 11, 15), "actual_delivery": None, "delay_reason": "ABB India pushed production slot from August to November — higher priority export order. Critical path risk for COD.", "notes": "0.8kV/33kV inverter-side transformer, ONAN type, 3MVA per inverter station", "schedule_match": "L4-009"},
    {"material_name": "C-Profile Tracker Rail (4mm Galvanized)", "category": "Structural Steel", "supplier_name": "Tata Steel Ltd.", "unit": "MT", "required_quantity": 8400.0, "ordered_quantity": 8400.0, "delivered_quantity": 5712.0, "status": "in_transit", "priority": "high", "expected_delivery": datetime(2026, 9, 18), "actual_delivery": None, "delay_reason": "Rolling mill maintenance at Jamshedpur — production delayed by 3 weeks", "notes": "Hot-dip galvanized C-profiles for single-axis tracker torque tube rail system", "schedule_match": "L4-004"},
    {"material_name": "UV-Resistant DC Cable (4mm2 & 6mm2)", "category": "Electrical", "supplier_name": "Polycab India Ltd. (Alternate)", "unit": "km", "required_quantity": 820.0, "ordered_quantity": 820.0, "delivered_quantity": 380.0, "status": "in_transit", "priority": "high", "expected_delivery": datetime(2026, 9, 20), "actual_delivery": None, "delay_reason": "Primary supplier stock depleted. Alternate sourcing from Polycab at 12% premium approved by PMC.", "notes": "PV-ZZ-F type UV resistant DC string cable", "schedule_match": "L4-007"},
    {"material_name": "132kV GIS Switchgear (Bay 2 & 3)", "category": "Electrical", "supplier_name": "Siemens India Ltd.", "unit": "bays", "required_quantity": 3.0, "ordered_quantity": 3.0, "delivered_quantity": 1.0, "status": "delayed", "priority": "critical", "expected_delivery": datetime(2026, 11, 1), "actual_delivery": None, "delay_reason": "Siemens Kalwa factory 8-week delay — component supply issues. Impacts grid synchronization schedule.", "notes": "SF6 Gas-Insulated Switchgear for 132kV grid interconnection substation", "schedule_match": "L4-010"},
]

ENERGY_SAFETY = [
    {"title": "Heat Stress — Extreme Temperature (44°C)", "hazard_category": "Environmental", "risk_score": "critical", "description": "Workers exposed to 44°C peak temperatures in Bhadla Solar Park, Rajasthan. Risk of heat stroke, dehydration, and cognitive impairment leading to accidents.", "required_ppe": json.dumps(["Cooling Vest", "Wide-brim Helmet", "UV-protective Clothing", "Electrolyte Drinks", "Cooling Stations"]), "mitigation_plan": "Mandatory 10-minute rest every 50 minutes in shaded cooling stations. No heavy work between 12:00-15:00. ORS/electrolyte stations every 200m. Daily heat stress briefing. Medical standby on site.", "compliance_status": "warning", "affected_workers": 180, "schedule_match": "L4-003"},
    {"title": "Cable Reel Handling — Near-Miss Incidents", "hazard_category": "Manual Handling", "risk_score": "high", "description": "3 near-miss incidents involving cable reel movement without designated spotter. Cable reels (up to 800kg) tipping risk during placement.", "required_ppe": json.dumps(["Steel-toe Boots", "Hi-Vis Vest", "Helmet", "Heavy Duty Gloves"]), "mitigation_plan": "Mandatory spotter for all cable reel movement. Use mechanical reel stands — manual carrying banned. Re-issued toolbox talk for all electrical workers. STOP WORK authority exercised.", "compliance_status": "warning", "affected_workers": 35, "schedule_match": "L4-007"},
    {"title": "Pile Driving Rig — Boom Cable Failure Risk", "hazard_category": "Heavy Equipment", "risk_score": "high", "description": "Post-failure pile driving RIG-3 resuming operation. Risk of secondary boom cable failure given same batch of cables used on RIG-1 and RIG-2.", "required_ppe": json.dumps(["Helmet", "Hi-Vis Vest", "Steel-toe Boots", "Exclusion Zone 30m radius"]), "mitigation_plan": "OEM inspection of all boom cables on RIG-1, RIG-2, and RIG-3 before resuming. 30m exclusion zone enforced during all pile driving. Load test documentation required.", "compliance_status": "pending_review", "affected_workers": 12, "schedule_match": "L4-003"},
    {"title": "Electrical Safety — DC Live Conductor Exposure", "hazard_category": "Electrical Hazard", "risk_score": "critical", "description": "DC string cables produce up to 1000V DC once modules connected. Arc flash energy significantly higher in DC systems. Workers observed working near uncapped DC cables without insulation check.", "required_ppe": json.dumps(["Insulated DC Gloves Class 00", "Arc Flash Category 2 PPE", "Face Shield", "Insulated Tools (1000V rated)"]), "mitigation_plan": "Mandatory LOTO for all DC string work. Cable ends to be capped when not terminated. Arc flash hazard analysis completed for all inverter stations. EPC contractor to conduct DC safety re-training for all electricians.", "compliance_status": "violation", "affected_workers": 28, "schedule_match": "L4-007"},
]


# ── Template data lookup ────────────────────────────────────────────────────
TEMPLATE_DATA = {
    "infrastructure": {
        "activities": INFRA_ACTIVITIES,
        "extracted_updates": INFRA_EXTRACTED_UPDATES,
        "field_report_text": INFRA_FIELD_REPORT,
        "field_report_filename": "DPR-2026-248_Indravati_Pumping_Station.txt",
        "field_report_label": "Daily Progress Report — 05 September 2026",
        "field_report_date": datetime(2026, 9, 5),
        "evidence": INFRA_EVIDENCE,
        "materials": INFRA_MATERIALS,
        "safety": INFRA_SAFETY,
    },
    "construction": {
        "activities": CONSTRUCTION_ACTIVITIES,
        "extracted_updates": CONSTRUCTION_EXTRACTED_UPDATES,
        "field_report_text": CONSTRUCTION_FIELD_REPORT,
        "field_report_filename": "WPR-2026-36_Skyline_Heights_Tower.txt",
        "field_report_label": "Weekly Progress Report — Week 36, September 2026",
        "field_report_date": datetime(2026, 9, 7),
        "evidence": CONSTRUCTION_EVIDENCE,
        "materials": CONSTRUCTION_MATERIALS,
        "safety": CONSTRUCTION_SAFETY,
    },
    "energy": {
        "activities": ENERGY_ACTIVITIES,
        "extracted_updates": ENERGY_EXTRACTED_UPDATES,
        "field_report_text": ENERGY_FIELD_REPORT,
        "field_report_filename": "MPR-2026-08_SuryaKiran_Solar_Plant.txt",
        "field_report_label": "Monthly Progress Report — August 2026",
        "field_report_date": datetime(2026, 8, 31),
        "evidence": ENERGY_EVIDENCE,
        "materials": ENERGY_MATERIALS,
        "safety": ENERGY_SAFETY,
    },
}

# backward-compat alias used in Step 8
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

    # ── Step 1: Delete ONLY the existing project for THIS template ───────────
    # This lets all 3 templates (infrastructure, construction, energy) coexist
    existing = await db.execute(
        select(Project).where(
            Project.is_demo == True,
            Project.name == template_info["name"]
        )
    )
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

    tdata = TEMPLATE_DATA.get(template_type, TEMPLATE_DATA["infrastructure"])

    # ── Step 3: Insert schedule activities ──────────────────────────────────
    act_id_to_db: dict[str, int] = {}
    db_activities = []

    for act_data in tdata["activities"]:
        embedding = encode_text(act_data["activity_name"])
        embedding_json = json.dumps(embedding) if embedding else None

        p_start = datetime.strptime(act_data["planned_start"], "%Y-%m-%d") if isinstance(act_data.get("planned_start"), str) else act_data.get("planned_start")
        p_finish = datetime.strptime(act_data["planned_finish"], "%Y-%m-%d") if isinstance(act_data.get("planned_finish"), str) else act_data.get("planned_finish")

        var = act_data.get("progress_variance", act_data["actual_progress"] - act_data["planned_progress"])

        act = ScheduleActivity(
            project_id=project_id,
            activity_id=act_data["activity_id"],
            activity_name=act_data["activity_name"],
            level=act_data["level"],
            parent_id=act_data.get("parent_id"),
            planned_start=p_start,
            planned_finish=p_finish,
            planned_progress=act_data["planned_progress"],
            actual_progress=act_data["actual_progress"],
            progress_variance=var,
            dependency=act_data.get("dependency"),
            is_milestone=act_data.get("is_milestone", False),
            status=act_data.get("status", "In Progress"),
            embedding=embedding_json,
        )
        db.add(act)
        db_activities.append((act_data, act))

    await db.flush()

    for act_data, act in db_activities:
        act_id_to_db[act_data["activity_id"]] = act.id

    logger.info(f"  Created {len(db_activities)} schedule activities for {template_type}")

    # ── Step 4: Create Field Report ──────────────────────────────────────────
    field_report = FieldReport(
        project_id=project_id,
        filename=tdata["field_report_filename"],
        file_type="txt",
        raw_text=tdata["field_report_text"],
        report_date=tdata["field_report_date"],
        source_label=tdata["field_report_label"],
        uploaded_at=datetime.utcnow(),
    )
    db.add(field_report)
    await db.flush()
    report_id = field_report.id
    logger.info(f"  Created field report: id={report_id}")

    # ── Step 5: Create Extracted Updates & Matches ───────────────────────────
    REVIEW_THRESHOLD = settings.confidence_threshold
    pending_review_count = 0
    matched_count = 0

    extracted_updates_list = tdata["extracted_updates"]
    for upd_data in extracted_updates_list:
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

        target_act_id = upd_data["schedule_match"]
        matched_db_id = act_id_to_db.get(target_act_id)

        if matched_db_id is None:
            logger.warning(f"  Could not find schedule activity '{target_act_id}' for match")
            continue

        confidence = upd_data["match_confidence"]
        match_status = "needs_review" if confidence < REVIEW_THRESHOLD else "approved"
        if match_status == "needs_review":
            pending_review_count += 1

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

        stmt = select(ScheduleActivity).where(ScheduleActivity.id == matched_db_id)
        result = await db.execute(stmt)
        act_obj = result.scalar_one_or_none()
        if act_obj and upd_data.get("delay_category"):
            act_obj.delay_category = upd_data["delay_category"]
            if upd_data.get("delay_reason"):
                act_obj.delay_reason = upd_data["delay_reason"][:200]

    await db.flush()
    logger.info(f"  Created {matched_count} activity matches ({pending_review_count} need review)")

    # ── Step 6: Run Risk Engine ──────────────────────────────────────────────
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

    # ── Step 7: Demo Evidence ────────────────────────────────────────────────
    evidence_list = tdata["evidence"]
    for ev_data in evidence_list:
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
        target_db_id = act_id_to_db.get(ev_data.get("schedule_match"))
        if target_db_id:
            db.add(EvidenceActivityLink(
                evidence_id=ev.id,
                activity_id=target_db_id,
                relevance_score=ev_data.get("relevance_score", 90.0),
                link_reason="[DEMO] AI-linked based on description and project context.",
                linked_by="ai",
            ))
    await db.flush()
    logger.info(f"  Created {len(evidence_list)} demo evidence items")

    # ── Step 8: Run consistency + assessments + verification tasks ───────────
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

    match_conf_map2 = {upd["schedule_match"]: upd["match_confidence"] for upd in extracted_updates_list}
    consistency_cnt = conflict_cnt_d = assessment_cnt = vt_cnt = 0

    for a in all_acts:
        if a.level < 4 and len(all_acts) > 30:
            continue
        act_dict = next((d for d in all_act_dicts_full if d["id"] == a.id), None)
        if not act_dict:
            continue

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

    # ── Step 9: Audit events ─────────────────────────────────────────────────
    for ev_data in [
        {"event_type": "extraction", "actor": "ai", "summary": f"AI extracted {len(extracted_updates_list)} field updates from {tdata['field_report_filename']}"},
        {"event_type": "matching", "actor": "ai", "summary": f"Semantic matching: {matched_count} matches, {pending_review_count} flagged for review"},
        {"event_type": "evidence_upload", "actor": "system", "summary": f"[DEMO] {len(evidence_list)} evidence items loaded"},
        {"event_type": "consistency_check", "actor": "system", "summary": f"Consistency engine ran on {assessment_cnt} activities"},
        {"event_type": "conflict_detected", "actor": "system", "summary": f"{conflict_cnt_d} conflicts detected"},
    ]:
        db.add(AuditEvent(project_id=project_id, event_type=ev_data["event_type"],
                          actor=ev_data["actor"], summary=ev_data["summary"]))

    await db.commit()

    # ── Step 10: Demo Material Shipments ─────────────────────────────────────
    materials_list = tdata["materials"]
    material_shortage_count = sum(1 for m in materials_list if m.get("status") in ("shortage", "delayed"))

    material_count = 0
    for m_orig in materials_list:
        m_data = dict(m_orig)  # Copy dict so pop() does not mutate original
        target_match = m_data.pop("schedule_match", None)
        activity_db_id = act_id_to_db.get(target_match)

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

    # ── Step 11: Demo Worker Safety Risks ────────────────────────────────────
    safety_list = tdata["safety"]
    safety_violation_count = sum(1 for s in safety_list if s.get("compliance_status") in ("violation", "warning"))

    safety_count = 0
    for s_orig in safety_list:
        s_data = dict(s_orig)  # Copy dict so pop() does not mutate original
        target_match = s_data.pop("schedule_match", None)
        activity_db_id = act_id_to_db.get(target_match)
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

    # ── Step 12: Additional audit events for features ────────────────────────
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
    logger.info(f"  Demo project fully loaded for template '{template_type}'.")

    return {
        "project_id": project_id,
        "project_name": project.name,
        "activities_count": len(db_activities),
        "field_reports": 1,
        "extracted_updates": len(extracted_updates_list),
        "matches": matched_count,
        "pending_review": pending_review_count,
        "risks": len(risks_data),
        "evidence_items": len(evidence_list),
        "conflicts": conflict_cnt_d,
        "verification_tasks": vt_cnt,
        "material_shipments": material_count,
        "worker_safety_risks": safety_count,
        "message": f"Demo project '{project.name}' loaded with realistic schedule, reports, logistics, safety, and AI risk analysis!",
    }



