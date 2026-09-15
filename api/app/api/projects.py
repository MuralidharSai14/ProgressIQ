"""Projects CRUD endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database.connection import get_db
from app.utils.auth_deps import get_project_or_404
from typing import Optional
from app.models.models import Project, ScheduleActivity, FieldReport, Risk, User, ProjectMember
from app.schemas.schemas import ProjectCreate, ProjectOut
from app.utils.auth_deps import get_current_user_optional

router = APIRouter()


@router.get("/projects", response_model=list[ProjectOut])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    projects = result.scalars().all()
    if not projects:
        try:
            from app.services.demo_loader import ensure_all_demo_projects_seeded
            await ensure_all_demo_projects_seeded(db)
            result = await db.execute(select(Project).order_by(Project.created_at.desc()))
            projects = result.scalars().all()
        except Exception:
            pass
    return projects


@router.post("/projects", response_model=ProjectOut, status_code=201)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    proj_dict = data.model_dump()
    if current_user:
        proj_dict["created_by_id"] = current_user.id
        if not proj_dict.get("organization") and current_user.organization:
            proj_dict["organization"] = current_user.organization

    project = Project(**proj_dict)
    db.add(project)
    await db.flush()

    # If created by a user, automatically add them as admin member of the project
    if current_user:
        db.add(ProjectMember(
            project_id=project.id,
            user_id=current_user.id,
            role="admin",
        ))

    await db.commit()
    await db.refresh(project)
    return project


@router.get("/projects/{project_id}", response_model=ProjectOut)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        try:
            from app.services.demo_loader import ensure_all_demo_projects_seeded
            await ensure_all_demo_projects_seeded(db)
            result = await db.execute(select(Project).where(Project.id == project_id))
            project = result.scalar_one_or_none()
        except Exception:
            pass
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project



@router.delete("/projects/{project_id}")
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    project = await get_project_or_404(project_id, db)
    await db.delete(project)
    await db.commit()
    return {"success": True, "message": f"Project '{project.name}' deleted"}
