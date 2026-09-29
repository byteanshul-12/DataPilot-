import logging
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ai.config import PORT, LOG_LEVEL
from ai.workflow_engine import run_data_collection_workflow
from ai.llm_client import classify_intent, generate_plan_response

logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO))
logger = logging.getLogger("datapilot.ai")

app = FastAPI(
    title="DataPilot AI Microservice",
    version="1.0.0",
    description="AI-Powered Data Intelligence & Dynamic Web Extraction Workflow Engine"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExecuteRequest(BaseModel):
    taskId: str
    prompt: str

class ClassifyRequest(BaseModel):
    prompt: str

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "datapilot-ai",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

@app.post("/api/v1/execute")
async def execute_workflow(req: ExecuteRequest):
    if not req.prompt:
        raise HTTPException(status_code=400, detail="Prompt string is required")
    
    logger.info(f"Received execution request for taskId={req.taskId}")
    result = await run_data_collection_workflow(req.taskId, req.prompt)
    return result

@app.post("/api/v1/classify")
async def classify_prompt(req: ClassifyRequest):
    result = await classify_intent(req.prompt)
    return result

@app.post("/api/v1/plan")
async def create_plan(req: ClassifyRequest):
    intent_details = await classify_intent(req.prompt)
    plan_text = await generate_plan_response(req.prompt, intent_details)
    return {"prompt": req.prompt, "plan": plan_text}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ai.main:app", host="0.0.0.0", port=PORT, reload=True)
