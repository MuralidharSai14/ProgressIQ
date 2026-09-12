"""
PROGRESSIQ — Unified Storage Service
Handles local disk uploads and cloud object storage (Supabase / S3 / R2).
Stores actual files persistently and returns accessible URLs.
"""
import os
import uuid
import logging
from pathlib import Path
from typing import Optional
import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Base upload directory for local storage
UPLOAD_DIR = Path(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))) / settings.storage_local_dir
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


async def save_file(
    content: bytes,
    original_filename: str,
    content_type: Optional[str] = None,
    folder: str = "evidence",
) -> tuple[str, int]:
    """
    Saves file bytes to the configured storage backend (local or cloud).
    
    Returns:
        tuple of (file_url: str, file_size: int)
    """
    file_size = len(content)
    ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else "bin"
    unique_name = f"{uuid.uuid4().hex[:12]}_{_sanitize(original_filename)}"

    # 1. Cloud Storage: Supabase Storage
    if settings.storage_provider.lower() == "supabase" and settings.supabase_url and settings.supabase_key:
        try:
            cloud_url = await _upload_to_supabase(content, unique_name, folder, content_type or "application/octet-stream")
            if cloud_url:
                return cloud_url, file_size
        except Exception as e:
            logger.error(f"Supabase upload failed: {e}. Falling back to local storage.")

    # 2. Local Storage Provider (Default & reliable fallback)
    target_folder = UPLOAD_DIR / folder
    target_folder.mkdir(parents=True, exist_ok=True)
    file_path = target_folder / unique_name

    with open(file_path, "wb") as f:
        f.write(content)

    # If public URL base is configured, prepend it; otherwise return standard /uploads/... path
    base = settings.public_url_base.rstrip("/") if settings.public_url_base else ""
    local_url = f"{base}/uploads/{folder}/{unique_name}"
    return local_url, file_size


async def _upload_to_supabase(content: bytes, filename: str, folder: str, content_type: str) -> Optional[str]:
    """Upload directly to Supabase Storage REST API."""
    supabase_url = settings.supabase_url.rstrip("/")
    bucket = settings.supabase_bucket
    target_path = f"{folder}/{filename}"
    upload_endpoint = f"{supabase_url}/storage/v1/object/{bucket}/{target_path}"

    headers = {
        "apikey": settings.supabase_key,
        "Authorization": f"Bearer {settings.supabase_key}",
        "Content-Type": content_type,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(upload_endpoint, content=content, headers=headers)
        if res.status_code in (200, 201):
            public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{target_path}"
            logger.info(f"✅ Uploaded to Supabase Storage: {public_url}")
            return public_url
        else:
            logger.warning(f"Supabase upload returned {res.status_code}: {res.text}")
            return None


def _sanitize(filename: str) -> str:
    import re
    safe = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    return safe
