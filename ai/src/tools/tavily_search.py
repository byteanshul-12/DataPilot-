"""Tavily search API integration module."""
from app.tools.tavily import TavilySearchTool

async def search_tavily_async(query: str) -> list[dict]:
    """Executes web search using Tavily tool and returns matching source dicts."""
    tool = TavilySearchTool()
    return await tool.search([query])

__all__ = ["TavilySearchTool", "search_tavily_async"]
