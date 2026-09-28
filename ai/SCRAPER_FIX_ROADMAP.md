# Scraper Fix Roadmap

## Current State

The scraping pipeline now works technically:

```text
AI workflow -> Tavily search -> candidate sources -> parallel scrape -> parser -> score -> dedupe -> top N
```

But live tests show the results are not consistently high quality.

Latest 5-prompt testing showed:

```text
Overall quality: 5.4/10
Best case: 7/10
Worst case: 3/10
```

The main gap is not search. The main gap is:

```text
structured extraction + enrichment + relevance scoring
```

## Research Summary

### Tavily

Best role:

```text
Search and URL discovery
```

Tavily should not be treated as the final data source. Its snippets can be useful as fallback, but they are not reliable enough for final structured rows.

Use Tavily for:

```text
find candidate URLs
rank source titles/snippets
fallback evidence
follow-up enrichment search
```

Do not use Tavily for:

```text
final company/founder/LinkedIn extraction
```

Reference:

```text
https://help.tavily.com/articles/4840311948-tavily-search-api
```

### Firecrawl

Best role:

```text
Structured extraction from selected known URLs
```

Firecrawl supports scraping and structured extraction. The most useful mode for us is JSON/schema extraction from a page.

Use Firecrawl for:

```text
top 3-5 high-quality URLs
schema-based extraction
official/company/directory pages
```

Do not use Firecrawl for:

```text
every candidate URL
bulk scraping 20-30 URLs without throttling
```

Reason:

```text
Firecrawl rate-limits quickly during repeated tests.
```

References:

```text
https://www.firecrawl.dev/blog/mastering-firecrawl-scrape-endpoint
https://firecrawl.docs.manicule.dev/developer-guides/usage-guides/choosing-the-data-extractor
```

### Crawl4AI

Best role:

```text
Local/open-source structured extraction fallback
```

Crawl4AI supports CSS/XPath/regex strategies and LLM-based extraction. This is a strong fit for our product because it can run locally and reduce hosted API cost.

Use Crawl4AI for:

```text
local structured extraction
repeated directory pages
LLM extraction fallback
table/card extraction
```

References:

```text
https://docs.crawl4ai.com/extraction/llm-strategies/
https://docs.crawl4ai.com/api/strategies/
https://docs.crawl4ai.com/core/table_extraction/
```

### Playwright

Best role:

```text
Dynamic JavaScript fallback
```

Playwright should not be the default scraper because it is slower and heavier. It is useful when static scraping fails or when a page is JS-rendered.

Current issue:

```text
Playwright browser binary is missing locally.
```

Fix:

```powershell
python -m playwright install chromium
```

Reference:

```text
https://docs.scrapy.org/en/latest/topics/dynamic-content.html
```

## Current Architecture Problems

### Problem 1: Missing Enrichment

Rows often have:

```text
founder: null
linkedin_url: null
```

Reason:

The first source usually gives company name and website, but not founder/LinkedIn.

Fix:

Add an enrichment node after deduplication.

Flow:

```text
deduped company row
-> search "{company_name} founder"
-> search "{company_name} LinkedIn company"
-> search "{company_name} official website"
-> merge best evidence into row
```

Files to add/update:

```text
ai/app/graph/nodes/enrich.py
ai/app/graph/workflow.py
ai/app/tools/tavily.py
ai/app/tools/quality.py
```

Expected improvement:

```text
5.4/10 -> 7/10
```

### Problem 2: Weak Relevance Scoring

Bad examples from tests:

```text
YC-backed prompt returned non-YC companies.
Bengaluru prompt returned unrelated public SaaS companies.
HR tech prompt returned generic YC SaaS companies.
```

Reason:

The final ranker scores field quality, but not whether the row matches user filters.

Fix:

Add relevance score.

Score against:

```text
country
city
industry
funding/source constraint
YC-backed
job/product/event/entity type
```

Example:

```text
Prompt says YC-backed -> source must be ycombinator.com or row must mention YC.
Prompt says Bengaluru -> source/evidence must mention Bengaluru/Bangalore.
Prompt says HR tech -> row/source/evidence must mention HR, payroll, hiring, workforce, employee, etc.
```

Files to update:

```text
ai/app/tools/quality.py
ai/app/graph/nodes/deduplicate.py
```

Expected improvement:

```text
7/10 -> 8/10 for relevance-sensitive prompts
```

### Problem 3: Parser Still Extracts Bad Names

Bad examples:

```text
http://investor.alight.com
CORE
Total
What Are SaaS
Combinator Logo W2023
View Profile
```

Fix:

Add stricter `clean_company_name`.

Reject:

```text
URLs
generic labels
education/institution names when company is requested
short generic all-caps terms
navigation phrases
cookie text
investor URLs
country/city names
```

Normalize:

```text
Chargebee View Profile -> Chargebee
Keka View Profile -> Keka
SpadeWorks SpadeWorks W2022 -> SpadeWorks
```

