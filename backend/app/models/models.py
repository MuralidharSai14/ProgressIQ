"""
PROGRESSIQ â€” Database Models
These are the "tables" in the database. Each class = one table.
SQLAlchemy maps Python objects to database rows automatically.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Integer, Float, Boolean, Text, DateTime, JSON,
    ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base
import enum


# ── Enumerations ─────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    PROJECT_MANAGER = "project_manager"
    SITE_ENGINEER = "site_engineer"
    VIEWER = "viewer"


class ProjectStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"
    CANCELLED = "cancelled"


class ActivityStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"
    ON_HOLD = "on_hold"


class MatchStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_REVIEW = "needs_review"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DelayCategory(str, enum.Enum):
    MATERIAL = "Material"
    LABOUR = "Labour"
    EQUIPMENT = "Equipment"
    WEATHER = "Weather"
    APPROVAL = "Approval"
    DEPENDENCY = "Dependency"
    CONTRACTOR = "Contractor"
    EXTERNAL = "External"
    UNKNOWN = "Unknown"


class EvidenceType(str, enum.Enum):
    PHOTO = "photo"
    MATERIAL_RECORD = "material_record"
    EQUIPMENT_RECORD = "equipment_record"
    DOCUMENT = "document"


class ConflictSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    EVIDENCE_REQUESTED = "evidence_requested"
    MARKED_REVIEW = "marked_review"


class MaterialCategory(str, enum.Enum):
    STEEL = "Steel"
    CONCRETE = "Concrete"
    PIPING = "Piping"
    ELECTRICAL = "Electrical"
    CIVIL = "Civil"
    STRUCTURAL = "Structural"
    MECHANICAL = "Mechanical"
    INSTRUMENTATION = "Instrumentation"
    CHEMICALS = "Chemicals"
    CONSUMABLES = "Consumables"
    OTHER = "Other"


class ShipmentStatus(str, enum.Enum):
    ORDERED = "ordered"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    DELAYED = "delayed"
    SHORTAGE = "shortage"
    CANCELLED = "cancelled"


class HazardCategory(str, enum.Enum):
    WORKING_AT_HEIGHT = "Working at Height"
    EXCAVATION = "Excavation"
    ELECTRICAL = "Electrical Hazard"
    HEAVY_EQUIPMENT = "Heavy Equipment"
    CHEMICAL = "Chemical Exposure"
    FIRE = "Fire & Explosion"
    CONFINED_SPACE = "Confined Space"
    MANUAL_HANDLING = "Manual Handling"
    NOISE = "Noise & Vibration"
    GENERAL = "General Site"


class SafetyCompliance(str, enum.Enum):
    COMPLIANT = "compliant"
    WARNING = "warning"
    VIOLATION = "violation"
    PENDING_REVIEW = "pending_review"


# ── User & Auth ─────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(150))
    role: Mapped[str] = mapped_column(String(50), default="site_engineer")  # UserRole values
    organization: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    memberships: Mapped[list["ProjectMember"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(50), default="viewer")
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="memberships")


# ── Project ───────────────────────────────────────────────────────────────────

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    organization: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    planned_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    planned_end: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    members: Mapped[list["ProjectMember"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    activities: Mapped[list["ScheduleActivity"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    field_reports: Mapped[list["FieldReport"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    live_updates: Mapped[list["LiveFieldUpdate"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    risks: Mapped[list["Risk"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    evidence: Mapped[list["Evidence"]] = relationship(cascade="all, delete-orphan", foreign_keys="Evidence.project_id")
    conflicts: Mapped[list["Conflict"]] = relationship(cascade="all, delete-orphan", foreign_keys="Conflict.project_id")
    verification_tasks: Mapped[list["VerificationTask"]] = relationship(cascade="all, delete-orphan", foreign_keys="VerificationTask.project_id")
    audit_events: Mapped[list["AuditEvent"]] = relationship(cascade="all, delete-orphan", foreign_keys="AuditEvent.project_id")
    material_shipments: Mapped[list["MaterialShipment"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    worker_safety_risks: Mapped[list["WorkerSafetyRisk"]] = relationship(back_populates="project", cascade="all, delete-orphan")



# â”€â”€ Schedule Activity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ScheduleActivity(Base):
    __tablename__ = "schedule_activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    activity_id: Mapped[str] = mapped_column(String(50), index=True)   # e.g. "L5-023"
    activity_name: Mapped[str] = mapped_column(String(500))
    level: Mapped[int] = mapped_column(Integer, default=5)              # L1-L6
    parent_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    planned_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    planned_finish: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    actual_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    actual_finish: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    planned_progress: Mapped[float] = mapped_column(Float, default=0.0)
    actual_progress: Mapped[float] = mapped_column(Float, default=0.0)
    progress_variance: Mapped[float] = mapped_column(Float, default=0.0)
    dependency: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    is_milestone: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(30), default="not_started")
    delay_reason: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    delay_category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    embedding: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON-encoded vector
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="activities")
    matches: Mapped[list["ActivityMatch"]] = relationship(back_populates="activity")
    assessment: Mapped[Optional["ActivityAssessment"]] = relationship(uselist=False, foreign_keys="ActivityAssessment.activity_id")
    consistency_checks: Mapped[list["ConsistencyCheck"]] = relationship(foreign_keys="ConsistencyCheck.activity_id")
    verification_tasks: Mapped[list["VerificationTask"]] = relationship(foreign_keys="VerificationTask.activity_id")


# â”€â”€ Field Report â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class FieldReport(Base):
    __tablename__ = "field_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    uploader_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    uploader_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    filename: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(20))   # "pdf" | "txt" | "csv" | "docx"
    file_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    raw_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    report_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    source_label: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="completed")  # pending, processing, completed, needs_review, failed
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="field_reports")
    extracted_updates: Mapped[list["ExtractedUpdate"]] = relationship(back_populates="field_report", cascade="all, delete-orphan")


# â”€â”€ Extracted Update (from AI) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ExtractedUpdate(Base):
    __tablename__ = "extracted_updates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    field_report_id: Mapped[int] = mapped_column(ForeignKey("field_reports.id"), index=True)
    activity_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    progress: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    actual_start: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    actual_finish: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    delay_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    delay_category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    risk_level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    dependency_mentioned: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)   # the exact text chunk
    source_page: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ai_provider: Mapped[str] = mapped_column(String(50), default="mock")
    extraction_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    raw_ai_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extracted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    field_report: Mapped["FieldReport"] = relationship(back_populates="extracted_updates")
    match: Mapped[Optional["ActivityMatch"]] = relationship(back_populates="extracted_update", uselist=False)


# â”€â”€ Activity Match â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ActivityMatch(Base):
    __tablename__ = "activity_matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    extracted_update_id: Mapped[int] = mapped_column(ForeignKey("extracted_updates.id"), unique=True, index=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("schedule_activities.id"), index=True)
    confidence_score: Mapped[float] = mapped_column(Float)        # 0.0 â€“ 100.0
    status: Mapped[str] = mapped_column(String(30), default="pending")  # pending | approved | rejected | needs_review
    alternative_matches: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array
    reviewer_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    matched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    extracted_update: Mapped["ExtractedUpdate"] = relationship(back_populates="match")
    activity: Mapped["ScheduleActivity"] = relationship(back_populates="matches")
    review_decision: Mapped[Optional["ReviewDecision"]] = relationship(back_populates="match", uselist=False)


# â”€â”€ Review Decision â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ReviewDecision(Base):
    __tablename__ = "review_decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("activity_matches.id"), unique=True, index=True)
    decision: Mapped[str] = mapped_column(String(20))   # "approved" | "rejected" | "reassigned"
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    chosen_activity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # if reassigned
    decided_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    match: Mapped["ActivityMatch"] = relationship(back_populates="review_decision")


# â”€â”€ Risk â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class Risk(Base):
    __tablename__ = "risks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    activity_id: Mapped[Optional[int]] = mapped_column(ForeignKey("schedule_activities.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(String(20))   # low | medium | high | critical
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    affected_dependency: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    recommended_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="risks")


# â”€â”€ Evidence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    evidence_type: Mapped[str] = mapped_column(String(30))  # EvidenceType values
    filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    content_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    uploader_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    uploader_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reported_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    material_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    expected_quantity: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    recorded_quantity: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    equipment_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    ai_analysis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    activity_links: Mapped[list["EvidenceActivityLink"]] = relationship(back_populates="evidence", cascade="all, delete-orphan")


# ── Live Field Update ─────────────────────────────────────────────────────────

class LiveFieldUpdate(Base):
    """
    Mobile-first field update submitted by site engineers from smartphones or laptops.
    Immediately updates progress in DB and triggers background AI consistency check.
    """
    __tablename__ = "live_field_updates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("schedule_activities.id"), index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    reporter_name: Mapped[str] = mapped_column(String(100), default="Site Engineer")
    reported_progress: Mapped[float] = mapped_column(Float)
    previous_progress: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reported_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    evidence_type: Mapped[Optional[str]] = mapped_column(String(50), default="photo")
    status: Mapped[str] = mapped_column(String(30), default="completed")  # pending, processing, completed, needs_review, failed
    ai_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ai_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="live_updates")
    activity: Mapped["ScheduleActivity"] = relationship()


class EvidenceActivityLink(Base):
    __tablename__ = "evidence_activity_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    evidence_id: Mapped[int] = mapped_column(ForeignKey("evidence.id"), index=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("schedule_activities.id"), index=True)
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0)
    link_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    linked_by: Mapped[str] = mapped_column(String(20), default="ai")
    linked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    evidence: Mapped["Evidence"] = relationship(back_populates="activity_links")


class ConsistencyCheck(Base):
    __tablename__ = "consistency_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("schedule_activities.id"), index=True)
    check_type: Mapped[str] = mapped_column(String(30))
    passed: Mapped[bool] = mapped_column(Boolean, default=True)
    score: Mapped[float] = mapped_column(Float, default=100.0)
    finding: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    checked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Conflict(Base):
    __tablename__ = "conflicts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    activity_id: Mapped[Optional[int]] = mapped_column(ForeignKey("schedule_activities.id"), nullable=True)
    conflict_type: Mapped[str] = mapped_column(String(50))
    severity: Mapped[str] = mapped_column(String(20), default="medium")
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text)
    reported_value: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    expected_value: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    recommended_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ActivityAssessment(Base):
    __tablename__ = "activity_assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("schedule_activities.id"), unique=True, index=True)
    planned_progress: Mapped[float] = mapped_column(Float, default=0.0)
    reported_progress: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    evidence_supported_progress: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    overall_confidence: Mapped[float] = mapped_column(Float, default=50.0)
    confidence_label: Mapped[str] = mapped_column(String(20), default="low")
    confidence_factors: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    supporting_factors: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    uncertainty_factors: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    recommendation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requires_verification: Mapped[bool] = mapped_column(Boolean, default=False)
    assessed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class VerificationTask(Base):
    __tablename__ = "verification_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("schedule_activities.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    trigger_reason: Mapped[str] = mapped_column(Text)
    reported_progress: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    evidence_supported_progress: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    overall_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    conflict_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recommendation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    decision: Mapped[Optional["VerificationDecision"]] = relationship(back_populates="task", uselist=False)


class VerificationDecision(Base):
    __tablename__ = "verification_decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("verification_tasks.id"), unique=True, index=True)
    decision: Mapped[str] = mapped_column(String(30))
    reviewer: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    task: Mapped["VerificationTask"] = relationship(back_populates="decision")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    activity_id: Mapped[Optional[int]] = mapped_column(ForeignKey("schedule_activities.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(50))
    actor: Mapped[str] = mapped_column(String(50), default="system")
    summary: Mapped[str] = mapped_column(String(500))
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ── Material Shipment ──────────────────────────────────────────────────────────

class MaterialShipment(Base):
    """
    Tracks individual material items/shipments for a project.
    Links to specific schedule activities when applicable.
    """
    __tablename__ = "material_shipments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    activity_id: Mapped[Optional[int]] = mapped_column(ForeignKey("schedule_activities.id"), nullable=True)
    material_name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(50), default="Other")       # MaterialCategory values
    supplier_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    unit: Mapped[str] = mapped_column(String(30), default="units")            # MT, m³, m, nos, etc.
    required_quantity: Mapped[float] = mapped_column(Float, default=0.0)
    ordered_quantity: Mapped[float] = mapped_column(Float, default=0.0)
    delivered_quantity: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(30), default="ordered")        # ShipmentStatus values
    priority: Mapped[str] = mapped_column(String(20), default="medium")       # low | medium | high | critical
    expected_delivery: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    actual_delivery: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    delay_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="material_shipments")


# ── Worker Safety Risk ─────────────────────────────────────────────────────────

class WorkerSafetyRisk(Base):
    """
    Documents site-specific safety hazards tied to schedule activities.
    Tracks PPE requirements, compliance, and mitigation plans.
    """
    __tablename__ = "worker_safety_risks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    activity_id: Mapped[Optional[int]] = mapped_column(ForeignKey("schedule_activities.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(300))
    hazard_category: Mapped[str] = mapped_column(String(50), default="General Site")  # HazardCategory values
    risk_score: Mapped[str] = mapped_column(String(20), default="medium")              # low | medium | high | critical
    description: Mapped[str] = mapped_column(Text)
    required_ppe: Mapped[Optional[str]] = mapped_column(Text, nullable=True)           # JSON list of PPE items
    mitigation_plan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    compliance_status: Mapped[str] = mapped_column(String(30), default="pending_review")  # SafetyCompliance values
    affected_workers: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)    # Estimated worker headcount
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="worker_safety_risks")

