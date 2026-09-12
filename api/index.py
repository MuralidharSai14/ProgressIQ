"""
PROGRESSIQ — Vercel Serverless Entry Point
Uses http.server.BaseHTTPRequestHandler wrapping FastAPI via WSGI bridge.
"""
import os
import sys
import json
import io
import logging

# ── Path setup ────────────────────────────────────────────────────────────────
api_dir = os.path.dirname(os.path.abspath(__file__))
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

# ── Build FastAPI app ─────────────────────────────────────────────────────────
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

fastapi_app = FastAPI(
    title="PROGRESSIQ API",
    version="2.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register all routers ──────────────────────────────────────────────────────
try:
    from app.api import (
        health, auth, projects, schedule, field_reports, field_updates,
        ai_routes, matching, dashboard, demo, evidence, consistency,
        verification, audit, logistics, safety, events, evm, copilot
    )
    _routers = [
        (health.router,        "Health"),
        (auth.router,          "Authentication"),
        (projects.router,      "Projects"),
        (schedule.router,      "Schedule"),
        (field_reports.router, "Field Reports"),
        (field_updates.router, "Live Field Updates"),
        (ai_routes.router,     "AI Extraction"),
        (matching.router,      "Activity Matching"),
        (dashboard.router,     "Dashboard"),
        (demo.router,          "Demo"),
        (evidence.router,      "Evidence"),
        (consistency.router,   "Consistency"),
        (verification.router,  "Verification"),
        (audit.router,         "Audit"),
        (logistics.router,     "Material Logistics"),
        (safety.router,        "Worker Safety"),
        (events.router,        "Real-Time Events"),
        (evm.router,           "EVM & S-Curve"),
        (copilot.router,       "AI Copilot"),
    ]
    for router, tag in _routers:
        fastapi_app.include_router(router, prefix="/api", tags=[tag])
        fastapi_app.include_router(router, tags=[tag])
    logger.warning("All routers registered successfully.")
except Exception as e:
    logger.error(f"Router registration error: {e}", exc_info=True)


@fastapi_app.get("/")
@fastapi_app.get("/health")
@fastapi_app.get("/api/health")
async def root_health():
    return {"status": "healthy", "app": "PROGRESSIQ", "version": "2.0.0"}


# ── WSGI bridge via a2wsgi ────────────────────────────────────────────────────
from a2wsgi import ASGIMiddleware
app = ASGIMiddleware(fastapi_app)
