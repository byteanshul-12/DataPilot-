"""Run a bounded live quality benchmark; writes results without environment secrets."""
import asyncio
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")
os.environ["MODEL_PROVIDER"] = "mock"
os.environ["MAX_ITERATIONS"] = "1"
os.environ["MAX_SOURCE_CANDIDATES"] = "3"
os.environ["MAX_CANDIDATE_SOURCES"] = "6"
os.environ["MIN_CANDIDATE_SOURCES"] = "6"
os.environ["FIRECRAWL_SOURCE_LIMIT"] = "2"
os.environ["SEMANTIC_SOURCE_LIMIT"] = "1"
os.environ.setdefault("EXTRACTION_MODEL", "qwen2.5:7b")
os.environ["EXTRACTION_TIMEOUT"] = "60"
if "--structured-only" in sys.argv:
    os.environ["EXTRACTION_MODEL"] = ""

from app.graph.workflow import build_collection_graph

PROMPTS = [
    "Find 3 Indian AI jobs with company name, job title, location and application link",
    "Find 3 Indian SaaS companies with company name, founder, website and LinkedIn URL",
    "Find 3 Bengaluru SaaS companies with company name and website",
    "Find 3 Indian HR tech companies with company name and website",
    "Find 3 YC-backed Indian SaaS companies with company name and website",
]

async def main():
    results = []
    documents = []
    graph = build_collection_graph()
    for index, prompt in enumerate(PROMPTS):
        start = time.monotonic()
        try:
            state = await asyncio.wait_for(graph.ainvoke({"task_id": f"live-quality-{index}", "user_requirement": prompt,
                "iteration": 1, "errors": [], "specification": {}, "discovered_sources": [], "raw_documents": [],
                "extracted_records": [], "validated_records": [], "deduplicated_records": []},
                config={"recursion_limit": 50}), timeout=150)
            result = {"prompt": prompt, "seconds": round(time.monotonic() - start, 1),
                      "semantic_model": os.getenv("EXTRACTION_MODEL") or None,
                      "sources": len(state.get("discovered_sources", [])),
                      "source_urls": [s.get("url") for s in state.get("discovered_sources", [])],
                      "documents": len(state.get("raw_documents", [])),
                      "candidates": len(state.get("extracted_records", [])),
                      "records": state.get("deduplicated_records", []), "errors": state.get("errors", [])}
            documents.append({"prompt": prompt, "specification": state.get("specification"), "documents": state.get("raw_documents", [])})
        except Exception as exc:
            result = {"prompt": prompt, "error": type(exc).__name__, "records": []}
        results.append(result)
        (ROOT / "quality_benchmark_results.json").write_text(json.dumps(results, indent=2, ensure_ascii=True), encoding="utf-8")
        (ROOT / "quality_benchmark_documents.json").write_text(json.dumps(documents, ensure_ascii=True), encoding="utf-8")
        print(json.dumps({k: v for k, v in result.items() if k not in {"records", "errors"}}) + f" accepted={len(result['records'])}", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
