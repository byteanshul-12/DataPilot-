# REST endpoints for workflow task execution and management.
from fastapi import APIRouter, HTTPException
from app.schemas.task import TaskCreate, TaskResponse
import uuid
from datetime import datetime

router = APIRouter()

@router.post("/", response_model=TaskResponse)
async def create_task(payload: TaskCreate):
    task_id = str(uuid.uuid4())
    return TaskResponse(
        id=task_id,
        prompt=payload.prompt,
        status="pending",
        created_at=datetime.utcnow().isoformat()
    )

@router.get("/", response_model=list[TaskResponse])
async def list_tasks():
    return []
