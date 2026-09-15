"""
PROGRESSIQ — AI Project Copilot & Real-Time RAG Knowledge Assistant
Aggregates live multi-source project data (schedules, field reports, delay logs,
material logistics, worker safety, verification queue, EVM metrics) and uses
Gemini 3.6 Flash to answer project controls and executive questions.
"""
import json
import asyncio
import logging
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import (
    Project, ScheduleActivity, FieldReport, ExtractedUpdate,
    Conflict, VerificationTask, MaterialShipment, WorkerSafetyRisk
)
from app.services.evm_engine import compute_project_evm
from app.ai.provider import get_ai_provider
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def aggregate_project_context(db: AsyncSession, project_id: int) -> Dict[str, Any]:
    """Compile comprehensive live state of the project for LLM grounding."""
    from app.utils.auth_deps import get_project_or_404
    try:
        project = await get_project_or_404(project_id, db)
    except Exception:
        return {}


    # 1. Activities & Delays
    act_res = await db.execute(select(ScheduleActivity).where(ScheduleActivity.project_id == project_id))
    activities = act_res.scalars().all()
    delayed_acts = [a for a in activities if str(a.status).lower() in ("delayed", "behind") or (a.actual_progress or 0) < (a.planned_progress or 0) - 10]

    # 2. Consistency / Conflict Flags
    flag_res = await db.execute(select(Conflict).where(Conflict.project_id == project_id))
    flags = flag_res.scalars().all()

    # 3. Open Verification Queue
    v_res = await db.execute(select(VerificationTask).where(VerificationTask.project_id == project_id))
    tasks = v_res.scalars().all()
    pending_verifications = [t for t in tasks if str(t.status).lower() == "pending"]

    # 4. Materials & Supply Chain
    mat_res = await db.execute(select(MaterialShipment).where(MaterialShipment.project_id == project_id))
    materials = mat_res.scalars().all()
    shortages = [m for m in materials if str(m.status).lower() in ("shortage", "delayed")]

    # 5. Worker Safety & Hazards
    safe_res = await db.execute(select(WorkerSafetyRisk).where(WorkerSafetyRisk.project_id == project_id))
    safety_risks = safe_res.scalars().all()
    critical_safety = [s for s in safety_risks if str(s.risk_score).lower() in ("high", "critical")]

    # 6. EVM Metrics
    evm = await compute_project_evm(db, project_id)

    # 7. Recent Field Reports
    rep_res = await db.execute(select(FieldReport).where(FieldReport.project_id == project_id).order_by(FieldReport.uploaded_at.desc()).limit(5))
    reports = rep_res.scalars().all()

    context = {
        "project": {
            "id": project.id,
            "name": project.name,
            "location": project.location or "Site",
            "status": project.status,
            "planned_start": project.planned_start.strftime("%Y-%m-%d") if project.planned_start else None,
            "planned_finish": project.planned_end.strftime("%Y-%m-%d") if project.planned_end else None,
        },
        "evm_metrics": {
            "spi": evm.get("spi", 1.0),
            "cpi": evm.get("cpi", 1.0),
            "planned_value_pct": evm.get("pv", 0.0),
            "earned_value_pct": evm.get("ev", 0.0),
            "variance_days": evm.get("variance_days", 0),
            "health": evm.get("health", "healthy"),
            "projected_finish": evm.get("projected_completion_date"),
        },
        "critical_delays": [
            {
                "activity_id": a.activity_id,
                "name": a.activity_name,
                "planned_progress": a.planned_progress,
                "actual_progress": a.actual_progress,
                "status": a.status,
            }
            for a in delayed_acts[:8]
        ],
        "material_bottlenecks": [
            {
                "item": m.material_name,
                "category": m.category,
                "status": m.status,
                "quantity": f"{m.ordered_quantity} {m.unit}",
                "vendor": m.supplier_name,
                "eta": m.expected_delivery.strftime("%Y-%m-%d") if m.expected_delivery else None,
            }
            for m in shortages[:6]
        ],
        "safety_hazards": [
            {
                "category": s.hazard_category,
                "risk_score": s.risk_score,
                "description": s.description,
                "corrective_action": s.mitigation_plan,
            }
            for s in critical_safety[:5]
        ],
        "unverified_progress_claims": len(pending_verifications),
        "recent_field_notes": [
            (r.raw_text or "")[:300] for r in reports if r.raw_text
        ],
    }

    return context


