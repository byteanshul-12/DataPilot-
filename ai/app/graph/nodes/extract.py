import logging
import asyncio
import os
from typing import Any

from app.graph.state import WorkflowState
from app.tools.browser import PlaywrightBrowserTool
from app.tools.firecrawl import FirecrawlTool
from app.tools.parser import DataParserTool
from app.tools.semantic import SemanticExtractor
from app.tools.quality import relevance_errors
from app.tools.fetch_policy import source_allowed, cached_document, cache_document

logger = logging.getLogger(__name__)

MAX_PARALLEL_SOURCES = int(os.getenv("MAX_PARALLEL_SOURCES", "6"))
MAX_SOURCE_CANDIDATES = int(os.getenv("MAX_SOURCE_CANDIDATES", "30"))
FIRECRAWL_SOURCE_LIMIT = int(os.getenv("FIRECRAWL_SOURCE_LIMIT", "8"))
ENABLE_PLAYWRIGHT = os.getenv("ENABLE_PLAYWRIGHT", "true").lower() not in {"0", "false", "no"}


def _snippet_doc(src: dict[str, Any]) -> dict[str, Any] | None:
    url = src.get("url")
    if not url or not src.get("content"):
        return None
    return {
        "url": url,
        "title": src.get("title", ""),
        "content": src.get("content", ""),
        "raw_html": "",
        "_source": {
            "url": url,
            "title": src.get("title", ""),
            "retrieved_by": "tavily",
            "source_type": src.get("source_type", "search_result"),
            "source_quality_score": src.get("source_quality_score", 50),
        }
    }


async def _scrape_source(
    src: dict[str, Any],
    index: int,
    firecrawl: FirecrawlTool,
    browser: PlaywrightBrowserTool,
    semaphore: asyncio.Semaphore,
) -> list[dict[str, Any]]:
    url = src.get("url")
    if not url or not source_allowed(url):
        return []

    async with semaphore:
        docs = []
        result = cached_document(url)
        from_cache = result is not None
        async def fetch(call):
            try:
                return await asyncio.wait_for(call, timeout=25)
            except Exception:
                return None
        if not result and index < FIRECRAWL_SOURCE_LIMIT:
            result = await fetch(firecrawl.scrape_url(url))
        spec = src.get("_spec", {})
        candidates = DataParserTool().parse_document(result, spec.get("fields", []), spec.get("entity_type", "company")) if result and spec else []
        usable = result and (not spec or any(not relevance_errors(r, spec) for r in candidates))
        if not usable and not from_cache and ENABLE_PLAYWRIGHT:
            rendered = await fetch(browser.scrape_url(url))
            if rendered:
                result = rendered
        if result:
            from datetime import datetime, timezone
            result.setdefault("_source", {}).setdefault("retrieved_at", datetime.now(timezone.utc).isoformat())
            cache_document(url, result)
            docs.append(result)
        snippet = _snippet_doc(src)
        if snippet and not docs:
            docs.append(snippet)

        for doc in docs:
            if isinstance(doc.get("_source"), dict):
                doc["_source"].setdefault("source_type", src.get("source_type", "scraped_page"))
                doc["_source"].setdefault("source_quality_score", src.get("source_quality_score", 60))
        return docs


