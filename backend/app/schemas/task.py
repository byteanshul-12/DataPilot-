# Pydantic schemas for data collection task endpoints.
from pydantic import BaseModel
from typing import Optional, List, Any

class TaskCreate(BaseModel):
    prompt: str

class TaskResponse(BaseModel):
    id: str
    prompt: str
    status: str
    created_at: str
    results: Optional[List[Any]] = None
