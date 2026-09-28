import logging
import re
from typing import Any
from urllib.parse import urlparse

from app.graph.state import WorkflowState
from app.schemas.workflow import RecordValidationResult
from app.tools.quality import relevance_errors, record_confidence

logger = logging.getLogger(__name__)


def merge_entity_evidence(records, entity_type):
    """Combine exact identities only; conflicting websites keep records separate."""
    groups = []
    for raw in records:
        rec = dict(raw)
        name = str(rec.get("company_name") or "").strip().casefold()
        if not name or entity_type == "job":
            groups.append(rec)
            continue
        existing = next((r for r in groups if str(r.get("company_name", "")).strip().casefold() == name
                         and (not r.get("website") or not rec.get("website")
                              or r["website"].rstrip("/") == rec["website"].rstrip("/"))), None)
        if existing is None:
            rec["_evidence"] = dict(rec.get("_evidence") or {})
            rec["_sources"] = list(rec.get("_sources") or [])
            if rec.get("_source") and rec["_source"] not in rec["_sources"]:
                rec["_sources"].append(rec["_source"])
            groups.append(rec)
            continue
        for key, value in rec.items():
            if not key.startswith("_") and value is not None and existing.get(key) is None:
                existing[key] = value
        for key, quote in (rec.get("_evidence") or {}).items():
            existing["_evidence"].setdefault(key, quote)
        context = rec.get("_context", "")
        if context and context not in existing.get("_context", ""):
            existing["_context"] = existing.get("_context", "") + "\n" + context
        if rec.get("_source") and rec["_source"] not in existing["_sources"]:
            existing["_sources"].append(rec["_source"])
    return groups


def validate_single_record(record: dict[str, Any], validation_rules: list[str]) -> RecordValidationResult:
    """Validate a single record against rules and url/email sanity checks."""
    errors = []
    
    # 1. Required field checks
    for rule in validation_rules:
        if rule in {"source_url_required", "confidence_score_required", "duplicate_check_required"}:
            continue
        if rule.endswith("_required"):
            field_name = rule.replace("_required", "")
            val = record.get(field_name)
            if val is None or (isinstance(val, str) and not val.strip()):
                errors.append(f"Required field '{field_name}' is missing or empty.")

    # 2. URL validation checks
    for field_name in ["website", "linkedin_url", "url", "application_link"]:
        val = record.get(field_name)
        if val and isinstance(val, str):
            parsed = urlparse(val)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                errors.append(f"Field '{field_name}' value '{val}' is not a valid URL.")

    # 3. Email validation checks
    email_val = record.get("email")
    if email_val and isinstance(email_val, str):
        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", email_val):
            errors.append(f"Field 'email' value '{email_val}' is not a valid email address.")

    # 4. Source proof validation checks
    if "source_url_required" in validation_rules:
        source = record.get("_source")
        source_url = source.get("url") if isinstance(source, dict) else record.get("source_url")
        if not source_url:
            errors.append("Source URL is required but missing.")
        elif isinstance(source_url, str):
            parsed = urlparse(source_url)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                errors.append(f"Source URL '{source_url}' is not a valid URL.")

    confidence = record.get("confidence_score")
    if "confidence_score_required" in validation_rules and confidence is None:
        errors.append("Confidence score is required but missing.")
    elif confidence is not None:
        if not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 100:
            errors.append("Confidence score must be a number from 0 to 100.")

    # 5. Check that at least one field has non-null content
    content_fields = [k for k, v in record.items() if k != "_source" and v is not None]
    if not content_fields:
        errors.append("Record contains no valid data fields.")

    is_valid = len(errors) == 0
    return RecordValidationResult(record=record, valid=is_valid, errors=errors)


async def validate_node(state: WorkflowState) -> dict[str, Any]:
    """Reject unsupported identities and irrelevant rows; warn on optional missing fields."""
    logger.info(f"[{state.get('task_id')}] Running VALIDATE node")
    extracted_records = state.get("extracted_records", [])
    spec = state.get("specification", {})
    if state.get("user_requirement"):
        from app.services.request_policy import apply_request_policy
        spec = apply_request_policy(state["user_requirement"], spec)
    if spec.get("needs_clarification") or spec.get("entity_type") == "conversation":
        return {"validated_records": [], "errors": list(state.get("errors", [])), "status": "needs_clarification"}
    validation_rules = spec.get("validation_rules", [])

    validated_records = []
    errors = list(state.get("errors", []))

    for rec in merge_entity_evidence(extracted_records, spec.get("entity_type")):
        rec = dict(rec)
        hard_errors = relevance_errors(rec, spec)
        proof_check = validate_single_record(rec, ["source_url_required"])
        hard_errors.extend(proof_check.errors)
        if hard_errors:
            message = f"Rejected {rec.get('company_name', 'unknown')}: {', '.join(hard_errors)}"
            if message not in errors:
                errors.append(message)
            continue
        rec["_relevance_verified"] = True
        rec["confidence_score"] = record_confidence(rec)
        res = validate_single_record(rec, list(dict.fromkeys(validation_rules + [f"{f}_required" for f in spec.get("fields", [])])))
        if not res.valid:
            err_msg = f"Record validation error for '{rec.get('company_name', 'unknown')}': {', '.join(res.errors)}"
            logger.debug(err_msg)
            rec["quality_warnings"] = res.errors
        validated_records.append(rec)

    logger.info(f"VALIDATE node accepted {len(validated_records)} of {len(extracted_records)} records.")

    return {
        "validated_records": validated_records,
        "errors": errors,
        "status": "validation_completed"
    }
