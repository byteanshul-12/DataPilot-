import pytest
from app.graph.nodes.deduplicate import deduplicate_node, get_dedup_key_str, normalize_value


def test_normalize_value():
    assert normalize_value("  https://www.Example.com/  ") == "examplecom"
    assert normalize_value("Acme SaaS Inc.,") == "acme saas inc"


def test_get_dedup_key_str():
    record = {
        "company_name": "Acme SaaS",
        "website": "https://acme.io"
    }
    key = get_dedup_key_str(record, ["company_name", "website"])
    assert key == "acme saas|acmeio"


@pytest.mark.asyncio
async def test_deduplicate_node_exact_and_fuzzy():
    validated_records = [
        {
            "company_name": "DataPilot Technologies",
            "website": "https://datapilot.ai",
            "founder": "Alice",
            "_source": {"url": "https://source1.com", "retrieved_by": "firecrawl"}
        },
        {
            "company_name": "DataPilot Technologies Inc",
            "website": "https://datapilot.ai/",
            "founder": "Alice Smith",
            "_source": {"url": "https://source2.com", "retrieved_by": "playwright"}
        },
        {
            "company_name": "Other Startup",
            "website": "https://other.com",
            "founder": "Bob",
            "_source": {"url": "https://source3.com", "retrieved_by": "tavily"}
        }
    ]

    state = {
        "task_id": "dedup-test-1",
        "validated_records": validated_records,
        "specification": {
            "deduplication_key": ["company_name", "website"]
        }
    }

    res = await deduplicate_node(state)
    deduped = res["deduplicated_records"]
    assert len(deduped) == 2  # The first two records merged into one

    datapilot_rec = next(r for r in deduped if "datapilot" in r["website"].lower())
    assert datapilot_rec["founder"] is not None
    # Verify that source provenance from both records was merged into _sources
    sources = datapilot_rec["_sources"]
    assert len(sources) == 2
    source_retrievers = {s["retrieved_by"] for s in sources}
    assert "firecrawl" in source_retrievers
    assert "playwright" in source_retrievers
