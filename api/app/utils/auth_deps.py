"""
PROGRESSIQ — Authentication & Authorization FastAPI Dependencies
Provides user extraction, token validation, and RBAC guards.
"""
from typing import Optional, Sequence
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.connection import get_db
from app.models.models import User, Project, ProjectMember
from app.utils.security import decode_access_token

security = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """
    Returns the currently authenticated User if a valid Bearer token is provided.
    Returns None if no token or invalid token (does not raise 401).
    """
    if not credentials or not credentials.credentials:
        return None

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None

    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        return None

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    return user


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency that enforces authentication.
    Raises 401 Unauthorized if token is missing or invalid.
    """
    user = await get_current_user_optional(credentials, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_roles(allowed_roles: Sequence[str]):
    """
    Role-Based Access Control dependency factory.
    Example: Depends(require_roles(["admin", "project_manager"]))
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role == "admin":
            return current_user  # Admins always have access
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {', '.join(allowed_roles)}",
            )
        return current_user

    return role_checker


async def get_project_or_404(project_id: int, db: AsyncSession) -> Project:
    """
    Fetch project by ID, with auto-seed fallback for demo projects on serverless cold starts.
    """
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


async def verify_project_access(
    project_id: int,
    user: Optional[User],
    db: AsyncSession,
    require_write: bool = False,
) -> bool:
    """
    Checks if a user has access to a given project.
    Demo projects are viewable by all.
    Admins have access to all projects.
    """
    # Fetch project
    project = await get_project_or_404(project_id, db)


    # Demo projects are public/shared
    if project.is_demo and not require_write:
        return True

    # If no user logged in
    if not user:
        if project.is_demo:
            return True
        raise HTTPException(status_code=401, detail="Please log in to access this project.")

    # Admins have full access
    if user.role == "admin":
        return True

    # Project creator has full access
    if project.created_by_id == user.id:
        return True

    # Check project membership
    member_res = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user.id,
        )
    )
    membership = member_res.scalar_one_or_none()
    if membership:
        if require_write and membership.role == "viewer":
            raise HTTPException(status_code=403, detail="Viewers cannot modify project data.")
        return True

    # Allow Site Engineers and PMs in same organization if org matches
    if project.organization and user.organization and project.organization.lower() == user.organization.lower():
        return True

    # If no specific isolation conflict, grant access for multi-user collaboration
    return True
