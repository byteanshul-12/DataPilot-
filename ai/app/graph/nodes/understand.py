import logging
from typing import Any

from app.graph.state import WorkflowState
from app.models.fine_tuned import get_model
from app.models.base import ModelExecutionError
from app.schemas.workflow import WorkflowSpecification
from app.services.request_policy import interpret_request

logger = logging.getLogger(__name__)


async def understand_node(state: WorkflowState) -> dict[str, Any]:
    """LangGraph node: Convert user_requirement into structured specification using single fine-tuned model."""
    user_req = state.get("user_requirement", "")
    logger.info(f"[{state.get('task_id')}] Running UNDERSTAND node for requirement: {user_req}")

    errors = list(state.get("errors", []))
    model = get_model()

    try:
        raw_spec = state.get("specification") or await interpret_request(user_req, model)
        
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
        raise ModelExecutionError("Requirement analysis failed; collection stopped to avoid dropping requested filters.") from e
