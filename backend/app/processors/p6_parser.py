"""
PROGRESSIQ — Primavera P6 (.XER & .XML) Native Parser
Parses native Primavera P6 project files directly into structured activity lists.
Supports:
- Oracle Primavera P6 XER format (text/tab-delimited %T, %F, %R tables)
- Oracle Primavera P6 XML format (<Activity>, <WBS>, <Calendar>)
"""
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import List, Dict, Any, Tuple


def _clean_date_str(d_str: str | None) -> str | None:
    if not d_str or str(d_str).strip() in ("", "None", "null"):
        return None
    d_clean = str(d_str).strip().split()[0]
    for fmt in ("%Y-%m-%d", "%d-%b-%y", "%d-%b-%Y", "%d/%m/%Y", "%Y/%m/%d", "%m/%d/%Y"):
        try:
            parsed = datetime.strptime(d_clean, fmt)
            return parsed.strftime("%Y-%m-%d")
        except Exception:
            continue
    return d_clean


def parse_p6_xer(content_bytes: bytes) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Parse Primavera P6 .xer file content.
    Returns (activities, errors).
    """
    errors = []
    activities = []
    
    try:
        # XER files are typically Windows-1252 or UTF-8 encoded
        try:
            text = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = content_bytes.decode("windows-1252", errors="replace")

        lines = text.splitlines()
        current_table = None
        fields = []
        task_rows = []
        wbs_map = {}  # wbs_id -> wbs_name/code

        for line in lines:
            line = line.strip()
            if not line:
                continue

            if line.startswith("%T"):
                parts = line.split("\t")
                current_table = parts[1].strip() if len(parts) > 1 else line[2:].strip()
                fields = []
            elif line.startswith("%F") and current_table:
                parts = line.split("\t")
                fields = [p.strip().lower() for p in parts[1:] if p.strip()]
            elif line.startswith("%R") and current_table:
                parts = line.split("\t")[1:]
                row_dict = {}
                for idx, fld in enumerate(fields):
                    if idx < len(parts):
                        row_dict[fld] = parts[idx].strip()
                    else:
                        row_dict[fld] = ""

                if current_table == "PROJWBS":
                    wbs_id = row_dict.get("wbs_id")
                    wbs_name = row_dict.get("wbs_name") or row_dict.get("wbs_short_name", "")
                    if wbs_id:
                        wbs_map[wbs_id] = wbs_name
                elif current_table == "TASK":
                    task_rows.append(row_dict)

        # Now convert TASK rows into standard PROGRESSIQ activity schema
        for row in task_rows:
            task_code = row.get("task_code") or row.get("task_id", f"ACT-{len(activities)+1}")
            task_name = row.get("task_name") or "Unnamed Activity"
            
            # WBS code/name
            wbs_id = row.get("wbs_id")
            wbs_name = wbs_map.get(wbs_id, "WBS")

            # Dates
            start_date = _clean_date_str(row.get("target_start_date") or row.get("act_start_date") or row.get("early_start_date"))
            finish_date = _clean_date_str(row.get("target_end_date") or row.get("act_end_date") or row.get("early_end_date"))

            # Calculate duration
            duration = None
            if row.get("target_drtn_hr_cnt"):
                try:
                    duration = round(float(row.get("target_drtn_hr_cnt")) / 8.0, 1)
                except Exception:
                    pass
            elif start_date and finish_date:
                try:
                    d1 = datetime.strptime(start_date, "%Y-%m-%d")
                    d2 = datetime.strptime(finish_date, "%Y-%m-%d")
                    duration = max(1, (d2 - d1).days)
                except Exception:
                    duration = 10

            # Progress
            try:
                progress = float(row.get("phys_complete_pct", 0) or row.get("act_work_qty", 0) or 0)
            except Exception:
                progress = 0.0

            # Status determination
            status_code = row.get("status_code", "").upper()
            if status_code == "TK_COMPLETE" or progress >= 100.0:
                status = "completed"
            elif status_code == "TK_ACTIVE" or progress > 0.0:
                status = "in_progress"
            else:
                status = "not_started"

            activities.append({
                "activity_id": task_code,
                "name": task_name,
                "wbs_code": wbs_name,
                "level": 2,
                "planned_start": start_date,
                "planned_finish": finish_date,
                "planned_duration_days": duration or 10,
                "planned_progress": 100.0 if status == "completed" else (50.0 if status == "in_progress" else 0.0),
                "actual_progress": progress,
                "status": status,
                "is_critical": str(row.get("total_float_hr_cnt", "100")).strip() in ("0", "0.0", "0.00"),
            })

    except Exception as e:
        errors.append(f"Error parsing Primavera XER: {str(e)}")

    return activities, errors


def parse_p6_xml(content_bytes: bytes) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Parse Primavera P6 XML file content.
    Returns (activities, errors).
    """
    errors = []
    activities = []

    try:
        root = ET.fromstring(content_bytes)

        # XML namespace handling
        ns = {}
        if "}" in root.tag:
            ns["p6"] = root.tag.split("}")[0].strip("{")
            prefix = "p6:"
        else:
            prefix = ""

        # Find all Activity nodes
        activity_nodes = root.findall(f".//{prefix}Activity", ns) if ns else root.findall(".//Activity")

        for act in activity_nodes:
            def _get_text(tag_name: str) -> str | None:
                el = act.find(f"{prefix}{tag_name}", ns) if ns else act.find(tag_name)
                return el.text.strip() if el is not None and el.text else None

            code = _get_text("Id") or _get_text("ActivityId") or f"ACT-{len(activities)+1}"
            name = _get_text("Name") or _get_text("ActivityName") or "Unnamed Activity"
            wbs = _get_text("WBSCode") or _get_text("WBSName") or "General"
            
            start_date = _clean_date_str(_get_text("PlannedStartDate") or _get_text("StartDate") or _get_text("ActualStartDate"))
            finish_date = _clean_date_str(_get_text("PlannedFinishDate") or _get_text("FinishDate") or _get_text("ActualFinishDate"))

            pct_str = _get_text("PercentComplete") or _get_text("PhysicalPercentComplete") or "0"
            try:
                pct = float(pct_str)
            except Exception:
                pct = 0.0

            status_str = (_get_text("Status") or "").lower()
            if "complete" in status_str or pct >= 100.0:
                status = "completed"
            elif "progress" in status_str or pct > 0.0:
                status = "in_progress"
            else:
                status = "not_started"

            duration_days = 10
            if start_date and finish_date:
                try:
                    d1 = datetime.strptime(start_date, "%Y-%m-%d")
                    d2 = datetime.strptime(finish_date, "%Y-%m-%d")
                    duration_days = max(1, (d2 - d1).days)
                except Exception:
                    pass

            activities.append({
                "activity_id": code,
                "name": name,
                "wbs_code": wbs,
                "level": 2,
                "planned_start": start_date,
                "planned_finish": finish_date,
                "planned_duration_days": duration_days,
                "planned_progress": 100.0 if status == "completed" else 0.0,
                "actual_progress": pct,
                "status": status,
                "is_critical": False,
            })

    except Exception as e:
        errors.append(f"Error parsing Primavera XML: {str(e)}")

    return activities, errors
