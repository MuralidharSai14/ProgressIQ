"""
PROGRESSIQ — AI Provider Abstraction Layer
This module decides WHICH AI to use based on the AI_PROVIDER env var.
It supports three modes:
  - "mock"   → built-in deterministic responses (no API key needed, works in demo)
  - "gemini" → Google Gemini API
  - "openai" → OpenAI API (future)

WHY an abstraction layer?
So we can swap AI providers without changing any other code.
"""
from app.config import get_settings
import json
import random


settings = get_settings()


# ── Structured extraction schema ──────────────────────────────────────────────

EXTRACTION_SCHEMA = {
    "activity_description": str,
    "status": str,           # "Not Started" | "In Progress" | "Delayed" | "Completed"
    "progress": float,       # 0-100
    "actual_start": str,
    "actual_finish": str,
    "delay_reason": str,
    "delay_category": str,   # Material | Labour | Equipment | Weather | Approval | ...
    "risk_level": str,       # Low | Medium | High | Critical
    "dependency_mentioned": str,
}


# ── Mock AI Provider ──────────────────────────────────────────────────────────
# Produces realistic-looking outputs from a keyword-based analysis
# NO REAL AI — but structured so the real one is a drop-in replacement

class MockAIProvider:
    """
    Deterministic mock AI for demo mode.
    Uses keyword analysis + structured templates.
    Always works. No API key. Fast.
    """
    name = "mock"

    # Keyword → category mapping
    DELAY_KEYWORDS = {
        "material": "Material",
        "supply": "Material",
        "delivery": "Material",
        "cement": "Material",
        "steel": "Material",
        "pipe": "Material",
        "equipment": "Equipment",
        "machine": "Equipment",
        "crane": "Equipment",
        "excavator": "Equipment",
        "weather": "Weather",
        "rain": "Weather",
        "flood": "Weather",
        "monsoon": "Weather",
        "labour": "Labour",
        "labor": "Labour",
        "worker": "Labour",
        "manpower": "Labour",
        "staff": "Labour",
        "approval": "Approval",
        "permit": "Approval",
        "clearance": "Approval",
        "inspection": "Approval",
        "contractor": "Contractor",
        "subcontractor": "Contractor",
        "vendor": "Contractor",
    }

    STATUS_KEYWORDS = {
        "completed": "Completed",
        "complete": "Completed",
        "finished": "Completed",
        "done": "Completed",
        "delayed": "Delayed",
        "behind": "Delayed",
        "slow": "Delayed",
        "halted": "Delayed",
        "stopped": "Delayed",
        "progressing": "In Progress",
        "ongoing": "In Progress",
        "underway": "In Progress",
        "started": "In Progress",
        "commenced": "In Progress",
        "not started": "Not Started",
        "yet to": "Not Started",
        "pending": "Not Started",
    }

    def _detect_delay_category(self, text: str) -> str:
        lower = text.lower()
        for keyword, category in self.DELAY_KEYWORDS.items():
            if keyword in lower:
                return category
        return "Unknown"

    def _detect_status(self, text: str) -> str:
        lower = text.lower()
        for keyword, status in self.STATUS_KEYWORDS.items():
            if keyword in lower:
                return status
        return "In Progress"

    def _extract_progress(self, text: str) -> float:
        """Try to extract a percentage from text, otherwise estimate from status."""
        import re
        matches = re.findall(r'(\d+)\s*%', text)
        if matches:
            val = float(matches[0])
            return min(100.0, max(0.0, val))
        status = self._detect_status(text)
        estimates = {
            "Completed": 100.0,
            "In Progress": random.uniform(30, 70),
            "Delayed": random.uniform(20, 55),
            "Not Started": 0.0,
        }
        return round(estimates.get(status, 40.0), 1)

    def _extract_description(self, text: str) -> str:
        """Take first sentence / first 120 chars as the activity description."""
        import re
        sentences = re.split(r'[.!?]', text.strip())
        first = sentences[0].strip() if sentences else text.strip()
        return first[:200] if len(first) > 200 else first

    async def extract_field_update(self, text: str) -> dict:
        """
        Parse unstructured field text → structured dict.
        In real mode this calls Gemini. In mock mode it uses keyword analysis.
        """
        status = self._detect_status(text)
        progress = self._extract_progress(text)
        delay_category = self._detect_delay_category(text)
        is_delayed = status == "Delayed" or delay_category != "Unknown"

        delay_reason = None
        if is_delayed:
            cat_phrases = {
                "Material": "Material delivery delays affecting progress",
                "Labour": "Insufficient manpower available on site",
                "Equipment": "Equipment malfunction / non-availability",
                "Weather": "Adverse weather conditions causing stoppage",
                "Approval": "Pending regulatory approvals / permits",
                "Contractor": "Contractor-related delays",
                "Unknown": "Delay reason not clearly specified in report",
            }
            delay_reason = cat_phrases.get(delay_category, "Unspecified delay")

        risk_levels = {"Completed": "Low", "In Progress": "Low",
                       "Delayed": "Medium", "Not Started": "Low"}
        risk_level = risk_levels.get(status, "Low")
        if delay_category in ("Equipment", "Approval") and is_delayed:
            risk_level = "High"

        return {
            "activity_description": self._extract_description(text),
            "status": status,
            "progress": progress,
            "actual_start": None,
            "actual_finish": None if status != "Completed" else "As reported",
            "delay_reason": delay_reason,
            "delay_category": delay_category if is_delayed else None,
            "risk_level": risk_level,
            "dependency_mentioned": None,
            "extraction_confidence": round(random.uniform(78, 93), 1),
            "ai_provider": "mock",
        }

    async def generate_recommendations(self, context: dict) -> list[str]:
        """Generate actionable recommendations based on project context."""
        recs = []
        if context.get("critical_count", 0) > 0:
            recs.append(f"⚠️ {context['critical_count']} activity(ies) are in CRITICAL state — immediate escalation recommended.")
        if context.get("delayed_count", 0) > 0:
            recs.append(f"Consider reviewing material procurement timelines — {context.get('delayed_count', 0)} activities are behind schedule.")
        if context.get("pending_reviews", 0) > 0:
            recs.append(f"Review Queue has {context['pending_reviews']} unreviewed AI matches — validate before using data for decisions.")
        top_delay = context.get("top_delay_category")
        if top_delay:
            recs.append(f"Top delay driver is '{top_delay}' — engage procurement/logistics team proactively.")
        if context.get("variance", 0) < -15:
            recs.append("Overall project is more than 15% behind plan — consider a schedule re-baseline review.")
        if not recs:
            recs.append("Project is progressing within acceptable thresholds — continue monitoring.")
        return recs


