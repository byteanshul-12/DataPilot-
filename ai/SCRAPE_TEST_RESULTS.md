# Scrape Test Results

## Test Setup

I ran 5 live workflow prompts against the local AI server.

Runtime settings:

```text
ENABLE_PLAYWRIGHT=false
FIRECRAWL_SOURCE_LIMIT=3
MIN_CANDIDATE_SOURCES=10
MAX_CANDIDATE_SOURCES=15
CANDIDATE_MULTIPLIER=4
```

Reason:

```text
Playwright browser binary is not installed locally.
Firecrawl rate limits quickly if every candidate URL is scraped.
```

## Result Summary

### Test 1

Prompt:

```text
Find 3 Indian SaaS companies with company name, founder, website and LinkedIn URL. Include source URL and confidence score.
```

Stats:

```text
sources_discovered: 9
records_extracted: 90
records_deduplicated: 3
```

Top results:

```text
Zoho       | https://builtin.com/company/zoho       | founder: null | linkedin: null | score: 82
Chargebee  | https://builtin.com/company/chargebee  | founder: null | linkedin: null | score: 82
Keka       | https://builtin.com/company/keka       | founder: null | linkedin: null | score: 82
```

Rating:

```text
7/10
```

Reason: clean company names and websites, but founder/LinkedIn missing.

### Test 2

Prompt:

```text
Find 3 Indian fintech SaaS startups with company name, website, founder and LinkedIn URL. Include source URL and confidence score.
```

Stats:

```text
sources_discovered: 9
records_extracted: 157
records_deduplicated: 3
```

Top results:

```text
Paytm   | https://builtin.com/company/paytm   | founder: null | linkedin: null | score: 82
PhonePe | https://builtin.com/company/phonepe | founder: null | linkedin: null | score: 82
PayPal  | https://builtin.com/company/paypal  | founder: null | linkedin: null | score: 82
```

Rating:

```text
6.5/10
```

Reason: clean rows, but PayPal is not an Indian startup. Need stricter country/entity filtering.

### Test 3

Prompt:

```text
Find 3 Bengaluru SaaS companies with company name, website, founder and LinkedIn URL. Include source URL and confidence score.
```

Stats:

```text
sources_discovered: 12
records_extracted: 236
records_deduplicated: 3
```

Top results:

```text
http://investor.alight.com       | http://www.alight.com       | Stephan Scholl  | score: 88
http://investors.alkami.com      | http://www.alkami.com       | Stephen Bohanon | score: 88
http://investor.asuresoftware.com| http://www.asuresoftware.com| Pat Goepel      | score: 88
```

Rating:

```text
3/10
```

Reason: company name extraction failed. It used investor URLs as company names and ignored Bengaluru filter.

### Test 4

Prompt:

```text
Find 3 Indian HR tech SaaS companies with company name, website, founder and LinkedIn URL. Include source URL and confidence score.
```

Stats:

```text
sources_discovered: 10
records_extracted: 50
records_deduplicated: 3
```

Top results:

```text
CORE    | https://www.ycombinator.com/companies/heysol  | founder: null | linkedin: null | score: 82
Clueso  | https://www.ycombinator.com/companies/clueso  | founder: null | linkedin: null | score: 82
Retape  | https://www.ycombinator.com/companies/retape  | founder: null | linkedin: null | score: 82
```

Rating:

```text
4/10
```

Reason: source is good, but category mismatch. These are YC SaaS companies, not clearly HR tech.

### Test 5

Prompt:

```text
Find 3 YC-backed SaaS startups in India with company name, website, founder and LinkedIn URL. Include source URL and confidence score.
```

Stats:

```text
sources_discovered: 10
records_extracted: 88
records_deduplicated: 3
```

Top results:

```text
Zoho      | https://builtin.com/company/zoho      | founder: null | linkedin: null | score: 82
Chargebee | https://builtin.com/company/chargebee | founder: null | linkedin: null | score: 82
Keka      | https://builtin.com/company/keka      | founder: null | linkedin: null | score: 82
```

Rating:

```text
4.5/10
```

Reason: companies are valid SaaS companies, but not YC-backed. Source ranking ignored the YC constraint.

## Overall Rating

```text
5.4/10
```

The pipeline works technically, but relevance and enrichment are not strong enough yet.

## What Works

```text
Tavily search works.
Firecrawl works when not rate-limited.
Parallel candidate scraping works.
The system returns the requested number of rows.
Company names are cleaner than before.
Website extraction works for BuiltIn-style pages.
```

## Main Problems

### 1. Missing Founder And LinkedIn

Most final rows have:

```text
founder: null
linkedin_url: null
```

Fix:

```text
Add enrichment node after deduplication:
company_name + founder
company_name + LinkedIn company
company_name + official website
```

### 2. Weak Filter Matching

Some prompts had filters like:

```text
Bengaluru
HR tech
YC-backed
Indian startup
```

But final records did not always match those filters.

Fix:

```text
Add relevance scoring against filters.
Reject or downrank rows that do not match country, city, industry, funding/source constraint.
```

### 3. Company Name Extraction Still Fails In Some Sources

Bad output:

```text
http://investor.alight.com
http://investors.alkami.com
```

Fix:

```text
Reject company_name values that look like URLs.
Use domain/company-name normalization.
```

### 4. Confidence Score Still Too Optimistic

Rows with missing founder and LinkedIn still score around:

```text
82
```

Fix:

```text
Cap score at 70 if founder and LinkedIn are both missing.
Cap score at 60 if filters are not proven.
Boost only when fields are verified from multiple sources.
```

### 5. Firecrawl Rate Limit

Firecrawl rate-limited during repeated tests.

Fix:

```text
Use Firecrawl only for top 3-5 sources.
Add retry-after/backoff.
Cache scraped pages by URL.
Use Tavily snippets for low-priority sources.
```

### 6. Playwright Not Available

Playwright was disabled because local Chromium is not installed.

Fix:

```powershell
python -m playwright install chromium
```

## Best Next Implementation

Implement these in order:

1. **Enrichment node**
   Fill founder, LinkedIn, official website.

2. **Relevance scorer**
   Score whether row matches country, city, industry, YC-backed, etc.

3. **Stricter final ranking**
   Rank by:
   ```text
   field completeness
   source quality
   relevance score
   confidence score
   ```

4. **Confidence caps**
   Do not allow high confidence for incomplete rows.

5. **Scrape cache**
   Avoid repeat calls and Firecrawl rate-limit waste.

## Verdict

The architecture is now technically correct:

```text
search more -> scrape candidates -> return best N
```

But to make the output impressive, the product needs:

```text
enrichment + relevance scoring
```

That is the next biggest upgrade.
