import logging
from typing import Any

from app.graph.state import WorkflowState
from app.tools.browser import PlaywrightBrowserTool
from app.tools.firecrawl import FirecrawlTool
from app.tools.parser import DataParserTool

logger = logging.getLogger(__name__)


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

    raw_docs = list(state.get("raw_documents", []))
    extracted_records = list(state.get("extracted_records", []))
    scraped_urls = {doc["url"] for doc in raw_docs if "url" in doc}

    for src in discovered_sources:
        url = src.get("url")
        if not url or url in scraped_urls:
            continue

        doc = None
        # First choice: Firecrawl
        doc = await firecrawl.scrape_url(url)
        
        # Fallback choice: Playwright browser
        if not doc:
            logger.info(f"Firecrawl unavailable or failed for {url}. Trying Playwright browser fallback.")
            doc = await browser.scrape_url(url)

        # Fallback to Tavily title/content snippet if scrapers failed
        if not doc and src.get("content"):
            doc = {
                "url": url,
                "title": src.get("title", ""),
                "content": src.get("content", ""),
                "raw_html": "",
                "_source": {
                    "url": url,
                    "title": src.get("title", ""),
                    "retrieved_by": "tavily"
                }
            }

        if doc:
            scraped_urls.add(url)
            raw_docs.append(doc)
            records = parser.parse_document(doc, requested_fields=fields, entity_type=entity_type)
            extracted_records.extend(records)

    logger.info(f"EXTRACT node extracted {len(extracted_records)} total candidate records across {len(raw_docs)} documents.")

    return {
        "raw_documents": raw_docs,
        "extracted_records": extracted_records,
        "status": "extraction_completed"
    }
