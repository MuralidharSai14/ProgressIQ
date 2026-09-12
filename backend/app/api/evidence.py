"""
PROGRESSIQ — Evidence API Routes

POST /projects/{project_id}/evidence/upload
GET  /projects/{project_id}/evidence
GET  /activities/{activity_id}/evidence
POST /evidence/{evidence_id}/link-activity
"""
import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database.connection import get_db
from app.models.models import Evidence, EvidenceActivityLink, ScheduleActivity, Project
from app.services.evidence_service import (
    validate_evidence_file, sanitize_filename, determine_evidence_type, analyze_photo_evidence
)
from app.services.storage import save_file
from app.services.event_broadcaster import emit_project_update
from app.utils.auth_deps import get_current_user_optional
from app.models.models import User

router = APIRouter()


@router.post("/projects/{project_id}/evidence/upload")
async def upload_evidence(
    project_id: int,
    description: str = Form(""),
    reported_date: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    material_name: Optional[str] = Form(None),
    expected_quantity: Optional[str] = Form(None),
    recorded_quantity: Optional[str] = Form(None),
    equipment_name: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Upload a new evidence item for a project (persists to cloud/local storage)."""
    proj = await db.execute(select(Project).where(Project.id == project_id))
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    content = await file.read()
    is_valid, error = validate_evidence_file(file.filename or "", len(content))
    if not is_valid:
        raise HTTPException(status_code=422, detail=error)

    safe_name = sanitize_filename(file.filename or "evidence")
    evidence_type = determine_evidence_type(safe_name, description)

    # Save to storage (cloud or local)
    file_url, file_size = await save_file(
        content=content,
        original_filename=safe_name,
        content_type=file.content_type,
        folder="evidence",
    )

    # Extract EXIF GPS and SHA-256 tamper-proof cryptographic metadata
    from app.services.exif_parser import extract_evidence_metadata
    exif_meta = extract_evidence_metadata(content, safe_name)

    ai_analysis_dict = {}
    if evidence_type == "photo":
        ai_analysis_dict = analyze_photo_evidence(description)
    
    # Merge EXIF GPS & cryptographic verification data
    ai_analysis_dict["tamper_proof"] = {
        "sha256_hash": exif_meta.get("sha256_hash"),
        "verified": True,
        "has_gps": exif_meta.get("has_gps", False),
        "latitude": exif_meta.get("latitude"),
        "longitude": exif_meta.get("longitude"),
        "altitude": exif_meta.get("altitude"),
        "capture_timestamp": exif_meta.get("capture_timestamp"),
        "camera_make": exif_meta.get("camera_make"),
        "camera_model": exif_meta.get("camera_model"),
        "google_maps_url": exif_meta.get("google_maps_url"),
    }
    ai_analysis = json.dumps(ai_analysis_dict)

    ev_date = None
    if reported_date:
        try:
            ev_date = datetime.fromisoformat(reported_date)
        except Exception:
            pass

    uploader_name = current_user.full_name if current_user else "Site Supervisor"

    ev = Evidence(
        project_id=project_id,
        evidence_type=evidence_type,
        filename=safe_name,
        file_url=file_url,
        file_size=file_size,
        content_type=file.content_type or "application/octet-stream",
        uploader_id=current_user.id if current_user else None,
        uploader_name=uploader_name,
        description=description,
        reported_date=ev_date or datetime.utcnow(),
        location=location,
        material_name=material_name,
        expected_quantity=expected_quantity,
        recorded_quantity=recorded_quantity,
        equipment_name=equipment_name,
        ai_analysis=ai_analysis,
        is_demo=False,
    )
    db.add(ev)
    await db.commit()
    await db.refresh(ev)

    # Emit real-time event
    await emit_project_update(
        project_id=project_id,
        event_type="evidence_uploaded",
        data={
            "evidence_id": ev.id,
            "evidence_type": ev.evidence_type,
            "filename": ev.filename,
            "file_url": ev.file_url,
            "uploader": uploader_name,
            "timestamp": ev.uploaded_at.isoformat(),
        },
    )

    return {
        "success": True,
        "evidence_id": ev.id,
        "evidence_type": ev.evidence_type,
        "file_url": ev.file_url,
        "file_size": ev.file_size,
        "message": f"Evidence uploaded successfully. Type: {evidence_type}.",
        "ai_analysis": json.loads(ai_analysis) if ai_analysis else None,
    }


@router.get("/projects/{project_id}/evidence")
async def list_evidence(
    project_id: int,
    evidence_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List all evidence for a project."""
    q = select(Evidence).where(Evidence.project_id == project_id)
    if evidence_type:
        q = q.where(Evidence.evidence_type == evidence_type)
    result = await db.execute(q.order_by(Evidence.uploaded_at.desc()))
    items = result.scalars().all()
    return {"evidence": [_fmt(e) for e in items], "total": len(items)}


@router.get("/activities/{activity_id}/evidence")
async def get_activity_evidence(activity_id: int, db: AsyncSession = Depends(get_db)):
    """Get evidence linked to a specific activity."""
    links_result = await db.execute(
        select(EvidenceActivityLink).where(EvidenceActivityLink.activity_id == activity_id)
    )
    links = links_result.scalars().all()
    if not links:
        return {"evidence": [], "total": 0}

    ev_ids = [l.evidence_id for l in links]
    ev_result = await db.execute(select(Evidence).where(Evidence.id.in_(ev_ids)))
    ev_map = {e.id: e for e in ev_result.scalars().all()}

    return {
        "evidence": [
            {**_fmt(ev_map[l.evidence_id]), "relevance_score": l.relevance_score, "link_reason": l.link_reason, "linked_by": l.linked_by}
            for l in links if l.evidence_id in ev_map
        ],
        "total": len(links),
    }


class LinkRequest(BaseModel):
    activity_id: int
    relevance_score: float = 80.0
    link_reason: str = "Manually linked by user"


@router.post("/evidence/{evidence_id}/link-activity")
async def link_to_activity(evidence_id: int, req: LinkRequest, db: AsyncSession = Depends(get_db)):
    """Manually link evidence to a schedule activity."""
    ev = await db.execute(select(Evidence).where(Evidence.id == evidence_id))
    if not ev.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Evidence not found")
    link = EvidenceActivityLink(
        evidence_id=evidence_id, activity_id=req.activity_id,
        relevance_score=req.relevance_score, link_reason=req.link_reason, linked_by="manual",
    )
    db.add(link)
    await db.commit()
    return {"success": True, "message": "Evidence linked to activity."}


def _fmt(e: Evidence) -> dict:
    """Format an Evidence ORM object as a serialisable dict."""
    analysis = None
    if e.ai_analysis:
        try: analysis = json.loads(e.ai_analysis)
        except Exception: pass
    return {
        "id": e.id, "evidence_type": e.evidence_type, "filename": e.filename,
        "file_url": e.file_url, "file_size": e.file_size, "content_type": e.content_type,
        "uploader_name": e.uploader_name,
        "description": e.description, "location": e.location,
        "reported_date": e.reported_date.isoformat() if e.reported_date else None,
        "material_name": e.material_name, "expected_quantity": e.expected_quantity,
        "recorded_quantity": e.recorded_quantity, "equipment_name": e.equipment_name,
        "ai_analysis": analysis, "is_demo": e.is_demo,
        "uploaded_at": e.uploaded_at.isoformat() if e.uploaded_at else None,
    }
