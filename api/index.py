import os
import sys
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Add api directory to sys.path so app modules are always found
api_dir = os.path.dirname(os.path.abspath(__file__))
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from app.config import get_settings
from app.database.connection import create_all_tables, AsyncSessionLocal
from app.api.auth import seed_default_users

from app.api import (
    health, auth, projects, schedule, field_reports, field_updates,
    ai_routes, matching, dashboard, demo, evidence, consistency,
    verification, audit, logistics, safety, events, evm, copilot
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await create_all_tables()
        async with AsyncSessionLocal() as db:
            await seed_default_users(db)
        logger.info("✅ Database tables and default users initialized")
    except Exception as e:
        logger.warning(f"⚠️ Startup note: {e}")
    yield


app = FastAPI(
    title="PROGRESSIQ API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
@app.get("/health")
@app.get("/api/health")
async def root_health_check():
    return {
        "status": "healthy",
        "app": "PROGRESSIQ",
        "version": "2.0.0",
        "cloud": "vercel-serverless"
    }


# Register all API endpoints with /api prefix and root
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

