import logging
import os
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

        try:
            res = self._app.scrape_url(url, params={"formats": ["markdown", "html"]})
            if res:
                content = res.get("markdown") or res.get("html") or ""
                metadata = res.get("metadata", {})
                return {
                    "url": url,
                    "title": metadata.get("title", ""),
                    "content": content,
                    "raw_html": res.get("html", ""),
                    "_source": {
                        "url": url,
                        "title": metadata.get("title", ""),
                        "retrieved_by": "firecrawl"
                    }
                }
        except Exception as e:
            logger.error(f"Firecrawl scrape failed for {url}: {e}")

        return None
