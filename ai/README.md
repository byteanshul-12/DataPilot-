# DataPilot AI Service

The AI service for **DataPilot**, an AI-powered data intelligence platform.

This service converts natural-language business/data requirements (e.g. *"Find 100 Indian SaaS startups founded after 2022 with company name, founder, website, funding stage and LinkedIn URL"*) into a structured collection workflow, executes web discovery, scrapes and parses web sources, validates data fields, deduplicates records, preserves source provenance URLs, and exposes everything via a high-performance FastAPI service.

---

## Technical Architecture

```text
                               ┌──────────────────────┐
                               │     Node Backend     │
                               └──────────┬───────────┘
                                          │ HTTP REST API
                                          ▼
                               ┌──────────────────────┐
                               │     FastAPI API      │
                               └──────────┬───────────┘
                                          │
                                          ▼
                               ┌──────────────────────┐
                               │  Fine-Tuned Model    │
                               │                      │
                               │ Requirement → JSON   │
                               └──────────┬───────────┘
                                          │
                                          ▼
                               ┌──────────────────────┐
                               │      LangGraph       │
                               │ Workflow Orchestrator│
                               └──────────┬───────────┘
                                          │
             ┌────────────────────────────┼────────────────────────────┐
             │                            │                            │
             ▼                            ▼                            ▼
       ┌───────────┐                ┌───────────┐               ┌────────────┐
       │  Tavily   │                │ Firecrawl │               │ Playwright │
       │ Discovery │                │ Extraction│               │ JS Browser │
       └───────────┘                └───────────┘               └────────────┘
             │                            │                            │
             └────────────────────────────┼────────────────────────────┘
                                          ▼
                                 ┌──────────────────┐
                                 │   Data Parser    │
                                 │ BeautifulSoup    │
                                 └────────┬─────────┘
                                          ▼
                                 ┌──────────────────┐
                                 │    Validation    │
                                 │    Pydantic      │
                                 └────────┬─────────┘
                                          ▼
                                 ┌──────────────────┐
                                 │   Deduplication  │
                                 │    RapidFuzz     │
                                 └────────┬─────────┘
                                          ▼
                                 ┌──────────────────┐
                                 │ Structured Data  │
                                 │ + Source URLs    │
                                 └──────────────────┘
```

---

## Key Principles & Design Rules

1. **Strict Fine-Tuned Model Abstraction**: Uses exactly **ONE** fine-tuned / open-source model. Zero dependency on OpenAI, Gemini, Claude, or commercial reasoning APIs.
2. **Model Responsibility**: The model is exclusively responsible for:
   `Natural Language Requirement → Structured Data Collection Specification (JSON)`
   Web scraping, search, parsing, validation, deduplication, and workflow execution are handled strictly by LangGraph and deterministic tools.
3. **Traceability & Provenance**: Every extracted record preserves original source metadata in `_sources` (including `url`, `title`, and `retrieved_by`).
4. **Validation & Error Handling**: Invalid records are flagged and logged rather than silently dropped.
5. **Deduplication**: Multi-stage RapidFuzz algorithm combining exact, normalized, and fuzzy token matching based on dynamically generated `deduplication_key`.
6. **Isolated Scope**: All python code, configurations, training assets, and tests reside strictly inside `ai/`.

---

## Directory Structure