# ── Gemini AI Provider ────────────────────────────────────────────────────────

class GeminiAIProvider:
    """
    Google Gemini API provider.
    Requires GEMINI_API_KEY in .env and AI_PROVIDER=gemini.
    """
    name = "gemini"

    def __init__(self):
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel("gemini-1.5-flash")
            self._available = True
        except Exception:
            self._available = False
            self._fallback = MockAIProvider()

    async def extract_field_update(self, text: str) -> dict:
        if not self._available or not settings.gemini_api_key:
            return await self._fallback.extract_field_update(text)

        prompt = f"""
You are an AI assistant for an infrastructure project management system.
Analyze the following field report text and extract structured information.

FIELD REPORT TEXT:
{text}

Return ONLY a valid JSON object with these exact keys (use null for missing values):
{{
  "activity_description": "brief description of the activity being reported",
  "status": "Not Started|In Progress|Delayed|Completed",
  "progress": 0-100 (numeric percentage),
  "actual_start": "date string or null",
  "actual_finish": "date string or null",
  "delay_reason": "reason for delay or null",
  "delay_category": "Material|Labour|Equipment|Weather|Approval|Dependency|Contractor|External|Unknown|null",
  "risk_level": "Low|Medium|High|Critical",
  "dependency_mentioned": "any mentioned dependency or null",
  "extraction_confidence": 0-100 (your confidence in this extraction)
}}

Return ONLY the JSON object. No explanations.
"""
        try:
            response = self.model.generate_content(prompt)
            raw = response.text.strip()
            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            result = json.loads(raw.strip())
            result["ai_provider"] = "gemini"
            result["extraction_confidence"] = float(result.get("extraction_confidence", 85))
            return result
        except Exception as e:
            # If Gemini fails, fall back to mock
            result = await MockAIProvider().extract_field_update(text)
            result["ai_provider"] = "gemini-fallback-mock"
            return result

    async def generate_recommendations(self, context: dict) -> list[str]:
        if not self._available or not settings.gemini_api_key:
            return await MockAIProvider().generate_recommendations(context)

        prompt = f"""
You are an AI assistant for an infrastructure project management system.
Based on the following project status context, generate 3-5 brief, actionable recommendations.
Use language like "Consider reviewing", "Flagged for attention", "Potential action".
Do NOT claim certainty. Keep each recommendation to 1-2 sentences.

Context: {json.dumps(context)}

Return ONLY a JSON array of strings. No markdown.
"""
        try:
            response = self.model.generate_content(prompt)
            raw = response.text.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            return json.loads(raw.strip())
        except Exception:
            return await MockAIProvider().generate_recommendations(context)


# ── Factory ───────────────────────────────────────────────────────────────────

def get_ai_provider():
    """Return the appropriate AI provider based on settings."""
    provider = settings.ai_provider.lower()
    if provider == "gemini" and settings.gemini_api_key:
        return GeminiAIProvider()
    return MockAIProvider()
