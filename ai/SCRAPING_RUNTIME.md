# AI scraping runtime changes

- Up to four unique discovery queries run concurrently.
- Firecrawl is the primary fetcher within its existing source budget. Playwright is used when primary content is missing or fails relevance checks.
- Retrieved pages are cached for 300 seconds, bounded to 128 entries, with original retrieval timestamps. Cached documents are copied before reuse.
- Failed and blocked URLs are tracked across iterations. No more than three iterations run by default.
- Semantic extraction is limited to two URLs per workflow, 45 seconds per call.
- Background collection defaults to a 180-second deadline. Request interpretation runs before this and may take up to 90 seconds separately.
- Accepted, deduplicated rows are exposed after each completed graph stage. These remain available when later collection times out.
- Underfilled workflows use status `partial`. Deadline expiry without accepted records uses `failed` and explains the timeout.

Configuration: `WORKFLOW_TIMEOUT_SECONDS`, `SCRAPE_CACHE_SECONDS`, `SCRAPE_ALLOWED_DOMAINS`, `SCRAPE_DENIED_DOMAINS`, `MAX_ITERATIONS`.
Domain settings are comma-separated hostnames. An empty allowlist permits public-source selection subject to other filters. These settings do not establish legal permission or implement robots.txt enforcement. Browser redirects/subresources are not a network sandbox.

Verification: 60 offline tests passed, including fallback selection, cache isolation, domain matching, cancellation by deadline, and partial-result retention. No measured end-to-end speedup is claimed.

Still outstanding: shared browser pooling, persistent task storage, broader entity extractors, source-specific permission policies, and stronger semantic accuracy evaluations. No frontend or backend files were changed.
