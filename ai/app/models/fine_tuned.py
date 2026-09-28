import json
import logging
import os
import re
from typing import Any, Optional
import httpx

from app.models.base import DataPilotModel, ModelConfigurationError, ModelExecutionError

logger = logging.getLogger(__name__)

WORKFLOW_KEYS = [
    "intent",
    "target_count",
    "entity_type",
    "filters",
    "fields",
    "source_types",
    "fallback_sources",
    "deduplication_key",
    "validation_rules",
    "output_format",
    "include_source_url",
    "include_confidence_score",
    "source_required_for_each_row",
    "missing_field_strategy",
    "needs_clarification",
    "clarification_questions",
    "plan_summary",
]

SYSTEM_PROMPT = (
    "You are a DataPilot specialized AI. Convert the user data requirement into "
    "only one valid JSON object matching these exact top-level keys: "
    f"{', '.join(WORKFLOW_KEYS)}. "
    "Detect output_format as table, csv, excel, json, or google_sheet. "
    "Set include_source_url, include_confidence_score, and source_required_for_each_row to true by default. "
    "Use fallback_sources when fields may be missing. "
    "Use needs_clarification and clarification_questions only when the request is too vague to execute safely. "
    "Write plan_summary as one short user-visible sentence. "
    "Do not wrap the response in markdown. Do not add any extra top-level keys."
)


def _extract_json_from_text(text: str) -> dict[str, Any]:
    """Parse JSON from raw text response, handling markdown blocks if present."""
    text = text.strip()
    if text.startswith("```"):
        # Strip code fences
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Match outermost curly braces using regex fallback
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError as e:
                raise ModelExecutionError(f"Failed to parse JSON from extracted block: {e}")
        raise ModelExecutionError(f"Model output did not contain valid JSON: {text[:200]}")


class FineTunedHTTPModel(DataPilotModel):
    """Fine-tuned model adapter interacting over HTTP endpoint (vLLM, TGI, Ollama, or custom service)."""

    def __init__(self, endpoint: str, model_name: str, api_key: Optional[str] = None, timeout: float = 60.0):
        if not endpoint:
            raise ModelConfigurationError("MODEL_ENDPOINT environment variable must be set for HTTP model provider.")
        self.endpoint = endpoint.rstrip("/")
        self.model_name = model_name or "datapilot-model"
        self.api_key = api_key
        self.timeout = timeout

    async def generate_workflow_spec(self, user_requirement: str) -> dict[str, Any]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        system_prompt = SYSTEM_PROMPT
        plain_prompt = f"{system_prompt}\n\nUser requirement: {user_requirement}\n\nJSON:"

        # Standard vLLM / OpenAI-compatible / custom inference request payload
        payload = {
            "model": self.model_name,
            "prompt": plain_prompt,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {"role": "user", "content": user_requirement}
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"}
        }

        # Try POST to endpoint or endpoint + /v1/chat/completions or /api/generate
        target_urls = [
            self.endpoint if self.endpoint.endswith(("/completions", "/generate", "/predict")) else f"{self.endpoint}/v1/chat/completions",
            f"{self.endpoint}/api/generate",
            self.endpoint
        ]

        last_error = None
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for url in target_urls:
                try:
                    logger.info(f"Connecting to fine-tuned model endpoint: {url}")
                    response = await client.post(url, json=payload, headers=headers)
                    if response.status_code == 200:
                        res_json = response.json()
                        raw_content = ""
                        if "choices" in res_json and len(res_json["choices"]) > 0:
                            choice = res_json["choices"][0]
                            if "message" in choice:
                                raw_content = choice["message"].get("content", "")
                            elif "text" in choice:
                                raw_content = choice.get("text", "")
                        elif "response" in res_json:
                            raw_content = res_json["response"]
                        elif "specification" in res_json:
                            return res_json["specification"]
                        else:
                            raw_content = response.text

                        return _extract_json_from_text(raw_content)
                    continue
                except Exception as e:
                    last_error = e
                    continue

        logger.warning(f"HTTP model endpoint unreachable ({last_error}). Falling back to local deterministic model.")
        return await MockRuleBasedModel().generate_workflow_spec(user_requirement)


