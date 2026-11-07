from __future__ import annotations

import hashlib
import logging
import os
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from typing import Any
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from zoneinfo import ZoneInfo

import requests

from domain.text import normalize_vi

DEFAULT_NEWS_FEEDS = (
    "https://vnexpress.net/rss/kinh-doanh.rss",
    "https://vneconomy.vn/chung-khoan.rss",
)
MAX_FEED_ITEMS = 100
FEED_CACHE_TTL_SECONDS = 600
VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
logger = logging.getLogger(__name__)

_FEED_CACHE: list[dict[str, Any]] | None = None
_FEED_CACHE_TS: datetime | None = None
_FEED_CACHE_KEY: tuple[str, ...] | None = None


@dataclass
class NewsItem:
    id: str
    headline: str
    source: str
    time: str
    insight: str
    marketImpact: str
    affectedTickers: list[str]
    url: str | None = None
    published_at: str | None = None


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in {"script", "style"}:
            self._ignored_depth += 1
        elif tag.lower() in {"br", "p", "div", "li"}:
            self.parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"script", "style"} and self._ignored_depth:
            self._ignored_depth -= 1
        elif tag.lower() in {"p", "div", "li"}:
            self.parts.append(" ")

    def handle_data(self, data: str) -> None:
        if not self._ignored_depth:
            self.parts.append(data)


def _parse_feed_urls() -> list[str]:
    value = os.getenv("FINSIGHT_NEWS_FEEDS", "").strip()
    if not value:
        return list(DEFAULT_NEWS_FEEDS)
    return [item.strip() for item in value.split(",") if item.strip()]


def _strip_html(text: str | None) -> str:
    if not text:
        return ""
    parser = _TextExtractor()
    try:
        parser.feed(text)
        parser.close()
        clean = " ".join(parser.parts)
    except Exception:
        clean = re.sub(r"<[^>]*>", " ", text)
    return " ".join(clean.split()).strip()


def normalize_published_at(value: str | None) -> str | None:
    if not value:
        return None
    parsed: datetime | None = None
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, OverflowError):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (TypeError, ValueError, OverflowError):
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=VN_TZ)
    return parsed.astimezone(timezone.utc).isoformat()


def canonicalize_url(value: str | None, feed_url: str | None = None) -> str | None:
    if not value:
        return None
    parts = urlsplit(urljoin(feed_url or "", value.strip()))
    if parts.scheme.lower() not in {"http", "https"} or not parts.netloc:
        return None
    tracking_keys = {"fbclid", "gclid", "mc_cid", "mc_eid"}
    query = [
        (key, val)
        for key, val in parse_qsl(parts.query, keep_blank_values=True)
        if not key.lower().startswith("utm_") and key.lower() not in tracking_keys
    ]
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, urlencode(sorted(query)), ""))


def story_hash(title: str, published_at: str | None) -> str:
    normalized_title = normalize_vi(title)
    day = published_at[:10] if published_at else ""
    return hashlib.sha256(f"{normalized_title}|{day}".encode("utf-8")).hexdigest()


def _feed_source_name(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower()
    if host.endswith("vnexpress.net"):
        return "VnExpress"
    if host.endswith("vneconomy.vn"):
        return "VnEconomy"
    if host.endswith("cafef.vn"):
        return "CafeF"
    if host.endswith("vietstock.vn"):
        return "Vietstock"
    return host or url


def _local_name(element: ET.Element) -> str:
    return element.tag.rsplit("}", 1)[-1]


def _child_text(element: ET.Element, name: str) -> str:
    for child in element:
        if _local_name(child) == name:
            return "".join(child.itertext()).strip()
    return ""


def _entries(root: ET.Element) -> tuple[str, list[ET.Element]]:
    for child in root:
        if _local_name(child) == "channel":
            channel_title = _child_text(child, "title")
            return channel_title, [entry for entry in child if _local_name(entry) == "item"]
    if _local_name(root) == "feed":
        entries = [entry for entry in root if _local_name(entry) == "entry"]
        return _child_text(root, "title"), entries
    return "", [entry for entry in root.iter() if _local_name(entry) == "item"]


def _entry_link(entry: ET.Element) -> str | None:
    for child in entry:
        if _local_name(child) != "link":
            continue
        link = (child.attrib.get("href") or "").strip() or "".join(child.itertext()).strip()
        if link:
            return link
    return None


def _entry_published_at(entry: ET.Element) -> str | None:
    for name in ("pubDate", "published", "updated", "date"):
        value = _child_text(entry, name)
        if value:
            return normalize_published_at(value)
    return None


def _sort_timestamp(value: str | None) -> datetime:
    if not value:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(value)
        return parsed.astimezone(timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=VN_TZ).astimezone(timezone.utc)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def fetch_news_items(limit: int = 8) -> list[dict[str, Any]]:
    global _FEED_CACHE, _FEED_CACHE_TS, _FEED_CACHE_KEY
    now = datetime.now(timezone.utc)
    feed_urls = tuple(_parse_feed_urls())
    if (
        _FEED_CACHE is not None
        and _FEED_CACHE_TS is not None
        and _FEED_CACHE_KEY == feed_urls
        and (now - _FEED_CACHE_TS).total_seconds() < FEED_CACHE_TTL_SECONDS
    ):
        return _FEED_CACHE[:max(0, limit)]

    headers = {
        "User-Agent": "FinSight/1.0 RSS reader",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    }
    items: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    seen_stories: set[str] = set()

    for feed_url in feed_urls:
        if len(items) >= MAX_FEED_ITEMS:
            break
        try:
            response = requests.get(feed_url, headers=headers, timeout=15)
            response.raise_for_status()
            root = ET.fromstring(response.content)
        except Exception as exc:
            logger.warning("RSS feed fetch failed (%s): %s", _feed_source_name(feed_url), exc)
            continue

        _, candidates = _entries(root)
        source = _feed_source_name(feed_url)
        for entry in candidates:
            title = _strip_html(_child_text(entry, "title"))
            if not title:
                continue
            published_at = _entry_published_at(entry)
            url = canonicalize_url(_entry_link(entry), feed_url)
            content_hash = story_hash(title, published_at)
            if (url and url in seen_urls) or content_hash in seen_stories:
                continue
            if url:
                seen_urls.add(url)
            seen_stories.add(content_hash)
            description = _strip_html(_child_text(entry, "description") or _child_text(entry, "summary"))
            items.append({
                "id": content_hash[:16],
                "headline": title,
                "source": source,
                "time": published_at or "",
                "summary": description,
                "url": url,
                "published_at": published_at,
            })
            if len(items) >= MAX_FEED_ITEMS:
                break

    items.sort(key=lambda item: _sort_timestamp(item.get("published_at")), reverse=True)
    _FEED_CACHE = items
    _FEED_CACHE_TS = now
    _FEED_CACHE_KEY = feed_urls
    return items[:max(0, limit)]
