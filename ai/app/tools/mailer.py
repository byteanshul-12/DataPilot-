import logging
import os
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Optional
from pathlib import Path

# Built-in lightweight .env loader (no external dependency needed)
def _load_env_fallback():
    root_env = Path(__file__).resolve().parents[3] / ".env"
    if root_env.is_file():
        with open(root_env, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    if key and key not in os.environ:
                        os.environ[key] = val

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[3] / ".env")
    load_dotenv()
except ImportError:
    _load_env_fallback()

logger = logging.getLogger(__name__)


class EmailOutreachTool:
    """Tool for drafting and sending contextual cold outreach emails to discovered contacts."""

    def __init__(
        self,
        smtp_host: Optional[str] = None,
        smtp_port: Optional[int] = None,
        smtp_user: Optional[str] = None,
        smtp_password: Optional[str] = None,
        from_email: Optional[str] = None,
    ):
        self.smtp_host = smtp_host or os.getenv("SMTP_HOST")
        self.smtp_port = smtp_port or int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = smtp_user or os.getenv("SMTP_USER")
        self.smtp_password = smtp_password or os.getenv("SMTP_PASSWORD")
        self.default_from = from_email or os.getenv("SMTP_FROM", self.smtp_user or "outreach@datapilot.ai")

    def is_smtp_configured(self) -> bool:
        """Check if live SMTP credentials are provided."""
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    def draft_email(
        self,
        company_name: str,
        role_or_topic: str,
        contact_name: Optional[str] = None,
        sender_name: Optional[str] = None,
        sender_email: Optional[str] = None,
        custom_notes: Optional[str] = None,
    ) -> dict[str, str]:
        """Generate a personalized, professional outreach subject and body."""
        greeting_name = contact_name if contact_name and contact_name.lower() != "unknown" else f"Hiring Team at {company_name}"
        clean_role = role_or_topic.title() if role_or_topic else "Backend Engineering Internship"
        clean_sender = sender_name or (sender_email.split("@")[0].replace(".", " ").title() if sender_email else "Applicant")

        subject = f"Application / Expression of Interest - {clean_role} at {company_name}"

        body = (
            f"Dear {greeting_name},\n\n"
            f"I hope this email finds you well.\n\n"
            f"I came across the {clean_role} opportunity at {company_name} and wanted to reach out directly to express my strong interest in joining your team.\n\n"
            f"I have been following {company_name}'s recent work and technical trajectory, and I am excited about the prospect of contributing to your backend infrastructure, APIs, and data engineering challenges.\n\n"
            f"I have attached my relevant profiles and experience for your review. Would you be open to a brief 10-minute introductory call next week to discuss how I can add value to your engineering team?\n\n"
            f"Thank you for your time and consideration. Looking forward to hearing from you!\n\n"
            f"Best regards,\n"
            f"{clean_sender}\n"
            f"{sender_email or ''}"
        ).strip()

        return {
            "subject": subject,
            "body": body,
        }

    def dispatch_email(
        self,
        recipient_email: str,
        subject: str,
        body: str,
        sender_email: Optional[str] = None,
        simulate: bool = False,
    ) -> dict[str, Any]:
        # The envelope From must be the verified sending domain (e.g. onboarding@resend.dev)
        from_addr = self.default_from

        # Check for email validity
        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", recipient_email):
            logger.warning(f"Invalid recipient email format: '{recipient_email}'")
            return {
                "recipient": recipient_email,
                "status": "failed",
                "error": "Invalid recipient email address syntax",
                "subject": subject,
                "body": body,
            }

        # If SMTP is not configured or simulation requested, perform safe simulated delivery
        if simulate or not self.is_smtp_configured():
            logger.info(
                f"[SIMULATED_DISPATCH] From: {from_addr} -> To: {recipient_email} | Subject: '{subject}'"
            )
            return {
                "recipient": recipient_email,
                "from_email": from_addr,
                "subject": subject,
                "body": body,
                "status": "simulated_sent",
                "mode": "simulation",
                "info": "Email drafted and verified. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD to send live emails.",
            }

        # Send live email via SMTP
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = from_addr
            msg["To"] = recipient_email
            if sender_email and sender_email != from_addr:
                msg["Reply-To"] = sender_email

            text_part = MIMEText(body, "plain")
            msg.attach(text_part)

            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=15) as server:
                server.ehlo()
                if server.has_extn("STARTTLS"):
                    server.starttls()
                    server.ehlo()
                if self.smtp_user and self.smtp_password:
                    server.login(self.smtp_user, self.smtp_password)
                server.sendmail(from_addr, [recipient_email], msg.as_string())

            logger.info(f"Live email sent successfully to {recipient_email}")
            return {
                "recipient": recipient_email,
                "from_email": from_addr,
                "subject": subject,
                "body": body,
                "status": "sent",
                "mode": "live",
            }
        except Exception as e:
            err_str = str(e)
            # Handle Resend sandbox restriction on unverified domains:
            # Resend free tier only delivers to the owner's email address.
            if "send testing emails to your own email address" in err_str and sender_email and sender_email != recipient_email:
                try:
                    logger.info(f"Resend sandbox mode: dispatching live copy to verified account email: {sender_email}")
                    sandbox_msg = MIMEMultipart("alternative")
                    sandbox_msg["Subject"] = f"[Outreach to {recipient_email}] {subject}"
                    sandbox_msg["From"] = from_addr
                    sandbox_msg["To"] = sender_email
                    sandbox_msg["Reply-To"] = sender_email
                    sandbox_msg.attach(MIMEText(body, "plain"))

                    with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=15) as server:
                        server.ehlo()
                        if server.has_extn("STARTTLS"):
                            server.starttls()
                            server.ehlo()
                        if self.smtp_user and self.smtp_password:
                            server.login(self.smtp_user, self.smtp_password)
                        server.sendmail(from_addr, [sender_email], sandbox_msg.as_string())

                    logger.info(f"Live sandbox preview email delivered to {sender_email}")
                    return {
                        "recipient": recipient_email,
                        "from_email": from_addr,
                        "subject": subject,
                        "body": body,
                        "status": "sent",
                        "mode": "live_sandbox",
                        "sandbox_notice": f"Delivered live copy to {sender_email} (Resend Sandbox). Verify a domain on resend.com to send directly to external inboxes."
                    }
                except Exception as inner_e:
                    logger.error(f"Fallback sandbox dispatch failed: {inner_e}")

            logger.error(f"Failed to send email to {recipient_email}: {e}")
            return {
                "recipient": recipient_email,
                "from_email": from_addr,
                "subject": subject,
                "body": body,
                "status": "failed",
                "error": str(e),
                "mode": "live",
            }
