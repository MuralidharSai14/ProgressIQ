"""AI extraction endpoint — turns field report text into structured data."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.connection import get_db
from app.models.models import FieldReport, ExtractedUpdate
from app.processors.document import split_into_paragraphs
from app.ai.provider import get_ai_provider
from app.config import get_settings

router = APIRouter()
settings = get_settings()


class ExtractRequest(BaseModel):
    field_report_id: int
    text: str | None = None   # Optional: directly provide text instead of loading from DB


@router.post("/ai/extract")
async def extract_from_report(
    data: ExtractRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Run AI extraction on a field report.
    Splits text into paragraphs and extracts structured data from each.
    Returns a list of extracted updates.
    """
    result = await db.execute(select(FieldReport).where(FieldReport.id == data.field_report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Field report not found")

    text = data.text or report.raw_text or ""
    if not text.strip():
        raise HTTPException(status_code=422, detail="Field report has no extractable text.")

    # Split into paragraphs (each is one "update")
    paragraphs = split_into_paragraphs(text, min_length=50)
    if not paragraphs:
        paragraphs = [text[:1000]]  # Use full text if no paragraphs found

    # Limit to 20 paragraphs max per report
    paragraphs = paragraphs[:20]

    ai = get_ai_provider()
    extracted_ids = []

    for i, para in enumerate(paragraphs):
        try:
            extraction = await ai.extract_field_update(para)
        except Exception as e:
            extraction = {
                "activity_description": para[:100],
                "status": "In Progress",
                "progress": None,
                "delay_reason": None,
                "delay_category": None,
                "risk_level": "Low",
                "dependency_mentioned": None,
                "extraction_confidence": 50.0,
                "ai_provider": "error-fallback",
            }

        update = ExtractedUpdate(
            field_report_id=data.field_report_id,
            activity_description=extraction.get("activity_description"),
            status=extraction.get("status"),
            progress=extraction.get("progress"),
            actual_start=extraction.get("actual_start"),
            actual_finish=extraction.get("actual_finish"),
            delay_reason=extraction.get("delay_reason"),
            delay_category=extraction.get("delay_category"),
            risk_level=extraction.get("risk_level"),
            dependency_mentioned=extraction.get("dependency_mentioned"),
            source_text=para[:500],
            source_page=None,
            ai_provider=extraction.get("ai_provider", settings.ai_provider),
            extraction_confidence=extraction.get("extraction_confidence"),
        )
        db.add(update)

    await db.commit()

    # Return all extractions for this report
    exts = await db.execute(
        select(ExtractedUpdate).where(ExtractedUpdate.field_report_id == data.field_report_id)
    )
    all_extractions = exts.scalars().all()

    return {
        "success": True,
        "field_report_id": data.field_report_id,
        "paragraphs_processed": len(paragraphs),
        "extractions_created": len(all_extractions),
        "ai_provider": settings.ai_provider,
        "extractions": [
            {
                "id": e.id,
                "activity_description": e.activity_description,
                "status": e.status,
                "progress": e.progress,
                "delay_reason": e.delay_reason,
                "delay_category": e.delay_category,
                "risk_level": e.risk_level,
                "extraction_confidence": e.extraction_confidence,
                "source_text": e.source_text,
                "ai_provider": e.ai_provider,
            }
            for e in all_extractions
        ],
    }
