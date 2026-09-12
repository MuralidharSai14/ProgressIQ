"""
PROGRESSIQ — Evidence Consistency Engine

Runs 6 deterministic checks (A-F) on a schedule activity.
All logic is pure Python — NO LLM calls.
Each check returns a structured result with a score (0-100) and finding.
"""
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def check_schedule_consistency(activity: dict) -> dict:
    """Check A: Is reported progress consistent with planned schedule timing?"""
    planned = activity.get("planned_progress", 0.0)
    reported = activity.get("reported_progress") or activity.get("actual_progress", 0.0)
    variance = reported - planned

    if variance > 30:
        return {
            "check_type": "schedule", "passed": False,
            "score": max(0, 100 - abs(variance) * 1.5),
            "finding": f"Reported progress ({reported:.0f}%) significantly exceeds planned ({planned:.0f}%). Possible early execution or over-reporting.",
            "detail": f"Variance: +{variance:.1f} percentage points"
        }
    elif variance < -40:
        return {
            "check_type": "schedule", "passed": False,
            "score": max(0, 100 - abs(variance)),
            "finding": f"Reported progress ({reported:.0f}%) is significantly behind planned ({planned:.0f}%). Activity appears severely delayed.",
            "detail": f"Variance: {variance:.1f} percentage points"
        }
    else:
        score = 100 - min(abs(variance) * 0.5, 30)
        return {
            "check_type": "schedule", "passed": True,
            "score": round(score, 1),
            "finding": "Reported progress is broadly consistent with planned schedule timing.",
            "detail": f"Planned: {planned:.0f}%, Reported: {reported:.0f}%, Variance: {variance:+.1f}%"
        }


def check_dependency_consistency(activity: dict, all_activities: list[dict]) -> dict:
    """Check B: Are predecessor activities sufficiently complete?"""
    dependency_str = activity.get("dependency", "") or ""
    reported = activity.get("reported_progress") or activity.get("actual_progress", 0.0)

    if not dependency_str.strip():
        return {
            "check_type": "dependency", "passed": True, "score": 100.0,
            "finding": "No predecessor dependency declared.", "detail": None
        }

    dep_ids = [d.strip() for d in dependency_str.split(",") if d.strip()]
    act_by_id = {a.get("activity_id", ""): a for a in all_activities}
    incomplete_deps = []

    for dep_id in dep_ids:
        dep = act_by_id.get(dep_id)
        if dep and dep.get("actual_progress", 0.0) < 80 and reported > 20:
            incomplete_deps.append(f"{dep_id} ({dep.get('actual_progress', 0):.0f}% complete)")

    if incomplete_deps:
        return {
            "check_type": "dependency", "passed": False,
            "score": max(0, 100 - len(incomplete_deps) * 30),
            "finding": f"Dependency inconsistency: predecessor(s) incomplete while this activity reports {reported:.0f}% progress.",
            "detail": f"Incomplete predecessors: {', '.join(incomplete_deps)}"
        }

    return {
        "check_type": "dependency", "passed": True, "score": 95.0,
        "finding": "Dependency consistency verified — predecessor activities are sufficiently progressed.",
        "detail": f"Dependencies checked: {', '.join(dep_ids)}"
    }


def check_temporal_consistency(activity: dict, previous_report_progress: Optional[float]) -> dict:
    """Check C: Is the progress jump from the previous report reasonable?"""
    current = activity.get("reported_progress") or activity.get("actual_progress", 0.0)

    if previous_report_progress is None:
        return {
            "check_type": "temporal", "passed": True, "score": 90.0,
            "finding": "No previous report available. Temporal check skipped.", "detail": None
        }

    jump = current - previous_report_progress

    if jump < -5:
        return {
            "check_type": "temporal", "passed": False, "score": 30.0,
            "finding": f"Progress regression detected. Previous: {previous_report_progress:.0f}%, Current: {current:.0f}%.",
            "detail": "Possible causes: data correction, rework, or reporting inconsistency. Human verification required."
        }
    if jump > 40:
        return {
            "check_type": "temporal", "passed": False, "score": 50.0,
            "finding": f"Large progress jump detected (+{jump:.0f}% in one period). Supporting evidence recommended.",
            "detail": f"Previous: {previous_report_progress:.0f}%, Current: {current:.0f}%"
        }

    return {
        "check_type": "temporal", "passed": True, "score": 90.0,
        "finding": f"Progress change is reasonable (+{jump:.0f}% from previous report).",
        "detail": f"Previous: {previous_report_progress:.0f}%, Current: {current:.0f}%"
    }


