"""
PROGRESSIQ — Confidence Engine

Deterministic confidence scoring. No LLM involvement.

Weighted factors:
  semantic_match:        0.20
  schedule:              0.20
  dependency:            0.15
  temporal:              0.10
  resource:              0.15
  location:              0.05
  cross_report:          0.10
  extraction_confidence: 0.05
"""
import json
from typing import Optional

WEIGHTS = {
    "semantic_match": 0.20, "schedule": 0.20, "dependency": 0.15,
    "temporal": 0.10, "resource": 0.15, "location": 0.05,
    "cross_report": 0.10, "extraction_confidence": 0.05,
}


def label_confidence(score: float) -> str:
    if score >= 80: return "high"
    elif score >= 55: return "medium"
    return "low"


def compute_evidence_supported_progress(
    reported_progress: float,
    resource_score: float,
    overall_confidence: float,
) -> float:
    """
    Evidence-supported progress indicator.
    NOT a precise measurement — reflects how much evidence can support the reported value.
    Formula: reported * evidence_factor where evidence_factor blends resource score + confidence.
    """
    ev_factor = (resource_score / 100) * 0.5 + (overall_confidence / 100) * 0.5
    supported = reported_progress * ev_factor
    return round(max(0.0, min(reported_progress, supported)), 1)


def build_supporting_factors(check_results: list[dict], match_confidence: float) -> list[str]:
    factors = []
    if match_confidence >= 80:
        factors.append(f"Strong semantic activity match ({match_confidence:.0f}%)")
    labels = {
        "schedule": "Schedule timing consistent", "dependency": "Dependency chain verified",
        "temporal": "Progress change is reasonable", "resource": "Supporting evidence available",
        "location": "Location consistent", "cross_report": "Cross-report consistency confirmed",
    }
    for c in check_results:
        if c["passed"] and c["score"] >= 80:
            factors.append(labels.get(c["check_type"], c["check_type"]))
    return factors


def build_uncertainty_factors(check_results: list[dict], match_confidence: float, evidence_count: int) -> list[str]:
    factors = []
    if match_confidence < 75:
        factors.append(f"Low activity match confidence ({match_confidence:.0f}%)")
    for c in check_results:
        if not c["passed"]:
            factors.append(c["finding"])
    if evidence_count == 0:
        factors.append("No supporting evidence attached")
    return factors


def compute_confidence(
    check_results: list[dict],
    match_confidence: float = 80.0,
    extraction_confidence: float = 80.0,
    evidence_count: int = 0,
) -> dict:
    """Compute weighted confidence score from all factors."""
    by_type = {c["check_type"]: c["score"] for c in check_results}

    overall = round(
        match_confidence * WEIGHTS["semantic_match"] +
        by_type.get("schedule", 80.0) * WEIGHTS["schedule"] +
        by_type.get("dependency", 80.0) * WEIGHTS["dependency"] +
        by_type.get("temporal", 80.0) * WEIGHTS["temporal"] +
        by_type.get("resource", 80.0) * WEIGHTS["resource"] +
        by_type.get("location", 85.0) * WEIGHTS["location"] +
        by_type.get("cross_report", 90.0) * WEIGHTS["cross_report"] +
        extraction_confidence * WEIGHTS["extraction_confidence"],
        1
    )

    factors = {
        "semantic_match": round(match_confidence, 1),
        "schedule": round(by_type.get("schedule", 80.0), 1),
        "dependency": round(by_type.get("dependency", 80.0), 1),
        "temporal": round(by_type.get("temporal", 80.0), 1),
        "resource": round(by_type.get("resource", 80.0), 1),
        "location": round(by_type.get("location", 85.0), 1),
        "cross_report": round(by_type.get("cross_report", 90.0), 1),
        "extraction_confidence": round(extraction_confidence, 1),
    }

    return {
        "overall_confidence": overall,
        "confidence_label": label_confidence(overall),
        "confidence_factors": json.dumps(factors),
        "supporting_factors": json.dumps(build_supporting_factors(check_results, match_confidence)),
        "uncertainty_factors": json.dumps(build_uncertainty_factors(check_results, match_confidence, evidence_count)),
    }


def generate_recommendation(
    activity_name: str,
    reported: float,
    evidence_supported: float,
    confidence_label: str,
    failed_checks: list[str],
    conflict_count: int,
) -> str:
    """Plain-language recommendation for the project manager. Rule-based, not LLM."""
    variance = reported - evidence_supported

    if conflict_count > 1 or confidence_label == "low":
        return (
            f"⚠ Verification required. Reported progress ({reported:.0f}%) has "
            f"{conflict_count} conflict(s) and {confidence_label} evidence confidence. "
            "Request additional evidence before accepting."
        )
    if variance > 15:
        return (
            f"Evidence-supported indicator ({evidence_supported:.0f}%) is {variance:.0f} points below "
            f"reported ({reported:.0f}%). Request quantity measurement or inspection document."
        )
    if failed_checks:
        return f"Continue monitoring. Address: {'; '.join(failed_checks[:2])}."
    return (
        f"Progress for '{activity_name}' appears consistent with available evidence. "
        "Continue monitoring and update evidence as work advances."
    )
