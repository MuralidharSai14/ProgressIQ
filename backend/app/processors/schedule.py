"""
PROGRESSIQ — Schedule Processor
Parses Excel/CSV files into ScheduleActivity objects.
Handles flexible column naming (different organizations use different headers).
"""
import pandas as pd
import io
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# Column name aliases — maps variations to canonical names
COLUMN_ALIASES = {
    "activity_id":       ["activity_id", "act_id", "id", "wbs", "code", "task_id", "item"],
    "activity_name":     ["activity_name", "name", "task", "description", "task_name", "activity", "title", "work_item"],
    "level":             ["level", "wbs_level", "hierarchy", "lvl"],
    "parent_id":         ["parent_id", "parent", "parent_activity", "wbs_parent"],
    "planned_start":     ["planned_start", "start", "plan_start", "baseline_start", "ps"],
    "planned_finish":    ["planned_finish", "finish", "end", "plan_finish", "baseline_finish", "pf"],
    "planned_progress":  ["planned_progress", "plan_pct", "planned_%", "baseline_progress", "plan_progress", "% planned", "planned %"],
    "actual_progress":   ["actual_progress", "actual_%", "actual_pct", "progress", "act_progress", "% actual", "actual %"],
    "dependency":        ["dependency", "predecessor", "predecessors", "depends_on"],
    "is_milestone":      ["milestone", "is_milestone", "key_milestone"],
    "status":            ["status", "activity_status", "task_status"],
}


def _resolve_column(df: pd.DataFrame, canonical: str) -> Optional[str]:
    """Find which column in the dataframe matches a canonical name."""
    aliases = COLUMN_ALIASES.get(canonical, [canonical])
    df_lower = {c.lower().strip(): c for c in df.columns}
    for alias in aliases:
        if alias.lower() in df_lower:
            return df_lower[alias.lower()]
    return None


def _parse_date(val) -> Optional[datetime]:
    """Try to parse a date value (handles strings, datetime, None)."""
    if pd.isna(val) or val is None or str(val).strip() in ("", "nan", "NaT"):
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, pd.Timestamp):
        return val.to_pydatetime()
    # Try common date formats
    for fmt in ("%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%b-%Y", "%d %b %Y"):
        try:
            return datetime.strptime(str(val).strip(), fmt)
        except ValueError:
            continue
    return None


def _parse_progress(val) -> float:
    """Parse a progress value to a 0–100 float."""
    if pd.isna(val) or val is None:
        return 0.0
    try:
        v = float(str(val).replace("%", "").strip())
        if v > 1.0 and v <= 100.0:
            return round(v, 2)
        elif v <= 1.0:
            return round(v * 100, 2)  # 0.55 → 55%
        return 0.0
    except (ValueError, TypeError):
        return 0.0


def _parse_bool(val) -> bool:
    """Parse milestone/boolean field."""
    if pd.isna(val) or val is None:
        return False
    return str(val).lower().strip() in ("yes", "true", "1", "y", "milestone", "m")


def parse_schedule_file(content: bytes, filename: str) -> list[dict]:
    """
    Parse an Excel or CSV schedule file.
    Returns a list of activity dicts ready for database insertion.

    Args:
        content: Raw file bytes
        filename: Original filename (used to detect file type)
    """
    filename_lower = filename.lower()
    try:
        if filename_lower.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        elif filename_lower.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
        else:
            raise ValueError(f"Unsupported file type: {filename}")
    except Exception as e:
        raise ValueError(f"Could not parse file '{filename}': {e}")

    if df.empty:
        raise ValueError("The uploaded schedule file is empty.")

    # Strip whitespace from column names
    df.columns = [str(c).strip() for c in df.columns]

    # Resolve column mappings
    col = {key: _resolve_column(df, key) for key in COLUMN_ALIASES}

    activities = []
    for _, row in df.iterrows():
        def get(canonical, default=None):
            c = col.get(canonical)
            if c is None:
                return default
            val = row.get(c)
            if pd.isna(val) if not isinstance(val, str) else False:
                return default
            return val

        activity_name = str(get("activity_name", "")).strip()
        if not activity_name or activity_name.lower() in ("nan", "none", ""):
            continue  # Skip blank rows

        activity_id_raw = get("activity_id")
        activity_id = str(activity_id_raw).strip() if activity_id_raw else f"ACT-{len(activities)+1:04d}"

        planned_prog = _parse_progress(get("planned_progress", 0))
        actual_prog = _parse_progress(get("actual_progress", 0))
        variance = round(actual_prog - planned_prog, 2)

        # Auto-classify status if not provided
        status_raw = str(get("status", "")).strip().lower()
        if status_raw in ("", "nan", "none"):
            if actual_prog >= 100:
                status = "completed"
            elif actual_prog == 0 and planned_prog == 0:
                status = "not_started"
            elif variance < -20:
                status = "delayed"
            elif actual_prog > 0:
                status = "in_progress"
            else:
                status = "not_started"
        else:
            STATUS_MAP = {
                "completed": "completed", "complete": "completed",
                "in progress": "in_progress", "in-progress": "in_progress",
                "delayed": "delayed", "behind": "delayed",
                "not started": "not_started",
            }
            status = STATUS_MAP.get(status_raw, "not_started")

        # Level
        level_raw = get("level")
        try:
            level = int(float(str(level_raw))) if level_raw is not None else 5
        except (ValueError, TypeError):
            level = 5

        act = {
            "activity_id": activity_id,
            "activity_name": activity_name,
            "level": level,
            "parent_id": str(get("parent_id", "")).strip() or None,
            "planned_start": _parse_date(get("planned_start")),
            "planned_finish": _parse_date(get("planned_finish")),
            "planned_progress": planned_prog,
            "actual_progress": actual_prog,
            "progress_variance": variance,
            "dependency": str(get("dependency", "")).strip() or None,
            "is_milestone": _parse_bool(get("is_milestone", False)),
            "status": status,
        }
        activities.append(act)

    if not activities:
        raise ValueError("No valid activities found in the uploaded file. Check column headers.")

    logger.info(f"Parsed {len(activities)} activities from '{filename}'")
    return activities
