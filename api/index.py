import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
possible_backend_paths = [
    os.path.join(current_dir, "backend"),
    os.path.join(current_dir, "..", "backend"),
    os.path.join(os.getcwd(), "backend"),
    os.path.join(os.getcwd(), "api", "backend"),
    os.path.join("/var/task", "backend"),
]

for p in possible_backend_paths:
    if os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)

try:
    from main import app
except Exception as e:
    import traceback
    err_trace = traceback.format_exc()
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    app = FastAPI(title="PROGRESSIQ Diagnostic Fallback")
    
    @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
    async def catch_all(path_name: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Backend initialization error",
                "detail": str(e),
                "cwd": os.getcwd(),
                "traceback": err_trace
            }
        )
