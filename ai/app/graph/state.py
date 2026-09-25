from typing import Any, TypedDict


class WorkflowState(TypedDict):
    """LangGraph Workflow State representation."""

    task_id: str
    user_requirement: str

    specification: dict[str, Any]

    search_queries: list[str]
    discovered_sources: list[dict[str, Any]]

    raw_documents: list[dict[str, Any]]
    extracted_records: list[dict[str, Any]]

    validated_records: list[dict[str, Any]]
    deduplicated_records: list[dict[str, Any]]

    errors: list[str]

    target_count: int
    iteration: int

    status: str
