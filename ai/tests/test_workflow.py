import pytest
from unittest.mock import AsyncMock, patch

from app.graph.nodes.plan import generate_plan_from_spec, plan_node
from app.graph.nodes.understand import understand_node
from app.graph.nodes.validate import validate_node, validate_single_record
from app.graph.workflow import build_collection_graph


@pytest.mark.asyncio
async def test_understand_node():
    state = {
        "task_id": "test-task-1",
        "user_requirement": "Find 10 Indian SaaS startups",
        "errors": []
    }
    with patch("app.graph.nodes.understand.get_model") as mock_get_model:
        mock_model = AsyncMock()
        mock_model.generate_workflow_spec.return_value = {
            "intent": "find_saas",
            "target_count": 10,
            "entity_type": "company",
            "fields": ["company_name", "website"]
        }
        mock_get_model.return_value = mock_model

        res = await understand_node(state)
        assert res["target_count"] == 10
        assert res["specification"]["entity_type"] == "company"


def test_generate_plan_from_spec():
    spec = {
        "intent": "find_saas_startups",
        "entity_type": "company",
        "filters": {"country": "India", "industry": "SaaS"},
        "fields": ["company_name", "founder", "website"],
        "source_types": ["company_website"],
        "deduplication_key": ["company_name", "website"],
        "validation_rules": ["company_name_required", "website_valid_url"]
    }
    plan = generate_plan_from_spec(spec)
    assert len(plan["queries"]) >= 1
    assert "company_name" in plan["fields"]
    assert "company_name_required" in plan["validation_rules"]


@pytest.mark.asyncio
async def test_validate_record_logic():
    valid_rec = {
        "company_name": "DataPilot Inc",
        "website": "https://datapilot.ai",
        "founder": "Jane Doe",
        "_source": {"url": "https://datapilot.ai", "retrieved_by": "firecrawl"}
    }
    res = validate_single_record(valid_rec, ["company_name_required", "website_valid_url"])
    assert res.valid is True
    assert len(res.errors) == 0

    invalid_rec = {
        "company_name": "",
        "website": "invalid-url-string",
        "founder": None
    }
    res_inv = validate_single_record(invalid_rec, ["company_name_required", "website_valid_url"])
    assert res_inv.valid is False
    assert len(res_inv.errors) >= 1


@pytest.mark.asyncio
async def test_full_graph_compilation_and_execution():
    graph = build_collection_graph()
    assert graph is not None

    initial_state = {
        "task_id": "test-compile-1",
        "user_requirement": "Find 2 Indian SaaS companies",
        "specification": {},
        "search_queries": [],
        "discovered_sources": [
            {"url": "https://example.com/startups", "title": "Example Startups List", "content": "Company: Acme SaaS. Founder: John. Website: https://acme.io"}
        ],
        "raw_documents": [],
        "extracted_records": [],
        "validated_records": [],
        "deduplicated_records": [],
        "errors": [],
        "target_count": 1,
        "iteration": 1,
        "status": "init"
    }

    final_state = await graph.ainvoke(initial_state)
    assert "deduplicated_records" in final_state
    assert final_state["target_count"] == 2

