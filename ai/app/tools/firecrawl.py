import logging
import os
import asyncio
from typing import Any, Optional

logger = logging.getLogger(__name__)


class FirecrawlTool:
    """Firecrawl web scraper & content extractor wrapper."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("FIRECRAWL_API_KEY")
        self._app = None
        if self.api_key:
            try:
                from firecrawl import FirecrawlApp
                self._app = FirecrawlApp(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Failed to initialize FirecrawlApp: {e}")

    async def scrape_url(self, url: str) -> Optional[dict[str, Any]]:
        """Scrape page content using Firecrawl.
        
        Returns:
            dict containing raw_html, markdown, metadata, and _source metadata
        """
        if not self._app:
            logger.info(f"FIRECRAWL_API_KEY not configured. Skipping Firecrawl for {url}")
            return None

        return await asyncio.to_thread(self._scrape_url_sync, url)

    def _scrape_url_sync(self, url: str) -> Optional[dict[str, Any]]:
        try:
            res = self._app.scrape(url, formats=["markdown", "html"], timeout=10000)
            if res:
                if hasattr(res, "model_dump"):
                    res_data = res.model_dump()
                elif isinstance(res, dict):
                    res_data = res
                else:
                    res_data = {
                        "markdown": getattr(res, "markdown", ""),
                        "html": getattr(res, "html", ""),
                        "metadata": getattr(res, "metadata", {}) or {},
                    }
                content = res_data.get("markdown") or res_data.get("html") or ""
                metadata = res_data.get("metadata", {}) or {}
                return {
                    "url": url,
                    "title": metadata.get("title", ""),
                    "content": content,
                    "raw_html": res_data.get("html", ""),
                    "_source": {
                        "url": url,
                        "title": metadata.get("title", ""),
                        "retrieved_by": "firecrawl"
                    }
                }
        except Exception as e:
            logger.error(f"Firecrawl scrape failed for {url}: {e}")

        return None
