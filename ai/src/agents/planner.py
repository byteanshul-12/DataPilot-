# Gemini and OpenAI prompt-driven requirement planning agent.
import os

def create_planner_agent(provider: str = "gemini"):
    # Returns configured LLM model instance for task orchestration.
    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(model="gemini-1.5-pro", google_api_key=os.getenv("GEMINI_API_KEY"))
    else:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model="gpt-4o", openai_api_key=os.getenv("OPENAI_API_KEY"))
