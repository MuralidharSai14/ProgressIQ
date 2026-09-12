"""
PROGRESSIQ — Pydantic Schemas
These are the "shapes" of data going in and out of the API.
Pydantic validates that the data matches the expected format automatically.
"""
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict


# ── Authentication & User Schemas ──────────────────────────────────────────

class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str
    role: Optional[str] = "site_engineer"
    organization: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    full_name: str
    role: str
    organization: Optional[str]
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProjectMemberCreate(BaseModel):
    user_id: int
    role: Optional[str] = "viewer"


class ProjectMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    user_id: int
    role: str
    joined_at: datetime
    user: Optional[UserOut] = None


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
    created_by_id: Optional[int] = None
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


class ScheduleUploadSummary(BaseModel):
    success: bool
    message: str
    total_rows: int
    imported_count: int
    error_count: int
    errors: list[dict] = []
    filename: str


# ── Field Report Schemas ──────────────────────────────────────────────────────

class FieldReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    uploader_id: Optional[int] = None
    uploader_name: Optional[str] = None
    filename: str
    file_type: str
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    raw_text: Optional[str]
    report_date: Optional[datetime]
    source_label: Optional[str]
    status: str
    uploaded_at: datetime


# ── Live Field Update Schemas ────────────────────────────────────────────────

class LiveFieldUpdateCreate(BaseModel):
    activity_id: int
    reported_progress: float
    reporter_name: Optional[str] = "Site Engineer"
    reported_date: Optional[datetime] = None
    location: Optional[str] = None
    remarks: Optional[str] = None
    evidence_url: Optional[str] = None
    evidence_type: Optional[str] = "photo"


class LiveFieldUpdateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    activity_id: int
    user_id: Optional[int] = None
    reporter_name: str
    reported_progress: float
    previous_progress: Optional[float] = None
    reported_date: datetime
    location: Optional[str] = None
    remarks: Optional[str] = None
    evidence_url: Optional[str] = None
    evidence_type: Optional[str] = "photo"
    status: str
    ai_confidence: Optional[float] = None
    ai_notes: Optional[str] = None
    created_at: datetime
    activity_name: Optional[str] = None


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


# ── Material Shipment Schemas ─────────────────────────────────────────────────

class MaterialShipmentCreate(BaseModel):
    material_name: str
    category: str = "Other"
    supplier_name: Optional[str] = None
    unit: str = "units"
    required_quantity: float = 0.0
    ordered_quantity: float = 0.0
    delivered_quantity: float = 0.0
    status: str = "ordered"
    priority: str = "medium"
    expected_delivery: Optional[datetime] = None
    actual_delivery: Optional[datetime] = None
    delay_reason: Optional[str] = None
    notes: Optional[str] = None
    activity_id: Optional[int] = None


class MaterialShipmentUpdate(BaseModel):
    delivered_quantity: Optional[float] = None
    ordered_quantity: Optional[float] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    actual_delivery: Optional[datetime] = None
    delay_reason: Optional[str] = None
    notes: Optional[str] = None
    supplier_name: Optional[str] = None


class MaterialShipmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    activity_id: Optional[int]
    material_name: str
    category: str
    supplier_name: Optional[str]
    unit: str
    required_quantity: float
    ordered_quantity: float
    delivered_quantity: float
    status: str
    priority: str
    expected_delivery: Optional[datetime]
    actual_delivery: Optional[datetime]
    delay_reason: Optional[str]
    notes: Optional[str]
    is_demo: bool
    created_at: datetime
    updated_at: datetime


# ── Worker Safety Risk Schemas ────────────────────────────────────────────────

class WorkerSafetyRiskCreate(BaseModel):
    title: str
    hazard_category: str = "General Site"
    risk_score: str = "medium"
    description: str
    required_ppe: Optional[list[str]] = None
    mitigation_plan: Optional[str] = None
    compliance_status: str = "pending_review"
    affected_workers: Optional[int] = None
    activity_id: Optional[int] = None


class WorkerSafetyRiskUpdate(BaseModel):
    compliance_status: Optional[str] = None
    mitigation_plan: Optional[str] = None
    risk_score: Optional[str] = None
    required_ppe: Optional[list[str]] = None
    is_resolved: Optional[bool] = None
    affected_workers: Optional[int] = None


class WorkerSafetyRiskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    activity_id: Optional[int]
    title: str
    hazard_category: str
    risk_score: str
    description: str
    required_ppe: Optional[str]   # stored as JSON string
    mitigation_plan: Optional[str]
    compliance_status: str
    affected_workers: Optional[int]
    is_resolved: bool
    detected_at: datetime
    resolved_at: Optional[datetime]
    is_demo: bool
