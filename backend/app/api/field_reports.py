"""Field report upload and AI extraction endpoints."""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.connection import get_db
from app.models.models import Project, FieldReport, ExtractedUpdate
from app.schemas.schemas import FieldReportOut, ExtractedUpdateOut
from app.processors.document import extract_text_from_pdf, extract_text_from_txt, split_into_paragraphs, sanitize_filename
from app.ai.provider import get_ai_provider
from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.post("/projects/{project_id}/field-reports/upload")
async def upload_field_report(
    project_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    filename = sanitize_filename(file.filename or "report")
    filename_lower = filename.lower()

    if not filename_lower.endswith((".pdf", ".txt", ".text")):
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported for field reports.")

    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large.")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Extract text
    if filename_lower.endswith(".pdf"):
        raw_text, pages = extract_text_from_pdf(content)
        file_type = "pdf"
    else:
        raw_text = extract_text_from_txt(content)
        file_type = "txt"

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="Could not extract any text from the uploaded file.")

    # Save field report
    field_report = FieldReport(
        project_id=project_id,
        filename=filename,
        file_type=file_type,
        raw_text=raw_text,
        source_label=f"Uploaded: {filename}",
    )
    db.add(field_report)
    await db.commit()
    await db.refresh(field_report)

    return {
        "success": True,
        "field_report_id": field_report.id,
        "filename": filename,
        "file_type": file_type,
        "text_length": len(raw_text),
        "message": "Field report uploaded. Run AI extraction to process it.",
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
