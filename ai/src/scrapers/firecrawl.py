"""Firecrawl API scraper wrapper module re-exporting FirecrawlTool."""
from app.tools.firecrawl import FirecrawlTool

class FirecrawlScraper(FirecrawlTool):
    """Backward compatibility wrapper class for FirecrawlScraper."""
    pass

__all__ = ["FirecrawlTool", "FirecrawlScraper"]
