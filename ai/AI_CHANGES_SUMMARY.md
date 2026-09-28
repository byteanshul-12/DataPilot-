# AI Folder Changes Summary

## Current AI Goal

The AI module converts a user's natural language data request into a structured scraping workflow.

Example user request:

```text
Find 10 Indian SaaS startups with company name, founder, website and LinkedIn URL
```

Expected AI output:

```json
{
  "deduplication_key": ["company_name", "website"],
  "entity_type": "company",
  "fields": ["company_name", "founder", "website", "linkedin_url"],
  "filters": {
    "country": "India",
    "industry": "SaaS"
  },
  "intent": "find_SaaS_startups",
  "source_types": ["company_website", "linkedin", "startup_database", "news"],
  "target_count": 10,
  "validation_rules": ["company_name_required", "website_valid_url"]
}
```

## What Has Been Done

1. Added synthetic dataset generation for workflow-style AI training.
2. Prepared train, validation, and test splits.
3. Fine-tuned `Qwen2.5-1.5B-Instruct` locally using LoRA.
4. Added a local adapter runner to test the fine-tuned model.
5. Added documentation for training, evaluation, and local testing.
6. Updated the AI workflow prompt so the model returns structured workflow JSON.

## Dataset Used

The current model was trained on synthetic workflow examples.

```text
Train: 336
Validation: 42
Test: 42
Total: 420
```

The data was generated from templates for requests such as:

- company search
- lead generation
- job listings
- event discovery
- product research
- competitor research
- sponsor discovery

Important note: this dataset is synthetic, not real scraped user data.

## Fine-Tuned Model

Base model:

```text
Qwen/Qwen2.5-1.5B-Instruct
```

Fine-tuning method:

```text
LoRA
```

Adapter path:

```text
ai/training/checkpoints/datapilot-qwen2.5-1.5b-lora
```

The actual trained adapter weights are kept out of Git using `.gitignore`.

## Test Command

Run this from PowerShell:

```powershell
cd "C:\Users\gupta\OneDrive\Desktop\sarvagya\Hackaton Scrapper\DataPilot-\ai\training"
.\.venv\Scripts\python.exe scripts/run_adapter.py "Find 10 Indian SaaS startups with company name, founder, website and LinkedIn URL"
```

If the model is working, it should return clean JSON with fields, filters, sources, target count, and validation rules.

## Evaluation Command

```powershell
cd "C:\Users\gupta\OneDrive\Desktop\sarvagya\Hackaton Scrapper\DataPilot-\ai\training"
.\.venv\Scripts\python.exe scripts/train_local.py --evaluate-only
```

Current evaluation result:

```text
42/42 synthetic test examples passed
```

## Important Limitation

The fine-tuned model is not yet connected to the main product API.

Current state:

- Fine-tuned adapter works from CLI.
- Main app can still use Ollama/API model flow.
- Product backend does not yet serve the fine-tuned LoRA adapter as an API.

## Current Product Flow

1. User enters natural language request in frontend.
2. AI converts the request into structured workflow JSON.
3. Backend uses the workflow JSON to decide fields, filters, sources, and validation rules.
4. Scraper/API layer collects data.
5. Backend cleans, validates, and deduplicates the data.
6. Frontend shows the final table/result to the user.

## What Makes The Product Stand Out

The strongest differentiator should be:

```text
Verified data with proof, confidence score, and fallback search.
```

Instead of only scraping data, the product should show:

- source URL for every row
- confidence score for every row
- validation status
- fallback source attempts for missing fields
- editable AI-generated workflow before scraping starts

Hackathon pitch:

```text
We do not just scrape data. We generate verified, source-backed datasets from plain English.
```

## Recommended AI Changes Next

### 1. Add Output Format Detection

The AI should understand when the user asks for:

- table
- CSV
- Excel
- JSON
- Google Sheet

Example output:

```json
{
  "output_format": "excel"
}
```

### 2. Add Proof Requirements

The AI should include whether proof is required.

```json
{
  "include_source_url": true,
  "include_confidence_score": true
}
```

### 3. Add Fallback Source Plan

The AI should tell the backend what sources to try if a field is missing.

```json
{
  "fallback_sources": ["company_website", "linkedin", "startup_database", "news"]
}
```

### 4. Add User-Visible Plan Summary

The AI should produce a short plan that frontend can show before scraping.

```json
{
  "plan_summary": "Find Indian SaaS startups, verify company websites, collect founders, and validate source links."
}
```

### 5. Increase Dataset Size

Recommended hackathon dataset size:

```text
Train: 1500
Validation: 200
Test: 200
Total: 1900
```

Add examples for:

- Excel export requests
- CSV export requests
- source/proof requests
- confidence score requests
- missing-field retry requests
- messy real user prompts
- short prompts
- vague prompts
- multi-filter prompts

### 6. Add Realistic Human-Written Prompts

Synthetic data is useful for format learning, but the model needs more realistic examples.

Best next dataset improvement:

```text
200-300 manually written user-style prompts with correct workflow JSON labels
```

Examples:

```text
Need 100 VC-funded SaaS companies in India, give founder, website, email, source link, in Excel.
```

```text
Find D2C brands from Mumbai with Instagram and founder LinkedIn, verify from official site.
```

```text
Give me hiring startups in Bengaluru, include careers page and confidence score.
```

## Recommended ChatGPT API Model

For production API usage, recommended model:

```text
GPT-4.1 mini
```

Why:

- good at natural language to JSON
- fast
- cost-effective
- strong structured output

For more complex planning:

```text
GPT-5.1
```

## Git Push Note

The code, dataset, scripts, and documentation can be pushed to GitHub.

The trained adapter checkpoint should not be pushed to GitHub because model files are large.

Use Hugging Face or another model registry if the trained adapter needs to be shared.

## Final Status

Current AI status:

```text
Fine-tuned 1.5B LoRA adapter is working locally.
```

Product integration status:

```text
Fine-tuned adapter is not yet connected to the main backend API.
```

Next best AI task:

```text
Add proof, confidence score, output format detection, fallback sources, and a larger 1500+ example dataset.
```
