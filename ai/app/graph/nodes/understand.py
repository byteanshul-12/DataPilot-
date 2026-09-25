import logging
from typing import Any

from app.graph.state import WorkflowState
from app.models.fine_tuned import get_model
from app.schemas.workflow import WorkflowSpecification

logger = logging.getLogger(__name__)


async def understand_node(state: WorkflowState) -> dict[str, Any]:
    """LangGraph node: Convert user_requirement into structured specification using single fine-tuned model."""
    user_req = state.get("user_requirement", "")
    logger.info(f"[{state.get('task_id')}] Running UNDERSTAND node for requirement: {user_req}")

    errors = list(state.get("errors", []))
    model = get_model()

    try:
        raw_spec = await model.generate_workflow_spec(user_req)
        
        # Validate spec schema using Pydantic model
        validated_spec = WorkflowSpecification(**raw_spec).model_dump()
        target_count = validated_spec.get("target_count") or 10

        return {
            "specification": validated_spec,
            "target_count": target_count,
            "status": "understanding_completed"
        }
    except Exception as e:
        logger.error(f"Error in UNDERSTAND node: {e}")
        errors.append(f"UnderstandNode failure: {str(e)}")
        
        # Provide clean fallback specification on error
        fallback_spec = WorkflowSpecification(
            intent="find_entities",
            target_count=state.get("target_count") or 10,
            entity_type="company",
            filters={},
            fields=["company_name", "website"],
            source_types=["company_website"],
            deduplication_key=["company_name"],
            validation_rules=["company_name_required"]
        ).model_dump()

        return {
            "specification": fallback_spec,
            "target_count": fallback_spec["target_count"],
            "errors": errors,
            "status": "understanding_fallback"
        }