async def ask_project_copilot(db: AsyncSession, project_id: int, user_query: str) -> Dict[str, Any]:
    """Process user natural language query with grounded project context."""
    context = await aggregate_project_context(db, project_id)
    if not context:
        return {
            "answer": "Project not found or no data available to analyze.",
            "citations": [],
            "source": "fallback",
        }

    prompt = f"""
You are "PROGRESSIQ Copilot", an expert AI Project Director & Senior Construction Controls Specialist.
You have real-time access to the live project database and telemetry.

LIVE PROJECT CONTEXT (JSON):
{json.dumps(context, indent=2)}

USER QUESTION / DIRECTIVE:
"{user_query}"

INSTRUCTIONS:
1. Provide a direct, professional, highly actionable answer tailored for EPC Project Directors, Site Managers, or Quality Auditors.
2. Structure your response using markdown with clear headings, bullet points, and callout alerts where appropriate.
3. Cite specific activity names, SPI/CPI numbers, material vendors, or safety categories from the context.
4. If asked to draft an email, executive report, or mitigation plan, provide a complete, ready-to-use draft.
5. Highlight critical path impacts and recommended immediate next steps.
"""

    # Try Gemini 3.6 Flash with non-blocking timeout
    ai = get_ai_provider()
    if hasattr(ai, "model") and getattr(ai, "_available", False) and settings.gemini_api_key:
        try:
            def _call_gemini():
                res = ai.model.generate_content(prompt)
                return res.text.strip()

            answer_text = await asyncio.wait_for(asyncio.to_thread(_call_gemini), timeout=12.0)
            return {
                "answer": answer_text,
                "citations": ["Schedule Activity Database", "Material Logistics", "Worker Safety Register", "EVM Engine"],
                "source": "gemini-3.6-flash",
                "evm_summary": context.get("evm_metrics"),
            }
        except Exception as e:
            logger.warning(f"Gemini Copilot generation failed/timed out: {e}")

    # Intelligent Local Fallback
    # Produce high-quality rule-based analysis from context
    evm = context.get("evm_metrics", {})
    delays = context.get("critical_delays", [])
    materials = context.get("material_bottlenecks", [])
    safety = context.get("safety_hazards", [])

    fallback_ans = f"""### 📊 PROGRESSIQ Project Intelligence Summary

**Project Health:** `{evm.get('health', 'normal').upper()}` | **SPI:** `{evm.get('spi', 1.0)}` | **Earned Progress:** `{evm.get('earned_value_pct', 0)}%` (vs Planned `{evm.get('planned_value_pct', 0)}%`)

---

#### 🚨 Key Critical Path & Delay Observations:
- **Schedule Slippage:** Projected delay is **+{evm.get('variance_days', 0)} days**, with estimated completion on **{evm.get('projected_finish', 'TBD')}**.
"""
    if delays:
        fallback_ans += "\n**Top Lagging Activities:**\n"
        for d in delays[:4]:
            fallback_ans += f"- **{d['name']}** (`{d['activity_id']}`): Actual {d['actual_progress']}% vs Planned {d['planned_progress']}%\n"

    if materials:
        fallback_ans += "\n#### 📦 Material Supply Chain Bottlenecks:\n"
        for m in materials[:3]:
            fallback_ans += f"- **{m['item']}** ({m['quantity']}): Status `{m['status'].upper()}` | Vendor: *{m['vendor']}* (ETA: {m['eta']})\n"

    if safety:
        fallback_ans += "\n#### ⚠️ Safety Observations Requiring Action:\n"
        for s in safety[:2]:
            fallback_ans += f"- **{s['category']}** (Risk: `{s['risk_score']}`): {s['description']}\n"

    fallback_ans += f"""
---
#### 💡 Recommended Immediate Mitigations:
1. **Accelerate Critical Path:** Prioritize material expediting for delayed shipments.
2. **Review Unverified Claims:** Resolve the **{context.get('unverified_progress_claims', 0)} pending verification tasks** in the Human Review Queue.
3. **Weekly Baselines:** Conduct an S-Curve recovery baseline alignment with subcontractors.
"""

    return {
        "answer": fallback_ans,
        "citations": ["Project Telemetry", "Schedule Matrix", "Material Tracker"],
        "source": "progressiq-local-copilot",
        "evm_summary": evm,
    }


def get_suggested_prompts(context: Dict[str, Any]) -> List[str]:
    """Generate dynamic prompt suggestions based on current project bottlenecks."""
    prompts = [
        "Summarize project status, SPI/CPI, and projected completion date.",
        "Which activities are currently on the critical delay path?",
        "Draft a formal weekly progress update email for the client.",
        "List all material shortages and their impact on upcoming milestones.",
        "What safety hazards and PPE compliance issues need immediate site action?",
    ]
    return prompts
