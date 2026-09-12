"""
PROGRESSIQ — Verification Service
Determines which activities need human verification and creates VerificationTask records.
"""
from typing import Optional


def should_verify(
    reported_progress: float,
    evidence_supported_progress: Optional[float],
    overall_confidence: float,
    failed_check_types: list[str],
    conflict_count: int,
) -> tuple[bool, str, str]:
    """Returns (needs_verification, priority, trigger_reason)."""
    reasons = []
    priority = "low"

    if overall_confidence < 55:
        reasons.append(f"Low AI confidence ({overall_confidence:.0f}%)")
        priority = "high"

    if conflict_count > 0:
        priority = "high" if conflict_count > 1 else "medium"
        reasons.append(f"{conflict_count} conflict(s) detected")

    if evidence_supported_progress is not None:
        gap = reported_progress - evidence_supported_progress
        if gap > 20:
            reasons.append(f"Large gap: reported {reported_progress:.0f}% vs evidence-supported {evidence_supported_progress:.0f}%")
            priority = "high" if gap > 30 else max(priority, "medium")

    if "cross_report" in failed_check_types:
        reasons.append("Progress regression detected")
        priority = "high"
    if "dependency" in failed_check_types:
        reasons.append("Dependency inconsistency")
        if priority == "low": priority = "medium"

    if not reasons:
        return False, "low", ""
    return True, priority, "; ".join(reasons)


def build_verification_task(
    activity: dict,
    project_id: int,
    reported_progress: float,
    evidence_supported_progress: Optional[float],
    overall_confidence: float,
    conflict_count: int,
    failed_check_types: list[str],
    recommendation: str,
) -> Optional[dict]:
    """Build a VerificationTask dict for DB insertion, or None if not needed."""
    needs, priority, trigger = should_verify(
        reported_progress, evidence_supported_progress,
        overall_confidence, failed_check_types, conflict_count
    )
    if not needs:
        return None

    return {
        "project_id": project_id,
        "activity_id": activity.get("db_id") or activity.get("id"),
        "status": "pending",
        "priority": priority,
        "trigger_reason": trigger,
        "reported_progress": reported_progress,
        "evidence_supported_progress": evidence_supported_progress,
        "overall_confidence": overall_confidence,
        "conflict_summary": f"{conflict_count} conflict(s): {', '.join(failed_check_types)}" if failed_check_types else None,
        "recommendation": recommendation,
    }
