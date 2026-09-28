import json
import pytest
from app.tools.parser import DataParserTool
from app.tools.quality import relevance_errors, record_confidence
from app.graph.nodes.deduplicate import deduplicate_node
from app.graph.nodes.validate import validate_node
from app.models.fine_tuned import MockRuleBasedModel
from app.graph.nodes.plan import generate_plan_from_spec


def test_navigation_cannot_become_companies():
    doc = {"url": "https://in.usembassy.gov/jobs", "title": "Jobs",
           "raw_html": '<nav><li class="item"><a href="https://bb.usembassy.gov">Barbados</a></li></nav>',
           "content": "Home Blog Top\nCompany About\nFor Personal InstaPoints"}
    assert DataParserTool().parse_document(doc, ["company_name", "website"]) == []


def test_job_schema_preserves_employer_and_role():
    item = {"@type": "JobPosting", "title": "AI Engineer", "hiringOrganization": {"name": "Acme", "url": "https://acme.test"},
            "jobLocation": {"address": {"addressLocality": "Bengaluru", "addressCountry": "India"}},
            "description": "Work on artificial intelligence", "url": "/jobs/123"}
    doc = {"url": "https://acme.test/careers", "raw_html": '<script type="application/ld+json">' + json.dumps(item) + '</script>'}
    records = DataParserTool().parse_document(doc, ["company_name", "job_title", "location", "application_link"], "job")
    assert len(records) == 1
    assert records[0]["application_link"] == "https://acme.test/jobs/123"
    assert relevance_errors(records[0], {"entity_type": "job", "filters": {"country": "India", "specialization": "artificial intelligence"}}) == []


@pytest.mark.asyncio
async def test_garbage_is_rejected_despite_high_confidence():
    result = await validate_node({"specification": {"entity_type": "job"}, "extracted_records": [
        {"company_name": "Barbados", "website": "https://bb.usembassy.gov", "confidence_score": 82,
         "_source": {"url": "https://in.usembassy.gov/jobs"}}]})
    assert result["validated_records"] == []
    assert result["errors"]


@pytest.mark.asyncio
async def test_different_jobs_same_employer_survive():
    result = await deduplicate_node({"specification": {"entity_type": "job", "deduplication_key": ["company_name", "job_title", "location"]},
        "validated_records": [{"company_name": "Acme", "website": "https://acme.test", "job_title": title, "location": "India"}
                              for title in ["AI Engineer", "Data Analyst"]]})
    assert len(result["deduplicated_records"]) == 2


def test_missing_evidence_does_not_score_82():
    assert record_confidence({"company_name": "Anything", "website": "https://example.com", "_source": {"url": "https://example.com"}}) <= 10


def test_ceo_is_not_automatically_a_founder():
    rows = DataParserTool().parse_document({"url": "https://example.com", "content": "Company: Acme. CEO: Jane Smith. Website: https://acme.test"}, ["company_name", "founder", "website"])
    assert rows[0]["founder"] is None


@pytest.mark.asyncio
async def test_semantic_extraction_rejects_invented_values(monkeypatch):
    from unittest.mock import AsyncMock, patch
    import httpx
    from app.tools.semantic import SemanticExtractor
    monkeypatch.setenv("EXTRACTION_MODEL", "test-model")
    payload = {"records": [{"fields": {"company_name": "Acme", "website": "https://invented.test"},
                           "evidence": {"company_name": "Acme is based in India", "website": "https://invented.test"},
                           "context": "Acme is based in India"}]}
    response = httpx.Response(200, json={"response": json.dumps(payload)}, request=httpx.Request("POST", "http://localhost"))
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=response)):
        rows = await SemanticExtractor().extract({"url": "https://example.com", "content": "Acme is based in India"}, {"fields": ["company_name", "website"], "entity_type": "company"})
    assert rows[0]["company_name"] == "Acme"
    assert rows[0]["website"] is None


