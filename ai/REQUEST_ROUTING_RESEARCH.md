# Request routing and location preservation

## Research and decisions

1. [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs) supports supplying JSON Schema through `format`, followed by Pydantic validation. The local planner now uses `/api/chat`, a schema and temperature zero. Schema validity alone does not establish semantic correctness, so explicit role/location constraints are checked separately.
2. [Rasa fallback and clarification](https://legacy-docs-oss.rasa.com/docs/rasa/fallback-handoff/) describes clarification when intent is uncertain. This implementation uses the same principle without adding Rasa: ambiguous locations return a question and no search queries.

## Original failure

The API used MODEL_PROVIDER=mock. The old keyword parser treated "role" as a company request and dropped "backend" and "nodia". An empty filter object produced unrestricted company searches. Validation checked that incorrect specification, so unrelated US companies could pass and receive a high completeness score.

## Implemented behavior

- Greetings and thanks return `status: answered` with a `reply`, without contacting a model or scraper.
- "Find 7 backend role in nodia" returns `needs_clarification`, asking whether the user meant Noida. No background collection starts.
- Resend the full corrected request: "Find 7 backend roles in Noida". The current API does not maintain conversational context for a standalone "yes".
- Collection requests now use the installed Qwen2.5 7B through Ollama for planning. This is not the previously trained 1.5B adapter; no retraining occurred.
- Explicit job synonyms, known cities, backend/frontend roles and Node.js are preserved by deterministic checks after model interpretation.
- Model field aliases are normalized before planning. Array-valued filters use alternative matching rather than Python list strings.
- Search queries carry role and location. Job-role checks use the job title; city/country checks use the posting's location.
- The original user request is checked again before accepting rows, so dropped explicit constraints cannot silently broaden collection.
- Clarification and conversation stop the graph before search, including direct graph callers.
- Planner failure returns a service error without starting unrestricted scraping.
- `.env` loads before workflow imports, so configured options apply at startup.

## API usage

Open http://127.0.0.1:8023/docs and submit to POST `/api/v1/workflows/run`:

```json
{"requirement": "Good morning how are you"}
```

Read `reply` directly. For `needs_clarification`, resend a full corrected request. For `queued`, poll the task status and results as before.
The frontend must render `reply` and handle `answered` and `needs_clarification`; this change is scoped to the AI service.

Use POST `/api/v1/workflow/plan` to inspect the interpretation and queries without paid web collection.

## Verification

- Offline suite: 56 tests passed, covering job synonyms, the exact typo, mixed greetings and collection, model omissions, API replies, model failure, and graph early exit.
- `python scripts/check_request_routing.py` checks five requests against the running API. Results are stored in `request_routing_results.json`.
- Greeting and typo requests were also exercised through the live `/workflows/run` endpoint and returned the expected immediate statuses.
- No seven-job yield is guaranteed. Model interpretation, source coverage, active-job verification and missing fields remain separate concerns.

## Limits

Greeting routing covers common English greetings and a small number of courtesy phrases, not general-purpose chat. City spelling suggestions use a finite known-city list. Unusual syntax, multiple locations, negation and unsupported constraints need broader evaluation. Qwen can be slow or unavailable on local hardware; it does not replace evidence checking. Task state remains in memory and old IDs are lost on restart.