def check_resource_consistency(activity: dict, evidence_items: list[dict]) -> dict:
    """Check D: Does available evidence support the reported progress?"""
    reported = activity.get("reported_progress") or activity.get("actual_progress", 0.0)
    material_ev = [e for e in evidence_items if e.get("evidence_type") in ("material_record", "equipment_record")]
    photo_ev = [e for e in evidence_items if e.get("evidence_type") == "photo"]
    total = len(evidence_items)

    if reported > 30 and total == 0:
        return {
            "check_type": "resource", "passed": False, "score": 40.0,
            "finding": f"Evidence gap: {reported:.0f}% reported but no supporting evidence available.",
            "detail": "Attach site photos, material delivery records, or inspection documents."
        }
    if reported > 60 and not material_ev and not photo_ev:
        return {
            "check_type": "resource", "passed": False, "score": 60.0,
            "finding": f"Limited evidence for {reported:.0f}% progress. No material records or photos.",
            "detail": "Evidence-supported estimation requires material records or photographic evidence."
        }

    score = min(100.0, 70.0 + total * 10)
    return {
        "check_type": "resource", "passed": True, "score": round(score, 1),
        "finding": f"Supporting evidence available ({total} item(s)).",
        "detail": f"Photos: {len(photo_ev)}, Material records: {len(material_ev)}"
    }


def check_location_consistency(activity: dict, evidence_items: list[dict]) -> dict:
    """Check E: Do location mentions in evidence match activity's location?"""
    activity_location = (activity.get("location", "") or "").lower().strip()

    if not activity_location:
        return {
            "check_type": "location", "passed": True, "score": 85.0,
            "finding": "Activity location not specified. Location check skipped.", "detail": None
        }

    conflicting = [
        e.get("location", "").lower() for e in evidence_items
        if (e.get("location", "") or "").lower().strip()
        and activity_location not in (e.get("location", "") or "").lower()
        and (e.get("location", "") or "").lower() not in activity_location
    ]

    if conflicting:
        return {
            "check_type": "location", "passed": False, "score": 50.0,
            "finding": f"Location discrepancy: activity '{activity_location}' vs evidence location(s) '{', '.join(conflicting)}'.",
            "detail": "Verify that evidence belongs to the correct activity location."
        }

    return {
        "check_type": "location", "passed": True, "score": 100.0,
        "finding": "Location information is consistent.",
        "detail": f"Activity location: {activity_location}"
    }


def check_cross_report_consistency(activity: dict, historical_progress: list[float]) -> dict:
    """Check F: Compare with previous reports to detect regression."""
    if len(historical_progress) < 2:
        return {
            "check_type": "cross_report", "passed": True, "score": 90.0,
            "finding": "Insufficient history for cross-report comparison.", "detail": None
        }

    current = historical_progress[-1]
    max_prev = max(historical_progress[:-1])

    if current < max_prev - 5:
        return {
            "check_type": "cross_report", "passed": False, "score": 35.0,
            "finding": f"Progress regression: peak was {max_prev:.0f}%, current is {current:.0f}%.",
            "detail": f"History: {[f'{v:.0f}%' for v in historical_progress]}. Possible rework or reporting error."
        }

    return {
        "check_type": "cross_report", "passed": True, "score": 92.0,
        "finding": "Progress trend is consistent with historical reports.",
        "detail": f"Recent values: {[f'{v:.0f}%' for v in historical_progress[-3:]]}"
    }


def run_all_checks(
    activity: dict,
    all_activities: list[dict],
    evidence_items: list[dict],
    previous_report_progress: Optional[float] = None,
    historical_progress: Optional[list[float]] = None,
) -> list[dict]:
    """Run all 6 consistency checks and return results."""
    return [
        check_schedule_consistency(activity),
        check_dependency_consistency(activity, all_activities),
        check_temporal_consistency(activity, previous_report_progress),
        check_resource_consistency(activity, evidence_items),
        check_location_consistency(activity, evidence_items),
        check_cross_report_consistency(activity, historical_progress or [activity.get("actual_progress", 0.0)]),
    ]
