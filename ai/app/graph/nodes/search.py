import logging
from typing import Any

from app.graph.state import WorkflowState
from app.tools.tavily import TavilySearchTool

logger = logging.getLogger(__name__)


async def search_node(state: WorkflowState) -> dict[str, Any]:
    """LangGraph node: Execute web search queries via Tavily and update discovered_sources."""
    logger.info(f"[{state.get('task_id')}] Running SEARCH node (Iteration {state.get('iteration', 1)})")
    queries = state.get("search_queries", [])
    existing_sources = list(state.get("discovered_sources", []))
    existing_urls = {s["url"] for s in existing_sources if "url" in s}

    tavily_tool = TavilySearchTool()
    new_sources = await tavily_tool.search(queries=queries, max_results_per_query=5)

    added_count = 0
    for src in new_sources:
        url = src.get("url")
        if url and url not in existing_urls:
            existing_urls.add(url)
            existing_sources.append(src)
            added_count += 1

    logger.info(f"SEARCH node discovered {added_count} new unique sources (Total: {len(existing_sources)})")

    return {
        "discovered_sources": existing_sources,
        "status": "search_completed"
    }
