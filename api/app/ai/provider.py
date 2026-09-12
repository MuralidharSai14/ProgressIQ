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
import asyncio
import logging

logger = logging.getLogger(__name__)

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
    "material_updates": list,  # List of {name, category, status, quantity_note}
    "safety_hazards": list,    # List of {category, risk_score, description, ppe}
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

    # Material mentions → (category, default_unit)
    MATERIAL_KEYWORDS = {
        "steel": ("Steel", "MT"),
        "rebar": ("Steel", "MT"),
        "structural steel": ("Steel", "MT"),
        "concrete": ("Concrete", "m³"),
        "cement": ("Concrete", "MT"),
        "rcc": ("Concrete", "m³"),
        "pipe": ("Piping", "m"),
        "piping": ("Piping", "m"),
        "cable": ("Electrical", "m"),
        "electrical": ("Electrical", "nos"),
        "transformer": ("Electrical", "nos"),
        "valve": ("Piping", "nos"),
        "fitting": ("Piping", "nos"),
        "bolt": ("Consumables", "nos"),
        "nut": ("Consumables", "nos"),
        "chemical": ("Chemicals", "kg"),
        "solvent": ("Chemicals", "L"),
        "gravel": ("Civil", "m³"),
        "sand": ("Civil", "m³"),
        "brick": ("Civil", "nos"),
        "instrument": ("Instrumentation", "nos"),
        "sensor": ("Instrumentation", "nos"),
    }

    # Safety hazard trigger phrases → category
    SAFETY_KEYWORDS = {
        "working at height": ("Working at Height", "high"),
        "scaffolding": ("Working at Height", "high"),
        "fall": ("Working at Height", "critical"),
        "excavation": ("Excavation", "high"),
        "trench": ("Excavation", "high"),
        "electrical hazard": ("Electrical Hazard", "high"),
        "live wire": ("Electrical Hazard", "critical"),
        "shock": ("Electrical Hazard", "high"),
        "crane": ("Heavy Equipment", "medium"),
        "heavy equipment": ("Heavy Equipment", "medium"),
        "lifting": ("Heavy Equipment", "medium"),
        "chemical exposure": ("Chemical Exposure", "high"),
        "toxic": ("Chemical Exposure", "critical"),
        "fire": ("Fire & Explosion", "critical"),
        "explosion": ("Fire & Explosion", "critical"),
        "welding": ("Fire & Explosion", "medium"),
        "confined space": ("Confined Space", "high"),
        "underground": ("Confined Space", "medium"),
        "manual handling": ("Manual Handling", "low"),
        "heavy lifting": ("Manual Handling", "medium"),
        "noise": ("Noise & Vibration", "low"),
        "vibration": ("Noise & Vibration", "low"),
        "injured": ("General Site", "critical"),
        "accident": ("General Site", "critical"),
        "unsafe": ("General Site", "high"),
        "hazard": ("General Site", "medium"),
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

    def _extract_material_updates(self, text: str) -> list:
        """Detect material mentions in text and return structured list."""
        lower = text.lower()
        found = []
        seen_categories = set()
        for keyword, (category, unit) in self.MATERIAL_KEYWORDS.items():
            if keyword in lower and category not in seen_categories:
                seen_categories.add(category)
                is_shortage = any(w in lower for w in ["shortage", "short", "insufficient", "unavailable", "not available", "delayed"])
                is_delivered = any(w in lower for w in ["delivered", "received", "arrived", "dispatched"])
                status = "shortage" if is_shortage else ("delivered" if is_delivered else "in_transit")
                found.append({
                    "name": keyword.title(),
                    "category": category,
                    "unit": unit,
                    "status": status,
                    "quantity_note": f"Mentioned in field report ({keyword})",
                })
        return found

    def _extract_safety_hazards(self, text: str) -> list:
        """Detect safety hazard mentions and return structured list."""
        lower = text.lower()
        found = []
        seen_categories = set()
        # PPE mapping per category
        ppe_map = {
            "Working at Height": ["Safety Harness", "Helmet", "Non-slip Footwear", "Safety Net"],
            "Excavation": ["Helmet", "Steel-toe Boots", "Hi-Vis Vest", "Shoring Equipment"],
            "Electrical Hazard": ["Insulated Gloves", "Arc Flash PPE", "Helmet", "Insulated Footwear"],
            "Heavy Equipment": ["Helmet", "Hi-Vis Vest", "Steel-toe Boots", "Signal Person"],
            "Chemical Exposure": ["Chemical Resistant Gloves", "Respirator", "Face Shield", "Protective Suit"],
            "Fire & Explosion": ["Fire-Resistant Clothing", "Face Shield", "Gloves", "Fire Extinguisher"],
            "Confined Space": ["SCBA/Respirator", "Gas Detector", "Safety Harness", "Lifeline"],
            "Manual Handling": ["Back Support Belt", "Safety Gloves", "Steel-toe Boots"],
            "Noise & Vibration": ["Earplugs", "Ear Muffs", "Anti-Vibration Gloves"],
            "General Site": ["Helmet", "Hi-Vis Vest", "Steel-toe Boots", "Safety Gloves"],
        }
        for keyword, (category, risk_score) in self.SAFETY_KEYWORDS.items():
            if keyword in lower and category not in seen_categories:
                seen_categories.add(category)
                found.append({
                    "category": category,
                    "risk_score": risk_score,
                    "description": f"{category} hazard detected from field report mention of '{keyword}'",
                    "ppe": ppe_map.get(category, ["Helmet", "Hi-Vis Vest", "Safety Boots"]),
                })
        return found

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
            "material_updates": self._extract_material_updates(text),
            "safety_hazards": self._extract_safety_hazards(text),
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
            
            # Select working model with fallbacks
            self.model = None
            for model_name in ["gemini-3.6-flash", "gemini-flash-latest", "gemini-3.5-flash", "gemini-2.5-flash-lite"]:
                try:
                    self.model = genai.GenerativeModel(model_name)
                    break
                except Exception:
                    continue
            
            if self.model is None:
                self.model = genai.GenerativeModel("gemini-3.6-flash")
                
            self._available = True
        except Exception as e:
            logger.warning(f"Failed to initialize Gemini AI: {e}")
            self._available = False
            self._fallback = MockAIProvider()

    def _sync_generate(self, prompt: str) -> str:
        """Helper to run synchronous Gemini generation."""
        response = self.model.generate_content(prompt)
        return response.text.strip()

    async def extract_field_update(self, text: str) -> dict:
        if not self._available or not settings.gemini_api_key:
            return await MockAIProvider().extract_field_update(text)

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
  "extraction_confidence": 0-100 (your confidence in this extraction),
  "material_updates": [
    {{"name": "material name", "category": "Steel|Concrete|Piping|Electrical|Civil|Structural|Mechanical|Instrumentation|Chemicals|Consumables|Other", "unit": "MT|m³|m|nos|kg|L", "status": "ordered|in_transit|delivered|delayed|shortage", "quantity_note": "brief note"}}
  ],
  "safety_hazards": [
    {{"category": "Working at Height|Excavation|Electrical Hazard|Heavy Equipment|Chemical Exposure|Fire & Explosion|Confined Space|Manual Handling|Noise & Vibration|General Site", "risk_score": "low|medium|high|critical", "description": "brief description", "ppe": ["PPE item 1", "PPE item 2"]}}
  ]
}}

