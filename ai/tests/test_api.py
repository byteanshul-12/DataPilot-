import os
import pytest
from fastapi.testclient import TestClient

# Ensure test mode for model provider
os.environ["MODEL_PROVIDER"] = "mock"

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "datapilot-ai"


def test_analyze_endpoint():
    payload = {
        "requirement": "Find 100 Indian SaaS startups founded after 2022 with company name, founder, website and funding stage."
    }
    response = client.post("/api/v1/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "specification" in data
    spec = data["specification"]
    assert spec["entity_type"] == "company"
    assert "company_name" in spec["fields"]


def test_analyze_endpoint_empty():
    response = client.post("/api/v1/analyze", json={"requirement": "   "})
    assert response.status_code == 400


def test_workflow_plan_endpoint():
    payload = {
        "requirement": "Find 50 Indian SaaS startups founded after 2022"
    }
    response = client.post("/api/v1/workflow/plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "specification" in data
    assert "plan" in data
    plan = data["plan"]
    assert len(plan["queries"]) > 0


def test_workflow_run_status_results_cancel_flow():
    # 1. Run workflow
    payload = {
        "requirement": "Find 5 Indian SaaS startups with website and founder"
    }
    run_res = client.post("/api/v1/workflows/run", json=payload)
    assert run_res.status_code == 202
    run_data = run_res.json()
    assert "task_id" in run_data
    task_id = run_data["task_id"]
    assert run_data["status"] == "queued"

    # 2. Get status
    status_res = client.get(f"/api/v1/workflows/{task_id}")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["task_id"] == task_id
    assert "progress" in status_data

    # 3. Get results
    results_res = client.get(f"/api/v1/workflows/{task_id}/results")
    assert results_res.status_code == 200
    results_data = results_res.json()
    assert results_data["task_id"] == task_id

    # 4. Cancel task
    cancel_res = client.post(f"/api/v1/workflows/{task_id}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"
