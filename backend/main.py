"""
PROGRESSIQ — FastAPI Main Application Entry Point

This is the "main engine" of the backend. It:
1. Creates the FastAPI app
2. Sets up CORS (so the frontend can talk to it)
3. Registers all the API routes
4. Creates the database tables on startup
"""
import logging
import sys
import os

# Ensure the backend directory is in Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.database.connection import create_all_tables
from app.config import get_settings

# Import all route modules
from app.api import health, projects, schedule, field_reports, ai_routes, matching, dashboard, demo

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs on startup and shutdown."""
    logger.info("🚀 PROGRESSIQ Backend Starting...")
    logger.info(f"   AI Provider: {settings.ai_provider}")
    logger.info(f"   Database:    {settings.database_url}")
    logger.info(f"   Confidence Threshold: {settings.confidence_threshold}%")
    await create_all_tables()
    logger.info("✅ Database tables ready")
    yield
    logger.info("🛑 PROGRESSIQ Backend Shutting down...")


app = FastAPI(
    title="PROGRESSIQ API",
    description=(
        "Project Progress Intelligence — AI-powered planning-to-execution bridge "
        "for infrastructure projects. Connects planned schedules with actual field updates "
        "using semantic AI matching."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS Configuration ───────────────────────────────────────────────────────
# CORS lets the frontend (running on port 5173) talk to the backend (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # Alternative frontend port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register API Routes ───────────────────────────────────────────────────────
app.include_router(health.router,        prefix="/api",        tags=["Health"])
app.include_router(projects.router,      prefix="/api",        tags=["Projects"])
app.include_router(schedule.router,      prefix="/api",        tags=["Schedule"])
app.include_router(field_reports.router, prefix="/api",        tags=["Field Reports"])
app.include_router(ai_routes.router,     prefix="/api",        tags=["AI Extraction"])
app.include_router(matching.router,      prefix="/api",        tags=["Activity Matching"])
app.include_router(dashboard.router,     prefix="/api",        tags=["Dashboard"])
app.include_router(demo.router,          prefix="/api",        tags=["Demo"])


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Catch-all handler — never expose raw stack traces to users."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "An internal error occurred. Please try again."},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=True,
    )
