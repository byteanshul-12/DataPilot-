# Celery background task handlers for long-running collection jobs.
from app.core.celery_app import celery_app

@celery_app.task(name="execute_collection_workflow")
def execute_collection_workflow(task_id: str, prompt: str):
    # Background execution trigger for AI collection graph.
    return {"task_id": task_id, "status": "completed"}
