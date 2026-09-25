"""Planner agent integrating fine-tuned requirement parsing model."""
from app.models.fine_tuned import get_model, DataPilotModel

def create_planner_agent() -> DataPilotModel:
    """Returns the DataPilot single fine-tuned reasoning model instance for requirement parsing."""
    return get_model()
