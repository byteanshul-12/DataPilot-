"""Recheck saved live pages with current code, without searches or model calls."""
import asyncio
import json
from pathlib import Path
import sys
import os

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
if "--enrich" in sys.argv:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
    if "--structured-only" in sys.argv:
        os.environ["EXTRACTION_MODEL"] = ""
from app.tools.parser import DataParserTool
from app.graph.nodes.validate import validate_node
from app.graph.nodes.deduplicate import deduplicate_node


async def main():
    cases = json.loads((ROOT / "quality_benchmark_documents.json").read_text(encoding="utf-8"))
    output = []
    for case in cases:
        spec = case["specification"]
        records = [r for doc in case["documents"] for r in DataParserTool().parse_document(doc, spec["fields"], spec["entity_type"])]
        state = {"specification": spec, "extracted_records": records, "target_count": spec["target_count"]}
        if "--enrich" in sys.argv:
            from app.graph.nodes.extract import extract_node
            state["raw_documents"] = case["documents"]
            state.update(await extract_node(state))
        state.update(await validate_node(state))
        state.update(await deduplicate_node(state))
        rows = [{k: v for k, v in row.items() if k not in {"_context", "_entity_type", "_relevance_verified", "_requested_fields"}}
                for row in state["deduplicated_records"]]
        mode = "live profile enrichment of saved pages" if "--enrich" in sys.argv else "offline replay of live pages; no model extraction"
        result = {"prompt": case["prompt"], "mode": mode,
                  "requested": spec["target_count"], "accepted": len(rows), "records": rows,
                  "errors": state.get("errors", [])}
        output.append(result)
        print(json.dumps({"prompt": result["prompt"], "accepted": len(rows), "names": [r.get("company_name") for r in rows]}))
    filename = "quality_enrichment_results.json" if "--enrich" in sys.argv else "quality_replay_results.json"
    (ROOT / filename).write_text(json.dumps(output, indent=2), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
