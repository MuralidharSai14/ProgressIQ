"""Demo project loader endpoint."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.connection import get_db
from app.services.demo_loader import load_demo_project

router = APIRouter()


@router.get("/demo/templates")
async def get_demo_templates():
    """Return available industry templates."""
    from app.services.demo_loader import TEMPLATES_CATALOG
    return TEMPLATES_CATALOG


@router.post("/demo/load")
async def load_demo(template: str = "infrastructure", db: AsyncSession = Depends(get_db)):
    """
    Load an industry template demo project into the database.
    Supported templates: infrastructure | construction | software | energy
    """
    try:
        result = await load_demo_project(db, template_type=template)
        return {"success": True, **result}
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Demo load error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
