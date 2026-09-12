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
    try:
        # 1. Initialize Database Tables
        await create_all_tables()
        logger.info("✅ Database tables ready")

        # 2. Seed Default Test User Accounts (Admin, PM, Site Engineer, Viewer)
        async with AsyncSessionLocal() as db:
            await seed_default_users(db)
        logger.info("✅ Default test users ready")
    except Exception as e:
        logger.warning(f"⚠️ Startup database initialization note: {e}")
    
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
if os.environ.get("VERCEL") or "/var/task" in os.getcwd():
    upload_path = "/tmp/uploads"
else:
    upload_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), settings.storage_local_dir)

try:
    os.makedirs(upload_path, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=upload_path), name="uploads")
except Exception as e:
    logger.warning(f"Static uploads mount note: {e}")

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

# Direct root health endpoints
@app.get("/")
@app.get("/health")
@app.get("/api/health")
async def root_health():
    return {
        "status": "healthy",
        "app": "PROGRESSIQ",
        "version": "2.0.0",
        "serverless": bool(os.environ.get("VERCEL"))
    }

# ── Register API Routes (Both /api prefix and root for universal cloud routing) ─
all_routers = [
    (health.router, "Health"),
    (auth.router, "Authentication"),
    (projects.router, "Projects"),
    (schedule.router, "Schedule"),
    (field_reports.router, "Field Reports"),
    (field_updates.router, "Live Field Updates"),
    (ai_routes.router, "AI Extraction"),
    (matching.router, "Activity Matching"),
    (dashboard.router, "Dashboard"),
    (demo.router, "Demo"),
    (evidence.router, "Evidence"),
    (consistency.router, "Consistency"),
    (verification.router, "Verification"),
    (audit.router, "Audit"),
    (logistics.router, "Material Logistics"),
    (safety.router, "Worker Safety"),
    (events.router, "Real-Time Events"),
    (evm.router, "EVM & S-Curve"),
    (copilot.router, "AI Copilot"),
]

for r, tag in all_routers:
    app.include_router(r, prefix="/api", tags=[tag])
    app.include_router(r, tags=[tag])



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

