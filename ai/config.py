import os
from dotenv import load_dotenv

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

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
