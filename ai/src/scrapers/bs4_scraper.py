"""BeautifulSoup HTML parsing utility module."""
from bs4 import BeautifulSoup
from app.tools.parser import DataParserTool

def parse_html_elements(html_content: str, selector: str) -> list[str]:
    """Parses raw HTML using BeautifulSoup CSS selectors."""
    soup = BeautifulSoup(html_content, "html.parser")
    return [elem.get_text(strip=True) for elem in soup.select(selector)]

__all__ = ["DataParserTool", "parse_html_elements"]
