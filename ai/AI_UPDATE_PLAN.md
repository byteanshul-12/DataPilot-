# AI Update Plan

## Purpose

This file lists the AI-side updates we should discuss and implement to make the product stronger for the hackathon.

The goal is not only to convert natural language into JSON, but to create a smarter data agent that can plan, verify, and explain data collection.

## Main Direction

Current AI role:

```text
Natural language request -> structured scraping workflow JSON
```

Better AI role:

```text
Natural language request -> verified data collection plan -> structured workflow JSON -> proof and confidence rules
```

## Biggest Product Differentiator

Most teams may build:

```text
User prompt -> scraper -> table
```

We should build:

```text
User prompt -> AI-generated verified workflow -> scraper -> source-backed table with confidence score
```

Hackathon pitch:

```text
We do not just scrape data. We generate verified, source-backed datasets from plain English.
```

## Update 1: Output Format Detection

### Problem

Users may ask for data in different formats:

- Excel
- CSV
- Google Sheet
- JSON
- table

The AI should detect this from natural language.

### Example User Prompt

```text
Find 50 Indian SaaS startups and give the data in Excel.
```

### Expected AI Output Field

```json
{
  "output_format": "excel"
}
```

### Why It Matters

This makes the product feel complete because users often want downloadable data, not only a table on screen.

## Update 2: Proof / Source URL Requirement

### Problem

Scraped data is hard to trust if the user cannot see where it came from.

### Expected AI Output Fields

```json
{
  "include_source_url": true,
  "source_required_for_each_row": true
}
```

### Why It Matters

This helps the product stand out from normal scrapers. Every result should have proof.

## Update 3: Confidence Score

### Problem

Not all data sources are equally reliable.

Example:

- official company website: high confidence
- random directory: medium confidence
- old article: low confidence

### Expected AI Output Field

```json
{
  "include_confidence_score": true
}
```

### Example Confidence Logic

```text
Official website match: 90-100
LinkedIn/company profile match: 75-90
Directory match only: 50-75
Unverified source: below 50
```

### Why It Matters

Judges can immediately understand that the product is focused on trustworthy data, not just scraped data.

## Update 4: Fallback Sources

### Problem

Sometimes one source will not have all fields.

Example:

Company website may have company name and website, but not founder email.

### Expected AI Output Field

```json
{
  "fallback_sources": ["company_website", "linkedin", "startup_database", "news", "search_engine"]
}
```

### Why It Matters

The backend can try another source when data is missing instead of returning incomplete rows.

## Update 5: Missing Field Strategy

### Problem

If important fields are missing, the system should know what to do.

### Expected AI Output Field

```json
{
  "missing_field_strategy": "retry_with_fallback_sources"
}
```

### Possible Values

```text
allow_missing
retry_with_fallback_sources
drop_incomplete_rows
ask_user_for_clarification
```

### Why It Matters

This gives the backend a clear rule for incomplete data.

## Update 6: User-Visible Plan Summary

### Problem

Users should understand what the AI is about to do before scraping starts.

### Expected AI Output Field

```json
{
  "plan_summary": "Find Indian SaaS startups, collect founder and website details, verify sources, remove duplicates, and return Excel output."
}
```

### Why It Matters

This makes the product feel transparent and controllable.

## Update 7: Editable AI Workflow

### Problem

AI may misunderstand the user request.

### Product Idea

Before scraping, frontend shows the AI-generated workflow:

- fields
- filters
- target count
- source types
- output format
- validation rules

User can edit it before starting the scraping job.

### Why It Matters

This reduces wrong scraping jobs and gives users more control.

## Update 8: Clarification Questions

### Problem

Some prompts are incomplete.

Example:

```text
Find startups for me.
```

This does not say country, industry, fields, count, or output format.

### Expected AI Output Field

```json
{
  "needs_clarification": true,
  "clarification_questions": [
    "Which country should I search in?",
    "Which fields do you need?",
    "How many results do you want?"
  ]
}
```

