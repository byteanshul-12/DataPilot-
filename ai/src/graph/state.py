"""LangGraph state schema module re-exporting WorkflowState for backward compatibility."""
from app.graph.state import WorkflowState

# Backward compatibility alias
CollectionGraphState = WorkflowState

__all__ = ["WorkflowState", "CollectionGraphState"]
