from typing import Any, Optional
from pydantic import BaseModel, Field


class WorkflowSpecification(BaseModel):
    """Structured Workflow Specification produced by the single fine-tuned model."""
    intent: str = Field(..., description="High-level intent of the task")
    target_count: Optional[int] = Field(default=10, description="Target record count")
    entity_type: str = Field(..., description="Target entity type (e.g. company, lead, job)")
    filters: dict[str, Any] = Field(default_factory=dict, description="Extracted key-value filters")
    fields: list[str] = Field(default_factory=list, description="Requested fields to extract")
    source_types: list[str] = Field(default_factory=list, description="Recommended source categories")
    deduplication_key: list[str] = Field(default_factory=list, description="Fields used for deduplication")
    validation_rules: list[str] = Field(default_factory=list, description="Rules for record validation")


class ExecutionPlan(BaseModel):
    """Executable Collection Plan generated deterministically from WorkflowSpecification."""
    queries: list[str] = Field(..., description="Search queries generated for web discovery")
    fields: list[str] = Field(..., description="Fields to extract from raw documents")
    source_types: list[str] = Field(default_factory=list, description="Target source categories")
    deduplication_key: list[str] = Field(default_factory=list, description="Deduplication key fields")
    validation_rules: list[str] = Field(default_factory=list, description="Validation rules")


class SourceMetadata(BaseModel):
    """Provenance metadata for an extracted record piece or full document."""
    url: str
    title: Optional[str] = None
    retrieved_by: str = "tavily"


class RecordValidationResult(BaseModel):
    """Structured record validation status."""
    record: dict[str, Any]
    valid: bool
    errors: list[str] = Field(default_factory=list)
