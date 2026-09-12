"""
PROGRESSIQ — Schedule Processor
Parses Excel (.xlsx, .xls), CSV, and JSON files into normalized ScheduleActivity dictionaries.
Provides comprehensive row-by-row validation and detailed import diagnostics without silently discarding rows.
"""
import pandas as pd
import json
import io
import logging
from datetime import datetime
from typing import Optional, Any

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
    df_lower = {str(c).lower().strip(): c for c in df.columns}
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
    for fmt in ("%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%b-%Y", "%d %b %Y", "%Y/%m/%d"):
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
        elif v <= 1.0 and v >= 0.0:
            return round(v * 100, 2)  # 0.55 → 55%
        elif v > 100.0:
            return 100.0
        return 0.0
    except (ValueError, TypeError):
        return 0.0


def _parse_bool(val) -> bool:
    """Parse milestone/boolean field."""
    if pd.isna(val) or val is None:
        return False
    return str(val).lower().strip() in ("yes", "true", "1", "y", "milestone", "m")


def parse_schedule_file(content: bytes, filename: str) -> tuple[list[dict], list[dict], int]:
    """
    Parse an Excel, CSV, or JSON schedule file.
    
    Returns:
        tuple of (valid_activities: list[dict], errors: list[dict], total_rows: int)
    """
    filename_lower = filename.lower()
    errors = []
    activities = []
    total_rows = 0

    # 1. Handle Primavera P6 .XER format
    if filename_lower.endswith(".xer"):
        from app.processors.p6_parser import parse_p6_xer
        p6_acts, p6_errs = parse_p6_xer(content)
        total_rows = len(p6_acts) + len(p6_errs)
        for act in p6_acts:
            activities.append({
                "activity_id": act["activity_id"],
                "activity_name": act["name"],
                "level": act.get("level", 2),
                "parent_id": None,
                "planned_start": _parse_date(act.get("planned_start")),
                "planned_finish": _parse_date(act.get("planned_finish")),
                "planned_progress": act.get("planned_progress", 0.0),
                "actual_progress": act.get("actual_progress", 0.0),
                "progress_variance": round(act.get("actual_progress", 0.0) - act.get("planned_progress", 0.0), 2),
                "dependency": None,
                "is_milestone": False,
                "status": act.get("status", "not_started"),
            })
        for idx, err in enumerate(p6_errs, start=1):
            errors.append({"row": idx, "reason": err})
        return activities, errors, total_rows

    # 2. Handle Primavera P6 XML format
    if filename_lower.endswith(".xml"):
        from app.processors.p6_parser import parse_p6_xml
        p6_acts, p6_errs = parse_p6_xml(content)
        total_rows = len(p6_acts) + len(p6_errs)
        for act in p6_acts:
            activities.append({
                "activity_id": act["activity_id"],
                "activity_name": act["name"],
                "level": act.get("level", 2),
                "parent_id": None,
                "planned_start": _parse_date(act.get("planned_start")),
                "planned_finish": _parse_date(act.get("planned_finish")),
                "planned_progress": act.get("planned_progress", 0.0),
                "actual_progress": act.get("actual_progress", 0.0),
                "progress_variance": round(act.get("actual_progress", 0.0) - act.get("planned_progress", 0.0), 2),
                "dependency": None,
                "is_milestone": False,
                "status": act.get("status", "not_started"),
            })
        for idx, err in enumerate(p6_errs, start=1):
            errors.append({"row": idx, "reason": err})
        return activities, errors, total_rows

    # 3. Handle JSON format
    if filename_lower.endswith(".json"):
        try:
            raw_data = json.loads(content.decode("utf-8"))
            if isinstance(raw_data, dict):
                items = raw_data.get("activities") or raw_data.get("tasks") or raw_data.get("data") or [raw_data]
            elif isinstance(raw_data, list):
                items = raw_data
            else:
                raise ValueError("JSON must be an array of activities or contain an 'activities' array.")
            
            total_rows = len(items)
            for idx, item in enumerate(items, start=1):
                name = item.get("activity_name") or item.get("name") or item.get("task")
                if not name or not str(name).strip():
                    errors.append({"row": idx, "reason": "Missing activity name"})
                    continue
                
                act_id = item.get("activity_id") or item.get("id") or f"ACT-{idx:04d}"
                plan_p = _parse_progress(item.get("planned_progress", 0))
                act_p = _parse_progress(item.get("actual_progress", 0))
                
                activities.append({
                    "activity_id": str(act_id).strip(),
                    "activity_name": str(name).strip(),
                    "level": int(item.get("level", 5)),
                    "parent_id": str(item.get("parent_id", "")).strip() or None,
                    "planned_start": _parse_date(item.get("planned_start")),
                    "planned_finish": _parse_date(item.get("planned_finish")),
                    "planned_progress": plan_p,
                    "actual_progress": act_p,
                    "progress_variance": round(act_p - plan_p, 2),
                    "dependency": str(item.get("dependency", "")).strip() or None,
                    "is_milestone": bool(item.get("is_milestone", False)),
                    "status": item.get("status", "not_started"),
                })
            return activities, errors, total_rows
        except Exception as e:
            raise ValueError(f"JSON parsing error: {e}")

    # 4. Handle CSV / Excel
    try:
        if filename_lower.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        elif filename_lower.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
        else:
            raise ValueError(f"Unsupported file format: {filename}. Please upload .xer, .xml, .xlsx, .xls, .csv, or .json")
    except Exception as e:
        raise ValueError(f"Could not read schedule file '{filename}': {e}")

    if df.empty:
        raise ValueError("The uploaded schedule file contains no rows.")

    df.columns = [str(c).strip() for c in df.columns]
    col = {key: _resolve_column(df, key) for key in COLUMN_ALIASES}
    
    if not col.get("activity_name"):
        raise ValueError("Could not find an 'Activity Name' / 'Task Description' column. Please check headers.")

    total_rows = len(df)
    for idx, (_, row) in enumerate(df.iterrows(), start=2):  # start=2 considering header is row 1
        def get(canonical, default=None):
            c = col.get(canonical)
            if c is None:
                return default
            val = row.get(c)
            if pd.isna(val) if not isinstance(val, str) else False:
                return default
            return val

        activity_name_raw = get("activity_name", "")
        activity_name = str(activity_name_raw).strip() if activity_name_raw is not None else ""
        if not activity_name or activity_name.lower() in ("nan", "none", ""):
            errors.append({"row": idx, "reason": "Empty activity name or blank line"})
            continue

        activity_id_raw = get("activity_id")
        activity_id = str(activity_id_raw).strip() if activity_id_raw else f"ACT-{len(activities)+1:04d}"

        planned_prog = _parse_progress(get("planned_progress", 0))
        actual_prog = _parse_progress(get("actual_progress", 0))
        variance = round(actual_prog - planned_prog, 2)

        # Status classification
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

    logger.info(f"Schedule parse complete for '{filename}': {len(activities)} valid activities, {len(errors)} errors")
    return activities, errors, total_rows