def test_expired_job_is_rejected():
    row = {"company_name": "Acme", "job_title": "AI Engineer", "application_link": "https://acme.test/job", "location": "India",
           "_evidence": {"company_name": "Acme"}, "valid_through": "2020-01-01"}
    assert "Job posting has expired" in relevance_errors(row, {"entity_type": "job"})


def test_talent_pool_is_not_an_active_vacancy():
    row = {"company_name": "Acme", "job_title": "AI Trainers Network", "application_link": "https://acme.test/job", "location": "India",
           "_evidence": {"company_name": "Acme"}, "_context": "This is not an active job opening. Join our talent community."}
    assert any("talent pool" in e for e in relevance_errors(row, {"entity_type": "job"}))


@pytest.mark.asyncio
async def test_schema_and_table_evidence_are_both_used():
    item = {"@type": "Organization", "name": "Acme", "url": "https://acme.test", "description": "Acme builds a SaaS platform."}
    html = '<script type="application/ld+json">' + json.dumps(item) + '</script>' + '''
    <table><tr><th>Company</th><th>Headquarters</th></tr>
    <tr><td><span aria-hidden="true">A</span><a href="https://acme.test">Acme</a></td><td>Pune, India</td></tr>
    <tr><td></td><td colspan="2">Acme builds a SaaS platform.</td></tr></table>'''
    spec = {"entity_type": "company", "fields": ["company_name", "website"], "filters": {"country": "India", "industry": "SaaS"}}
    rows = DataParserTool().parse_document({"url": "https://directory.test", "raw_html": html}, spec["fields"])
    result = await validate_node({"specification": spec, "extracted_records": rows})
    assert len(result["validated_records"]) == 1
    assert result["validated_records"][0]["company_name"] == "Acme"
    assert result["validated_records"][0]["website"] == "https://acme.test"


def test_yc_directory_keeps_profile_separate_from_official_website():
    html = '<h1>SaaS Startups funded by Y Combinator (YC) in India 2026</h1><div><a href="/companies/acme"><span class="text-2xl">Acme</span> Bengaluru Active</a></div>'
    rows = DataParserTool().parse_document({"url": "https://www.ycombinator.com/companies/industry/saas/india", "raw_html": html}, ["company_name", "website"])
    row = next(r for r in rows if r.get("company_name") == "Acme")
    assert row["website"] is None
    assert row["_profile_url"] == "https://www.ycombinator.com/companies/acme"
    assert not relevance_errors(row, {"entity_type": "company", "filters": {"country": "India", "industry": "SaaS", "accelerator": "Y Combinator"}})


def test_yc_profile_extracts_explicit_official_link():
    doc = {"url": "https://www.ycombinator.com/companies/acme", "title": "Acme: SaaS tools | Y Combinator",
           "raw_html": '<div>Acme Location: Bengaluru India</div><a href="https://acme.test">https://acme.test</a><footer>Other companies</footer>'}
    rows = DataParserTool().parse_document(doc, ["company_name", "website"])
    assert rows[0]["company_name"] == "Acme"
    assert rows[0]["website"] == "https://acme.test"


@pytest.mark.parametrize("requirement,key,value", [
    ("Find 5 Indian AI jobs", "specialization", "artificial intelligence"),
    ("Find 5 Bengaluru SaaS companies", "city", "Bengaluru"),
    ("Find 5 Indian HR tech companies", "specialization", "HR tech"),
    ("Find 5 YC-backed Indian SaaS companies", "accelerator", "Y Combinator"),
    ("Find 5 Indian fintech companies", "industry", "fintech"),
])
@pytest.mark.asyncio
async def test_prompt_constraints_preserved(requirement, key, value):
    spec = await MockRuleBasedModel().generate_workflow_spec(requirement)
    assert spec["filters"][key] == value
    assert value in generate_plan_from_spec(spec)["queries"][0]
    assert relevance_errors({"company_name": "Acme", "_evidence": {"company_name": "Acme"}, "_context": "Acme"}, spec)