### Why It Matters

This prevents bad output when the user prompt is vague.

## Update 9: Better Validation Rules

### Problem

Current validation rules are basic.

### Add More Rules

```text
company_name_required
website_valid_url
email_valid
linkedin_url_valid
phone_number_valid
country_match_required
industry_match_required
duplicate_check_required
source_url_required
```

### Why It Matters

Validation rules make the scraper output cleaner and more useful.

## Update 10: Larger Dataset

### Current Dataset

```text
Train: 336
Validation: 42
Test: 42
Total: 420
```

### Target Dataset

```text
Train: 1500
Validation: 200
Test: 200
Total: 1900
```

### Why It Matters

420 examples are enough for demo-level format learning, but a bigger dataset will make the AI more reliable.

## Update 11: More Realistic Prompts

### Problem

Synthetic data is useful, but real users write messy prompts.

### Add Prompts Like

```text
need 100 d2c brands from india with insta founder and email in excel
```

```text
can u find ai startups hiring in bangalore and give careers link also
```

```text
give me verified saas companies from mumbai, need source url and founder linkedin
```

```text
find investors for healthtech startup, csv format, only india based
```

### Why It Matters

This trains the AI for real frontend users, not only clean template prompts.

## Update 12: Add API Model Option

### Problem

Local model is good for demo, but API models may be better for accuracy.

### Recommended API Model

```text
GPT-4.1 mini
```

### Why

- strong structured JSON output
- fast
- cost-effective
- good for natural language to workflow conversion

### Optional Premium Model

```text
GPT-5.1
```

Use this for complex requests or advanced planning.

## Proposed Final AI JSON Shape

```json
{
  "intent": "find_SaaS_startups",
  "entity_type": "company",
  "target_count": 50,
  "fields": ["company_name", "founder", "website", "email", "linkedin_url"],
  "filters": {
    "country": "India",
    "industry": "SaaS"
  },
  "source_types": ["company_website", "linkedin", "startup_database", "news"],
  "fallback_sources": ["search_engine", "company_website", "linkedin", "news"],
  "validation_rules": [
    "company_name_required",
    "website_valid_url",
    "email_valid",
    "source_url_required",
    "duplicate_check_required"
  ],
  "deduplication_key": ["company_name", "website"],
  "output_format": "excel",
  "include_source_url": true,
  "include_confidence_score": true,
  "source_required_for_each_row": true,
  "missing_field_strategy": "retry_with_fallback_sources",
  "needs_clarification": false,
  "clarification_questions": [],
  "plan_summary": "Find Indian SaaS startups, collect founder, website, email and LinkedIn URL, verify sources, remove duplicates, and export the result as Excel."
}
```

## Priority Order

### Must Have

1. Output format detection
2. Source URL requirement
3. Confidence score requirement
4. Fallback sources
5. Better validation rules

### Should Have

1. User-visible plan summary
2. Missing field strategy
3. Clarification questions
4. Editable workflow support

### Nice To Have

1. GPT-4.1 mini API option
2. 1500+ training examples
3. Realistic human-written prompts
4. Separate model evaluation report

## Discussion Points

Before implementation, we should decide:

1. Should the AI always require source URLs?
2. Should Excel export be default when user does not mention format?
3. Should vague prompts trigger clarification questions or should AI assume defaults?
4. Should confidence score be calculated by AI, backend, or both?
5. Should we use local fine-tuned Qwen, GPT-4.1 mini API, or both?
6. What fields should be mandatory for every scraped row?
7. What sources are allowed for the hackathon demo?

## Recommended Next Step

Start with the schema update:

```text
output_format
include_source_url
include_confidence_score
fallback_sources
missing_field_strategy
plan_summary
needs_clarification
clarification_questions
```

Then generate a new larger dataset with examples for these fields and fine-tune again.
