# LangGraph graph state schema for data collection pipeline.  ya thora issue kar skta hai to check kar lena 
from typing import TypedDict, List, Dict, Any, Optional

class CollectionGraphState(TypedDict):
    prompt: str
    search_queries: List[str]
    raw_sources: List[Dict[str, Any]]
    extracted_data: List[Dict[str, Any]]
    validated_data: List[Dict[str, Any]]
    error: Optional[str]
