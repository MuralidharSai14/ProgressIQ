"""Schedule upload and retrieval endpoints."""
import json
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.connection import get_db
from app.models.models import Project, ScheduleActivity
from app.schemas.schemas import ScheduleActivityOut
from app.processors.schedule import parse_schedule_file
from app.processors.document import sanitize_filename
from app.ai.embeddings import encode_text
from app.config import get_settings

router = APIRouter()
settings = get_settings()

ALLOWED_TYPES = {
    "text/csv", "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
}


@router.post("/projects/{project_id}/schedule/upload")
async def upload_schedule(
    project_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    # Validate project exists
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate file
    filename = sanitize_filename(file.filename or "upload")
    if not filename.lower().endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported.")

    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_upload_size_mb}MB limit.")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Parse
    try:
        activities = parse_schedule_file(content, filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Delete existing activities for this project
    existing = await db.execute(select(ScheduleActivity).where(ScheduleActivity.project_id == project_id))
    for a in existing.scalars().all():
        await db.delete(a)

    # Insert new activities with embeddings
    inserted = 0
    for act_data in activities:
        embedding = encode_text(act_data["activity_name"])
        act = ScheduleActivity(
            project_id=project_id,
            activity_id=act_data["activity_id"],
            activity_name=act_data["activity_name"],
            level=act_data["level"],
            parent_id=act_data.get("parent_id"),
            planned_start=act_data.get("planned_start"),
            planned_finish=act_data.get("planned_finish"),
            planned_progress=act_data["planned_progress"],
            actual_progress=act_data["actual_progress"],
            progress_variance=act_data["progress_variance"],
            dependency=act_data.get("dependency"),
            is_milestone=act_data["is_milestone"],
            status=act_data["status"],
            embedding=json.dumps(embedding) if embedding else None,
        )
        db.add(act)
        inserted += 1

    await db.commit()
    return {
        "success": True,
        "message": f"Schedule uploaded: {inserted} activities imported.",
        "activities_count": inserted,
        "filename": filename,
    }


@router.get("/projects/{project_id}/schedule", response_model=list[ScheduleActivityOut])
async def get_schedule(
    project_id: int,
    level: int | None = None,
    search: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(ScheduleActivity).where(ScheduleActivity.project_id == project_id)
    if level is not None:
        query = query.where(ScheduleActivity.level == level)
    if status:
        query = query.where(ScheduleActivity.status == status)
    query = query.order_by(ScheduleActivity.activity_id)

    result = await db.execute(query)
    activities = result.scalars().all()

    if search:
        s = search.lower()
        activities = [a for a in activities if s in a.activity_name.lower() or s in a.activity_id.lower()]

    return activities
