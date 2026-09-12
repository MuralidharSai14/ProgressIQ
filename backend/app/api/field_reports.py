from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.connection import get_db
from app.models.models import Project, FieldReport, ExtractedUpdate, User
from app.schemas.schemas import FieldReportOut, ExtractedUpdateOut
from app.processors.document import (
    extract_text_from_pdf, extract_text_from_txt, extract_text_from_docx,
    split_into_paragraphs, sanitize_filename
)
from app.services.storage import save_file
from app.services.ai_pipeline import process_field_report_background
from app.utils.auth_deps import get_current_user_optional
from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.post("/projects/{project_id}/field-reports/upload")
async def upload_field_report(
    project_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    filename = sanitize_filename(file.filename or "report")
    filename_lower = filename.lower()

    if not filename_lower.endswith((".pdf", ".txt", ".text", ".docx")):
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, and TXT files are supported for field reports.")

    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large.")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Save original file to storage
    file_url, file_size = await save_file(
        content=content,
        original_filename=filename,
        content_type=file.content_type,
        folder="field_reports",
    )

    # Extract text
    if filename_lower.endswith(".pdf"):
        raw_text, pages = extract_text_from_pdf(content)
        file_type = "pdf"
    elif filename_lower.endswith(".docx"):
        raw_text = extract_text_from_docx(content)
        file_type = "docx"
    else:
        raw_text = extract_text_from_txt(content)
        file_type = "txt"

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="Could not extract any text from the uploaded file.")

    uploader_name = current_user.full_name if current_user else "Site Supervisor"

    # Save field report
    field_report = FieldReport(
        project_id=project_id,
        uploader_id=current_user.id if current_user else None,
        uploader_name=uploader_name,
        filename=filename,
        file_type=file_type,
        file_url=file_url,
        file_size=file_size,
        raw_text=raw_text,
        source_label=f"Uploaded: {filename}",
        status="processing",
    )
    db.add(field_report)
    await db.commit()
    await db.refresh(field_report)

    # Enqueue background AI extraction and semantic matching
    background_tasks.add_task(
        process_field_report_background,
        field_report_id=field_report.id,
        project_id=project_id,
    )

    return {
        "success": True,
        "field_report_id": field_report.id,
        "filename": filename,
        "file_type": file_type,
        "file_url": file_url,
        "file_size": file_size,
        "status": "processing",
        "text_length": len(raw_text),
        "message": f"Field report '{filename}' uploaded. AI background extraction and semantic matching in progress...",
    }


@router.get("/projects/{project_id}/field-reports", response_model=list[FieldReportOut])
async def list_field_reports(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(FieldReport)
        .where(FieldReport.project_id == project_id)
        .order_by(FieldReport.uploaded_at.desc())
    )
    return result.scalars().all()


@router.get("/field-reports/{report_id}", response_model=FieldReportOut)
async def get_field_report(report_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FieldReport).where(FieldReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Field report not found")
    return report


@router.get("/field-reports/{report_id}/extractions", response_model=list[ExtractedUpdateOut])
async def get_extractions(report_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExtractedUpdate).where(ExtractedUpdate.field_report_id == report_id)
    )
    return result.scalars().all()
