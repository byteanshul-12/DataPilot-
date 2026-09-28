import logging
import asyncio
import os
from typing import Any, Optional

from app.tools.quality import is_blocked_url, source_quality

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

        async def run_query(query):
            if not self._client:
                return {}
            try:
                return await asyncio.to_thread(self._client.search, query=query, max_results=max_results_per_query, search_depth="advanced", timeout=20)
            except Exception as exc:
                logger.warning("Search failed: %s", type(exc).__name__)
                return {}

        queries = list(dict.fromkeys(q.strip() for q in queries if q.strip()))[:4]
        responses = await asyncio.gather(*(run_query(q) for q in queries))
        for query, res in zip(queries, responses):
            if not query.strip():
                continue

            if self._client:
                try:
                    results = res.get("results", [])
                    for item in results:
                        url = item.get("url")
                        if url and url not in seen_urls and not is_blocked_url(url):
                            source_type, quality_score = source_quality(url, item.get("title", ""))
                            seen_urls.add(url)
                            discovered_sources.append({
                                "url": url,
                                "title": item.get("title", ""),
                                "content": item.get("content", ""),
                                "source": "tavily",
                                "search_query": query,
                                "source_type": source_type,
                                "source_quality_score": quality_score,
                            })
                except Exception as e:
                    logger.error(f"Tavily search failed for query '{query}': {e}")
            else:
                logger.warning(f"TAVILY_API_KEY not configured. Skipping live Tavily search for: {query}")

        return discovered_sources
