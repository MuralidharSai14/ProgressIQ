"""
PROGRESSIQ â€” FastAPI Main Application Entry Point

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

from fastapi.staticfiles import StaticFiles
from app.database.connection import create_all_tables, AsyncSessionLocal
from app.config import get_settings
from app.api.auth import seed_default_users

# Import all route modules
from app.api import (
    health, auth, projects, schedule, field_reports, field_updates,
    ai_routes, matching, dashboard, demo, evidence, consistency,
    verification, audit, logistics, safety, events, evm, copilot
)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs on startup and shutdown."""
    logger.info("🚀 PROGRESSIQ Multi-User Backend Starting...")
    logger.info(f"   AI Provider: {settings.ai_provider}")
    logger.info(f"   Database:    {settings.database_url}")
    logger.info(f"   Storage:     {settings.storage_provider}")
    logger.info(f"   Confidence Threshold: {settings.confidence_threshold}%")
    
    # 1. Initialize Database Tables
    await create_all_tables()
    logger.info("✅ Database tables ready")

    # 2. Seed Default Test User Accounts (Admin, PM, Site Engineer, Viewer)
    async with AsyncSessionLocal() as db:
        await seed_default_users(db)
    
    yield
    logger.info("🛑 PROGRESSIQ Backend Shutting down...")


app = FastAPI(
    title="PROGRESSIQ API",
    description=(
        "Real-Time Multi-User Project Progress Intelligence Platform — "
        "AI-powered planning-to-execution bridge connecting baseline schedules with actual field updates."
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── Static Uploads Mount ──────────────────────────────────────────────────────
# Serves uploaded photographs, PDFs, and inspection records persistently
upload_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), settings.storage_local_dir)
os.makedirs(upload_path, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_path), name="uploads")

# ── CORS Configuration ────────────────────────────────────────────────────────
# Supports multi-device access (laptop, phone, tablet, cloud preview, different Wi-Fi/cellular)
if settings.cors_origins == "*" or not settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^https?://.*$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    allowed_list = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# ── Register API Routes ───────────────────────────────────────────────────────
app.include_router(health.router,        prefix="/api",        tags=["Health"])
app.include_router(auth.router,          prefix="/api",        tags=["Authentication"])
app.include_router(projects.router,      prefix="/api",        tags=["Projects"])
app.include_router(schedule.router,      prefix="/api",        tags=["Schedule"])
app.include_router(field_reports.router, prefix="/api",        tags=["Field Reports"])
app.include_router(field_updates.router, prefix="/api",        tags=["Live Field Updates"])
app.include_router(ai_routes.router,     prefix="/api",        tags=["AI Extraction"])
app.include_router(matching.router,      prefix="/api",        tags=["Activity Matching"])
app.include_router(dashboard.router,     prefix="/api",        tags=["Dashboard"])
app.include_router(demo.router,          prefix="/api",        tags=["Demo"])
app.include_router(evidence.router,      prefix="/api",        tags=["Evidence"])
app.include_router(consistency.router,   prefix="/api",        tags=["Consistency"])
app.include_router(verification.router,  prefix="/api",        tags=["Verification"])
app.include_router(audit.router,         prefix="/api",        tags=["Audit"])
app.include_router(logistics.router,     prefix="/api",        tags=["Material Logistics"])
app.include_router(safety.router,        prefix="/api",        tags=["Worker Safety"])
app.include_router(events.router,        prefix="/api",        tags=["Real-Time Events"])
app.include_router(evm.router,           prefix="/api",        tags=["EVM & S-Curve"])
app.include_router(copilot.router,       prefix="/api",        tags=["AI Copilot"])



@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Catch-all handler â€” never expose raw stack traces to users."""
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

