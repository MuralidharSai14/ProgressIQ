"""
PROGRESSIQ — Risk Detection Engine
Rule-based engine that flags activities with potential risks.

Design principle: Simple, explainable rules. Every risk comes with a reason.
Future: Can be extended with ML-based risk scoring.
"""
from datetime import datetime, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def _days_until(dt: Optional[datetime]) -> Optional[int]:
    if dt is None:
        return None
    return (dt - datetime.utcnow()).days


def detect_risks(activities: list[dict], project_id: int) -> list[dict]:
    """
    Analyze activities and generate risk records.

    Rules:
    1. CRITICAL: Activity delayed AND affects a milestone within 14 days
    2. HIGH: Activity >20% behind plan AND has dependencies
    3. HIGH: Milestone approaching in <14 days AND not complete
    4. MEDIUM: Activity delayed with material/equipment issues
    5. MEDIUM: Activity >10% behind plan
    6. LOW: Activity at risk (status = "at_risk" or variance < -5%)

    Args:
        activities: List of activity dicts (from DB or demo data)
        project_id: The project this risk belongs to

    Returns:
        List of risk dicts ready for DB insertion
    """
    risks = []
    milestone_names = {
        a.get("activity_id", ""): a.get("activity_name", "")
        for a in activities if a.get("is_milestone")
    }

    # Build dependency map: which activities depend on what
    # dependency field contains the parent activity_id string
    dep_map: dict[str, list[str]] = {}
    for act in activities:
        dep = act.get("dependency")
        if dep:
            for dep_id in str(dep).split(","):
                dep_id = dep_id.strip()
                if dep_id:
                    dep_map.setdefault(dep_id, []).append(act.get("activity_id", ""))

    for act in activities:
        act_id = act.get("activity_id", "")
        act_name = act.get("activity_name", "Unnamed Activity")
        variance = act.get("progress_variance", 0.0)
        status = act.get("status", "not_started")
        delay_cat = act.get("delay_category", "Unknown")
        planned_finish = act.get("planned_finish")
        is_milestone = act.get("is_milestone", False)
        dependency = act.get("dependency", "")
        level = act.get("level", 1)
        days_left = _days_until(planned_finish)
        dependents = dep_map.get(act_id, [])
        has_dependents = len(dependents) > 0

        # Only generate risks for L3+ activities to reduce noise
        if level < 3:
            continue

        risk_added = False  # Only add ONE risk per activity (highest severity)

        # ── Rule 1: Critical — delayed + affects upcoming milestone ──────────
        if not risk_added and status in ("delayed", "critical") and has_dependents and days_left is not None and days_left < 21:
            dependent_names = ", ".join(dependents[:2])
            risks.append({
                "project_id": project_id,
                "activity_id": act.get("db_id"),
                "title": f"CRITICAL: {act_name} blocking milestone",
                "description": (
                    f"Activity '{act_name}' is {abs(variance):.1f}% behind planned progress "
                    f"and has dependent activities ({dependent_names}) that may be impacted. "
                    f"Planned finish is in {days_left} days."
                ),
                "level": "critical",
                "category": delay_cat,
                "affected_dependency": dependent_names,
                "recommended_action": (
                    f"Immediate attention required. Review blockers for '{act_name}' and "
                    f"assess cascading impact on dependent work."
                ),
            })
            risk_added = True

        # ── Rule 2: High — >20% variance with dependents ─────────────────────
        elif not risk_added and variance < -20 and has_dependents and level >= 4:
            risks.append({
                "project_id": project_id,
                "activity_id": act.get("db_id"),
                "title": f"HIGH RISK: Significant delay in {act_name}",
                "description": (
                    f"'{act_name}' is {abs(variance):.1f}% behind plan. "
                    f"Dependent activities may be impacted: {', '.join(dependents[:2])}."
                ),
                "level": "high",
                "category": delay_cat,
                "affected_dependency": ", ".join(dependents[:2]),
                "recommended_action": (
                    "Engage resources to accelerate this activity. "
                    "Inform dependent teams to prepare for potential delay."
                ),
            })
            risk_added = True

        # ── Rule 3: High — milestone approaching and incomplete ───────────────
        elif not risk_added and is_milestone and days_left is not None and 0 < days_left < 14 and act.get("actual_progress", 0) < 90:
            risks.append({
                "project_id": project_id,
                "activity_id": act.get("db_id"),
                "title": f"HIGH RISK: Milestone '{act_name}' at risk",
                "description": (
                    f"Milestone '{act_name}' is due in {days_left} days "
                    f"but current progress is only {act.get('actual_progress', 0):.1f}%."
                ),
                "level": "high",
                "category": "Dependency",
                "affected_dependency": act_name,
                "recommended_action": (
                    "Escalate milestone tracking. Verify all predecessor activities "
                    "are on schedule or adjust milestone date."
                ),
            })
            risk_added = True

        # ── Rule 4: Medium — delayed due to material/equipment, L5+ only ─────
        elif not risk_added and status == "delayed" and delay_cat in ("Material", "Equipment") and level >= 5:
            risks.append({
                "project_id": project_id,
                "activity_id": act.get("db_id"),
                "title": f"MEDIUM RISK: {delay_cat} issue affecting {act_name}",
                "description": (
                    f"'{act_name}' is delayed due to {delay_cat} issues. "
                    f"Current variance: {variance:.1f}%."
                ),
                "level": "medium",
                "category": delay_cat,
                "affected_dependency": None,
                "recommended_action": (
                    f"Expedite {delay_cat.lower()} procurement/mobilization. "
                    "Confirm delivery/arrival timeline."
                ),
            })
            risk_added = True

    return risks


def classify_health(variance: float, delayed_count: int, critical_count: int) -> str:
    """
    Classify overall project health.
    Returns: "on_track" | "at_risk" | "delayed" | "critical"
    """
    if critical_count > 0 or variance < -20:
        return "critical"
    elif delayed_count > 5 or variance < -10:
        return "delayed"
    elif delayed_count > 0 or variance < -5:
        return "at_risk"
    return "on_track"


def classify_activity_status(variance: float, status: str) -> str:
    """
    Return UI-facing status classification.
    """
    if status == "completed":
        return "completed"
    if variance < -25:
        return "critical"
    elif variance < -10:
        return "delayed"
    elif variance < -5:
        return "at_risk"
    return "on_track"
