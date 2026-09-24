# BeautifulSoup HTML parsing utility for static web page extraction.
from bs4 import BeautifulSoup

def parse_html_elements(html_content: str, selector: str) -> list[str]:
    # Parses raw HTML using BeautifulSoup CSS selectors.
    soup = BeautifulSoup(html_content, "html.parser")
    return [elem.get_text(strip=True) for elem in soup.select(selector)]
