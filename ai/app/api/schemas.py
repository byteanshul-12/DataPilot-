from typing import Any, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "datapilot-ai"


class AnalyzeRequest(BaseModel):
    requirement: str = Field(..., description="Natural language data collection requirement")


class AnalyzeResponse(BaseModel):
    status: str = "ready"
    reply: str = ""
    specification: dict[str, Any] = Field(..., description="Structured specification produced by fine-tuned model")


class WorkflowPlanRequest(BaseModel):
    requirement: str = Field(..., description="Natural language requirement to generate execution plan for")


class WorkflowPlanResponse(BaseModel):
    status: str = "ready"
    reply: str = ""
    specification: dict[str, Any]
    plan: dict[str, Any]


class WorkflowRunRequest(BaseModel):
    requirement: str = Field(..., description="Natural language requirement to execute complete workflow for")


class WorkflowRunResponse(BaseModel):
    task_id: str
    status: str = "queued"
    reply: str = ""
    clarification_questions: list[str] = Field(default_factory=list)


class WorkflowProgressMetrics(BaseModel):
    sources_discovered: int = 0
    records_extracted: int = 0
    records_validated: int = 0
    records_deduplicated: int = 0
    emails_outreached: int = 0


class WorkflowStatusResponse(BaseModel):
    reply: str = ""
    clarification_questions: list[str] = Field(default_factory=list)
    task_id: str
    status: str
    progress: WorkflowProgressMetrics
    errors: list[str] = Field(default_factory=list)


class WorkflowResultResponse(BaseModel):
    reply: str = ""
    clarification_questions: list[str] = Field(default_factory=list)
    task_id: str
    status: str
    records: list[dict[str, Any]] = Field(default_factory=list)
    outreach_emails: list[dict[str, Any]] = Field(default_factory=list)
    total: int = 0
    requested_count: int = 0
    target_met: bool = False
    errors: list[str] = Field(default_factory=list)


class CancelWorkflowResponse(BaseModel):
    task_id: str
    status: str = "cancelled"