Files to update:

```text
ai/app/tools/quality.py
ai/app/tools/parser.py
```

Expected improvement:

```text
fewer noisy rows
better top N ranking
```

### Problem 4: Confidence Score Is Not Strict Enough

Current issue:

Rows missing founder and LinkedIn still score around:

```text
82
```

Fix:

Use hard confidence caps:

```text
no website -> max 60
no founder and no LinkedIn -> max 70
no source proof -> max 40
filter mismatch -> max 55
trusted directory + website + clean company -> 75-85
multi-source match -> 85-95
official website + founder + LinkedIn -> 95+
```

Files to update:

```text
ai/app/tools/quality.py
```

Expected improvement:

```text
scores become believable
frontend can sort by trust
```

### Problem 5: Firecrawl Rate Limit

Observed:

```text
Firecrawl hit rate limits during tests.
```

Fix:

```text
Use Firecrawl only for top 3-5 URLs.
Add retry-after/backoff.
Add URL scrape cache.
Use Tavily snippets for low-priority URLs.
```

Files to add/update:

```text
ai/app/tools/cache.py
ai/app/tools/firecrawl.py
ai/app/graph/nodes/extract.py
```

Expected improvement:

```text
fewer failed scrapes
cheaper tests
faster repeated runs
```

### Problem 6: No Structured Extraction Schema

Current extraction still relies too much on text parsing.

Fix:

Use schema-based extraction for Firecrawl/Crawl4AI.

Company schema:

```json
{
  "company_name": "string",
  "founder": "string|null",
  "website": "string|null",
  "linkedin_url": "string|null",
  "email": "string|null",
  "country": "string|null",
  "city": "string|null",
  "industry": "string|null",
  "source_url": "string",
  "evidence_text": "string|null"
}
```

Files to update:

```text
ai/app/tools/firecrawl.py
ai/app/tools/parser.py
```

Optional new tool:

```text
ai/app/tools/crawl4ai_tool.py
```

Expected improvement:

```text
less regex guessing
fewer fake company names
better field completeness
```

## Recommended New Architecture

```text
1. AI Understand Node
   Natural language -> workflow spec

2. Query Planner
   Generate search queries and enrichment queries

3. Search Node
   Tavily finds 5N-6N URLs

4. Source Filter Node
   Remove blocked domains and rank sources

5. Parallel Extract Node
   Firecrawl for top URLs
   Crawl4AI local fallback
   Playwright for JS-heavy fallback
   Tavily snippet fallback

6. Clean Node
   Normalize company names, URLs, person names

7. Deduplicate Node
   Merge by website/domain/name similarity

8. Enrichment Node
   Fill missing founder, LinkedIn, official website

9. Relevance Score Node
   Check filters from prompt

10. Confidence Score Node
   Score completeness + source + relevance + agreement

11. Final Rank Node
   Return best N records

12. Export Node
   Table/CSV/Excel/JSON
```

## Implementation Priority

### Priority 1: Enrichment Node

This is the highest-impact fix.

Why:

```text
Most final rows are missing founder and LinkedIn.
```

Implement:

```text
company_name + founder
company_name + LinkedIn
company_name + official website
```

### Priority 2: Relevance Scorer

Why:

```text
YC/Bengaluru/HR-tech prompts currently drift.
```

Implement:

```text
row relevance score from 0-100
downrank rows that do not prove prompt filters
```

### Priority 3: Confidence Caps

Why:

```text
Score must not say 82/100 when founder and LinkedIn are missing.
```

Implement:

```text
strict caps based on missing fields and relevance
```

### Priority 4: Firecrawl Cache And Rate Limit

Why:

```text
Firecrawl rate-limits during multi-prompt tests.
```

Implement:

```text
local cache keyed by URL
top 3-5 Firecrawl calls per workflow
retry-after handling
```

### Priority 5: Crawl4AI Fallback

Why:

```text
Reduces hosted API dependency and supports local structured extraction.
```

Implement later if time allows.

## What To Avoid

Do not:

```text
scrape every source with Firecrawl
trust Tavily snippets as final truth
return first N records
use static confidence scores
accept generic names like "CORE", "Total", "View Profile"
claim founder/LinkedIn accuracy without enrichment
```

## Best Hackathon Target

For demo, aim for:

```text
User asks for 5
system searches 20-30 candidates
system returns 5 clean rows
each row has website + source URL + confidence score
at least 2-3 rows have founder or LinkedIn
```

This is stronger than returning 50 noisy rows.

## Success Criteria

A result is good if:

```text
company_name is clean
website is valid
source URL exists
row matches prompt filters
confidence score is believable
duplicates are merged
missing fields are clearly marked
```

Target rating after next fixes:

```text
Current: 5.4/10
After enrichment + relevance scoring: 7.5/10 to 8/10
After structured extraction + cache: 8.5/10
```
