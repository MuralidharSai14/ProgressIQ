"""
PROGRESSIQ — Live Field Updates API
Mobile-first field update submission with immediate activity progress updates,
automatic photo evidence storage, background AI consistency analysis, and SSE broadcast.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.connection import get_db
from app.models.models import Project, ScheduleActivity, LiveFieldUpdate, Evidence, EvidenceActivityLink, User
from app.schemas.schemas import LiveFieldUpdateOut
from app.services.storage import save_file
from app.services.ai_pipeline import process_live_field_update_background
from app.utils.auth_deps import get_current_user_optional

router = APIRouter(tags=["Live Field Updates"])


@router.post("/projects/{project_id}/field-updates", status_code=status.HTTP_201_CREATED)
async def submit_live_field_update(
    project_id: int,
    background_tasks: BackgroundTasks,
    activity_id: int = Form(...),
    reported_progress: float = Form(...),
    reporter_name: Optional[str] = Form(None),
    reported_date: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    remarks: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Submit a live progress update from mobile phone or laptop.
    Saves evidence photo, updates progress in database, and launches background AI analysis.
    """
    # 1. Validate project & activity
    proj_res = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    act_res = await db.execute(select(ScheduleActivity).where(ScheduleActivity.id == activity_id, ScheduleActivity.project_id == project_id))
    activity = act_res.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Schedule activity not found in this project")

    # Validate progress
    if reported_progress < 0 or reported_progress > 100:
        raise HTTPException(status_code=422, detail="Reported progress must be between 0 and 100%")

    # Determine reporter name
    final_reporter = reporter_name or (current_user.full_name if current_user else "Site Engineer")

    # Parse date
    rep_datetime = datetime.utcnow()
    if reported_date:
        try:
            rep_datetime = datetime.fromisoformat(reported_date.replace("Z", "+00:00"))
        except Exception:
            pass

    # 2. Handle optional evidence photo/file upload
    evidence_url = None
    if file and file.filename:
        content = await file.read()
        if len(content) > 0:
            evidence_url, file_size = await save_file(
                content=content,
                original_filename=file.filename,
                content_type=file.content_type,
                folder="evidence",
            )
            # Create Evidence record
            ev = Evidence(
                project_id=project_id,
                evidence_type="photo",
                filename=file.filename,
                file_url=evidence_url,
                file_size=file_size,
                content_type=file.content_type or "image/jpeg",
                uploader_id=current_user.id if current_user else None,
                uploader_name=final_reporter,
                description=f"Field update photo: {remarks or activity.activity_name}",
                reported_date=rep_datetime,
                location=location or activity.activity_name,
                is_demo=False,
            )
            db.add(ev)
            await db.flush()

            # Link evidence to activity
            db.add(EvidenceActivityLink(
                evidence_id=ev.id,
                activity_id=activity_id,
                relevance_score=95.0,
                link_reason="Attached directly during Live Field Update",
                linked_by="site_engineer",
            ))

    # 3. Create LiveFieldUpdate entry
    prev_prog = activity.actual_progress
    live_update = LiveFieldUpdate(
        project_id=project_id,
        activity_id=activity_id,
        user_id=current_user.id if current_user else None,
        reporter_name=final_reporter,
        reported_progress=round(reported_progress, 2),
        previous_progress=prev_prog,
        reported_date=rep_datetime,
        location=location,
        remarks=remarks,
        evidence_url=evidence_url,
        evidence_type="photo" if evidence_url else None,
        status="processing",
    )
    db.add(live_update)

    # Fast inline update for immediate visual feedback
    activity.actual_progress = round(reported_progress, 2)
    activity.progress_variance = round(activity.actual_progress - activity.planned_progress, 2)
    if activity.actual_progress >= 100:
        activity.status = "completed"
    elif activity.progress_variance < -20:
        activity.status = "delayed"
    elif activity.actual_progress > 0:
        activity.status = "in_progress"

    await db.commit()
    await db.refresh(live_update)

    # 4. Enqueue background AI pipeline
    background_tasks.add_task(
        process_live_field_update_background,
        update_id=live_update.id,
        project_id=project_id,
        activity_id=activity_id,
        reported_progress=reported_progress,
        remarks=remarks,
        evidence_url=evidence_url,
        reporter_name=final_reporter,
    )

    return {
        "success": True,
        "message": f"Field update submitted for '{activity.activity_name}' ({reported_progress}%). AI consistency pipeline initiated.",
        "update_id": live_update.id,
        "activity_id": activity.id,
        "activity_name": activity.activity_name,
        "reported_progress": reported_progress,
        "previous_progress": prev_prog,
        "evidence_url": evidence_url,
        "status": "processing",
        "timestamp": live_update.created_at.isoformat(),
    }


@router.get("/projects/{project_id}/field-updates")
async def list_live_field_updates(
    project_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """List recent live field updates submitted for a project."""
    res = await db.execute(
        select(LiveFieldUpdate)
        .where(LiveFieldUpdate.project_id == project_id)
        .order_by(LiveFieldUpdate.created_at.desc())
        .limit(limit)
    )
    updates = res.scalars().all()

    # Get activity names
    act_ids = [u.activity_id for u in updates]
    act_map = {}
    if act_ids:
        act_res = await db.execute(select(ScheduleActivity).where(ScheduleActivity.id.in_(act_ids)))
        act_map = {a.id: a.activity_name for a in act_res.scalars().all()}

    return {
        "updates": [
            {
                "id": u.id,
                "project_id": u.project_id,
                "activity_id": u.activity_id,
                "activity_name": act_map.get(u.activity_id, f"Activity #{u.activity_id}"),
                "reporter_name": u.reporter_name,
                "reported_progress": u.reported_progress,
                "previous_progress": u.previous_progress,
                "reported_date": u.reported_date.isoformat() if u.reported_date else None,
                "location": u.location,
                "remarks": u.remarks,
                "evidence_url": u.evidence_url,
                "evidence_type": u.evidence_type,
                "status": u.status,
                "ai_confidence": u.ai_confidence,
                "ai_notes": u.ai_notes,
                "created_at": u.created_at.isoformat(),
            }
            for u in updates
        ],
        "total": len(updates),
    }