async def extract_node(state: WorkflowState) -> dict[str, Any]:
    """LangGraph node: Extract structured records from discovered sources using Firecrawl, Playwright fallback, and BeautifulSoup parsing."""
    logger.info(f"[{state.get('task_id')}] Running EXTRACT node")
    discovered_sources = state.get("discovered_sources", [])
    spec = state.get("specification", {})
    fields = spec.get("fields") or ["company_name", "website", "founder"]
    entity_type = spec.get("entity_type", "company")

    firecrawl = FirecrawlTool()
    browser = PlaywrightBrowserTool()
    parser = DataParserTool()
    semantic = SemanticExtractor()
    semantic_urls = set(state.get("semantic_urls", []))
    errors = list(state.get("errors", []))

    raw_docs = list(state.get("raw_documents", []))
    extracted_records = list(state.get("extracted_records", []))
    scraped_urls = {doc["url"] for doc in raw_docs if "url" in doc}
    attempted_urls = set(state.get("attempted_urls", []))
    scraped_doc_keys = {
        f"{doc.get('url')}:{doc.get('_source', {}).get('retrieved_by', 'unknown')}"
        for doc in raw_docs
        if doc.get("url")
    }

    candidate_sources = sorted(
        [s for s in discovered_sources if s.get("url") not in scraped_urls and s.get("url") not in attempted_urls],
        key=lambda item: item.get("source_quality_score") or 0,
        reverse=True,
    )[:MAX_SOURCE_CANDIDATES]
    semaphore = asyncio.Semaphore(MAX_PARALLEL_SOURCES)
    scrape_tasks = []

    for index, src in enumerate(candidate_sources):
        url = src.get("url")
        if not url or url in scraped_urls:
            continue
        attempted_urls.add(url)
        scrape_tasks.append(_scrape_source(dict(src, _spec=spec), index, firecrawl, browser, semaphore))

    scraped_groups = await asyncio.gather(*scrape_tasks, return_exceptions=True)
    for src, group in zip(candidate_sources, scraped_groups):
        if not group or isinstance(group, Exception):
            errors.append(f"No permitted usable document fetched: {src.get('url')}")
    for group in scraped_groups:
        if isinstance(group, Exception):
            logger.error(f"Parallel scrape task failed: {group}")
            continue
        for doc in group:
            url = doc.get("url")
            doc_key = f"{url}:{doc.get('_source', {}).get('retrieved_by', 'unknown')}"
            if not url or doc_key in scraped_doc_keys:
                continue
            scraped_doc_keys.add(doc_key)
            scraped_urls.add(url)
            raw_docs.append(doc)
            records = parser.parse_document(doc, requested_fields=fields, entity_type=entity_type)
            if not any(not relevance_errors(r, spec) for r in records) and url not in semantic_urls and len(semantic_urls) < min(2, int(os.getenv("SEMANTIC_SOURCE_LIMIT", "2"))):
                semantic_urls.add(url)
                try:
                    records.extend(await asyncio.wait_for(semantic.extract(doc, spec), timeout=45))
                except Exception as exc:
                    errors.append(f"Semantic extraction failed for {url}: {type(exc).__name__}")
            extracted_records.extend(records)

    profile_urls = list(dict.fromkeys(r.get("_profile_url") for r in extracted_records if r.get("_profile_url") and r["_profile_url"] not in scraped_urls))
    if entity_type == "company":
        for record in extracted_records:
            website = record.get("website")
            if website and website not in scraped_urls and website not in profile_urls and not relevance_errors(record, spec) and any(not record.get(f) for f in fields):
                profile_urls.append(website)
    profile_sources = [{"url": url, "source_quality_score": 85, "_spec": spec} for url in profile_urls if url not in attempted_urls][:min(state.get("target_count", 5), 5)]
    attempted_urls.update(s["url"] for s in profile_sources)
    if profile_sources:
        groups = await asyncio.gather(*[_scrape_source(src, index, firecrawl, browser, semaphore) for index, src in enumerate(profile_sources)], return_exceptions=True)
        for group in groups:
            if isinstance(group, Exception):
                continue
            for doc in group:
                raw_docs.append(doc)
                records = parser.parse_document(doc, fields, entity_type)
                if not records and doc.get("url") not in semantic_urls and len(semantic_urls) < min(2, int(os.getenv("SEMANTIC_SOURCE_LIMIT", "2"))):
                    semantic_urls.add(doc.get("url"))
                    try:
                        records = await asyncio.wait_for(semantic.extract(doc, spec), timeout=45)
                    except Exception as exc:
                        errors.append(f"Profile extraction failed for {doc.get('url')}: {type(exc).__name__}")
                extracted_records.extend(records)
        discovered_sources = list(discovered_sources) + profile_sources

    logger.info(f"EXTRACT node extracted {len(extracted_records)} total candidate records across {len(raw_docs)} documents.")

    return {
        "raw_documents": raw_docs,
        "discovered_sources": discovered_sources,
        "extracted_records": extracted_records,
        "errors": errors,
        "attempted_urls": list(attempted_urls),
        "semantic_urls": list(semantic_urls),
        "status": "extraction_completed"
    }
