# Scraper quality fixes

## What changed

- Navigation, footers, capitalized text, and arbitrary page titles no longer create company identities.
- Read Organization and JobPosting JSON-LD before heuristic parsing. Preserve supporting field evidence.
- Jobs need an employer, role, location, and application link. Reject expired postings and explicit talent-pool listings.
- Preserve AI, city, HR tech, and YC constraints in rule-based planning. Check requested constraints against entity evidence.
- Reserve search candidates across queries, prioritize job boards for jobs, and use company-specific evidence searches on retries.
- Optional local Ollama extraction only accepts field values whose supporting quotes occur in the retrieved page.
- Merge exact company identities across documents before checking completeness. Keep different jobs at one employer separate.
- Reject unsupported identities and irrelevant results. Optional missing fields remain null with warnings.
- Confidence is an evidence/completeness score, not a calibrated probability or proof of independent verification.
- Report progress during workflow execution and expose requested_count, target_met, and errors with results.
- Stop silently replacing failed requirement analysis with an unrestricted company search.
- Unit tests mock network services and browsers so real keys never cause paid unit-test requests.

## Local configuration

This machine's ai/.env now enables `EXTRACTION_MODEL=qwen2.5:7b`, the model already installed in Ollama.
This is separate from the previously trained 1.5B adapter. The API planner still uses `MODEL_PROVIDER=mock`.
No retraining took place in this change. Semantic extraction uses the installed 7B model, with a 4096-token context.
Tavily discovers pages; Firecrawl and Playwright retrieve them. Extraction and validation happen locally.

Start Ollama and restart the API from the ai directory after code changes:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8022
```

If 8022 is occupied, stop the old server in its own terminal first. Existing in-memory tasks are lost on restart.

```powershell
$body = @{ requirement = "Find 3 Indian AI jobs with company name, job title, location and application link" } | ConvertTo-Json
$res = Invoke-RestMethod -Uri "http://127.0.0.1:8022/api/v1/workflows/run" -Method Post -ContentType "application/json" -Body $body
Invoke-RestMethod -Uri "http://127.0.0.1:8022/api/v1/workflows/$($res.task_id)" | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri "http://127.0.0.1:8022/api/v1/workflows/$($res.task_id)/results" | ConvertTo-Json -Depth 10
```

`completed` means execution finished. Check `target_met`, field warnings, and evidence to assess the result.

## Verification

Latest automated check: **36 tests passed**.

Fresh-network benchmark on 2026-09-28, requesting three rows per prompt:

| Request | Accepted | Examples | Time |
| --- | --- | --- | --- |
| Indian AI jobs | 1/3 | Anyone AI: Computer Science PhD (India), with AI/ML duties | 14.5 s |
| Indian SaaS | 3/3 | RazorSign, RUPYZ, WorkDo | 19.9 s |
| Bengaluru SaaS | 1/3 | Hattiops | 24.9 s |
| Indian HR tech | 1/3 | Ciel HR | 13.4 s |
| YC-backed Indian SaaS | 3/3 | CORE, Clueso, Retape | 26.4 s |

These are extraction/relevance results, not an independent audit of each source's assertions.
The final fresh-network benchmark used structured extraction with semantic inference disabled, to isolate scraper behavior.
Local Qwen extraction was separately smoke-tested and its quote checking has regression coverage.
Earlier semantic-enabled live runs encountered timeouts; arbitrary-page coverage is still incomplete.
The final network run followed three YC profiles and obtained getcore.me, clueso.io, and retape.ai as official website links.
A subsequent live official-site enrichment check added RUPYZ's LinkedIn URL. Founder names remained missing for all three SaaS rows.
Missing founder/LinkedIn fields have explicit warnings; a full row count does not mean every field is complete.

The updated API was started on port **8023**, since an existing server was already using 8022.
Use http://127.0.0.1:8023/docs to test the updated process. The commands above use 8022 for a normal manual restart.

Run offline tests: `python -m pytest tests -q` from ai.
Run paid live benchmark: `python scripts/benchmark_quality.py` from ai.
The live benchmark deliberately limits each prompt to one iteration, three source pages, and one semantic extraction.
Up to three additional profiles may be fetched to enrich the initial results.
Its five prompts cover AI jobs, Indian SaaS, Bengaluru SaaS, HR tech, and YC-backed SaaS.
Results are written to quality_benchmark_results.json; fetched page snapshots are in quality_benchmark_documents.json.
Use `python scripts/benchmark_quality.py --structured-only` to reproduce the final benchmark configuration.
Use `python scripts/replay_quality.py` to recheck saved pages without network calls.
Use `python scripts/replay_quality.py --enrich --structured-only` to fetch missing profiles from saved candidates; this can use API credits.
Those enrichment results are in quality_enrichment_results.json.

## Remaining limitations

- Rule-based planning supports a limited vocabulary; it does not understand arbitrary requirements as a language model would.
- Evidence matching is conservative and cannot establish every implicit relationship. Source assertions can themselves be wrong.
- A reachable job posting without an expiry date does not guarantee the role remains open.
- Local 7B inference can time out or run slowly. Partial results and provider errors must remain visible.
- Direct employer/company profiles and field enrichment need broader source-specific coverage, especially founders and LinkedIn URLs.
- Product prices and other entity types do not yet have equivalent extraction support.
- Workflow tasks are in memory; durable queues, caching and restart recovery remain outstanding.
- This change does not implement an Excel download endpoint.
