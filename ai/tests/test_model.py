import pytest
from unittest.mock import AsyncMock, patch

from app.models.base import ModelConfigurationError, ModelExecutionError
from app.models.fine_tuned import FineTunedHTTPModel, MockRuleBasedModel, _extract_json_from_text, get_model
from app.schemas.workflow import WorkflowSpecification


@pytest.mark.asyncio
async def test_mock_model_generation():
    model = MockRuleBasedModel()
    spec = await model.generate_workflow_spec(
        "Find 100 Indian SaaS startups founded after 2022 with company name, founder, website and funding stage."
    )
    
    assert spec["intent"] == "extract_companys"
    assert spec["target_count"] == 100
    assert spec["entity_type"] == "company"
    assert spec["filters"].get("country") == "India"
    assert spec["filters"].get("industry") == "SaaS"
    assert spec["filters"].get("founded_after") == 2022

    # Validate against Pydantic schema
    validated = WorkflowSpecification(**spec)
    assert validated.target_count == 100


def test_json_extractor_from_markdown():
    markdown_json = "```json\n{\n  \"intent\": \"test\",\n  \"target_count\": 10,\n  \"entity_type\": \"company\"\n}\n```"
    result = _extract_json_from_text(markdown_json)
    assert result["intent"] == "test"
    assert result["target_count"] == 10


def test_json_extractor_invalid_raises():
    invalid_text = "This is not json text at all"
    with pytest.raises(ModelExecutionError):
        _extract_json_from_text(invalid_text)


def test_missing_endpoint_configuration_raises():
    with pytest.raises(ModelConfigurationError):
        FineTunedHTTPModel(endpoint="", model_name="test")


@pytest.mark.asyncio
async def test_http_model_mocked_response():
    http_model = FineTunedHTTPModel(endpoint="http://mock-endpoint:8001", model_name="datapilot-model")
    
    mock_json_resp = {
        "choices": [
            {
                "message": {
                    "content": '{"intent": "find_jobs", "target_count": 25, "entity_type": "job", "fields": ["job_title"]}'
                }
            }
        ]
    }

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json = lambda: mock_json_resp
        mock_post.return_value = mock_response

        spec = await http_model.generate_workflow_spec("Find 25 developer jobs")
        assert spec["intent"] == "find_jobs"
        assert spec["target_count"] == 25
        assert spec["entity_type"] == "job"