```text
ai/
├── .env.example
├── .gitignore
├── README.md
├── requirements.txt
├── main.py                     # Entrypoint script (runs FastAPI or test pipeline)
│
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application instance & middleware
│   │
│   ├── api/                    # API Layer
│   │   ├── __init__.py
│   │   ├── routes.py           # FastAPI route handlers
│   │   └── schemas.py          # Request & Response Pydantic models
│   │
│   ├── graph/                  # LangGraph Workflow Layer
│   │   ├── __init__.py
│   │   ├── state.py            # TypedDict WorkflowState
│   │   ├── workflow.py         # StateGraph & conditional looping edge
│   │   └── nodes/
│   │       ├── __init__.py
│   │       ├── understand.py   # Model spec generation node
│   │       ├── plan.py         # Deterministic plan generation node
│   │       ├── search.py       # Tavily source discovery node
│   │       ├── extract.py      # Firecrawl / Playwright / BeautifulSoup extraction
│   │       ├── validate.py     # Pydantic validation & error tracking node
│   │       └── deduplicate.py  # RapidFuzz deduplication node
│   │
│   ├── models/                 # Fine-Tuned Model Abstraction
│   │   ├── __init__.py
│   │   ├── base.py             # DataPilotModel abstract class & exceptions
│   │   └── fine_tuned.py      # FineTunedHTTPModel, MockRuleBasedModel, get_model()
│   │
│   ├── tools/                  # Deterministic Tool Wrappers
│   │   ├── __init__.py
│   │   ├── tavily.py           # Tavily search tool
│   │   ├── firecrawl.py        # Firecrawl scraper tool
│   │   ├── browser.py          # Playwright headless browser tool
│   │   └── parser.py           # BeautifulSoup data parser
│   │
│   ├── schemas/                # Specification & Plan Schemas
│   │   ├── __init__.py
│   │   └── workflow.py
│   │
│   └── services/               # Background Task Services
│       ├── __init__.py
│       └── task_manager.py     # In-memory background task execution manager
│
├── training/                   # Model Fine-Tuning Suite (QLoRA / LoRA)
│   ├── README.md
│   ├── dataset/
│   │   └── synthetic_dataset.json
│   ├── scripts/
│   │   ├── prepare_data.py
│   │   └── train_lora.py
│   └── configs/
│       └── qlora_config.json
│
└── tests/                      # Unit & Integration Tests
    ├── __init__.py
    ├── test_api.py
    ├── test_model.py
    ├── test_workflow.py
    └── test_deduplication.py
```

---

## Setup & Local Installation

### 1. Create Virtual Environment
```bash
cd ai
python -m venv .venv
# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
playwright install chromium
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in key variables:
```env
MODEL_PROVIDER=http
MODEL_NAME=datapilot-fine-tuned-v1
MODEL_ENDPOINT=http://localhost:8001
MODEL_API_KEY=

TAVILY_API_KEY=your_tavily_key
FIRECRAWL_API_KEY=your_firecrawl_key

MAX_ITERATIONS=5
```

---

## Running the Service

### Start FastAPI Server
```bash
uvicorn app.main:app --reload --port 8000
```
Or via main entrypoint:
```bash
python main.py
```

### OpenAPI Documentation
Once running, interactive API docs are available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health status check |
| `POST` | `/api/v1/analyze` | Test fine-tuned model specification parsing independently |
| `POST` | `/api/v1/workflow/plan` | Generate workflow specification & execution plan without scraping |
| `POST` | `/api/v1/workflows/run` | Start asynchronous collection workflow, returns `task_id` |
| `GET` | `/api/v1/workflows/{task_id}` | Fetch workflow execution status & progress metrics |
| `GET` | `/api/v1/workflows/{task_id}/results` | Fetch final extracted structured dataset with source URLs |
| `POST` | `/api/v1/workflows/{task_id}/cancel` | Cancel an active workflow task |

---

## Node Backend Integration Interface

The Node backend interacts with the Python AI Service purely via HTTP REST calls:

```text
Node Backend                         Python AI Service
    │                                        │
    ├──────── POST /api/v1/workflows/run ───►│ (Enqueues task)
    │◄─────── { "task_id": "abc123" } ───────┤
    │                                        │
    ├──────── GET /api/v1/workflows/abc123 ─►│ (Polls status)
    │◄─────── { "status": "running" } ───────┤
    │                                        │
    ├──────── GET /api/v1/workflows/abc123/results ► (Fetches results)
    │◄─────── { "records": [...], ... } ─────┤
```

### Integration Contract Summary
- **No Direct DB Sharing**: The Python AI Service is self-contained. Persisting task state to PostgreSQL or Redis remains the responsibility of the Node backend.
- **Asynchronous Execution**: The `POST /api/v1/workflows/run` endpoint returns HTTP status `202 Accepted` immediately with a `task_id` without blocking.
- **Source Traceability**: Every item inside `records` contains `_sources`:
  ```json
  {
    "company_name": "Example Startup",
    "founder": "Jane Doe",
    "website": "https://example.com",
    "funding_stage": "Seed",
    "linkedin_url": "https://linkedin.com/company/example",
    "_sources": [
      {
        "url": "https://example.com/about",
        "title": "About Example Startup",
        "retrieved_by": "firecrawl"
      }
    ]
  }
  ```

---

## Testing

Run the full test suite with all external tool calls mocked (no live API keys required):

```bash
pytest tests/ -v
```
