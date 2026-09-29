import logging
import os
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Optional
from ai.config import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    SMTP_FROM,
    RESEND_API_KEY,
)

logger = logging.getLogger("datapilot.mailer")
logger.setLevel(logging.INFO)


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
        self.smtp_host = smtp_host or SMTP_HOST
        self.smtp_port = smtp_port or SMTP_PORT
        self.smtp_user = smtp_user or SMTP_USER
        self.smtp_password = smtp_password or SMTP_PASSWORD
        self.default_from = from_email or SMTP_FROM

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
        greeting_name = (
            contact_name
            if contact_name and contact_name.lower() != "unknown"
            else f"Team at {company_name}"
        )
        clean_role = role_or_topic.title() if role_or_topic else "Business Partnership & Opportunities"
        clean_sender = sender_name or (
            sender_email.split("@")[0].replace(".", " ").title()
            if sender_email
            else "DataPilot Inquirer"
        )

        subject = f"Inquiry / Expression of Interest - {clean_role} at {company_name}"

        body = (
            f"Dear {greeting_name},\n\n"
            f"I hope this message finds you well.\n\n"
            f"I came across {company_name}'s recent work in the industry and wanted to reach out directly regarding {clean_role}.\n\n"
            f"We are exploring strategic synergies, technical opportunities, and data partnerships with leading teams in your domain.\n\n"
            f"Would you or a relevant member of your team be open to a brief 10-minute introductory call next week to explore potential collaboration?\n\n"
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
        from_addr = self.default_from

        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", recipient_email):
            logger.warning(f"Invalid recipient email syntax: '{recipient_email}'")
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
                "info": "Email drafted and verified. Set SMTP_PASSWORD to send live emails.",
            }

        # Live SMTP delivery
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
            # Handle Resend sandbox restriction: Resend free tier only delivers to account owner's email
            if "send testing emails to your own email address" in err_str:
                email_match = re.search(r"\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b", err_str)
                target_sandbox = sender_email or (email_match.group(1) if email_match else None)
                if target_sandbox and target_sandbox != recipient_email:
                    try:
                        logger.info(f"Resend sandbox: dispatching live copy to verified account email: {target_sandbox}")
                        sandbox_msg = MIMEMultipart("alternative")
                        sandbox_msg["Subject"] = f"[Outreach Preview for {recipient_email}] {subject}"
                        sandbox_msg["From"] = from_addr
                        sandbox_msg["To"] = target_sandbox
                        sandbox_msg["Reply-To"] = target_sandbox
                        sandbox_msg.attach(MIMEText(body, "plain"))

                        with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=15) as server:
                            server.ehlo()
                            if server.has_extn("STARTTLS"):
                                server.starttls()
                                server.ehlo()
                            if self.smtp_user and self.smtp_password:
                                server.login(self.smtp_user, self.smtp_password)
                            server.sendmail(from_addr, [target_sandbox], sandbox_msg.as_string())

                        return {
                            "recipient": recipient_email,
                            "from_email": from_addr,
                            "subject": subject,
                            "body": body,
                            "status": "sent",
                            "mode": "live_sandbox",
                            "sandbox_notice": f"Delivered preview copy to {target_sandbox} (Resend Sandbox). Verify your domain on resend.com/domains to send directly to third-party recipients.",
                        }
                    except Exception as inner_e:
                        logger.error(f"Fallback sandbox dispatch failed: {inner_e}")

                return {
                    "recipient": recipient_email,
                    "from_email": from_addr,
                    "subject": subject,
                    "body": body,
                    "status": "drafted",
                    "mode": "sandbox_draft",
                    "info": "Email drafted successfully. Note: Resend sandbox permits direct external delivery only after verifying a domain on resend.com.",
                }

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
