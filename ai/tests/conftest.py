import pytest


@pytest.fixture(autouse=True)
def offline_services(monkeypatch):
    """Unit tests must never spend real API credits or launch browsers."""
    from app.tools.firecrawl import FirecrawlTool
    from app.tools.browser import PlaywrightBrowserTool
    from app.tools.tavily import TavilySearchTool
    monkeypatch.setenv("MODEL_PROVIDER", "mock")
    monkeypatch.setenv("EXTRACTION_MODEL", "")
    async def no_document(*args, **kwargs):
        return None
    async def no_search(*args, **kwargs):
        return []
    monkeypatch.setattr(FirecrawlTool, "scrape_url", no_document)
    monkeypatch.setattr(PlaywrightBrowserTool, "scrape_url", no_document)
    monkeypatch.setattr(TavilySearchTool, "search", no_search)
