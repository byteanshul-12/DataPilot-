# Scraping Quality Plan

## Test Run

I ran a real local workflow test through the running AI server.

Request:

```text
Find 5 Indian SaaS companies with company name, founder, website and LinkedIn URL. Include source URL and confidence score.
```

Task id:

```text
443f4653-9441-493c-8fe8-e2078bdac0f8
```

Observed pipeline result:

```text
sources_discovered: 11
records_extracted: 39
records_validated: 39
records_deduplicated: 37
```

So the pipeline is running. The problem is not that scraping is dead. The problem is data quality.

## Current Output Quality

Some output rows were real-ish:

```text
Freshworks -> founder: Girish Mathrubootham
Peoplestrong
Engineerbabu
OneFin
```

But many rows were bad extractions:

```text
Company Name
SaaS Companies India Sheet1 The
Indirect evidence
College
IIT Delhi
Indian School of Business
Company Stage
Series B
Home
B2C
View Listing
Commerce SoftwareOnline Form Bu
Total funding in SaaS companies
```

Most rows had:

```text
website: null
linkedin_url: null
founder: null
```

This means the system is finding pages and extracting text, but it is not reliably extracting structured company records.

## Root Problems

### 1. Search Results Are Treated Like Final Data

Tavily is good for discovering URLs, but search result snippets are not enough to produce clean rows.

Current behavior:

```text
Tavily search -> parse snippets/pages -> final records
```

Better behavior:

```text
Tavily search -> filter URLs -> crawl selected pages -> extract structured JSON -> enrich missing fields -> validate -> final records
```

### 2. Bad Source Types Are Allowed

Current results included sources like:

```text
YouTube
Scribd
generic blog pages
unstructured directory pages
```

These are weak sources for company datasets.

For company data, preferred source order should be:

```text
official company website
trusted startup/company directory
YC/company profile page
Product Hunt/G2/Capterra
news/article only as fallback
YouTube/Scribd/social content should usually be blocked
```

### 3. Parser Is Too Regex-Based

The parser currently guesses company names from text using broad regex patterns.

That is why non-company text becomes a company name:

```text
College
Series B
Home
Company Stage
View Listing
```

The parser needs source-aware extraction:

- table parser for table pages
- card parser for directory pages
- schema-based LLM/Firecrawl extraction for messy pages
- source-specific parsers for high-value sites

### 4. No Company Enrichment Loop

The first pass often finds only a company name.

Example:

```json
{
  "company_name": "Peoplestrong",
  "founder": null,
  "website": null,
  "linkedin_url": null
}
```

The system should not stop there. It should run follow-up searches:

```text
Peoplestrong official website
Peoplestrong founder
Peoplestrong LinkedIn
Peoplestrong contact
```

Then merge those fields into the same row.

### 5. Validation Is Now Pass-Through

Validation was changed to warnings only, so results are no longer blocked.

This gives more output, but it also lets noisy rows reach the frontend.

We need a better approach:

```text
hard validation -> only for impossible/bad rows
soft validation -> warnings for missing optional fields
quality score -> rank best rows first
```

### 6. Confidence Score Is Static

Current confidence score is mostly fixed at `75`.

That is not meaningful.

Confidence should depend on:

```text
official website found
source URL quality
field completeness
field agreement across multiple sources
known bad source penalty
whether website/LinkedIn/founder are present
```

## Best Architecture

Recommended scraping architecture:

```text
1. AI creates workflow JSON
2. Search query planner creates targeted search queries
3. Search API discovers candidate URLs
4. URL filter removes bad sources
5. Source ranker picks best URLs
6. Crawler fetches full page content
7. Source-aware extractor creates structured rows
8. Enrichment loop fills missing fields
9. Deduplication merges same company rows
10. Quality scorer ranks rows
11. Final validator separates accepted/warning/rejected rows
12. Export layer returns table/CSV/Excel
```

