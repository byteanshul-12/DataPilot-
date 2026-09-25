import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)


class TavilySearchTool:
    """Tavily Web Search Tool for discovering relevant web sources."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("TAVILY_API_KEY")
        self._client = None
        if self.api_key:
            try:
                from tavily import TavilyClient
                self._client = TavilyClient(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Failed to initialize TavilyClient: {e}")

    async def search(self, queries: list[str], max_results_per_query: int = 5) -> list[dict[str, Any]]:
        """Search Tavily for a list of queries and return deduplicated structured sources.
        
        Returns:
            list[dict] with keys: url, title, snippet, source
        """
        discovered_sources = []
        seen_urls = set()

        for query in queries:
            if not query.strip():
                continue

            if self._client:
                try:
                    res = self._client.search(query=query, max_results=max_results_per_query)
                    results = res.get("results", [])
                    for item in results:
                        url = item.get("url")
                        if url and url not in seen_urls:
                            seen_urls.add(url)
                            discovered_sources.append({
                                "url": url,
                                "title": item.get("title", ""),
                                "content": item.get("content", ""),
                                "source": "tavily"
                            })
                except Exception as e:
                    logger.error(f"Tavily search failed for query '{query}': {e}")
            else:
                logger.warning(f"TAVILY_API_KEY not configured. Skipping live Tavily search for: {query}")

        return discovered_sources
