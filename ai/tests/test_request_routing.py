import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.models.fine_tuned import MockRuleBasedModel
from app.services.request_policy import interpret_request, apply_request_policy
from app.graph.nodes.plan import generate_plan_from_spec
from app.tools.quality import relevance_errors


@pytest.mark.parametrize("text", ["Good morning", "How are you?", "Good morning how are you", "Hello!", "Thanks", "how are you doing today?"])
@pytest.mark.asyncio
async def test_smalltalk_never_calls_model_or_scraper(text):
    model = AsyncMock()
    spec = await interpret_request(text, model)
    assert spec["entity_type"] == "conversation"
    assert spec["plan_summary"]
    assert generate_plan_from_spec(spec)["queries"] == []
    model.generate_workflow_spec.assert_not_awaited()


@pytest.mark.parametrize("noun", ["role", "roles", "jobs", "positions", "vacancies", "openings"])
@pytest.mark.asyncio
async def test_backend_noida_constraints_survive(noun):
    spec = await interpret_request(f"Find 7 backend {noun} in Noida.", MockRuleBasedModel())
    assert spec["entity_type"] == "job"
    assert spec["filters"]["city"] == "Noida"
    assert spec["filters"]["role"] == "backend"
    assert spec["target_count"] == 7
    assert not spec["needs_clarification"]
    assert all("Noida" in q and "backend" in q for q in generate_plan_from_spec(spec)["queries"])


@pytest.mark.asyncio
async def test_original_typo_needs_confirmation_without_model():
    model = AsyncMock()
    spec = await interpret_request("Find 7 backend role in nodia.", model)
    assert spec["entity_type"] == "job"
    assert spec["needs_clarification"]
    assert "Noida" in spec["clarification_questions"][0]
    assert generate_plan_from_spec(spec)["queries"] == []
    model.generate_workflow_spec.assert_not_awaited()


def test_omitted_constraints_restored_and_wrong_results_rejected():
    spec = apply_request_policy("Find 7 backend roles in Noida", {"intent": "extract_companys", "entity_type": "company", "filters": {}})
    row = {"company_name": "Acme", "job_title": "Backend Engineer", "application_link": "https://acme.test/jobs/1",
           "location": "New York, United States", "_evidence": {"company_name": "Acme"}, "_context": "Backend engineer"}
    assert any("city=Noida" in e for e in relevance_errors(row, spec))
    row["location"] = "Noida, India"
    assert not relevance_errors(row, spec)
    row["job_title"] = "Frontend Engineer"
    assert any("role=backend" in e for e in relevance_errors(row, spec))


def test_run_and_results_expose_reply_without_background_job():
    client = TestClient(app)
    with patch("app.api.routes.task_manager.start_task_background") as start:
        for text, status in [("Good morning how are you", "answered"), ("Find 7 backend role in nodia.", "needs_clarification")]:
            res = client.post("/api/v1/workflows/run", json={"requirement": text})
            assert res.status_code == 202
            data = res.json()
            assert data["status"] == status
            assert data["reply"]
            output = client.get(f"/api/v1/workflows/{data['task_id']}/results").json()
            assert output["status"] == status
            assert output["records"] == []
            assert output["reply"]
            assert not output["target_met"]
        start.assert_not_called()


@pytest.mark.asyncio
async def test_mixed_greeting_and_request_is_not_discarded():
    spec = await interpret_request("Good morning, find 7 backend jobs in Noida.", MockRuleBasedModel())
    assert spec["entity_type"] == "job"
    assert not spec["needs_clarification"]


@pytest.mark.asyncio
async def test_graph_exits_before_search_for_clarification():
    from app.graph.workflow import build_collection_graph
    with patch("app.graph.nodes.search.TavilySearchTool.search", new_callable=AsyncMock) as search:
        state = await build_collection_graph().ainvoke({"user_requirement": "Find 7 backend role in nodia.", "specification": {}})
        assert state["specification"]["needs_clarification"]
        search.assert_not_awaited()


def test_model_filter_aliases_normalized():
    spec = apply_request_policy("Find 7 backend roles in Noida", {"intent": "jobs", "entity_type": "job", "filters": {"job_role": ["backend developer", "backend engineer"], "job_location": "Noida"}, "fields": ["job_location", "posted_date"]})
    assert "job_role" not in spec["filters"]
    assert "job_location" not in spec["filters"]
    assert spec["filters"]["role"] == "backend"
    assert "job_location" not in spec["fields"]


@pytest.mark.asyncio
async def test_original_requirement_rechecked_before_accepting_rows():
    from app.graph.nodes.validate import validate_node
    row = {"company_name": "Acme", "website": "https://acme.test", "_evidence": {"company_name": "Acme"}, "_source": {"url": "https://acme.test"}}
    result = await validate_node({"user_requirement": "Find 7 backend roles in Noida", "specification": {"intent": "companies", "entity_type": "company", "filters": {}}, "extracted_records": [row]})
    assert result["validated_records"] == []


def test_planner_failure_does_not_queue_search():
    client = TestClient(app)
    with patch("app.api.routes.get_model") as get_model, patch("app.api.routes.task_manager.start_task_background") as start:
        model = AsyncMock()
        model.generate_workflow_spec.side_effect = RuntimeError("offline")
        get_model.return_value = model
        response = client.post("/api/v1/workflows/run", json={"requirement": "Find 7 backend roles in Noida"})
        assert response.status_code == 503
        start.assert_not_called()
