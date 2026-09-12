"""
EVM and S-Curve API Endpoints for PROGRESSIQ
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.connection import get_db
from app.models.models import Project
from app.services.evm_engine import compute_project_evm, generate_s_curve_data

router = APIRouter()


@router.get("/projects/{project_id}/evm")
async def get_project_evm(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get comprehensive Earned Value Management (EVM) metrics for a project:
    PV, EV, AC, SV, CV, SPI, CPI, EAC, ETC, VAC, TCPI, and schedule health.
    """
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    metrics = await compute_project_evm(db, project_id)
    return metrics


@router.get("/projects/{project_id}/s-curve")
async def get_project_s_curve(
    project_id: int,
    intervals: int = 12,
    db: AsyncSession = Depends(get_db),
):
    """
    Get time-series S-Curve cumulative progress points for Planned, Earned, and Forecasted completion.
    """
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    points = await generate_s_curve_data(db, project_id, intervals=intervals)
    return {
        "project_id": project_id,
        "points_count": len(points),
        "data": points,
    }
