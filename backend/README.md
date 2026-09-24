# Backend - DataPilot

/ FastAPI REST API service with Celery background task worker support.

## Commands

- `pip install -r requirements.txt` - Install Python dependencies
- `uvicorn main:app --reload` - Run FastAPI development server
- `celery -A app.core.celery_app worker --loglevel=info` - Run Celery task worker
