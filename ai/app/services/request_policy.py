"""Request routing and explicit-constraint checks shared by every entry point."""
import re
from difflib import get_close_matches

from app.schemas.workflow import WorkflowSpecification

JOB_PATTERN = r"\b(jobs?|roles?|positions?|vacanc(?:y|ies)|openings?|hiring|careers?)\b"
CITIES = {c.lower(): c for c in ("Noida", "Greater Noida", "Bengaluru", "Bangalore", "Mumbai", "Delhi", "New Delhi", "Hyderabad", "Pune", "Chennai", "Gurugram", "Gurgaon", "Kolkata")}
ROLES = {"backend": r"\bback[ -]?end\b", "frontend": r"\bfront[ -]?end\b", "full stack": r"\bfull[ -]?stack\b", "data engineer": r"\bdata engineer(?:ing)?\b", "data analyst": r"\bdata analyst\b"}


def apply_request_policy(requirement, specification):
    spec = WorkflowSpecification(**specification).model_dump()
    text = requirement.lower().strip()
    questions = list(spec.get("clarification_questions", []))
    filters = dict(spec.get("filters") or {})
    for old, new in {"job_role": "role", "job_title": "role", "job_location": "city", "location": "city"}.items():
        if old in filters:
            filters.setdefault(new, filters.pop(old))
    count = re.search(r"\b(?:find|get|show|list|collect|scrape)\s+(\d+)\b", text)
    if count:
        spec["target_count"] = int(count.group(1))
    if spec.get("target_count") is not None and not 1 <= spec["target_count"] <= 500:
        questions.append("Please request between 1 and 500 records.")
    if re.search(JOB_PATTERN, text) or spec.get("entity_type") == "job":
        spec.update(entity_type="job", intent="extract_jobs")
        field_aliases = {"job_location": "location", "posted_date": "date_posted", "job_description": "description", "apply_url": "application_link"}
        fields = [field_aliases.get(f, f) for f in spec.get("fields", []) if f != "founder" or "founder" in text]
        spec["fields"] = list(dict.fromkeys(["job_title", "company_name", "location", "application_link"] + fields))
        spec["deduplication_key"] = ["company_name", "job_title", "location"]
        spec["source_types"] = ["job_board", "company_careers_page"]
        spec["fallback_sources"] = ["company_careers_page", "job_board"]
        spec["validation_rules"] = ["job_title_required", "company_name_required", "location_required", "application_link_required", "source_url_required"]
        for role, pattern in ROLES.items():
            if re.search(pattern, text):
                filters["role"] = role
        if re.search(r"\bnode(?:\.js|js)?\b", text):
            filters["technology"] = "Node.js"
        for city in sorted(CITIES, key=len, reverse=True):
            if re.search(r"\b" + re.escape(city) + r"\b", text):
                filters["city"] = CITIES[city]
                filters["country"] = "India"
                break
        location = re.search(r"\b(?:in|near|around|based in)\s+([a-z][a-z -]*?)(?=[.,!?]|\s+(?:with|including|and|for)\b|$)", text)
        if location:
            raw = location.group(1).strip()
            if raw in {"ai", "ai field", "the ai field", "backend", "frontend", "data science"}:
                raw = ""
            suggestion = "Noida" if raw == "nodia" else None
            if raw and raw not in CITIES:
                close = get_close_matches(raw, list(CITIES), n=1, cutoff=0.78)
                suggestion = suggestion or (CITIES[close[0]] if close else None)
            if suggestion:
                questions.append(f'Did you mean {suggestion}, India by "{raw}"? Please resend the full request with the confirmed location.')
            elif raw and raw not in CITIES and raw not in {"india", "us", "usa", "united states", "uk", "remote"}:
                filters["city"] = raw.title()
        if re.search(r"\bindia[n]?\b", text):
            filters["country"] = "India"
        if location and location.group(1).strip() in {"us", "usa", "united states"}:
            filters["country"] = "United States"
        if location and location.group(1).strip() == "uk":
            filters["country"] = "United Kingdom"
        if "near me" in text or (not any(k in filters for k in ("city", "country")) and "remote" not in text and not questions):
            questions.append("Which city or country should these jobs be in?")
        if "remote" in text:
            filters["work_mode"] = "remote"
    spec["filters"] = filters
    if questions:
        spec["needs_clarification"] = True
        spec["clarification_questions"] = list(dict.fromkeys(questions))
        spec["missing_field_strategy"] = "ask_user_for_clarification"
    spec["plan_summary"] = f"Find {spec.get('target_count')} {spec['entity_type']} records matching {', '.join(str(v) for v in filters.values()) or 'the confirmed request'}."
    return spec


def preflight(requirement):
    text = requirement.lower().strip()
    collection = re.search(r"\b(find|get|show|list|collect|scrape|search)\b", text) or re.search(JOB_PATTERN, text)
    social = re.fullmatch(r"[\s!?,.]*((hi|hello|hey|good morning|good afternoon|good evening|how are you|how are you doing|thanks|thank you|namaste|today)[\s!?,.]*)+", text)
    if social and not collection:
        reply = "Hello! I'm ready to help. What data would you like to find?"
        if "good morning" in text:
            reply = "Good morning! I'm ready to help. What data would you like to find?"
        elif "how are you" in text:
            reply = "I'm doing well and ready to help. How can I help you today?"
        elif "thank" in text:
            reply = "You're welcome!"
        return WorkflowSpecification(intent="conversation", entity_type="conversation", target_count=0, plan_summary=reply).model_dump()
    baseline = apply_request_policy(requirement, {"intent": "extract_jobs" if re.search(JOB_PATTERN, text) else "unknown", "entity_type": "job" if re.search(JOB_PATTERN, text) else "unknown", "target_count": 10})
    if baseline["needs_clarification"]:
        return baseline
    if not collection and not re.search(r"\b(companies|startups|leads|sponsors|products)\b", text):
        baseline.update(needs_clarification=True, clarification_questions=["Would you like to search for data? Please describe what you need, where, and how many records."], missing_field_strategy="ask_user_for_clarification")
        return baseline
    return None


async def interpret_request(requirement, model):
    immediate = preflight(requirement)
    if immediate is not None:
        return immediate
    spec = apply_request_policy(requirement, await model.generate_workflow_spec(requirement))
    if spec["entity_type"] not in {"company", "job", "conversation"}:
        spec.update(needs_clarification=True, clarification_questions=["Currently I can collect company records and job postings. Which do you need?"])
    return spec


def response_status(spec):
    if spec.get("entity_type") == "conversation":
        return "answered"
    if spec.get("needs_clarification"):
        return "needs_clarification"
    return "ready"


def reply_for(spec):
    return " ".join(spec.get("clarification_questions", [])) if spec.get("needs_clarification") else spec.get("plan_summary", "")
