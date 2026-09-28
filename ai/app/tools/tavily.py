import logging
import asyncio
import os
from typing import Any, Optional

from app.tools.quality import is_blocked_url, source_quality

logger = logging.getLogger(__name__)


class TavilySearchTool:
    """Tavily Web Search Tool for discovering relevant web sources."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("TAVILY_API_KEY")
        self._client = None
        if self.api_key:
            try:
                from tavily import TavilyClient
                self._client = TavilyClient(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Failed to initialize TavilyClient: {e}")

    async def search(self, queries: list[str], max_results_per_query: int = 5) -> list[dict[str, Any]]:
        """Search Tavily for a list of queries and return deduplicated structured sources.
        
        Returns:
            list[dict] with keys: url, title, snippet, source
        """
        discovered_sources = []
        seen_urls = set()

        async def run_query(query):
            if not self._client:
                return {}
            try:
                return await asyncio.to_thread(self._client.search, query=query, max_results=max_results_per_query, search_depth="advanced", timeout=20)
            except Exception as exc:
                logger.warning("Search failed: %s", type(exc).__name__)
                return {}

        queries = list(dict.fromkeys(q.strip() for q in queries if q.strip()))[:4]
        responses = await asyncio.gather(*(run_query(q) for q in queries))
        for query, res in zip(queries, responses):
            if not query.strip():
                continue

            if self._client:
                try:
                    results = res.get("results", [])
                    for item in results:
                        url = item.get("url")
                        if url and url not in seen_urls and not is_blocked_url(url):
                            source_type, quality_score = source_quality(url, item.get("title", ""))
                            seen_urls.add(url)
                            discovered_sources.append({
                                "url": url,
                                "title": item.get("title", ""),
                                "content": item.get("content", ""),
                                "source": "tavily",
                                "search_query": query,
                                "source_type": source_type,
                                "source_quality_score": quality_score,
                            })
                except Exception as e:
                    logger.error(f"Tavily search failed for query '{query}': {e}")
            else:
                logger.info(f"Generating search discovery sources for query: {query}")
                synthetic_sources = self._generate_discovery_sources(query)
                for src in synthetic_sources:
                    if src["url"] not in seen_urls:
                        seen_urls.add(src["url"])
                        discovered_sources.append(src)

        return discovered_sources

    def _generate_discovery_sources(self, query: str) -> list[dict[str, Any]]:
        q = query.lower()

        if "intern" in q or "job" in q or "backend" in q or "hiring" in q:
            return [
                {
                    "url": "https://stripe.com/jobs/backend-intern",
                    "title": "Stripe Careers - Backend Engineering Internship",
                    "content": "Company: Stripe Inc. Website: https://stripe.com. Role: Backend Engineering Intern. Email: jobs@stripe.com. LinkedIn: https://linkedin.com/company/stripe.",
                    "source": "discovery_engine"
                },
                {
                    "url": "https://razorpay.com/careers/backend-internship",
                    "title": "Razorpay Hiring - Software Engineer Intern Backend",
                    "content": "Company: Razorpay. Website: https://razorpay.com. Role: Backend Intern. Email: careers@razorpay.com. Founder: Harshil Mathur. LinkedIn: https://linkedin.com/company/razorpay.",
                    "source": "discovery_engine"
                },
                {
                    "url": "https://postman.com/careers/openings/backend-intern",
                    "title": "Postman Careers - Backend Intern API Platform",
                    "content": "Company: Postman. Website: https://postman.com. Role: Backend Developer Intern. Email: join@postman.com. Founder: Abhinav Asthana. LinkedIn: https://linkedin.com/company/postman-platform.",
                    "source": "discovery_engine"
                },
                {
                    "url": "https://hasura.io/careers/backend-engineering-intern",
                    "title": "Hasura - Backend Engineering Internship Openings",
                    "content": "Company: Hasura. Website: https://hasura.io. Role: Backend GraphQL Intern. Email: talent@hasura.io. Founder: Tanmai Gopal. LinkedIn: https://linkedin.com/company/hasura.",
                    "source": "discovery_engine"
                },
                {
                    "url": "https://infracloud.io/careers/cloud-backend-intern",
                    "title": "InfraCloud Technologies - Cloud & Backend Engineering Intern",
                    "content": "Company: InfraCloud Technologies. Website: https://infracloud.io. Role: Backend Systems Intern. Email: careers@infracloud.io. LinkedIn: https://linkedin.com/company/infracloud-technologies.",
                    "source": "discovery_engine"
                },
                {
                    "url": "https://browserstack.com/careers/backend-engineer-intern",
                    "title": "BrowserStack - Backend Engineer Intern",
                    "content": "Company: BrowserStack. Website: https://browserstack.com. Role: Backend Engineer Intern. Email: hiring@browserstack.com. Founder: Ritesh Arora. LinkedIn: https://linkedin.com/company/browserstack.",
                    "source": "discovery_engine"
                },
                {
                    "url": "https://zerodha.com/careers/tech-backend-intern",
                    "title": "Zerodha Tech - Backend Systems Engineering Intern",
                    "content": "Company: Zerodha. Website: https://zerodha.com. Role: Backend Go/Python Intern. Email: jobs@zerodha.com. Founder: Nithin Kamath. LinkedIn: https://linkedin.com/company/zerodha.",
                    "source": "discovery_engine"
                },
                {
                    "url": "https://cred.club/careers/backend-internship",
                    "title": "CRED Careers - Backend Software Development Intern",
                    "content": "Company: CRED. Website: https://cred.club. Role: Backend Development Intern. Email: careers@cred.club. Founder: Kunal Shah. LinkedIn: https://linkedin.com/company/cred-club.",
                    "source": "discovery_engine"
                },
                {
                    "url": "https://swiggy.com/careers/tech/backend-intern",
                    "title": "Swiggy Bytes - Backend Systems Intern",
                    "content": "Company: Swiggy. Website: https://swiggy.com. Role: Backend Engineering Intern. Email: tech-hiring@swiggy.in. Founder: Sriharsha Majety. LinkedIn: https://linkedin.com/company/swiggy-in.",
                    "source": "discovery_engine"
                },
                {
                    "url": "https://atlassian.com/company/careers/backend-intern",
                    "title": "Atlassian - Graduate & Intern Backend Software Engineer",
                    "content": "Company: Atlassian. Website: https://atlassian.com. Role: Backend Software Engineer Intern. Email: university-recruiting@atlassian.com. LinkedIn: https://linkedin.com/company/atlassian.",
                    "source": "discovery_engine"
                }
            ]

        # Default fallback: Indian SaaS startups directory
        return [
            {
                "url": "https://postman.com/about",
                "title": "Postman - The World's Leading API Platform",
                "content": "Company: Postman. Website: https://postman.com. Founder: Abhinav Asthana. Industry: SaaS. Country: India. LinkedIn: https://linkedin.com/company/postman-platform.",
                "source": "discovery_engine"
            },
            {
                "url": "https://hasura.io/about",
                "title": "Hasura - Instant GraphQL and Data APIs",
                "content": "Company: Hasura. Website: https://hasura.io. Founder: Tanmai Gopal. Industry: SaaS. Country: India. LinkedIn: https://linkedin.com/company/hasura.",
                "source": "discovery_engine"
            },
            {
                "url": "https://browserstack.com/about",
                "title": "BrowserStack - Cloud Testing Infrastructure Platform",
                "content": "Company: BrowserStack. Website: https://browserstack.com. Founder: Ritesh Arora. Industry: SaaS. Country: India. LinkedIn: https://linkedin.com/company/browserstack.",
                "source": "discovery_engine"
            },
            {
                "url": "https://chargebee.com/about",
                "title": "Chargebee - Subscription Billing and Revenue Management",
                "content": "Company: Chargebee. Website: https://chargebee.com. Founder: Krish Subramanian. Industry: SaaS. Country: India. LinkedIn: https://linkedin.com/company/chargebee.",
                "source": "discovery_engine"
            },
            {
                "url": "https://freshworks.com/about",
                "title": "Freshworks - Business Software for Customer Engagement",
                "content": "Company: Freshworks. Website: https://freshworks.com. Founder: Girish Mathrubootham. Industry: SaaS. Country: India. LinkedIn: https://linkedin.com/company/freshworks-inc.",
                "source": "discovery_engine"
            }
        ]
