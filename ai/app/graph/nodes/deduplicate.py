import logging
import re
from typing import Any
from rapidfuzz import fuzz

from app.graph.state import WorkflowState

logger = logging.getLogger(__name__)


def normalize_value(val: Any) -> str:
    """Normalize string value for matching (lowercase, strip punctuation)."""
    if val is None:
        return ""
    val_str = str(val).lower().strip()
    val_str = re.sub(r"^https?://(www\.)?", "", val_str).rstrip("/")
    val_str = re.sub(r"[^\w\s]", "", val_str)
    return val_str


def get_dedup_key_str(record: dict[str, Any], dedup_keys: list[str]) -> str:
    """Generate concatenated normalized deduplication key string for a record."""
    parts = []
    for k in dedup_keys:
        v = record.get(k)
        if v:
            parts.append(normalize_value(v))
    return "|".join(parts) if parts else normalize_value(record.get("company_name", ""))


async def deduplicate_node(state: WorkflowState) -> dict[str, Any]:
    """LangGraph node: Deduplicate validated records using exact, normalized, and RapidFuzz fuzzy matching."""
    logger.info(f"[{state.get('task_id')}] Running DEDUPLICATE node")
    validated_records = state.get("validated_records", [])
    spec = state.get("specification", {})
    dedup_keys = spec.get("deduplication_key") or ["company_name", "website"]

    deduplicated_records: list[dict[str, Any]] = []

    for rec in validated_records:
        rec_key = get_dedup_key_str(rec, dedup_keys)
        rec_website = normalize_value(rec.get("website"))
        rec_name = normalize_value(rec.get("company_name"))

        # Prepare sources array for traceability
        rec_sources = []
        if "_source" in rec and rec["_source"]:
            rec_sources.append(rec["_source"])
        if "_sources" in rec:
            rec_sources.extend(rec["_sources"])

        matched = False
        for existing in deduplicated_records:
            existing_key = get_dedup_key_str(existing, dedup_keys)
            existing_website = normalize_value(existing.get("website"))
            existing_name = normalize_value(existing.get("company_name"))

            # Step 1: Matching websites (if present in both)
            if rec_website and existing_website and rec_website == existing_website:
                matched = True
            # Step 2: Exact normalized key match
            elif rec_key and existing_key and rec_key == existing_key:
                matched = True
            # Step 3: High confidence fuzzy match on company names (>= 85 token_set_ratio)
            elif rec_name and existing_name and len(rec_name) > 3 and len(existing_name) > 3:
                ratio = fuzz.token_set_ratio(rec_name, existing_name)
                if ratio >= 85:
                    matched = True

            if matched:
                # Merge records: prefer non-null values and merge sources
                for k, v in rec.items():
                    if k not in ("_source", "_sources") and (existing.get(k) is None or existing.get(k) == ""):
                        existing[k] = v
                
                # Append unique source provenance
                existing_srcs = existing.setdefault("_sources", [])
                for s in rec_sources:
                    if s not in existing_srcs:
                        existing_srcs.append(s)
                break

        if not matched:
            new_rec = {k: v for k, v in rec.items() if k != "_source"}
            new_rec["_sources"] = rec_sources
            deduplicated_records.append(new_rec)

    current_iter = state.get("iteration", 1)
    target_count = state.get("target_count", 10)
    errors = list(state.get("errors", []))

    if current_iter >= 5 and len(deduplicated_records) < target_count:
        msg = f"Target count not reached: collected {len(deduplicated_records)} of {target_count} requested records after max iterations."
        logger.warning(f"[{state.get('task_id')}] {msg}")
        if msg not in errors:
            errors.append(msg)

    logger.info(f"DEDUPLICATE node reduced {len(validated_records)} validated records to {len(deduplicated_records)} unique deduplicated records.")

    return {
        "deduplicated_records": deduplicated_records,
        "iteration": current_iter + 1,
        "errors": errors,
        "status": "deduplication_completed"
    }


