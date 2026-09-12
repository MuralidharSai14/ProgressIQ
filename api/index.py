"""
PROGRESSIQ — Vercel Serverless Entry Point
"""
import os
import sys
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
from fastapi.responses import JSONResponse

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


@fastapi_app.get("/")
@fastapi_app.get("/health")
@fastapi_app.get("/api/health")
async def root_health():
    return {"status": "healthy", "app": "PROGRESSIQ", "version": "2.0.0"}


# ── Register routers one-by-one so a single failure doesn't kill the rest ────
_ROUTER_MODULES = [
    ("app.api.health",        "health"),
    ("app.api.auth",          "auth"),
    ("app.api.projects",      "projects"),
    ("app.api.schedule",      "schedule"),
    ("app.api.field_reports", "field_reports"),
    ("app.api.field_updates", "field_updates"),
    ("app.api.ai_routes",     "ai_routes"),
    ("app.api.matching",      "matching"),
    ("app.api.dashboard",     "dashboard"),
    ("app.api.demo",          "demo"),
    ("app.api.evidence",      "evidence"),
    ("app.api.consistency",   "consistency"),
    ("app.api.verification",  "verification"),
    ("app.api.audit",         "audit"),
    ("app.api.logistics",     "logistics"),
    ("app.api.safety",        "safety"),
    ("app.api.events",        "events"),
    ("app.api.evm",           "evm"),
    ("app.api.copilot",       "copilot"),
]

_router_errors = {}

for module_path, attr in _ROUTER_MODULES:
    try:
        import importlib
        mod = importlib.import_module(module_path)
        router = getattr(mod, "router")
        fastapi_app.include_router(router, prefix="/api")
        fastapi_app.include_router(router)
    except Exception as exc:
        _router_errors[module_path] = str(exc)
        logger.error(f"Router load failed [{module_path}]: {exc}", exc_info=True)

if _router_errors:
    logger.error(f"Failed routers: {list(_router_errors.keys())}")


@fastapi_app.get("/api/debug/routers")
async def debug_routers():
    """Diagnostic: shows which routers failed to load."""
    return {
        "router_errors": _router_errors,
        "total_routes": len(fastapi_app.routes),
        "failed_count": len(_router_errors),
    }


# ── WSGI bridge ────────────────────────────────────────────────────────────────
from a2wsgi import ASGIMiddleware
app = ASGIMiddleware(fastapi_app)