Return ONLY the JSON object. No explanations.
"""
        try:
            # Run in thread pool with 9-second timeout to prevent frontend hangs
            raw = await asyncio.wait_for(
                asyncio.to_thread(self._sync_generate, prompt),
                timeout=9.0
            )
            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            result = json.loads(raw.strip())
            result["ai_provider"] = "gemini"
            result["extraction_confidence"] = float(result.get("extraction_confidence", 88))
            result.setdefault("material_updates", [])
            result.setdefault("safety_hazards", [])
            return result
        except asyncio.TimeoutError:
            logger.warning("Gemini AI extraction timed out, falling back to mock parser")
            result = await MockAIProvider().extract_field_update(text)
            result["ai_provider"] = "gemini-timeout-fallback"
            return result
        except Exception as e:
            logger.warning(f"Gemini AI extraction failed: {e}, falling back to mock parser")
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
            raw = await asyncio.wait_for(
                asyncio.to_thread(self._sync_generate, prompt),
                timeout=9.0
            )
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            return json.loads(raw.strip())
        except Exception as e:
            logger.warning(f"Gemini AI recommendations failed: {e}, falling back to mock")
            return await MockAIProvider().generate_recommendations(context)


# ── Factory ───────────────────────────────────────────────────────────────────

def get_ai_provider():
    """Return the appropriate AI provider based on settings."""
    provider = settings.ai_provider.lower()
    if provider == "gemini" and settings.gemini_api_key:
        return GeminiAIProvider()
    return MockAIProvider()
