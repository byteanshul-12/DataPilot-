"""Generate validated synthetic DataPilot requirement-to-spec examples."""

from __future__ import annotations

import json
import os
import random
import sys
from typing import Any

SCRIPT_DIR = os.path.dirname(__file__)
TRAINING_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
AI_ROOT = os.path.abspath(os.path.join(TRAINING_DIR, ".."))
OUTPUT_PATH = os.path.join(TRAINING_DIR, "dataset", "synthetic_dataset.json")

sys.path.insert(0, AI_ROOT)

from app.schemas.workflow import WorkflowSpecification

SEED = 42
TARGET_EXAMPLES = 420


def spec(
    *,
    intent: str,
    target_count: int,
    entity_type: str,
    filters: dict[str, Any],
    fields: list[str],
    source_types: list[str],
    deduplication_key: list[str],
    validation_rules: list[str],
) -> dict[str, Any]:
    return WorkflowSpecification(
        intent=intent,
        target_count=target_count,
        entity_type=entity_type,
        filters=filters,
        fields=fields,
        source_types=source_types,
        deduplication_key=deduplication_key,
        validation_rules=validation_rules,
    ).model_dump()


def build_examples() -> list[dict[str, Any]]:
    random.seed(SEED)
    examples: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(instruction: str, output: dict[str, Any]) -> None:
        key = instruction.lower().strip()
        if key in seen:
            return
        seen.add(key)
        examples.append({"instruction": instruction, "output": output})

    countries = ["India", "United States", "Singapore", "Germany", "Canada", "United Kingdom"]
    regions = ["North America", "Europe", "Southeast Asia", "Latin America", "Middle East", "Global"]
    startup_industries = ["SaaS", "fintech", "AI infrastructure", "healthtech", "edtech", "climate tech"]
    job_roles = ["Senior React Developer", "Data Engineer", "ML Engineer", "DevOps Engineer", "Product Designer"]
    lead_titles = ["VP of Sales", "Head of Marketing", "CTO", "Founder", "Talent Acquisition Lead"]
    event_topics = ["AI", "Web3", "developer tools", "climate tech", "fintech", "cybersecurity"]
    product_categories = ["AI developer tools", "CRM tools", "data observability tools", "sales automation tools"]
    counts = [10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200]

    for _ in range(90):
        count = random.choice(counts)
        country = random.choice(countries)
        industry = random.choice(startup_industries)
        year = random.choice([2019, 2020, 2021, 2022, 2023, 2024])
        fields = random.sample(
            ["company_name", "founder", "website", "funding_stage", "linkedin_url", "headquarters", "employee_count"],
            k=random.choice([4, 5, 6]),
        )
        if "company_name" not in fields:
            fields.insert(0, "company_name")
        if "website" not in fields:
            fields.append("website")
        add(
            f"Find {count} {country} {industry} startups founded after {year} with {', '.join(fields)}.",
            spec(
                intent=f"find_{industry.replace(' ', '_')}_startups",
                target_count=count,
                entity_type="company",
                filters={"country": country, "industry": industry, "founded_after": year},
                fields=fields,
                source_types=["company_website", "linkedin", "startup_database", "news"],
                deduplication_key=["company_name", "website"],
                validation_rules=["company_name_required", "website_valid_url"],
            ),
        )

    for _ in range(75):
        count = random.choice(counts)
        role = random.choice(job_roles)
        region = random.choice(regions)
        days = random.choice([3, 7, 14, 30])
        fields = ["job_title", "company_name", "location", "salary_range", "application_link"]
        add(
            f"Extract {count} remote {role} jobs in {region} posted in the last {days} days with job title, company name, location, salary range and application link.",
            spec(
                intent="extract_jobs",
                target_count=count,
                entity_type="job",
                filters={"role": role, "region": region, "remote": True, "posted_within_days": days},
                fields=fields,
                source_types=["job_board", "company_careers_page", "linkedin"],
                deduplication_key=["company_name", "job_title", "application_link"],
                validation_rules=["job_title_required", "company_name_required", "application_link_valid_url"],
            ),
        )

    for _ in range(75):
        count = random.choice(counts)
        title = random.choice(lead_titles)
        region = random.choice(regions)
        industry = random.choice(startup_industries)
        fields = ["full_name", "title", "company", "email", "linkedin_profile"]
        add(
            f"Find {count} {title} leads at {industry} companies in {region} with full name, title, company, email and LinkedIn profile.",
            spec(
                intent="find_leads",
                target_count=count,
                entity_type="lead",
                filters={"title_keyword": title, "industry": industry, "region": region},
                fields=fields,
                source_types=["linkedin", "company_directory", "company_website"],
                deduplication_key=["email", "linkedin_profile"],
                validation_rules=["full_name_required", "email_valid_email", "linkedin_profile_valid_url"],
            ),
        )

    for _ in range(65):
        count = random.choice(counts)
        topic = random.choice(event_topics)
        region = random.choice(regions)
        quarter = random.choice(["Q1", "Q2", "Q3", "Q4"])
        year = random.choice([2024, 2025, 2026])
        fields = ["event_name", "host_organization", "prize_pool", "location", "registration_url"]
        add(
            f"Find {count} {region} {topic} hackathons taking place in {quarter} {year} with event name, host organization, prize pool, location and registration URL.",
            spec(
                intent="find_hackathons",
                target_count=count,
                entity_type="event",
                filters={"topic": topic, "event_type": "hackathon", "region": region, "timeframe": f"{quarter} {year}"},
                fields=fields,
                source_types=["devpost", "event_pages", "tech_news"],
                deduplication_key=["event_name", "registration_url"],
                validation_rules=["event_name_required", "registration_url_valid_url"],
            ),
        )

    for _ in range(55):
        count = random.choice(counts)
        category = random.choice(product_categories)
        platform = random.choice(["Product Hunt", "G2", "GitHub", "Capterra"])
        year = random.choice([2023, 2024, 2025, 2026])
        fields = ["product_name", "tagline", "maker", "website", "pricing_model"]
        add(
            f"Collect top {count} {category} launched or listed on {platform} in {year} with product name, tagline, maker, website and pricing model.",
            spec(
                intent="find_products",
                target_count=count,
                entity_type="product",
                filters={"category": category, "platform": platform, "year": year},
                fields=fields,
                source_types=["product_directory", "company_website", "review_site"],
                deduplication_key=["product_name", "website"],
                validation_rules=["product_name_required", "website_valid_url"],
            ),
        )

    for _ in range(40):
        count = random.choice([10, 15, 20, 25, 30])
        company = random.choice(["Snowflake", "HubSpot", "Notion", "Datadog", "Stripe", "Shopify"])
        domain = random.choice(["cloud data warehousing", "CRM", "team productivity", "observability", "payments", "commerce"])
        fields = ["competitor_name", "main_website", "key_pricing_model", "enterprise_features"]
        add(
            f"Identify {count} major competitors of {company} in {domain} with competitor name, main website, key pricing model and enterprise features.",
            spec(
                intent="analyze_competitors",
                target_count=count,
                entity_type="competitor",
                filters={"target_competitor_of": company, "domain": domain},
                fields=fields,
                source_types=["analyst_reports", "company_website", "review_site"],
                deduplication_key=["competitor_name", "main_website"],
                validation_rules=["competitor_name_required", "main_website_valid_url"],
            ),
        )

    for _ in range(35):
        count = random.choice([20, 30, 40, 50, 75])
        region = random.choice(regions)
        category = random.choice(["tech conferences", "startup summits", "AI events", "developer conferences"])
        fields = ["sponsor_name", "tier_level", "website", "contact_email"]
        add(
            f"Collect {count} sponsors of {region} {category} with sponsor name, tier level, website and contact email.",
            spec(
                intent="collect_sponsors",
                target_count=count,
                entity_type="sponsor",
                filters={"region": region, "category": category},
                fields=fields,
                source_types=["event_website", "press_release", "sponsor_page"],
                deduplication_key=["sponsor_name", "website"],
                validation_rules=["sponsor_name_required", "website_valid_url", "contact_email_valid_email"],
            ),
        )

    add(
        "Find promising Indian SaaS companies with founder, website and LinkedIn.",
        spec(
            intent="find_saas_companies",
            target_count=10,
            entity_type="company",
            filters={"country": "India", "industry": "SaaS"},
            fields=["company_name", "founder", "website", "linkedin_url"],
            source_types=["company_website", "linkedin", "startup_database"],
            deduplication_key=["company_name", "website"],
            validation_rules=["company_name_required", "website_valid_url", "linkedin_url_valid_url"],
        ),
    )
    add(
        "Give me remote AI engineering roles with company, location and apply link.",
        spec(
            intent="extract_ai_engineering_jobs",
            target_count=10,
            entity_type="job",
            filters={"role_keyword": "AI engineering", "remote": True},
            fields=["job_title", "company_name", "location", "application_link"],
            source_types=["job_board", "company_careers_page"],
            deduplication_key=["company_name", "job_title", "application_link"],
            validation_rules=["job_title_required", "company_name_required", "application_link_valid_url"],
        ),
    )

    random.shuffle(examples)
    return examples[:TARGET_EXAMPLES]


def main() -> None:
    examples = build_examples()
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(examples, f, indent=2)
        f.write("\n")
    print(f"Saved {len(examples)} examples to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
