"""Demo project loader endpoint."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.connection import get_db
from app.services.demo_loader import load_demo_project

router = APIRouter()


@router.post("/demo/load")
async def load_demo(db: AsyncSession = Depends(get_db)):
    """
    Load the complete demo project into the database.
    This powers the 'Load Demo Project' button in the UI.
    """
    try:
        result = await load_demo_project(db)
        return {"success": True, **result}
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Demo load error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
