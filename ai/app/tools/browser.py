import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class PlaywrightBrowserTool:
    """Headless Playwright browser tool for scraping JavaScript-rendered web pages."""

    def __init__(self, timeout_ms: int = 15000):
        self.timeout_ms = timeout_ms

    async def scrape_url(self, url: str) -> Optional[dict[str, Any]]:
        """Scrape dynamic JS web page using Playwright async API.
        
        Returns:
            dict containing raw_html, content text, title, and _source metadata
        """
        try:
            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
                page = await context.new_page()
                await page.goto(url, wait_until="domcontentloaded", timeout=self.timeout_ms)
                
                title = await page.title()
                html = await page.content()
                text_content = await page.inner_text("body")

                await browser.close()

                return {
                    "url": url,
                    "title": title,
                    "content": text_content,
                    "raw_html": html,
                    "_source": {
                        "url": url,
                        "title": title,
                        "retrieved_by": "playwright"
                    }
                }
        except Exception as e:
            logger.error(f"Playwright scrape failed for {url}: {e}")
            return None
