"""
PROGRESSIQ — Conflict Detector
Generates Conflict records from failed consistency checks. Rule-based, not LLM.
"""


def detect_conflicts(activity: dict, check_results: list[dict], project_id: int) -> list[dict]:
    """
    Generate conflict records from failed consistency checks.
    Returns list of dicts ready for DB insertion.
    """
    conflicts = []
    act_name = activity.get("activity_name", "Unknown")
    act_db_id = activity.get("db_id") or activity.get("id")
    reported = activity.get("reported_progress") or activity.get("actual_progress", 0.0)
    planned = activity.get("planned_progress", 0.0)

    def severity(check_type: str, score: float) -> str:
        if check_type in ("dependency", "temporal", "cross_report"):
            return "high" if score < 50 else "medium"
        if check_type == "schedule":
            return "critical" if score < 40 else ("high" if score < 60 else "medium")
        return "medium" if score < 60 else "low"

    actions = {
        "schedule":     "Verify timing with field supervisor. Confirm whether early execution occurred or progress is overstated.",
        "dependency":   "Verify predecessor activity completion before accepting this activity's reported progress.",
        "temporal":     "Request photographic or measurement evidence to support the reported progress change.",
        "resource":     "Attach material delivery records, site photos, or inspection report to support this progress claim.",
        "location":     "Verify that the attached evidence belongs to the correct activity location.",
        "cross_report": "Investigate reason for progress regression. Determine if rework occurred or if this is a reporting error.",
    }

    type_labels = {
        "schedule": "Schedule Inconsistency", "dependency": "Dependency Violation",
        "temporal": "Temporal Inconsistency", "resource": "Evidence Gap",
        "location": "Location Discrepancy", "cross_report": "Progress Regression",
    }

    for check in check_results:
        if check["passed"]:
            continue
        ct = check["check_type"]
        conflicts.append({
            "project_id": project_id,
            "activity_id": act_db_id,
            "conflict_type": ct,
            "severity": severity(ct, check["score"]),
            "title": f"{type_labels.get(ct, ct)} — {act_name}",
            "description": check["finding"],
            "reported_value": f"{reported:.0f}% reported",
            "expected_value": f"{planned:.0f}% planned",
            "recommended_action": actions.get(ct, "Investigate and verify."),
        })

    return conflicts
