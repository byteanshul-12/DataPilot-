import logging
from urllib.parse import quote_plus, urlparse
import httpx
from bs4 import BeautifulSoup
from ai.config import MAXUN_API_KEY, MAXUN_API_URL

logger = logging.getLogger("datapilot.maxun")
logger.setLevel(logging.INFO)

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

async def scrape_with_maxun_api(url: str, prompt: str = "") -> dict | None:
    """Attempts to scrape a target URL using the Maxun API if configured."""
    if not MAXUN_API_URL:
        return None

    headers = {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
    }
    if MAXUN_API_KEY:
        headers["X-API-KEY"] = MAXUN_API_KEY
        headers["Authorization"] = f"Bearer {MAXUN_API_KEY}"

    endpoint = f"{MAXUN_API_URL.rstrip('/')}/api/v1/scrape"
    payload = {
        "url": url,
        "prompt": prompt,
        "extract": True,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.post(endpoint, json=payload, headers=headers)
            if resp.status_code == 200:
                logger.info(f"Successfully scraped {url} via Maxun API")
                return resp.json()
            else:
                logger.debug(
                    f"Maxun API returned status {resp.status_code} for {url}"
                )
    except Exception as e:
        logger.debug(f"Maxun API call skipped/failed for {url}: {e}")

    return None

async def fetch_web_content(url: str) -> dict:
    """Fallback web scraper using httpx and BeautifulSoup."""
    headers = {"User-Agent": USER_AGENT}
    domain = urlparse(url).netloc or "unknown"
    
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                # Remove scripts, styles, and non-content tags
                for element in soup(["script", "style", "nav", "footer", "header", "svg"]):
                    element.decompose()
                text_content = soup.get_text(separator=" ", strip=True)
                return {
                    "url": url,
                    "domain": domain,
                    "status": "scraped",
                    "title": soup.title.string if soup.title else domain,
                    "html": resp.text[:10000],
                    "text": text_content[:15000],
                }
    except Exception as e:
        logger.error(f"Failed to fetch {url}: {e}")

    return {
        "url": url,
        "domain": domain,
        "status": "failed",
        "title": domain,
        "html": "",
        "text": "",
    }

async def search_web_sources(query: str, count: int = 10) -> list[dict]:
    """
    Searches the web for relevant URLs using DuckDuckGo / HTML search scraping,
    and returns scraped page data from permitted sources.
    """
    encoded_query = quote_plus(query)
    search_url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
    
    headers = {"User-Agent": USER_AGENT}
    discovered_sources = []

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(search_url, headers=headers)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                results = soup.find_all("a", class_="result__url")
                
                urls = []
                for a in results:
                    href = a.get("href", "")
                    target_url = ""
                    if href.startswith("//duckduckgo.com/l/?uddg="):
                        from urllib.parse import parse_qs, urlparse
                        parsed = parse_qs(urlparse(href).query)
                        if "uddg" in parsed:
                            target_url = parsed["uddg"][0]
                    elif href.startswith("http"):
                        target_url = href

                    # Skip ad tracking & redirect links
                    if target_url and not any(ad_kw in target_url for ad_kw in ["y.js", "aclick", "duckduckgo.com/y.js", "msclkid="]):
                        urls.append(target_url)

                # Deduplicate discovered URLs
                unique_urls = list(dict.fromkeys(urls))[:count]
                
                for url in unique_urls[:count]:
                    # First try Maxun API
                    maxun_res = await scrape_with_maxun_api(url, query)
                    if maxun_res and maxun_res.get("data"):
                        domain = urlparse(url).netloc
                        discovered_sources.append({
                            "url": url,
                            "domain": domain,
                            "status": "scraped",
                            "title": maxun_res.get("title", domain),
                            "text": str(maxun_res.get("data", "")),
                        })
                    else:
                        # Fallback to direct web scraping
                        web_res = await fetch_web_content(url)
                        if web_res["status"] == "scraped" and len(web_res["text"]) > 100:
                            discovered_sources.append(web_res)

    except Exception as e:
        logger.error(f"Error during search_web_sources for query '{query}': {e}")

    return discovered_sources
