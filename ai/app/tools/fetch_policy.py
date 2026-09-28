"""Bounded fetch cache and operator-controlled source selection."""
from copy import deepcopy
import os
import time
from urllib.parse import urlsplit

_cache = {}


def source_allowed(url):
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"} or not host or parsed.username or parsed.password:
        return False
    allowed = [d.strip().lower() for d in os.getenv("SCRAPE_ALLOWED_DOMAINS", "").split(",") if d.strip()]
    denied = [d.strip().lower() for d in os.getenv("SCRAPE_DENIED_DOMAINS", "").split(",") if d.strip()]
    matches = lambda d: host == d or host.endswith("." + d)
    return not any(matches(d) for d in denied) and (not allowed or any(matches(d) for d in allowed))


def cached_document(url):
    entry = _cache.get(url)
    if entry and time.monotonic() - entry[0] < float(os.getenv("SCRAPE_CACHE_SECONDS", "300")):
        return deepcopy(entry[1])
    _cache.pop(url, None)
    return None


def cache_document(url, document):
    if len(_cache) >= 128:
        _cache.pop(next(iter(_cache)))
    _cache[url] = (time.monotonic(), deepcopy(document))
