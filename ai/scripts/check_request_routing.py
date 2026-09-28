"""Live local-model/API checks without running paid web collection."""
import json
from pathlib import Path
import httpx

ROOT = Path(__file__).resolve().parents[1]
PROMPTS = ["Good morning how are you", "How are you?", "Find 7 backend role in nodia.",
           "Find 7 backend roles in Noida.", "Hi, find 5 frontend positions in Mumbai."]

def main():
    results = []
    with httpx.Client(base_url="http://127.0.0.1:8023", timeout=120) as client:
        for prompt in PROMPTS:
            response = client.post("/api/v1/workflow/plan", json={"requirement": prompt})
            response.raise_for_status()
            data = response.json()
            results.append({"requirement": prompt, **data})
            print(json.dumps({"requirement": prompt, "status": data["status"], "reply": data["reply"], "filters": data["specification"]["filters"], "queries": data["plan"]["queries"]}), flush=True)
            (ROOT / "request_routing_results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
