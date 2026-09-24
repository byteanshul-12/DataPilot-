# Tavily search API integration tool.
import os
from tavily import TavilyClient

def search_tavily(query: str) -> list[dict]:
    # Executes web search using Tavily API and returns matching source links.
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return []
    client = TavilyClient(api_key=api_key)
    response = client.search(query=query)
    return response.get("results", [])
