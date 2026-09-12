"""
PROGRESSIQ — Evidence Service
Handles file validation, metadata extraction, and evidence linking.
"""
import json
import re
from pathlib import Path
from typing import Optional

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "pdf", "txt", "csv", "xlsx"}
MAX_SIZE_MB = 20


def validate_evidence_file(filename: str, size_bytes: int) -> tuple[bool, str]:
    """Returns (is_valid, error_message)."""
    if not filename:
        return False, "Filename is required."
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"File type '.{ext}' not supported. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
    if size_bytes > MAX_SIZE_MB * 1024 * 1024:
        return False, f"File exceeds {MAX_SIZE_MB}MB limit."
    return True, ""


def sanitize_filename(filename: str) -> str:
    """Remove dangerous characters from filenames."""
    safe = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    return Path(safe).name


def determine_evidence_type(filename: str, description: str = "") -> str:
    """Infer evidence type from extension and description."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    desc_lower = description.lower()
    if ext in {"jpg", "jpeg", "png", "gif"}:
        return "photo"
    if any(w in desc_lower for w in ("material", "delivery", "quantity", "steel", "cement", "pipe")):
        return "material_record"
    if any(w in desc_lower for w in ("equipment", "machine", "crane", "pump", "excavator")):
        return "equipment_record"
    return "document"


def analyze_photo_evidence(description: str) -> dict:
    """
    Mock AI analysis of photo evidence.
    Returns structured indicators without claiming exact percentages.
    [DEMO/SIMULATED] — production would use a vision model.
    """
    desc_lower = description.lower()
    keywords = {
        "reinforcement": "Reinforcement work visible", "rebar": "Reinforcement steel visible",
        "formwork": "Formwork visible", "concrete": "Concrete-related activity visible",
        "foundation": "Foundation construction visible", "column": "Column construction visible",
        "beam": "Beam construction visible", "excavation": "Excavation work visible",
        "pipe": "Pipe installation visible", "electrical": "Electrical work visible",
        "masonry": "Masonry work visible", "workers": "Site workers present",
        "equipment": "Construction equipment visible", "pump": "Pumping equipment visible",
    }
    detected = [label for kw, label in keywords.items() if kw in desc_lower]
    if not detected:
        detected = ["Construction site activity (details not identifiable from description alone)"]

    return {
        "detected_indicators": detected,
        "evidence_relevance": "High" if len(detected) >= 2 else "Medium",
        "progress_estimation": "Evidence supports activity execution, but is insufficient to independently estimate exact completion percentage.",
        "note": "[DEMO / SIMULATED] — In production, computer vision analysis would be applied."
    }
