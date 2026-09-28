import logging
from fastapi import APIRouter, HTTPException, status

from app.api.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    CancelWorkflowResponse,
    HealthResponse,
    WorkflowPlanRequest,
    WorkflowPlanResponse,
    WorkflowProgressMetrics,
    WorkflowResultResponse,
    WorkflowRunRequest,
    WorkflowRunResponse,
    WorkflowStatusResponse,
)
from app.graph.nodes.plan import generate_plan_from_spec
from app.models.fine_tuned import get_model
from app.schemas.workflow import WorkflowSpecification
from app.services.task_manager import TaskManager
from app.services.request_policy import interpret_request, response_status, reply_for

logger = logging.getLogger(__name__)

router = APIRouter()
task_manager = TaskManager()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint returning service status."""
    return HealthResponse(status="ok", service="datapilot-ai")


@router.post("/api/v1/analyze", response_model=AnalyzeResponse)
async def analyze_requirement(req: AnalyzeRequest):
    """Test the single fine-tuned model independently by parsing requirement to specification without running web workflow."""
    if not req.requirement.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Requirement text cannot be empty.")

    try:
        model = get_model()
        raw_spec = await interpret_request(req.requirement, model)
        validated_spec = WorkflowSpecification(**raw_spec).model_dump()
        return AnalyzeResponse(specification=validated_spec, status=response_status(validated_spec), reply=reply_for(validated_spec))
    except Exception as e:
        logger.error(f"Error in /api/v1/analyze: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Model analysis failed: {str(e)}")


@router.post("/api/v1/workflow/plan", response_model=WorkflowPlanResponse)
async def plan_workflow(req: WorkflowPlanRequest):
    """Convert a natural language requirement into an execution plan without running data collection."""
    if not req.requirement.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Requirement text cannot be empty.")

    try:
        model = get_model()
        raw_spec = await interpret_request(req.requirement, model)
        validated_spec = WorkflowSpecification(**raw_spec).model_dump()
        plan_dict = generate_plan_from_spec(validated_spec)
        return WorkflowPlanResponse(specification=validated_spec, plan=plan_dict, status=response_status(validated_spec), reply=reply_for(validated_spec))
    except Exception as e:
        logger.error(f"Error in /api/v1/workflow/plan: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Workflow planning failed: {str(e)}")


@router.post("/api/v1/workflows/run", response_model=WorkflowRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_workflow(req: WorkflowRunRequest):
    """Asynchronously start a complete DataPilot collection workflow."""
    if not req.requirement.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Requirement text cannot be empty.")

    try:
        spec = await interpret_request(req.requirement, get_model())
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Request understanding is unavailable. No scrape was started. Please retry.") from exc
    task_id = task_manager.create_task(req.requirement)
    info = task_manager.get_task_status(task_id)
    info["specification"] = spec
    info["reply"] = reply_for(spec)
    route = response_status(spec)
    if route == "ready":
        task_manager.start_task_background(task_id)
    else:
        info["status"] = route
    return WorkflowRunResponse(task_id=task_id, status=info["status"], reply=info["reply"], clarification_questions=spec.get("clarification_questions", []))


@router.get("/api/v1/workflows/{task_id}", response_model=WorkflowStatusResponse)
async def get_workflow_status(task_id: str):
    """Return the current status and metrics of a workflow task."""
    task_info = task_manager.get_task_status(task_id)
    if not task_info:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task ID {task_id} not found.")

    progress = WorkflowProgressMetrics(**task_info.get("progress", {}))
    return WorkflowStatusResponse(
        task_id=task_id,
        status=task_info.get("status", "unknown"),
        progress=progress,
        reply=task_info.get("reply", ""),
        clarification_questions=task_info.get("specification", {}).get("clarification_questions", []),
        errors=task_info.get("errors", [])
    )


@router.get("/api/v1/workflows/{task_id}/results", response_model=WorkflowResultResponse)
async def get_workflow_results(task_id: str):
    """Return the final extracted structured dataset for a completed workflow task."""
    task_info = task_manager.get_task_status(task_id)
    if not task_info:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task ID {task_id} not found.")

    records = task_info.get("result_records", [])
    records = [{k: v for k, v in record.items() if k not in {"_context", "_entity_type", "_relevance_verified", "_requested_fields"}} for record in records]
    outreach = task_info.get("outreach_emails", [])
    target_count = task_info.get("specification", {}).get("target_count", 0)
    return WorkflowResultResponse(
        task_id=task_id,
        status=task_info.get("status", "unknown"),
        records=records,
        outreach_emails=outreach,
        reply=task_info.get("reply", ""),
        clarification_questions=task_info.get("specification", {}).get("clarification_questions", []),
        total=len(records),
        requested_count=target_count,
        target_met=bool(target_count) and len(records) >= target_count,
        errors=task_info.get("errors", []),
    )


@router.post("/api/v1/workflows/{task_id}/cancel", response_model=CancelWorkflowResponse)
async def cancel_workflow(task_id: str):
    """Cancel an active workflow task."""
    success = task_manager.cancel_task(task_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task ID {task_id} not found.")

    return CancelWorkflowResponse(task_id=task_id, status="cancelled")
