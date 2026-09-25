from abc import ABC, abstractmethod
from typing import Any


class ModelConfigurationError(Exception):
    """Raised when model settings or endpoints are invalid or unconfigured."""
    pass


class ModelExecutionError(Exception):
    """Raised when model inference fails or produces unparseable output."""
    pass


class DataPilotModel(ABC):
    """Abstract base class for DataPilot single fine-tuned reasoning model.
    
    The sole responsibility of this model is converting natural language data requirements
    into structured JSON workflow specifications.
    """

    @abstractmethod
    async def generate_workflow_spec(self, user_requirement: str) -> dict[str, Any]:
        """Convert natural-language user requirement into a structured JSON dictionary.
        
        Args:
            user_requirement: Free text query (e.g., "Find 100 Indian SaaS startups...")
            
        Returns:
            dict containing structured fields: intent, target_count, entity_type, filters, fields, etc.
        """
        pass
