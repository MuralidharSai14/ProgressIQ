"""
PROGRESSIQ — Database Models
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    activities: Mapped[list["ScheduleActivity"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    field_reports: Mapped[list["FieldReport"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    risks: Mapped[list["Risk"]] = relationship(back_populates="project", cascade="all, delete-orphan")


# ── Schedule Activity ─────────────────────────────────────────────────────────

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


# ── Field Report ──────────────────────────────────────────────────────────────

class FieldReport(Base):
    __tablename__ = "field_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(20))   # "pdf" | "txt" | "csv"
    raw_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    report_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    source_label: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="field_reports")
    extracted_updates: Mapped[list["ExtractedUpdate"]] = relationship(back_populates="field_report", cascade="all, delete-orphan")


# ── Extracted Update (from AI) ────────────────────────────────────────────────

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


# ── Activity Match ─────────────────────────────────────────────────────────────

class ActivityMatch(Base):
    __tablename__ = "activity_matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    extracted_update_id: Mapped[int] = mapped_column(ForeignKey("extracted_updates.id"), unique=True, index=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("schedule_activities.id"), index=True)
    confidence_score: Mapped[float] = mapped_column(Float)        # 0.0 – 100.0
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


# ── Review Decision ────────────────────────────────────────────────────────────

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


# ── Risk ──────────────────────────────────────────────────────────────────────

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
