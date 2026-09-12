"""
PROGRESSIQ — Pydantic Schemas
These are the "shapes" of data going in and out of the API.
Pydantic validates that the data matches the expected format automatically.
"""
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict


# ── Project Schemas ──────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    organization: Optional[str] = None
    location: Optional[str] = None
    planned_start: Optional[datetime] = None
    planned_end: Optional[datetime] = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: Optional[str]
    organization: Optional[str]
    location: Optional[str]
    status: str
    is_demo: bool
    planned_start: Optional[datetime]
    planned_end: Optional[datetime]
    created_at: datetime


# ── Schedule Activity Schemas ─────────────────────────────────────────────────

class ScheduleActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    activity_id: str
    activity_name: str
    level: int
    parent_id: Optional[str]
    planned_start: Optional[datetime]
    planned_finish: Optional[datetime]
    actual_start: Optional[datetime]
    actual_finish: Optional[datetime]
    planned_progress: float
    actual_progress: float
    progress_variance: float
    dependency: Optional[str]
    is_milestone: bool
    status: str
    delay_reason: Optional[str]
    delay_category: Optional[str]


# ── Field Report Schemas ──────────────────────────────────────────────────────

class FieldReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    filename: str
    file_type: str
    raw_text: Optional[str]
    report_date: Optional[datetime]
    source_label: Optional[str]
    uploaded_at: datetime


# ── Extracted Update Schemas ──────────────────────────────────────────────────

class ExtractedUpdateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    field_report_id: int
    activity_description: Optional[str]
    status: Optional[str]
    progress: Optional[float]
    delay_reason: Optional[str]
    delay_category: Optional[str]
    risk_level: Optional[str]
    dependency_mentioned: Optional[str]
    source_text: Optional[str]
    source_page: Optional[int]
    ai_provider: str
    extraction_confidence: Optional[float]
    extracted_at: datetime


# ── Activity Match Schemas ────────────────────────────────────────────────────

class ActivityMatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    extracted_update_id: int
    activity_id: int
    confidence_score: float
    status: str
    alternative_matches: Optional[str]  # JSON string
    reviewer_notes: Optional[str]
    reviewed_at: Optional[datetime]
    matched_at: datetime


class ReviewDecisionCreate(BaseModel):
    decision: str                               # "approved" | "rejected" | "reassigned"
    notes: Optional[str] = None
    chosen_activity_id: Optional[int] = None    # Required if decision == "reassigned"


# ── Risk Schemas ──────────────────────────────────────────────────────────────

class RiskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    activity_id: Optional[int]
    title: str
    description: str
    level: str
    category: Optional[str]
    affected_dependency: Optional[str]
    recommended_action: Optional[str]
    is_resolved: bool
    detected_at: datetime


# ── Dashboard Summary Schema ──────────────────────────────────────────────────

class DashboardSummary(BaseModel):
    project_id: int
    project_name: str
    project_status: str
    overall_health: str                   # "on_track" | "at_risk" | "delayed" | "critical"
    planned_progress: float
    actual_progress: float
    progress_variance: float
    total_activities: int
    on_track_count: int
    at_risk_count: int
    delayed_count: int
    critical_count: int
    milestone_count: int
    upcoming_milestones: list[dict]
    top_delay_reasons: list[dict]
    risk_summary: dict
    pending_reviews: int
    ai_match_confidence_avg: float
    recommendations: list[str]


# ── Generic Response ──────────────────────────────────────────────────────────

class SuccessResponse(BaseModel):
    success: bool = True
    message: str
    data: Optional[Any] = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: Optional[str] = None
