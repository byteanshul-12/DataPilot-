import logging
import os
from typing import Literal

from langgraph.graph import END, StateGraph

from app.graph.nodes.deduplicate import deduplicate_node
from app.graph.nodes.extract import extract_node
from app.graph.nodes.plan import plan_node
from app.graph.nodes.search import search_node
from app.graph.nodes.understand import understand_node
from app.graph.nodes.validate import validate_node
from app.graph.state import WorkflowState

logger = logging.getLogger(__name__)

MAX_ITERATIONS = int(os.getenv("MAX_ITERATIONS", "5"))


def check_target_condition(state: WorkflowState) -> Literal["search", "__end__"]:
    """Conditional edge router: Check if target count is reached or max iterations exceeded."""
    dedup_count = len(state.get("deduplicated_records", []))
    target_count = state.get("target_count", 10)
    current_iteration = state.get("iteration", 1)

    logger.info(f"[{state.get('task_id')}] Target Check: {dedup_count}/{target_count} records collected (Iteration {current_iteration}/{MAX_ITERATIONS})")

    if dedup_count >= target_count or current_iteration > MAX_ITERATIONS:
        logger.info(f"[{state.get('task_id')}] Workflow completing: target achieved or max iterations reached.")
        return END
    
    logger.info(f"[{state.get('task_id')}] Target not yet reached. Looping back to SEARCH node.")
    return "search"



def build_collection_graph():
    """Build and compile the complete DataPilot LangGraph Workflow StateGraph."""
    workflow = StateGraph(WorkflowState)

    # Add workflow nodes
    workflow.add_node("understand", understand_node)
    workflow.add_node("plan", plan_node)
    workflow.add_node("search", search_node)
    workflow.add_node("extract", extract_node)
    workflow.add_node("validate", validate_node)
    workflow.add_node("deduplicate", deduplicate_node)

    # Set entry point
    workflow.set_entry_point("understand")

    # Linear transitions
    workflow.add_edge("understand", "plan")
    workflow.add_edge("plan", "search")
    workflow.add_edge("search", "extract")
    workflow.add_edge("extract", "validate")
    workflow.add_edge("validate", "deduplicate")

    # Conditional looping edge
    workflow.add_conditional_edges(
        "deduplicate",
        check_target_condition,
        {
            "search": "search",
            END: END
        }
    )

    return workflow.compile()
