"""Playwright browser automation scraper module."""
from app.tools.browser import PlaywrightBrowserTool

async def scrape_dynamic_page(url: str) -> str:
    """Launches headless browser and extracts dynamic HTML content."""
    tool = PlaywrightBrowserTool()
    res = await tool.scrape_url(url)
    return res.get("raw_html", "") if res else ""

__all__ = ["PlaywrightBrowserTool", "scrape_dynamic_page"]
