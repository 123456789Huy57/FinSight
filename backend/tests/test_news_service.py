import services.news_service as news_service
from api.v1.news import _impact_profile, list_news
from core.config import settings
from jobs.ingest_news import _category, _related_symbols, ingest_news
import services.stock_service as stock_service


class FakeResponse:
    def __init__(self, content: bytes) -> None:
        self.content = content

    def raise_for_status(self) -> None:
        return None


def _reset_cache() -> None:
    news_service._FEED_CACHE = None
    news_service._FEED_CACHE_TS = None
    news_service._FEED_CACHE_KEY = None


def _run_immediate(coroutine):
    try:
        coroutine.send(None)
    except StopIteration as result:
        return result.value
    coroutine.close()
    raise AssertionError("expected the disabled path to return without I/O")


def test_official_feed_defaults_and_tracking_url_cleanup(monkeypatch) -> None:
    monkeypatch.delenv("FINSIGHT_NEWS_FEEDS", raising=False)
    assert news_service._parse_feed_urls() == [
        "https://vnexpress.net/rss/kinh-doanh.rss",
        "https://vneconomy.vn/chung-khoan.rss",
    ]
    assert news_service.canonicalize_url(
        "https://VnExpress.net/story/?id=42&utm_source=rss#comments"
    ) == "https://vnexpress.net/story?id=42"


def test_fetch_normalizes_dates_strips_markup_and_deduplicates(monkeypatch) -> None:
    _reset_cache()
    monkeypatch.setenv(
        "FINSIGHT_NEWS_FEEDS",
        "https://vnexpress.net/rss/kinh-doanh.rss,https://vneconomy.vn/chung-khoan.rss",
    )
    xml_one = """<rss><channel><title>VnExpress kinh doanh</title><item>
      <title>Hoa Phat cong bo ket qua</title>
      <link>https://example.test/story?utm_source=rss</link>
      <description><![CDATA[Doanh nghiệp <b>tăng trưởng</b><script>bad()</script>]]></description>
      <pubDate>Fri, 06 Nov 2026 10:00:00 +0700</pubDate>
    </item></channel></rss>""".encode("utf-8")
    xml_two = """<rss><channel><item>
      <title>Hoa Phat cong bo ket qua</title>
      <link>https://example.test/story</link>
      <description>Trung lap</description>
      <pubDate>Fri, 06 Nov 2026 03:00:00 +0000</pubDate>
    </item></channel></rss>""".encode("utf-8")
    responses = iter((FakeResponse(xml_one), FakeResponse(xml_two)))
    monkeypatch.setattr(news_service.requests, "get", lambda *args, **kwargs: next(responses))

    items = news_service.fetch_news_items(limit=10)

    assert len(items) == 1
    assert items[0]["source"] == "VnExpress"
    assert items[0]["url"] == "https://example.test/story"
    assert items[0]["published_at"] == "2026-11-06T03:00:00+00:00"
    assert "tăng trưởng" in items[0]["summary"]
    assert "bad" not in items[0]["summary"]
    _reset_cache()


def test_naive_timestamp_uses_vietnam_timezone() -> None:
    assert news_service.normalize_published_at("2026-11-06T10:00:00") == "2026-11-06T03:00:00+00:00"


def test_news_classification_and_ticker_linking_fold_accents() -> None:
    assert _category("Hòa Phát công bố kết quả kinh doanh") == "stock"
    assert _category("Lãi suất và lạm phát có diễn biến mới") == "economic"
    assert _related_symbols("Công bố kết quả tại Hòa Phát", [("HPG", "Công ty Cổ phần Tập đoàn Hòa Phát")]) == ["HPG"]


def test_related_symbols_ignores_common_non_stock_tokens():
    assert _related_symbols(
        "Định giá 2.000 tỷ USD, quỹ ETF theo dõi FTSE.",
        [("USD", "United States Dollar"), ("ETF", "Quỹ ETF"), ("FTSE", "FTSE Russell")],
    ) == []


def test_impact_profile_names_the_transmission_variable() -> None:
    article = type("Article", (), {
        "title": "Khung giá điện mặt trời cao nhất hơn 2.120 đồng một kWh",
        "summary": "Mức giá phát điện tối đa được áp dụng.",
        "category": "economic",
    })()
    profile = _impact_profile(article, [])
    assert profile["driver"] == "giá bán điện đầu ra"
    assert "doanh thu" in profile["mechanism"]
    assert "gắn theo từ khoá" in profile["caveat"]


def test_impact_profile_does_not_invent_a_vietnamese_ticker() -> None:
    article = type("Article", (), {
        "title": "Cổ phiếu Nvidia lao dốc sau bê bối ngoại tình",
        "summary": "Cổ phiếu Nvidia giảm hơn 6%.",
        "category": "stock",
    })()
    profile = _impact_profile(article, [])
    assert profile["affected"] == []
    assert "chưa thể suy ra" in profile["caveat"].lower()


def test_news_ingestion_and_api_are_disabled_without_rights_opt_in(monkeypatch) -> None:
    monkeypatch.setattr(settings, "news_feed_enabled", False)
    assert settings.news_feed_enabled is False
    ingest_result = _run_immediate(ingest_news())
    api_result = _run_immediate(list_news(q=None, category=None, sentiment=None, symbol=None, limit=50, offset=0))

    assert ingest_result == {"enabled": 0, "fetched": 0, "inserted": 0, "tickerLinks": 0}
    assert api_result["items"] == []
    assert api_result["status"] == "disabled"
    assert api_result["dataMode"] is None




def test_legacy_news_has_empty_state_when_all_feeds_fail(monkeypatch) -> None:
    stock_service._news_intelligence_cache.set(None)
    monkeypatch.setattr(stock_service, "get_market_commentary", lambda: {
        "top_gainers": [], "top_losers": [], "leading_sectors": [], "updated_at": "2026-11-06",
        "summary": "No market snapshot",
    })
    monkeypatch.setattr(stock_service, "fetch_news_items", lambda limit: [])

    result = stock_service.get_news_intelligence()

    assert result["items"] == []
    assert result["status"] == "no_data"
    assert result["data_mode"] == "external-feed"
