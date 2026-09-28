import logging
from typing import Any

from app.graph.state import WorkflowState
from app.tools.mailer import EmailOutreachTool

logger = logging.getLogger(__name__)


async def email_outreach_node(state: WorkflowState) -> dict[str, Any]:
    """LangGraph node: Draft and dispatch automated cold emails for collected records if requested."""
    task_id = state.get("task_id", "unknown")
    logger.info(f"[{task_id}] Running EMAIL_OUTREACH node")

    spec = state.get("specification", {})
    user_req = state.get("user_requirement", "").lower()
    enable_outreach = spec.get("enable_email_outreach", False)

    # Secondary check: if requirement explicitly asked to mail/email them
    if not enable_outreach:
        if any(term in user_req for term in ["mail them", "email them", "send email", "send mail", "cold mail", "outreach"]):
            enable_outreach = True

    if not enable_outreach:
        logger.info(f"[{task_id}] Email outreach not requested. Skipping email dispatch.")
        return {
            "outreach_emails": [],
            "status": "completed"
        }

    records = state.get("deduplicated_records", [])
    if not records:
        logger.info(f"[{task_id}] No records available for email outreach.")
        return {
            "outreach_emails": [],
            "status": "completed"
        }

    sender_email = spec.get("sender_email")
    role_or_topic = spec.get("outreach_role_or_topic") or spec.get("entity_type", "opportunity")

    mailer = EmailOutreachTool()
    dispatched_emails: list[dict[str, Any]] = []

    for index, record in enumerate(records, 1):
        # Look for contact email in various common field names
        recipient_email = (
            record.get("email")
            or record.get("contact_email")
            or record.get("founder_email")
            or record.get("hr_email")
            or record.get("careers_email")
        )

        company_name = (
            record.get("company_name")
            or record.get("company")
            or record.get("organization")
            or record.get("name")
            or "Target Organization"
        )

        contact_name = (
            record.get("founder")
            or record.get("contact_person")
            or record.get("recruiter")
            or record.get("hiring_manager")
        )

        # If no explicit email was extracted, construct standard company contact or careers email
        if not recipient_email and record.get("website"):
            domain = str(record["website"]).replace("https://", "").replace("http://", "").split("/")[0]
            if domain:
                recipient_email = f"careers@{domain}"

        if not recipient_email:
            # Fallback if no domain available
            clean_company_slug = "".join(c for c in company_name if c.isalnum()).lower()
            recipient_email = f"careers@{clean_company_slug}.com"

        # Generate draft
        draft = mailer.draft_email(
            company_name=company_name,
            role_or_topic=role_or_topic,
            contact_name=contact_name,
            sender_email=sender_email,
        )

        # Dispatch (live SMTP or verified simulation)
        dispatch_result = mailer.dispatch_email(
            recipient_email=recipient_email,
            subject=draft["subject"],
            body=draft["body"],
            sender_email=sender_email,
            simulate=not mailer.is_smtp_configured(),
        )

        dispatch_result["company_name"] = company_name
        dispatch_result["record_index"] = index
        dispatched_emails.append(dispatch_result)

    logger.info(f"[{task_id}] Email outreach completed: {len(dispatched_emails)} emails processed.")

    return {
        "outreach_emails": dispatched_emails,
        "status": "completed"
    }