## What To Implement First

### Priority 1: URL Filtering

Add a URL filter before extraction.

Block or down-rank:

```text
youtube.com
youtu.be
scribd.com
facebook.com
instagram.com
twitter.com
x.com
reddit.com
pinterest.com
quora.com
generic PDF/document pages unless requested
```

Prefer:

```text
company websites
ycombinator.com/companies
producthunt.com
g2.com
capterra.com
tracxn.com
crunchbase-like directories
builtin.com/company pages
official directory pages
```

Files to update:

```text
ai/app/graph/nodes/search.py
ai/app/tools/tavily.py
```

Add:

```python
source_quality_score
source_type
is_blocked_source
```

### Priority 2: Better Company Name Cleaning

Add a company-name quality filter.

Reject names like:

```text
Company Name
Company
Home
B2C
College
Series B
Funding
View Listing
Read More
Published In
```

Reject names that:

- are too generic
- are page labels
- contain sentence fragments
- are mostly navigation text
- are longer than a normal company name

Files to update:

```text
ai/app/tools/parser.py
ai/app/graph/nodes/validate.py
```

### Priority 3: Enrichment Loop

For rows missing website/founder/LinkedIn, run extra search queries.

Example:

```text
{company_name} official website
{company_name} founder
{company_name} LinkedIn company
{company_name} contact email
```

Then merge results.

Files to add/update:

```text
ai/app/graph/nodes/enrich.py
ai/app/graph/workflow.py
ai/app/tools/tavily.py
ai/app/tools/parser.py
```

### Priority 4: Source-Aware Extraction

Add extraction strategies based on source type.

For table/list pages:

```text
extract repeated company rows from tables/cards
```

For official company websites:

```text
extract website, about page, contact email, LinkedIn URL
```

For directory pages:

```text
extract company cards and profile links
```

For article pages:

```text
extract only named companies, do not trust founder/email unless explicit
```

Files to update:

```text
ai/app/tools/parser.py
```

### Priority 5: Real Confidence Score

Replace fixed confidence score with scoring.

Suggested scoring:

```text
base score: 40
+25 official website found
+15 founder found
+10 LinkedIn found
+10 source is trusted directory
+10 same company appears in 2+ sources
-20 weak source like blog-only
-40 blocked/noisy source
-20 company name looks generic
cap 0-100
```

Files to add/update:

```text
ai/app/graph/nodes/score.py
ai/app/graph/workflow.py
```

### Priority 6: Split Result Buckets

Instead of one final records list, return:

```json
{
  "accepted_records": [],
  "warning_records": [],
  "rejected_records": []
}
```

For the frontend, show accepted records by default and let the user inspect warnings.

Files to update:

```text
ai/app/api/schemas.py
ai/app/api/routes.py
ai/app/services/task_manager.py
frontend result table
```

## Best Hackathon Version

For hackathon, implement this smaller but strong version:

```text
Tavily search
-> block bad URLs
-> parse pages
-> clean company names
-> enrich missing website/founder/LinkedIn with one follow-up search
-> score rows
-> return top N records
```

This will improve demo quality much more than adding more model training right now.

## Expected Improvement

Current output:

```text
37 rows, many noisy, most fields null
```

After the fixes:

```text
5-10 cleaner rows
real company names
source URLs
fewer generic rows
some founder/website/LinkedIn enrichment
meaningful confidence score
```

For demo, cleaner 5 rows is better than noisy 37 rows.

## Suggested Implementation Order

1. Add bad URL filtering.
2. Add company-name cleaning.
3. Add dynamic confidence scoring.
4. Add enrichment for missing website/founder/LinkedIn.
5. Add accepted/warning/rejected buckets.
6. Add Excel export after records become clean.

## Short Diagnosis

The current problem is not model training.

The current problem is:

```text
Search finds sources, but extraction and cleaning are too weak.
```

Fix scraping quality before retraining again.
