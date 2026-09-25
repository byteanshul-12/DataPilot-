import pytest
from unittest.mock import AsyncMock, patch

from app.graph.workflow import build_collection_graph
from app.models.fine_tuned import MockRuleBasedModel


@pytest.mark.asyncio
async def test_full_e2e_pipeline_mocked():
    """End-to-end pipeline test covering:
    requirement -> model spec -> plan -> search -> extract -> validate -> deduplicate -> target check -> final dataset.
    """
    user_requirement = (
        "Find 2 Indian SaaS startups founded after 2022 with company name, founder, website and funding stage."
    )

    # 1. Verify Model Specification Generation
    model = MockRuleBasedModel()
    spec = await model.generate_workflow_spec(user_requirement)
    assert spec["intent"] == "extract_companys"
    assert spec["target_count"] == 2
    assert spec["entity_type"] == "company"
    assert spec["filters"].get("country") == "India"
    assert "company_name" in spec["fields"]

    # 2. Build LangGraph workflow
    graph = build_collection_graph()
    assert graph is not None

    # Mocked discovered sources simulating Tavily/Firecrawl/Playwright responses
    mock_sources = [
        {
            "url": "https://tech-india.com/saas-2023",
            "title": "Top Indian SaaS Startups 2023",
            "content": """
            Company: Acme Analytics. Founder: Rajesh Kumar. Website: https://acmeanalytics.io. Funding Stage: Seed.
            Company: DataSync AI. Founder: Priya Sharma. Website: https://datasync.ai. Funding Stage: Series A.
            """,
            "source": "tavily"
        }
    ]

    initial_state = {
        "task_id": "e2e-task-999",
        "user_requirement": user_requirement,
        "specification": spec,
        "search_queries": ["Indian SaaS startups 2023"],
        "discovered_sources": mock_sources,
        "raw_documents": [],
        "extracted_records": [],
        "validated_records": [],
        "deduplicated_records": [],
        "errors": [],
        "target_count": 2,
        "iteration": 1,
        "status": "init"
    }

    # 3. Execute graph asynchronously
    final_state = await graph.ainvoke(initial_state)

    # 4. Verify pipeline stages and output dataset
    assert final_state["status"] == "deduplication_completed"
    records = final_state.get("deduplicated_records", [])
    assert len(records) >= 1

    # Verify field extraction & provenance tracking
    rec1 = records[0]
    assert "company_name" in rec1
    assert "website" in rec1
    assert "_sources" in rec1
    assert len(rec1["_sources"]) > 0
    assert rec1["_sources"][0]["url"] == "https://tech-india.com/saas-2023"
