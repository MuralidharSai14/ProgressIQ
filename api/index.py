import os
import sys
import json
import logging
import traceback
from http.server import BaseHTTPRequestHandler

# Ensure api directory is in sys.path
api_dir = os.path.dirname(os.path.abspath(__file__))
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_app_instance = None
_init_error = None

def get_app():
    global _app_instance, _init_error
    if _app_instance is not None:
        return _app_instance
    if _init_error is not None:
        return None
    try:
        from fastapi import FastAPI
        from fastapi.middleware.cors import CORSMiddleware
        from app.config import get_settings
        from app.api import (
            health, auth, projects, schedule, field_reports, field_updates,
            ai_routes, matching, dashboard, demo, evidence, consistency,
            verification, audit, logistics, safety, events, evm, copilot
        )

        app = FastAPI(title="PROGRESSIQ API", version="2.0.0")
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
        async def root_health():
            return {"status": "healthy", "app": "PROGRESSIQ", "version": "2.0.0", "cloud": "vercel"}

        all_routers = [
            (health.router, "Health"), (auth.router, "Authentication"),
            (projects.router, "Projects"), (schedule.router, "Schedule"),
            (field_reports.router, "Field Reports"), (field_updates.router, "Live Field Updates"),
            (ai_routes.router, "AI Extraction"), (matching.router, "Activity Matching"),
            (dashboard.router, "Dashboard"), (demo.router, "Demo"),
            (evidence.router, "Evidence"), (consistency.router, "Consistency"),
            (verification.router, "Verification"), (audit.router, "Audit"),
            (logistics.router, "Material Logistics"), (safety.router, "Worker Safety"),
            (events.router, "Real-Time Events"), (evm.router, "EVM & S-Curve"),
            (copilot.router, "AI Copilot"),
        ]
        for r, tag in all_routers:
            app.include_router(r, prefix="/api", tags=[tag])
            app.include_router(r, tags=[tag])

        _app_instance = app
        return _app_instance
    except Exception as e:
        _init_error = traceback.format_exc()
        logger.error(f"Failed to load FastAPI app: {e}\n{_init_error}")
        return None


# Standard Vercel Serverless HTTP Handler
class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        fastapi_app = get_app()
        if fastapi_app is not None and self.path in ("/api/health", "/health", "/"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            response = {"status": "healthy", "app": "PROGRESSIQ", "version": "2.0.0", "path": self.path}
            self.wfile.write(json.dumps(response).encode("utf-8"))
            return

        # If initialization error occurred, return the detailed traceback as JSON
        self.send_response(500 if _init_error else 200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        diag = {
            "status": "error" if _init_error else "ok",
            "init_error": _init_error,
            "path": self.path,
            "cwd": os.getcwd(),
            "sys_path": sys.path,
            "python_version": sys.version
        }
        self.wfile.write(json.dumps(diag, indent=2).encode("utf-8"))

    def do_POST(self):
        self.do_GET()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()


# Also export Mangum if supported
try:
    from mangum import Mangum
    _fa = get_app()
    if _fa:
        app = Mangum(_fa, lifespan="off")
    else:
        app = handler
except Exception:
    app = handler




