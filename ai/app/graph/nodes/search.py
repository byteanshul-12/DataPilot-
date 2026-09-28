import logging
import os
from typing import Any

from app.graph.state import WorkflowState
from app.tools.tavily import TavilySearchTool

logger = logging.getLogger(__name__)

MIN_CANDIDATE_SOURCES = int(os.getenv("MIN_CANDIDATE_SOURCES", "20"))
MAX_CANDIDATE_SOURCES = int(os.getenv("MAX_CANDIDATE_SOURCES", "30"))
CANDIDATE_MULTIPLIER = int(os.getenv("CANDIDATE_MULTIPLIER", "6"))


async def search_node(state: WorkflowState) -> dict[str, Any]:
    """LangGraph node: Execute web search queries via Tavily and update discovered_sources."""
    logger.info(f"[{state.get('task_id')}] Running SEARCH node (Iteration {state.get('iteration', 1)})")
    queries = state.get("search_queries", [])
    iteration = state.get("iteration", 1)
    if iteration > 1:
        suffixes = ["official website", "company profile", "careers apply"]
        suffix = "careers apply" if state.get("specification", {}).get("entity_type") == "job" else suffixes[min(iteration - 2, 1)]
        queries = [f"{q} {suffix}" for q in queries]
    existing_sources = list(state.get("discovered_sources", []))
    existing_urls = {s["url"] for s in existing_sources if "url" in s}
    has_seeded_sources = any("source_quality_score" not in s for s in existing_sources)

    # If the workflow was seeded with sources, extract those first before expanding search.
    if existing_sources and (not state.get("raw_documents") or has_seeded_sources):
        return {
            "discovered_sources": existing_sources,
            "status": "search_completed"
        }

    target_count = state.get("target_count", 10)
    candidate_target = min(max(target_count * CANDIDATE_MULTIPLIER, MIN_CANDIDATE_SOURCES), MAX_CANDIDATE_SOURCES)
    max_results_per_query = min(10, max(5, candidate_target // max(len(queries), 1) + 1))

    tavily_tool = TavilySearchTool()
    new_sources = await tavily_tool.search(queries=queries, max_results_per_query=max_results_per_query)
    if state.get("specification", {}).get("entity_type") == "job":
        import re
        new_sources = [s for s in new_sources if
                       re.search(r"jobs|careers|greenhouse|lever\.co|ashbyhq|workable", s.get("url", ""), re.I)
                       and not re.search(r"best.countries|/blog/|usembassy", s.get("url", ""), re.I)]
        for source in new_sources:
            if re.search(r"lever\.co|greenhouse\.io|ashbyhq\.com|workable\.com", source.get("url", "")):
                source["source_quality_score"] = 90
        new_sources.sort(key=lambda s: s.get("source_quality_score", 0), reverse=True)

    # Reserve candidates from every query instead of letting the first query fill the budget.
    buckets = {}
    for source in new_sources:
        buckets.setdefault(source.get("search_query", ""), []).append(source)
    new_sources = []
    while any(buckets.values()):
        for bucket in buckets.values():
            if bucket:
                new_sources.append(bucket.pop(0))
    added_count = 0
    for src in new_sources:
        url = src.get("url")
        if url and url not in existing_urls:
            existing_urls.add(url)
            existing_sources.append(src)
            added_count += 1
            if added_count >= candidate_target:
                break

    logger.info(f"SEARCH node discovered {added_count} new unique sources (Total: {len(existing_sources)})")

    return {
        "discovered_sources": existing_sources,
        "status": "search_completed"
    }
