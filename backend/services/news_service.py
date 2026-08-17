from __future__ import annotations

import os
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

import requests

DEFAULT_NEWS_FEEDS = [
    "https://vnexpress.net/rss/kinh-doanh.rss",
    "https://vnexpress.net/rss/thi-truong.rss",
    "https://vneconomy.vn/rss.htm",
]

_FEED_CACHE: list[dict[str, Any]] | None = None
_FEED_CACHE_TS: datetime | None = None
_FEED_CACHE_TTL = 600  # 10 minutes


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


def _parse_feed_urls() -> list[str]:
    value = os.getenv("FINSIGHT_NEWS_FEEDS", "").strip()
    if not value:
        return DEFAULT_NEWS_FEEDS
    return [item.strip() for item in value.split(",") if item.strip()]


def _strip_html(text: str | None) -> str:
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", " ", text)
    clean = re.sub(r"\s+", " ", clean)
    return clean.strip()


def _safe_dt(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return parsedate_to_datetime(value).astimezone(timezone.utc).isoformat()
    except Exception:
        try:
            return datetime.fromisoformat(value).isoformat()
        except Exception:
            return None


def _feed_source_name(url: str) -> str:
    if "vnexpress.net" in url:
        return "VnExpress"
    if "vneconomy.vn" in url:
        return "VnEconomy"
    if "cafef.vn" in url:
        return "CafeF"
    if "vietstock.vn" in url:
        return "Vietstock"
    return url


def fetch_news_items(limit: int = 8) -> list[dict[str, Any]]:
    global _FEED_CACHE, _FEED_CACHE_TS
    now = datetime.now(timezone.utc)
    if (
        _FEED_CACHE is not None
        and _FEED_CACHE_TS is not None
        and (now - _FEED_CACHE_TS).total_seconds() < _FEED_CACHE_TTL
    ):
        return _FEED_CACHE[:limit]

    headers = {
        "User-Agent": "FinSight/1.0 (+https://example.com)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
    }
    items: list[dict[str, Any]] = []
    _MAX = 20  # always fetch up to 20 items across all feeds, cache all of them

    for feed_url in _parse_feed_urls():
        if len(items) >= _MAX:
            break
        try:
            response = requests.get(feed_url, headers=headers, timeout=15)
            response.raise_for_status()
            root = ET.fromstring(response.text)
        except Exception:
            continue

        channel_title = ""
        channel = root.find("channel")
        if channel is not None:
            title_node = channel.find("title")
            if title_node is not None and title_node.text:
                channel_title = title_node.text.strip()

        candidates = []
        if channel is not None:
            candidates = channel.findall("item")
        if not candidates:
            candidates = root.findall(".//item")

        for entry in candidates:
            title = (entry.findtext("title") or "").strip()
            if not title:
                continue
            link = (entry.findtext("link") or "").strip() or None
            description = _strip_html(entry.findtext("description"))
            pub_date = _safe_dt(entry.findtext("pubDate") or entry.findtext("{http://purl.org/dc/elements/1.1/}date"))
            source = channel_title or _feed_source_name(feed_url)

            items.append(
                {
                    "id": f"{len(items) + 1}",
                    "headline": title,
                    "source": source,
                    "time": "Now" if not pub_date else pub_date,
                    "summary": description,
                    "url": link,
                    "published_at": pub_date,
                }
            )
            if len(items) >= _MAX:
                break

    _FEED_CACHE = items
    _FEED_CACHE_TS = now
    return items[:limit]
