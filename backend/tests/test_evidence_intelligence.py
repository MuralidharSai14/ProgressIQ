import pytest
from app.services.consistency_engine import (
    check_schedule_consistency, check_dependency_consistency,
    check_temporal_consistency, check_resource_consistency,
    check_location_consistency, check_cross_report_consistency, run_all_checks
)
from app.services.confidence_engine import (
    compute_confidence, compute_evidence_supported_progress, generate_recommendation
)
from app.services.conflict_detector import detect_conflicts
from app.services.verification_service import should_verify, build_verification_task
from app.services.evidence_service import validate_evidence_file, determine_evidence_type, analyze_photo_evidence


def test_schedule_consistency_check():
    res = check_schedule_consistency({"planned_progress": 50, "actual_progress": 52})
    assert res["passed"] is True
    assert res["score"] >= 90

    res_over = check_schedule_consistency({"planned_progress": 20, "actual_progress": 80})
    assert res_over["passed"] is False

    res_behind = check_schedule_consistency({"planned_progress": 90, "actual_progress": 30})
    assert res_behind["passed"] is False


def test_dependency_consistency_check():
    all_acts = [
        {"activity_id": "L5-001", "actual_progress": 30},
        {"activity_id": "L5-002", "actual_progress": 90},
    ]
    res = check_dependency_consistency({"dependency": "L5-001", "reported_progress": 70}, all_acts)
    assert res["passed"] is False

    res_ok = check_dependency_consistency({"dependency": "L5-002", "reported_progress": 30}, all_acts)
    assert res_ok["passed"] is True


def test_temporal_consistency_check():
    res_reg = check_temporal_consistency({"reported_progress": 40}, 55.0)
    assert res_reg["passed"] is False

    res_jump = check_temporal_consistency({"reported_progress": 90}, 30.0)
    assert res_jump["passed"] is False


def test_resource_consistency_check():
    res_gap = check_resource_consistency({"reported_progress": 80}, [])
    assert res_gap["passed"] is False

    res_ok = check_resource_consistency({"reported_progress": 80}, [{"evidence_type": "photo"}])
    assert res_ok["passed"] is True


def test_confidence_engine():
    checks = run_all_checks(
        activity={"planned_progress": 50, "actual_progress": 50},
        all_activities=[],
        evidence_items=[{"evidence_type": "photo"}],
    )
    conf = compute_confidence(checks, match_confidence=85.0, extraction_confidence=90.0, evidence_count=1)
    assert conf["overall_confidence"] > 70
    assert conf["confidence_label"] in ("high", "medium")

    ev_sup = compute_evidence_supported_progress(reported_progress=80.0, resource_score=50.0, overall_confidence=60.0)
    assert 0 <= ev_sup <= 80.0


def test_conflict_detector():
    act = {"id": 1, "activity_name": "Test Foundation", "planned_progress": 20, "actual_progress": 80}
    checks = run_all_checks(act, [], [])
    conflicts = detect_conflicts(act, checks, project_id=1)
    assert len(conflicts) > 0


def test_verification_service():
    needs, priority, trigger = should_verify(
        reported_progress=80.0,
        evidence_supported_progress=30.0,
        overall_confidence=50.0,
        failed_check_types=["resource", "schedule"],
        conflict_count=2,
    )
    assert needs is True
    assert priority in ("high", "critical")


def test_evidence_service():
    valid, err = validate_evidence_file("site_photo.jpg", 1024)
    assert valid is True

    etype = determine_evidence_type("steel_record.csv", "Steel delivery log")
    assert etype == "material_record"

    photo_analysis = analyze_photo_evidence("Reinforcement steel for foundation grade beam")
    assert any("Reinforcement" in d for d in photo_analysis["detected_indicators"])