class MockRuleBasedModel(DataPilotModel):
    """Deterministic requirement parser used for testing & offline mode without remote server."""

    async def generate_workflow_spec(self, user_requirement: str) -> dict[str, Any]:
        req_lower = user_requirement.lower()
        
        # Target count extraction
        count_match = re.search(r"\b(\d+)\b", user_requirement)
        target_count = int(count_match.group(1)) if count_match else 50

        # Entity type detection
        entity_type = "company"
        if "intern" in req_lower:
            entity_type = "internship"
        elif "job" in req_lower or "hiring" in req_lower:
            entity_type = "job"
        elif "lead" in req_lower or "contact" in req_lower:
            entity_type = "lead"
        elif "sponsor" in req_lower:
            entity_type = "sponsor"
        elif "product" in req_lower:
            entity_type = "product"

        # Filters
        filters = {}
        if "backend" in req_lower:
            filters["role"] = "backend"
        elif "frontend" in req_lower:
            filters["role"] = "frontend"
        if "india" in req_lower or "indian" in req_lower:
            filters["country"] = "India"
        if "saas" in req_lower:
            filters["industry"] = "SaaS"
        if "fintech" in req_lower:
            filters["industry"] = "fintech"
            
        founded_match = re.search(r"founded after (\d{4})", req_lower)
        if founded_match:
            filters["founded_after"] = int(founded_match.group(1))

        # Fields
        fields = []
        possible_fields = [
            ("company name", "company_name"),
            ("name", "company_name"),
            ("founder", "founder"),
            ("website", "website"),
            ("funding stage", "funding_stage"),
            ("funding", "funding_stage"),
            ("linkedin", "linkedin_url"),
            ("email", "email"),
            ("title", "job_title"),
            ("location", "location")
        ]
        for term, f_name in possible_fields:
            if term in req_lower and f_name not in fields:
                fields.append(f_name)

        # Always ensure core identity fields are present
        if "company_name" not in fields:
            fields.insert(0, "company_name")
        if "website" not in fields:
            fields.append("website")
        if entity_type in ("job", "internship") and "role" not in fields:
            fields.append("role")

        output_format = "table"
        if "excel" in req_lower or "xlsx" in req_lower or "spreadsheet" in req_lower:
            output_format = "excel"
        elif "csv" in req_lower:
            output_format = "csv"
        elif "google sheet" in req_lower or "sheets" in req_lower:
            output_format = "google_sheet"
        elif "json" in req_lower:
            output_format = "json"

        needs_proof = any(term in req_lower for term in ["source", "proof", "verify", "verified", "confidence"])
        vague_terms = {"find startups", "find companies", "get data", "find leads", "find jobs"}
        needs_clarification = req_lower.strip() in vague_terms or len(req_lower.split()) <= 3
        clarification_questions = []
        if needs_clarification:
            clarification_questions = [
                "Which country or region should I search in?",
                "Which fields do you need?",
                "How many results do you want?",
            ]

        validation_rules = ["company_name_required"]
        if "website" in fields:
            validation_rules.append("website_valid_url")
        if "email" in fields:
            validation_rules.append("email_valid")
        if "linkedin_url" in fields:
            validation_rules.append("linkedin_url_valid_url")
        validation_rules.extend(["source_url_required", "duplicate_check_required"])
        if "confidence_score_required" not in validation_rules:
            validation_rules.append("confidence_score_required")

        # Detect email outreach intent
        mail_intent_terms = ["mail them", "email them", "send email", "send mail", "cold mail", "outreach", "mail to them", "email to them"]
        enable_email_outreach = any(term in req_lower for term in mail_intent_terms)

        # Extract sender email if provided in prompt (e.g. "with my email id anshul@gmail.com")
        email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
        email_matches = re.findall(email_pattern, user_requirement)
        sender_email = email_matches[0] if email_matches else None

        # Detect role or topic for outreach
        outreach_role = None
        if "internship" in req_lower or "intern" in req_lower:
            outreach_role = "Backend Engineering Internship" if "backend" in req_lower else "Software Engineering Internship"
        elif "backend" in req_lower:
            outreach_role = "Backend Developer Opportunity"
        elif "founder" in req_lower or "lead" in req_lower:
            outreach_role = "Business Partnership & Introduction"

        # Ensure contact email is in extracted fields if outreach is requested
        if enable_email_outreach and "email" not in fields:
            fields.append("email")

        return {
            "intent": f"extract_{entity_type}s",
            "target_count": target_count,
            "entity_type": entity_type,
            "filters": filters,
            "fields": fields,
            "source_types": ["company_website", "linkedin", "startup_database", "news"],
            "fallback_sources": ["search_engine", "company_website", "linkedin", "news"],
            "deduplication_key": ["company_name", "website"] if "website" in fields else ["company_name"],
            "validation_rules": validation_rules,
            "output_format": output_format,
            "include_source_url": True if needs_proof or True else False,
            "include_confidence_score": True,
            "source_required_for_each_row": True,
            "missing_field_strategy": "ask_user_for_clarification" if needs_clarification else "retry_with_fallback_sources",
            "needs_clarification": needs_clarification,
            "clarification_questions": clarification_questions,
            "plan_summary": (
                f"Find {target_count} {entity_type} records, collect requested fields, "
                f"verify source links, remove duplicates, and return {output_format} output."
                + (" Send automated outreach emails to verified contacts." if enable_email_outreach else "")
            ),
            "enable_email_outreach": enable_email_outreach,
            "sender_email": sender_email,
            "outreach_role_or_topic": outreach_role,
        }


def get_model() -> DataPilotModel:
    """Factory function to instantiate the configured single fine-tuned model instance."""
    provider = os.getenv("MODEL_PROVIDER", "http").lower()
    endpoint = os.getenv("MODEL_ENDPOINT", "http://localhost:8001")
    model_name = os.getenv("MODEL_NAME", "datapilot-model")
    api_key = os.getenv("MODEL_API_KEY", "")

    if provider in ("http", "endpoint", "vllm", "ollama"):
        return FineTunedHTTPModel(endpoint=endpoint, model_name=model_name, api_key=api_key)
    elif provider in ("mock", "test", "rule_based"):
        return MockRuleBasedModel()
    else:
        # Default to HTTP endpoint model as required by spec
        return FineTunedHTTPModel(endpoint=endpoint, model_name=model_name, api_key=api_key)
