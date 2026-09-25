import logging
from typing import Any

from app.graph.state import WorkflowState
from app.schemas.workflow import ExecutionPlan

logger = logging.getLogger(__name__)


def generate_plan_from_spec(spec: dict[str, Any]) -> dict[str, Any]:
    """Deterministic planning logic converting specification dict into an execution plan."""
    entity = spec.get("entity_type", "company")
    filters = spec.get("filters", {})
    fields = spec.get("fields") or ["company_name", "website", "founder"]
    source_types = spec.get("source_types") or ["company_website", "startup_database"]
    dedup_key = spec.get("deduplication_key") or (["company_name", "website"] if "website" in fields else ["company_name"])
    validation_rules = spec.get("validation_rules") or [f"{f}_required" for f in fields[:2]]

    # Generate targeted search queries
    filter_terms = " ".join([f"{k} {v}" for k, v in filters.items()])
    queries = [
        f"{filter_terms} {entity} list database".strip(),
        f"top {filter_terms} {entity}s".strip(),
        f"find {filter_terms} {entity} directory".strip()
    ]
    # Clean up excess spaces in queries
    queries = [" ".join(q.split()) for q in queries if q.strip()]
    if not queries:
        queries = [f"{entity} database list"]

    plan = ExecutionPlan(
        queries=queries,
        fields=fields,
        source_types=source_types,
        deduplication_key=dedup_key,
        validation_rules=validation_rules
    )
    return plan.model_dump()


async def plan_node(state: WorkflowState) -> dict[str, Any]:
    """LangGraph node: Convert specification into an executable collection plan."""
    logger.info(f"[{state.get('task_id')}] Running PLAN node")
    spec = state.get("specification", {})
    plan_dict = generate_plan_from_spec(spec)

    return {
        "search_queries": plan_dict["queries"],
        "status": "plan_generated"
    }
