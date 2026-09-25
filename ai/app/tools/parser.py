import logging
import re
from typing import Any, Optional
from bs4 import BeautifulSoup

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

            # Look for structured elements like tables or lists first
            table_records = self._parse_html_tables(soup, requested_fields, source_meta, doc_url)
            extracted_records.extend(table_records)

            # Look for list item containers (cards/divs)
            if not extracted_records:
                card_records = self._parse_html_cards(soup, requested_fields, source_meta, doc_url)
                extracted_records.extend(card_records)

        # Fallback to pattern matching on plain text if no structured elements extracted
        if not extracted_records and text_content:
            text_records = self._parse_text_patterns(text_content, requested_fields, source_meta, doc_url)
            extracted_records.extend(text_records)

        # If still empty, construct a single record from document level metadata if possible
        if not extracted_records and (doc.get("title") or doc_url):
            fallback_record = self._parse_single_doc_record(doc, requested_fields, source_meta)
            if fallback_record:
                extracted_records.append(fallback_record)

        return extracted_records

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
            
            for row in rows[1:]:
                cols = [td.get_text(strip=True) for td in row.find_all("td")]
                if not cols or len(cols) != len(headers):
                    continue
                record = {}
                for h, val in zip(headers, cols):
                    field_name = self._map_header_to_field(h, fields)
                    if field_name:
                        record[field_name] = val if val else None
                
                # Fill missing requested fields with None
                for f in fields:
                    if f not in record:
                        record[f] = None
                
                record["_source"] = source_meta
                if any(v is not None for k, v in record.items() if k != "_source"):
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
            if any(v is not None for k, v in record.items() if k != "_source"):
                records.append(record)
        return records

    def _parse_text_patterns(
        self, text: str, fields: list[str], source_meta: dict, doc_url: str
    ) -> list[dict[str, Any]]:
        records = []
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        chunk_size = 5
        for i in range(0, len(lines), chunk_size):
            block = " ".join(lines[i:i+chunk_size])
            record = self._extract_fields_from_text_block(block, None, fields, source_meta, doc_url)
            if record.get("company_name") or record.get("website"):
                records.append(record)
        return records

    def _extract_fields_from_text_block(
        self, text: str, element: Optional[BeautifulSoup], fields: list[str], source_meta: dict, doc_url: str
    ) -> dict[str, Any]:
        record = {}

        # 1. Specialized extractors for common fields
        url_match = re.search(r"https?://[^\s<>\"']+", text)
        if "website" in fields:
            if url_match:
                record["website"] = url_match.group(0).rstrip(".,;")
            elif element:
                a_tag = element.find("a", href=re.compile(r"^https?://"))
                record["website"] = a_tag["href"] if a_tag else None
            else:
                record["website"] = None

        if "linkedin_url" in fields:
            li_match = re.search(r"https?://(www\.)?linkedin\.com/(in|company)/[^\s<>\"']+", text)
            record["linkedin_url"] = li_match.group(0).rstrip(".,;") if li_match else None

        if "company_name" in fields:
            name_match = re.search(r"([A-Z][A-Za-z0-9\s&]{2,30})\s*(?:Inc|Ltd|Technologies|SaaS|Pvt|Private|Corp)?", text)
            record["company_name"] = name_match.group(0).strip() if name_match else None

        if "founder" in fields:
            founder_match = re.search(r"(?:founded by|founder:?|ceo:?)\s*([A-Z][a-z]+\s+[A-Z][a-z]+)", text, re.I)
            record["founder"] = founder_match.group(1).strip() if founder_match else None

        if "funding_stage" in fields:
            funding_match = re.search(r"\b(Seed|Series A|Series B|Series C|Pre-Seed|Bootstrapped|Grant|Acquired)\b", text, re.I)
            record["funding_stage"] = funding_match.group(1).title() if funding_match else None

        # 2. Generic key-value extractor for ANY requested field (job_title, salary, email, upvotes, etc.)
        for f in fields:
            if f not in record or record[f] is None:
                # Convert field_name like "job_title" -> "job title" or "job_title"
                label = f.replace("_", " ")
                pattern = re.compile(rf"(?:{re.escape(label)}|{re.escape(f)})\s*[:=\-]\s*([^\n;,.]+)", re.I)
                match = pattern.search(text)
                if match:
                    val = match.group(1).strip()
                    record[f] = val if val else None
                else:
                    record[f] = None

        record["_source"] = source_meta
        return record


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
        
        record["_source"] = source_meta
        return record

    def _map_header_to_field(self, header: str, fields: list[str]) -> Optional[str]:
        header = header.lower().replace(" ", "_")
        for f in fields:
            if f in header or header in f:
                return f
        if "name" in header or "company" in header:
            return "company_name" if "company_name" in fields else None
        if "url" in header or "site" in header or "domain" in header:
            return "website" if "website" in fields else None
        return None
