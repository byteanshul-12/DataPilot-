# AI Research And Scraping Implementation Plan

## Goal

Make DataPilot return cleaner, source-backed data from a natural language request.

The AI should not directly scrape. The AI should:

1. understand the user request
2. create a structured workflow
3. generate search strategy
4. decide what fields and sources are needed
5. let scraping tools fetch pages
6. clean, rank, and validate extracted rows

## Current Problem Found In Test

Test request:

```text
Find 5 Indian SaaS companies with company name, founder, website and LinkedIn URL. Include source URL and confidence score.
```

Observed result before this implementation:

```text
sources_discovered: 11
records_extracted: 39
records_validated: 39
records_deduplicated: 37
```

The pipeline worked, but the output was noisy.

Bad extracted company names included:

```text
Company Name
College
Series B
Home
B2C
View Listing
Total funding in SaaS companies
```

Main issue:

```text
Search was working, but extraction and cleaning were weak.
```

## Research Summary

### Tavily

Tavily is useful as a search API. It should discover candidate URLs from user intent and search queries.

Best use:

```text
query -> source URLs
```

Bad use:

```text
query -> final structured records
```

Reason: search snippets are not reliable enough to become final rows.

### Firecrawl

Firecrawl is the best next paid/hosted tool to add for hackathon speed.

Best use:

```text
URL -> page crawl/scrape -> schema-based structured JSON
```

Firecrawl supports structured extraction with schema/prompt style workflows, which is better than regex-only parsing for messy pages.

### Crawl4AI

Crawl4AI is the best open-source/local fallback.

Best use:

```text
URL -> local crawl -> CSS/XPath extraction or LLM extraction -> structured JSON
```

Crawl4AI supports schema-based LLM extraction and non-LLM extraction strategies. This is useful if we want a local-first stack.

### Playwright

Playwright should be only a fallback for JavaScript-heavy pages.

Best use:

```text
dynamic page -> rendered HTML -> parser/extractor
```

It should not be the primary data extraction layer.

## Best Architecture

Recommended stack:

```text
AI prompt understanding
-> Workflow JSON
-> Tavily search
-> URL filtering and ranking
-> Firecrawl structured extraction
-> Crawl4AI fallback
-> Playwright fallback
-> cleaning
-> enrichment
-> confidence scoring
-> final top N rows
```

For now, implemented:

```text
Tavily search
-> URL filtering
-> parser cleaning
-> dynamic confidence scoring
-> top N ranking
```

Next recommended addition:

```text
Firecrawl structured extraction
```

## Implemented Changes

### 1. URL Filtering

Added source filtering so weak URLs do not enter the pipeline.

Blocked source types:

```text
youtube.com
youtu.be
scribd.com
facebook.com
instagram.com
x.com
twitter.com
reddit.com
pinterest.com
quora.com
```

Reason:

These sources often create noisy rows or incomplete company data.

Files changed:

```text
ai/app/tools/quality.py
ai/app/tools/tavily.py
```

### 2. Source Quality Metadata

Each source now receives:

```text
source_type
source_quality_score
```

Example:

```json
{
  "source_type": "trusted_directory",
  "source_quality_score": 85
}
```

Files changed:

```text
ai/app/tools/tavily.py
ai/app/graph/nodes/extract.py
```

### 3. Company Name Cleaning

Added company-name cleaning to reject generic page labels.

Rejected examples:

```text
Company
Company Name
Home
B2B
B2C
College
Series B
Funding
View Listing
Read More
Published In
```

Files changed:

```text
ai/app/tools/quality.py
ai/app/tools/parser.py
```

### 4. Better Parser Behavior

The parser now:

- prefers labelled company names when possible
- avoids broad sentence fragments
- cleans company names before attaching records
- keeps source provenance

Files changed:

```text
ai/app/tools/parser.py
```

### 5. Real Confidence Score

Replaced mostly static confidence with a score based on:

```text
source quality
company name quality
website present
founder present
LinkedIn present
blocked/noisy source penalty
```

Files changed:

```text
ai/app/tools/quality.py
ai/app/tools/parser.py
ai/app/graph/nodes/deduplicate.py
```

### 6. Top N Ranking

Final deduplicated records are now sorted by confidence score.

If user asks for 5 records, final output returns best 5 instead of dumping 37 noisy rows.

Files changed:

```text
ai/app/graph/nodes/deduplicate.py
```

## Why This Improves Results

Before:

```text
many weak URLs
many generic names
fixed confidence score
too many noisy final rows
```

After:

```text
blocked weak URLs
cleaned company names
confidence score is meaningful
best rows are ranked first
final output respects target count
```

## Next Implementation Step

Add Firecrawl structured extraction.

Recommended flow:

```text
Tavily discovers URL
-> Firecrawl scrapes URL
-> Firecrawl extracts exact JSON schema
-> fallback to local parser if Firecrawl fails
```

Company schema:

```json
{
  "company_name": "string",
  "founder": "string|null",
  "website": "string|null",
  "linkedin_url": "string|null",
  "email": "string|null",
  "source_url": "string",
  "evidence_text": "string|null"
}
```

## Required API Keys

Minimum:

```text
TAVILY_API_KEY
```

Recommended next:

```text
FIRECRAWL_API_KEY
```

Optional local fallback:

```text
Crawl4AI does not require a hosted API key if running locally.
```

## Best Hackathon Strategy

For the demo, do not try to scrape every possible website perfectly.

Instead:

```text
return 5 clean records with source proof and confidence score
```

Clean 5 rows will look much better than noisy 37 rows.

## References

- Tavily Search API docs: https://help.tavily.com/articles/4840311948-tavily-search-api
- Firecrawl structured extraction overview: https://www.firecrawl.dev/blog/mastering-firecrawl-scrape-endpoint
- Firecrawl repository notes on structured data: https://github.com/OHANA-WEB/firecrawl
- Crawl4AI LLM extraction docs: https://docs.crawl4ai.com/extraction/llm-strategies/
- Crawl4AI extraction strategy API: https://docs.crawl4ai.com/api/strategies/

## Parallel Architecture Update

Implemented parallel candidate scraping.

Current behavior:

```text
user asks for N records
-> search up to about 5N-6N candidate URLs, capped at 30
-> run Firecrawl, Playwright, and Tavily snippet fallback in parallel
-> merge all candidate records
-> clean, score, deduplicate, and return top N
```

This matches the intended strategy:

```text
User asks 5 -> scrape 20-30 candidates -> return best 5
```

Files changed:

```text
ai/app/graph/nodes/search.py
ai/app/graph/nodes/extract.py
ai/app/tools/firecrawl.py
ai/app/tools/browser.py
ai/app/tools/quality.py
ai/app/tools/parser.py
```

Latest live test:

```text
sources_discovered: 20
records_extracted: 1245
records_validated: 1245
records_deduplicated: 5
```

Remaining blockers:

```text
Playwright browser binaries are not installed.
Firecrawl can hit rate limits when scraping many sources at once.
Founder and LinkedIn enrichment is still missing.
```

Next fixes:

```text
python -m playwright install chromium
limit Firecrawl to top 5-8 sources or add rate-limit backoff
add enrichment searches for founder and LinkedIn
```
