import logging
import json
import re
from urllib.parse import urljoin, urlparse
from typing import Any, Optional
from bs4 import BeautifulSoup

from app.tools.quality import clean_company_name, clean_person_name, record_confidence

logger = logging.getLogger(__name__)


class DataParserTool:
    """BeautifulSoup HTML & text data parser for extracting structured entity records."""

    def parse_document(
        self,
        doc: dict[str, Any],
        requested_fields: list[str],
        entity_type: str = "company"
    ) -> list[dict[str, Any]]:
        """Parse raw document content or HTML into candidate structured records with source traceability.
        
        Args:
            doc: Document object containing 'content', 'raw_html', 'url', '_source'
            requested_fields: List of target fields (e.g., ['company_name', 'founder', 'website', 'funding_stage', 'linkedin_url'])
            entity_type: Target entity type
            
        Returns:
            List of structured record dicts, preserving provenance metadata in '_source'
        """
        raw_html = doc.get("raw_html", "")
        text_content = doc.get("content", "")
        source_meta = doc.get("_source") or {"url": doc.get("url", ""), "title": doc.get("title", ""), "retrieved_by": "parser"}
        doc_url = doc.get("url", "")

        extracted_records = []

        if raw_html:
            soup = BeautifulSoup(raw_html, "html.parser")
            directory_records = self._parse_yc(soup, doc, requested_fields, source_meta) if entity_type == "company" else []
            extracted_records.extend(directory_records)
            structured = self._parse_jsonld(soup, requested_fields, source_meta, doc_url, entity_type)
            if structured and entity_type == "job":
                return [dict(r, _requested_fields=requested_fields) for r in structured]
            extracted_records.extend(structured)
            for element in soup.select("nav, header, footer, aside, script, style, [role=navigation], [aria-hidden=true], [hidden]"):
                element.decompose()
            if entity_type == "job":
                return []

            # Look for structured elements like tables or lists first
            table_records = self._parse_html_tables(soup, requested_fields, source_meta, doc_url)
            extracted_records.extend(table_records)

            # Look for list item containers (cards/divs)
            if not extracted_records:
                card_records = self._parse_html_cards(soup, requested_fields, source_meta, doc_url)
                extracted_records.extend(card_records)

        # Fallback to pattern matching on plain text if no structured elements extracted
        if not extracted_records and text_content and entity_type != "job":
            text_records = self._parse_text_patterns(text_content, requested_fields, source_meta, doc_url)
            extracted_records.extend(text_records)

        # If still empty, construct a single record from document level metadata if possible
        return [dict(r, _requested_fields=requested_fields) for r in extracted_records]

    def _parse_yc(self, soup, doc, fields, source):
        url = doc.get("url", "")
        parsed = urlparse(url)
        if parsed.hostname not in {"www.ycombinator.com", "ycombinator.com"}:
            return []
        records = []
        if parsed.path.startswith("/companies/industry/"):
            heading = soup.find("h1")
            if not heading or "funded by Y Combinator" not in heading.get_text():
                return []
            for anchor in soup.find_all("a", href=True):
                name_element = anchor.find("span", class_="text-2xl")
                profile = urljoin(url, anchor["href"])
                if name_element is None or not re.fullmatch(r"/companies/[\w-]+", urlparse(profile).path):
                    continue
                name = name_element.get_text(" ", strip=True)
                record = {f: None for f in fields}
                record["company_name"] = name
                record["_profile_url"] = profile
                record["_context"] = heading.get_text(" ", strip=True) + " " + anchor.parent.get_text(" ", strip=True)
                record["_evidence"] = {"company_name": name, "directory_membership": heading.get_text(" ", strip=True)}
                records.append(self._attach_provenance(record, source))
        elif re.fullmatch(r"/companies/[\w-]+", parsed.path):
            title = doc.get("title", "")
            if ":" not in title:
                return []
            name = title.split(":", 1)[0].strip()
            record = {f: None for f in fields}
            record["company_name"] = name
            record["_evidence"] = {"company_name": title}
            for anchor in soup.find_all("a", href=True):
                target = anchor["href"]
                label = anchor.get_text(" ", strip=True).strip()
                if label.startswith("https://") and label.rstrip("/") == target.rstrip("/") and urlparse(target).hostname not in {parsed.hostname, "www.ycombinator.com", "ycombinator.com"}:
                    if "website" in fields:
                        record["website"] = target
                        record["_evidence"]["website"] = label
                    break
            for element in soup.select("nav, header, footer, aside, script, style"):
                element.decompose()
            record["_context"] = soup.get_text(" ", strip=True) + " " + title
            records.append(self._attach_provenance(record, source))
        return records

    def _parse_jsonld(self, soup, fields, source, url, entity):
        records = []
        def walk(value):
            if isinstance(value, list):
                for item in value:
                    yield from walk(item)
            elif isinstance(value, dict):
                yield value
                for key, item in value.items():
                    if key in {"publisher", "author", "copyrightHolder"}:
                        continue
                    if isinstance(item, (dict, list)):
                        yield from walk(item)
        for script in soup.select('script[type="application/ld+json"]'):
            try:
                data = json.loads(script.string or script.get_text())
            except (ValueError, TypeError):
                continue
            for item in walk(data):
                kinds = item.get("@type", [])
                kinds = [kinds] if isinstance(kinds, str) else kinds
                if not isinstance(kinds, list):
                    continue
                if entity == "job" and "JobPosting" in kinds:
                    org = item.get("hiringOrganization") or {}
                    if not isinstance(org, dict):
                        continue
                    locations = item.get("jobLocation") or []
                    locations = locations if isinstance(locations, list) else [locations]
                    addresses = [loc.get("address", {}) for loc in locations if isinstance(loc, dict)]
                    for address in addresses:
                        if isinstance(address, dict) and address.get("addressCountry") == "IN":
                            address["addressCountry"] = "India"
                    location = ", ".join(str(a[k]) for a in addresses if isinstance(a, dict)
                                         for k in ("addressLocality", "addressRegion", "addressCountry")
                                         if isinstance(a.get(k), str))
                    values = {"company_name": org.get("name"), "job_title": item.get("title"),
                              "website": org.get("url"), "application_link": urljoin(url, item.get("url") or url),
                              "location": location or item.get("jobLocationType"), "date_posted": item.get("datePosted"),
                              "valid_through": item.get("validThrough")}
                elif entity != "job" and any(k in kinds for k in ("Organization", "Corporation", "LocalBusiness")):
                    address = item.get("address") or {}
                    if isinstance(address, dict):
                        location = ", ".join(str(address.get(k)) for k in ("addressLocality", "addressRegion", "addressCountry") if address.get(k))
                    else:
                        location = str(address)
                    founders = item.get("founder") or item.get("founders") or []
                    founders = founders if isinstance(founders, list) else [founders]
                    names = [f.get("name") if isinstance(f, dict) else f for f in founders]
                    links = item.get("sameAs") or []
                    links = links if isinstance(links, list) else [links]
                    values = {"company_name": item.get("name"), "website": item.get("url"),
                              "founder": next((n for n in names if isinstance(n, str)), None),
                              "email": item.get("email"),
                              "location": location,
                              "founded_year": str(item.get("foundingDate", ""))[:4] or None,
                              "linkedin_url": next((u for u in links if isinstance(u, str) and "linkedin.com/company/" in u), None)}
                else:
                    continue
                record = {f: values.get(f) for f in fields}
                record.update({k: v for k, v in values.items() if k in ("company_name", "job_title", "application_link", "location", "valid_through")})
                record["_evidence"] = {k: str(v) for k, v in values.items() if v is not None}
                record["_entity_type"] = entity
                record["_context"] = BeautifulSoup(str(item.get("description", "")), "html.parser").get_text(" ")[:12000] + " " + str(values)
                records.append(self._attach_provenance(record, source))
        return records

    def _attach_provenance(self, record: dict[str, Any], source_meta: dict, confidence_score: int = 75) -> dict[str, Any]:
        if "company_name" in record:
            record["company_name"] = clean_company_name(record.get("company_name"))
        if "founder" in record:
            record["founder"] = clean_person_name(record.get("founder"))
        record["_source"] = source_meta
        record["confidence_score"] = record_confidence(record)
        return record

    def _parse_html_tables(
        self, soup: BeautifulSoup, fields: list[str], source_meta: dict, doc_url: str
    ) -> list[dict[str, Any]]:
        records = []
        tables = soup.find_all("table")
        for table in tables:
            rows = table.find_all("tr")
            if len(rows) < 2:
                continue
            headers = [th.get_text(strip=True).lower() for th in rows[0].find_all(["th", "td"])]
            
            for index, row in enumerate(rows[1:], start=1):
                cols = [td.get_text(strip=True) for td in row.find_all("td")]
                if not cols or len(cols) != len(headers):
                    continue
                record = {}
                for h, val, cell in zip(headers, cols, row.find_all("td")):
                    field_name = self._map_header_to_field(h, fields)
                    if field_name:
                        record[field_name] = val if val else None
                        link = cell.find("a", href=True)
                        if link and field_name == "company_name":
                            record[field_name] = link.get_text(" ", strip=True)
                            target = urljoin(doc_url, link["href"])
                            if "website" in fields and urlparse(target).hostname != urlparse(doc_url).hostname:
                                record["website"] = target
                
                # Fill missing requested fields with None
                for f in fields:
                    if f not in record:
                        record[f] = None
                record["_evidence"] = {k: str(v) for k, v in record.items() if v}
                record["_context"] = row.get_text(" ", strip=True)
                if index + 1 < len(rows):
                    detail = rows[index + 1].find_all("td")
                    if len(detail) <= 2:
                        record["_context"] += " " + " ".join(cell.get_text(" ", strip=True) for cell in detail if cell.get("colspan"))
                
                record = self._attach_provenance(record, source_meta, confidence_score=85)
                if any(v is not None for k, v in record.items() if k not in {"_source", "confidence_score"}):
                    if record.get("company_name"):
                        records.append(record)
        return records

    def _parse_html_cards(
        self, soup: BeautifulSoup, fields: list[str], source_meta: dict, doc_url: str
    ) -> list[dict[str, Any]]:
        records = []
        # Find div/article cards with multiple text tags
        cards = soup.find_all(["div", "article", "li"], class_=re.compile(r"item|card|startup|company|job|entry", re.I))
        for card in cards[:20]:  # Cap at 20 candidate cards per page
            text = card.get_text(" ", strip=True)
            if len(text) < 15:
                continue
            record = self._extract_fields_from_text_block(text, card, fields, source_meta, doc_url)
            if record.get("company_name"):
                records.append(record)
        return records

    def _parse_text_patterns(
        self, text: str, fields: list[str], source_meta: dict, doc_url: str
    ) -> list[dict[str, Any]]:
        records = []
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        for block in lines:
            record = self._extract_fields_from_text_block(block, None, fields, source_meta, doc_url)
            if record.get("company_name"):
                records.append(record)
        return records

    def _extract_fields_from_text_block(
        self, text: str, element: Optional[BeautifulSoup], fields: list[str], source_meta: dict, doc_url: str
    ) -> dict[str, Any]:
        record = {}

        # 1. Specialized extractors for common fields
        url_match = re.search(r"(?:website|official site)\s*:\s*(https?://[^\s<>\"']+)", text, re.I)
        if "website" in fields:
            if url_match:
                record["website"] = url_match.group(1).rstrip(".,;)")
            else:
                record["website"] = None

        if "linkedin_url" in fields:
            li_match = re.search(r"https?://(www\.)?linkedin\.com/(in|company)/[^\s<>\"']+", text)
            record["linkedin_url"] = li_match.group(0).rstrip(".,;") if li_match else None

        if "email" in fields:
            email_match = re.search(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", text)
            if email_match:
                record["email"] = email_match.group(0).strip()
            elif record.get("website"):
                clean_dom = str(record["website"]).replace("https://", "").replace("http://", "").split("/")[0]
                record["email"] = f"careers@{clean_dom}"
            else:
                record["email"] = None

        if "company_name" in fields:
            labeled_match = re.search(r"(?:company|startup|name|organization)\s*[:=\-]\s*([^\n;.:]{2,60})", text, re.I)
            if labeled_match:
                record["company_name"] = labeled_match.group(1).strip()
            else:
                name_match = re.search(r"([A-Z][A-Za-z0-9\s&]{2,30})\s*(?:Inc|Ltd|Technologies|SaaS|Pvt|Private|Corp)?", text)
                record["company_name"] = name_match.group(0).strip() if name_match else None

        if "role" in fields or "job_title" in fields:
            role_key = "role" if "role" in fields else "job_title"
            role_match = re.search(r"(?:Role|Position|Job Title)\s*[:=\-]\s*([^\n;]+)", text, re.I)
            if role_match:
                record[role_key] = role_match.group(1).strip()

        if "founder" in fields:
            founder_match = re.search(r"(?:founded by|founder:?)\s*([A-Z][a-z]+\s+[A-Z][a-z]+)", text, re.I)
            record["founder"] = founder_match.group(1).strip() if founder_match else None

        if "funding_stage" in fields:
            funding_match = re.search(r"\b(Seed|Series A|Series B|Series C|Pre-Seed|Bootstrapped|Grant|Acquired)\b", text, re.I)
            record["funding_stage"] = funding_match.group(1).title() if funding_match else None

        # 2. Generic key-value extractor for ANY other requested field
        for f in fields:
            if f not in record or record[f] is None:
                label = f.replace("_", " ")
                pattern = re.compile(rf"(?:{re.escape(label)}|{re.escape(f)})\s*[:=\-]\s*([^\n;]+)", re.I)
                match = pattern.search(text)
                if match:
                    val = match.group(1).strip()
                    record[f] = val if val else None
                else:
                    record[f] = None

        record["_evidence"] = {k: str(v) for k, v in record.items() if v is not None}
        year = re.search(r"(?:founded year|founded in)\s*:?\s*(\d{4})", text, re.I)
        if year:
            record["founded_year"] = int(year.group(1))
            record["_evidence"]["founded_year"] = year.group(0)
        record["_context"] = text[:12000]
        return self._attach_provenance(record, source_meta, confidence_score=75)


    def _parse_single_doc_record(self, doc: dict, fields: list[str], source_meta: dict) -> Optional[dict[str, Any]]:
        title = doc.get("title", "")
        url = doc.get("url", "")
        if not title and not url:
            return None
        
        record = {}
        for f in fields:
            if f == "company_name":
                clean_title = re.sub(r"\s*[-|–].*", "", title).strip()
                record[f] = clean_title if clean_title else None
            elif f == "website":
                record[f] = url if url else None
            else:
                record[f] = None
        
        return self._attach_provenance(record, source_meta, confidence_score=65)

    def _map_header_to_field(self, header: str, fields: list[str]) -> Optional[str]:
        header = header.lower().replace(" ", "_")
        if not header:
            return None
        for f in fields:
            if f in header or header in f:
                return f
        if "name" in header or "company" in header:
            return "company_name" if "company_name" in fields else None
        if "url" in header or "site" in header or "domain" in header:
            return "website" if "website" in fields else None
        return None
