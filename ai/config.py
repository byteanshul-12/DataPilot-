import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from both local directory and project root
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
load_dotenv()

PORT = int(os.getenv("PORT", "8001"))
MODEL_PROVIDER = os.getenv("MODEL_PROVIDER", "auto")
MODEL_NAME = os.getenv("MODEL_NAME", "gemini-1.5-flash")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")

MAXUN_API_KEY = os.getenv("MAXUN_API_KEY", "")
MAXUN_API_URL = os.getenv("MAXUN_API_URL", "http://localhost:8080")

# Email Outreach Configuration
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.resend.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "resend")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "onboarding@resend.dev")

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
