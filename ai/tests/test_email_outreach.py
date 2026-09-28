import pytest
from app.graph.nodes.email_outreach import email_outreach_node
from app.graph.workflow import build_collection_graph
from app.models.fine_tuned import MockRuleBasedModel
from app.schemas.workflow import WorkflowSpecification
from app.tools.mailer import EmailOutreachTool


@pytest.mark.asyncio
async def test_email_outreach_intent_detection():
    model = MockRuleBasedModel()
    prompt = (
        "Find 10 internship of backend role and make excel of all that company "
        "with social ids and mail them with my email id anshultrip1234@gmail.com"
    )
    spec = await model.generate_workflow_spec(prompt)

    assert spec["enable_email_outreach"] is True
    assert spec["sender_email"] == "anshultrip1234@gmail.com"
    assert spec["output_format"] == "excel"
    assert "email" in spec["fields"]
    assert "internship" in spec["outreach_role_or_topic"].lower()

    # Validates against Pydantic schema
    validated = WorkflowSpecification(**spec)
    assert validated.enable_email_outreach is True
    assert validated.sender_email == "anshultrip1234@gmail.com"


def test_email_outreach_tool_drafting():
    tool = EmailOutreachTool()
    draft = tool.draft_email(
        company_name="Acme Tech",
        role_or_topic="Backend Engineering Internship",
        contact_name="Sarah",
        sender_email="anshul@example.com"
    )

    assert "Acme Tech" in draft["subject"]
    assert "Backend Engineering Internship" in draft["subject"]
    assert "Dear Sarah" in draft["body"]
    assert "anshul@example.com" in draft["body"]


def test_email_outreach_tool_simulation():
    tool = EmailOutreachTool()
    res = tool.dispatch_email(
        recipient_email="careers@acmetech.io",
        subject="Internship Application",
        body="Hello, I am applying for the role.",
        sender_email="anshul@example.com",
        simulate=True
    )

    assert res["status"] == "simulated_sent"
    assert res["recipient"] == "careers@acmetech.io"


@pytest.mark.asyncio
async def test_email_outreach_node_execution():
    state = {
        "task_id": "test-outreach-1",
        "user_requirement": "Find 2 backend internships and mail them with my email id anshul@example.com",
        "specification": {
            "enable_email_outreach": True,
            "sender_email": "anshul@example.com",
            "outreach_role_or_topic": "Backend Internship"
        },
        "deduplicated_records": [
            {
                "company_name": "Stripe",
                "email": "jobs@stripe.com",
                "website": "https://stripe.com"
            },
            {
                "company_name": "Razorpay",
                "website": "https://razorpay.com"
            }
        ],
        "outreach_emails": []
    }

    result = await email_outreach_node(state)
    assert "outreach_emails" in result
    assert len(result["outreach_emails"]) == 2
    assert result["outreach_emails"][0]["company_name"] == "Stripe"
    assert result["outreach_emails"][0]["recipient"] == "jobs@stripe.com"
    assert result["outreach_emails"][0]["status"] == "simulated_sent"
    # Second company fallback email
    assert "razorpay" in result["outreach_emails"][1]["recipient"]


@pytest.mark.asyncio
async def test_full_graph_with_email_outreach():
    graph = build_collection_graph()
    initial_state = {
        "task_id": "test-compile-outreach",
        "user_requirement": "Find 1 backend internship and mail them with my email id anshul@example.com",
        "specification": {
            "enable_email_outreach": True,
            "sender_email": "anshul@example.com",
            "outreach_role_or_topic": "Backend Developer"
        },
        "search_queries": [],
        "discovered_sources": [
            {"url": "https://example.com/careers", "title": "Careers", "content": "Company: TechCorp. Founder: Alex. Email: careers@techcorp.com"}
        ],
        "raw_documents": [],
        "extracted_records": [],
        "validated_records": [],
        "deduplicated_records": [],
        "outreach_emails": [],
        "errors": [],
        "target_count": 1,
        "iteration": 1,
        "status": "init"
    }

    final_state = await graph.ainvoke(initial_state)
    assert "outreach_emails" in final_state
    assert len(final_state["outreach_emails"]) >= 1
