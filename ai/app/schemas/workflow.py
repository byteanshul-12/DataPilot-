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
    output_format: str = Field(default="table", description="Requested delivery format such as table, csv, excel, json, or google_sheet")
    fallback_sources: list[str] = Field(default_factory=list, description="Backup source categories to try when fields are missing")
    include_source_url: bool = Field(default=True, description="Whether every result row should include source proof URLs")
    include_confidence_score: bool = Field(default=True, description="Whether every result row should include a confidence score")
    source_required_for_each_row: bool = Field(default=True, description="Whether rows without source proof should be treated as incomplete")
    missing_field_strategy: str = Field(default="retry_with_fallback_sources", description="How to handle incomplete records")
    needs_clarification: bool = Field(default=False, description="Whether the user request is too vague to execute safely")
    clarification_questions: list[str] = Field(default_factory=list, description="Questions to ask before scraping when the request is vague")
    plan_summary: str = Field(default="", description="Short user-visible explanation of the AI collection plan")


class ExecutionPlan(BaseModel):
    """Executable Collection Plan generated deterministically from WorkflowSpecification."""
    queries: list[str] = Field(..., description="Search queries generated for web discovery")
    fields: list[str] = Field(..., description="Fields to extract from raw documents")
    source_types: list[str] = Field(default_factory=list, description="Target source categories")
    deduplication_key: list[str] = Field(default_factory=list, description="Deduplication key fields")
    validation_rules: list[str] = Field(default_factory=list, description="Validation rules")
    output_format: str = Field(default="table", description="Requested delivery format")
    fallback_sources: list[str] = Field(default_factory=list, description="Backup source categories")
    include_source_url: bool = True
    include_confidence_score: bool = True
    missing_field_strategy: str = "retry_with_fallback_sources"
    plan_summary: str = ""


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
