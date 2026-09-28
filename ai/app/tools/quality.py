from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse


BLOCKED_DOMAINS = {
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
    "scribd.com",
    "www.scribd.com",
    "facebook.com",
    "www.facebook.com",
    "instagram.com",
    "www.instagram.com",
    "x.com",
    "twitter.com",
    "reddit.com",
    "www.reddit.com",
    "pinterest.com",
    "www.pinterest.com",
    "quora.com",
    "www.quora.com",
}

TRUSTED_DOMAINS = {
    "ycombinator.com",
    "www.ycombinator.com",
    "producthunt.com",
    "www.producthunt.com",
    "g2.com",
    "www.g2.com",
    "capterra.com",
    "www.capterra.com",
    "tracxn.com",
    "www.tracxn.com",
    "builtin.com",
    "www.builtin.com",
}

GENERIC_COMPANY_NAMES = {
    "company",
    "company name",
    "home",
    "b2b",
    "b2c",
    "college",
    "funding",
    "funded",
    "total",
    "founded",
    "team size",
    "year founded",
    "company stage",
    "series a",
    "series b",
    "series c",
    "view listing",
    "view profile",
    "read more",
    "published in",
    "items",
    "sorting",
}


def get_domain(url: str | None) -> str:
    if not url:
        return ""
    parsed = urlparse(url if "://" in url else f"https://{url}")
    return parsed.netloc.lower().removeprefix("www.")


def is_blocked_url(url: str | None) -> bool:
    domain = get_domain(url)
    return domain in {d.removeprefix("www.") for d in BLOCKED_DOMAINS}


def source_quality(url: str | None, title: str = "") -> tuple[str, int]:
    domain = get_domain(url)
    clean_title = title.lower()
    trusted = {d.removeprefix("www.") for d in TRUSTED_DOMAINS}

    if not domain:
        return "unknown", 30
    if is_blocked_url(url):
        return "blocked", 0
    if domain in trusted:
        return "trusted_directory", 85
    if any(token in clean_title for token in ["directory", "startups", "companies", "saas"]):
        return "directory_or_article", 65
    return "general_web", 50


def clean_company_name(name: Any) -> str | None:
    if name is None:
        return None
    cleaned = str(name).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = cleaned.strip(" -:|,.;")
    cleaned = re.sub(r"\s+View Profile$", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"\s+Combinator Logo\s+[SW]\d{4}$", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"\s+Logo\s+[SW]\d{4}$", "", cleaned, flags=re.I).strip()
    if not cleaned:
        return None
    if "://" in cleaned or re.search(r"\b(home blog|company about|for personal|instapoints|total funding|barbados|bosnia|series [a-z])\b", cleaned, re.I):
        return None
    if cleaned.lower() in GENERIC_COMPANY_NAMES:
        return None
    if len(cleaned) < 3 or len(cleaned) > 45:
        return None
    if re.search(r"\b(read more|sign up|click here|skip to|privacy policy|terms|university|school|college|institute)\b", cleaned, re.I):
        return None
    if len(cleaned.split()) > 5:
        return None
    if not re.search(r"[A-Za-z]", cleaned):
        return None
    return cleaned


def clean_person_name(name: Any) -> str | None:
    if name is None:
        return None
    cleaned = re.sub(r"\s+", " ", str(name)).strip(" -:|,.;")
    if not cleaned:
        return None
    if cleaned.lower() in {"alumni from", "founder", "ceo", "team"}:
        return None
    if len(cleaned.split()) < 2 or len(cleaned.split()) > 4:
        return None
    if not re.match(r"^[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+)+$", cleaned):
        return None
    return cleaned


def record_confidence(record: dict[str, Any]) -> int:
    evidence = record.get("_evidence") or {}
    fields = record.get("_requested_fields") or [k for k in record if not k.startswith("_") and k not in {"confidence_score", "quality_warnings", "valid_through"}]
    supported = sum(bool(record.get(k)) and bool(evidence.get(k)) for k in fields)
    # This is an evidence/completeness score, not a probability of correctness.
    score = round(70 * supported / max(len(fields), 1))
    if record.get("_source") or record.get("_sources"):
        score += 10
    if record.get("_relevance_verified"):
        score += 15
    return min(85, score)


def relevance_errors(record: dict[str, Any], spec: dict[str, Any]) -> list[str]:
    errors = []
    if not clean_company_name(record.get("company_name")):
        errors.append("Missing or invalid company identity")
    if not record.get("_evidence", {}).get("company_name"):
        errors.append("Company identity has no extraction evidence")
    if spec.get("entity_type") == "job":
        description = str(record.get("_context", "")).lower()
        if re.search(r"not an active job|no longer accepting|position (?:has been |is )?filled|job (?:has )?expired|talent (?:community|pool|database)", description):
            errors.append("Posting is closed or is a talent pool rather than an active vacancy")
        for field in ("job_title", "application_link", "location"):
            if not record.get(field):
                errors.append(f"Missing job field: {field}")
        from datetime import datetime, timezone
        expiry = record.get("valid_through")
        if expiry:
            try:
                end = datetime.fromisoformat(str(expiry).replace("Z", "+00:00"))
                if end.replace(tzinfo=end.tzinfo or timezone.utc) < datetime.now(timezone.utc):
                    errors.append("Job posting has expired")
            except ValueError:
                errors.append("Job expiry could not be verified")
    context = str(record.get("_context", "")).lower()
    aliases = {"india": ["india", "indian", "bengaluru", "bangalore", "mumbai", "hyderabad", "pune", "delhi", "noida", "gurugram", "gurgaon", "chennai", "kolkata"],
               "backend": ["backend", "back-end", "back end", "server-side", "server side"],
               "frontend": ["frontend", "front-end", "front end"],
               "full stack": ["full stack", "full-stack", "fullstack"],
               "node.js": ["node.js", "nodejs", "node js"],
               "saas": ["saas", "software as a service", "software-as-a-service"],
               "artificial intelligence": ["artificial intelligence", "machine learning", "ai", "ml"],
               "bengaluru": ["bengaluru", "bangalore"], "bangalore": ["bengaluru", "bangalore"],
               "hr tech": ["hr tech", "hrtech", "human resources", "payroll"],
               "y combinator": ["y combinator", "yc-backed", "yc backed"]}
    for key, value in spec.get("filters", {}).items():
        if key == "founded_after":
            year = record.get("founded_year")
            if not year or not str(year).isdigit() or int(year) <= int(value):
                errors.append("Founding year constraint is unverified")
            continue
        values = value if isinstance(value, list) else [value]
        terms = [term for val in values for term in aliases.get(str(val).lower(), [str(val).lower()])]
        field_context = str(record.get("location", "")).lower() if spec.get("entity_type") == "job" and key in {"country", "city"} else context
        if key == "role" and spec.get("entity_type") == "job":
            field_context = str(record.get("job_title", "")).lower()
        if not any(re.search(r"\b" + re.escape(t) + r"\b", field_context) for t in terms):
            errors.append(f"Unverified filter: {key}={value}")
    return errors
