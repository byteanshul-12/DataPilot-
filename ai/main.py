"""Main entrypoint script to run DataPilot AI Service or test LangGraph workflow directly."""
import asyncio
import os
import uvicorn
from dotenv import load_dotenv

from app.graph.workflow import build_collection_graph
from app.main import app

load_dotenv()


def run_server():
    port = int(os.getenv("PORT", "8000"))
    print(f"Starting DataPilot AI FastAPI Service on port {port}...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)


async def test_workflow():
    print("Testing LangGraph DataPilot Workflow initialization...")
    graph = build_collection_graph()
    initial_state = {
        "task_id": "test-123",
        "user_requirement": "Find 5 Indian SaaS startups with company name and website",
        "specification": {},
        "search_queries": [],
        "discovered_sources": [],
        "raw_documents": [],
        "extracted_records": [],
        "validated_records": [],
        "deduplicated_records": [],
        "errors": [],
        "target_count": 5,
        "iteration": 1,
        "status": "init"
    }
    result = await graph.ainvoke(initial_state)
    print("Workflow executed successfully!")
    print(f"Status: {result.get('status')}")
    print(f"Records extracted: {len(result.get('deduplicated_records', []))}")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        asyncio.run(test_workflow())
    else:
        run_server()
