"""
AI Project Copilot API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database.connection import get_db
from app.models.models import Project
from app.utils.auth_deps import get_project_or_404
from app.services.copilot_service import ask_project_copilot, aggregate_project_context, get_suggested_prompts

router = APIRouter()


class CopilotAskRequest(BaseModel):
    query: str


@router.post("/projects/{project_id}/copilot/ask")
async def ask_copilot(
    project_id: int,
    req: CopilotAskRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Ask the AI Project Copilot a natural language question grounded on real-time project telemetry.
    """
    project = await get_project_or_404(project_id, db)

    if not req.query.strip():
        raise HTTPException(status_code=422, detail="Query cannot be empty.")

    result = await ask_project_copilot(db, project_id, req.query)
    return result


@router.get("/projects/{project_id}/copilot/suggested-prompts")
async def get_copilot_prompts(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get dynamic suggested prompts tailored to the project's current state and bottlenecks.
    """
    project = await get_project_or_404(project_id, db)

    context = await aggregate_project_context(db, project_id)

    prompts = get_suggested_prompts(context)
    return {
        "project_id": project_id,
        "suggested_prompts": prompts,
    }
