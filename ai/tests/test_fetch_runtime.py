import asyncio
from unittest.mock import AsyncMock
import pytest
from app.tools import fetch_policy
from app.graph.nodes.extract import _scrape_source
from app.services.task_manager import TaskManager


@pytest.fixture(autouse=True)
def empty_cache():
    fetch_policy._cache.clear()
    yield
    fetch_policy._cache.clear()


@pytest.mark.asyncio
async def test_primary_success_skips_browser_and_cached_fetch():
    doc = {"url": "https://acme.test", "content": "Company: Acme", "_source": {"url": "https://acme.test"}}
    primary, browser = AsyncMock(), AsyncMock()
    primary.scrape_url.return_value = doc
    src = {"url": doc["url"]}
    result = await _scrape_source(src, 0, primary, browser, asyncio.Semaphore(1))
    result[0]["content"] = "modified"
    second = await _scrape_source(src, 0, primary, browser, asyncio.Semaphore(1))
    assert second[0]["content"] == "Company: Acme"
    assert second[0]["_source"]["retrieved_at"]
    primary.scrape_url.assert_awaited_once()
    browser.scrape_url.assert_not_awaited()


@pytest.mark.asyncio
async def test_primary_failure_uses_browser():
    primary, browser = AsyncMock(), AsyncMock()
    primary.scrape_url.return_value = None
    browser.scrape_url.return_value = {"url": "https://acme.test", "content": "Acme"}
    docs = await _scrape_source({"url": "https://acme.test"}, 0, primary, browser, asyncio.Semaphore(1))
    assert docs[0]["content"] == "Acme"
    browser.scrape_url.assert_awaited_once()


def test_operator_domain_restrictions(monkeypatch):
    monkeypatch.setenv("SCRAPE_ALLOWED_DOMAINS", "example.com")
    monkeypatch.setenv("SCRAPE_DENIED_DOMAINS", "blocked.example.com")
    assert fetch_policy.source_allowed("https://jobs.example.com/a")
    assert not fetch_policy.source_allowed("https://example.com.evil.test/a")
    assert not fetch_policy.source_allowed("https://blocked.example.com/a")
    assert not fetch_policy.source_allowed("file:///data")


@pytest.mark.asyncio
async def test_deadline_preserves_partial_results(monkeypatch):
    monkeypatch.setenv("WORKFLOW_TIMEOUT_SECONDS", "0.02")
    class SlowGraph:
        async def astream(self, *args, **kwargs):
            yield {"specification": {"target_count": 2}, "deduplicated_records": [{"company_name": "Acme"}]}
            await asyncio.sleep(1)
    manager = TaskManager()
    monkeypatch.setattr(manager, "_graph", SlowGraph())
    task_id = manager.create_task("Find 2 companies")
    await manager._run_workflow_async(task_id)
    result = manager.get_task_status(task_id)
    assert result["status"] == "partial"
    assert len(result["result_records"]) == 1
    assert "time budget" in result["errors"][-1]
