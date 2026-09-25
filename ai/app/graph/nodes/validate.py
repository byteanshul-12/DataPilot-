import logging
import re
from typing import Any
from urllib.parse import urlparse

from app.graph.state import WorkflowState
from app.schemas.workflow import RecordValidationResult

logger = logging.getLogger(__name__)


def validate_single_record(record: dict[str, Any], validation_rules: list[str]) -> RecordValidationResult:
    """Validate a single record against rules and url/email sanity checks."""
    errors = []
    
    # 1. Required field checks
    for rule in validation_rules:
        if rule.endswith("_required"):
            field_name = rule.replace("_required", "")
            val = record.get(field_name)
            if val is None or (isinstance(val, str) and not val.strip()):
                errors.append(f"Required field '{field_name}' is missing or empty.")

    # 2. URL validation checks
    for field_name in ["website", "linkedin_url", "url"]:
        val = record.get(field_name)
        if val and isinstance(val, str):
            parsed = urlparse(val)
            if not parsed.scheme or not parsed.netloc:
                errors.append(f"Field '{field_name}' value '{val}' is not a valid URL.")

    # 3. Email validation checks
    email_val = record.get("email")
    if email_val and isinstance(email_val, str):
        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", email_val):
            errors.append(f"Field 'email' value '{email_val}' is not a valid email address.")

    # 4. Check that at least one field has non-null content
    content_fields = [k for k, v in record.items() if k != "_source" and v is not None]
    if not content_fields:
        errors.append("Record contains no valid data fields.")

    is_valid = len(errors) == 0
    return RecordValidationResult(record=record, valid=is_valid, errors=errors)


async def validate_node(state: WorkflowState) -> dict[str, Any]:
    """LangGraph node: Validate extracted records and log errors for invalid items without silently deleting them."""
    logger.info(f"[{state.get('task_id')}] Running VALIDATE node")
    extracted_records = state.get("extracted_records", [])
    spec = state.get("specification", {})
    validation_rules = spec.get("validation_rules", [])

    validated_records = []
    errors = list(state.get("errors", []))

    for rec in extracted_records:
        res = validate_single_record(rec, validation_rules)
        if res.valid:
            validated_records.append(rec)
        else:
            err_msg = f"Record validation error for '{rec.get('company_name', 'unknown')}': {', '.join(res.errors)}"
            logger.debug(err_msg)
            # Store invalid item details in errors list as per specification
            errors.append(err_msg)

    logger.info(f"VALIDATE node validated {len(validated_records)} valid records out of {len(extracted_records)} extracted.")

    return {
        "validated_records": validated_records,
        "errors": errors,
        "status": "validation_completed"
    }
