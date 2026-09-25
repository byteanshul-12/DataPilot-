import json
import logging
import os
import re
from typing import Any, Optional
import httpx

from app.models.base import DataPilotModel, ModelConfigurationError, ModelExecutionError

logger = logging.getLogger(__name__)


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

        # Standard vLLM / OpenAI-compatible / custom inference request payload
        payload = {
            "model": self.model_name,
            "prompt": user_requirement,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a DataPilot specialized AI. Convert the user data requirement into a valid JSON workflow specification."
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
                except httpx.HTTPError as e:
                    last_error = e
                    continue

        raise ModelExecutionError(f"HTTP model endpoint inference failed on {self.endpoint}: {last_error}")


class MockRuleBasedModel(DataPilotModel):
    """Deterministic requirement parser used for testing & offline mode without remote server."""

    async def generate_workflow_spec(self, user_requirement: str) -> dict[str, Any]:
        req_lower = user_requirement.lower()
        
        # Target count extraction
        count_match = re.search(r"\b(\d+)\b", user_requirement)
        target_count = int(count_match.group(1)) if count_match else 50

        # Entity type detection
        entity_type = "company"
        if "job" in req_lower or "hiring" in req_lower:
            entity_type = "job"
        elif "lead" in req_lower or "contact" in req_lower:
            entity_type = "lead"
        elif "sponsor" in req_lower:
            entity_type = "sponsor"
        elif "product" in req_lower:
            entity_type = "product"

        # Filters
        filters = {}
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

        if not fields:
            fields = ["company_name", "website", "founder"]

        return {
            "intent": f"extract_{entity_type}s",
            "target_count": target_count,
            "entity_type": entity_type,
            "filters": filters,
            "fields": fields,
            "source_types": ["company_website", "linkedin", "startup_database", "news"],
            "deduplication_key": ["company_name", "website"] if "website" in fields else ["company_name"],
            "validation_rules": [f"{f}_required" for f in fields[:2]] + ["website_valid_url" if "website" in fields else ""]
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
