# Playwright browser automation scraper for JS-rendered dynamic pages.
from playwright.async_api import async_playwright

async def scrape_dynamic_page(url: str) -> str:
    # Launches headless browser and extracts dynamic HTML content.
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url)
        content = await page.content()
        await browser.close()
        return content
