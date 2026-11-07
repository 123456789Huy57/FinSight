from core.config import settings
from providers.base import MarketDataProvider


SOURCE_BY_PROVIDER = {"csv": "csv-demo", "vnstock": "vnstock"}


def get_configured_market_source_id() -> str:
    provider_name = settings.market_provider.lower()
    try:
        return SOURCE_BY_PROVIDER[provider_name]
    except KeyError as exc:
        raise ValueError("MARKET_PROVIDER must be 'vnstock' or 'csv'") from exc


def get_market_provider() -> MarketDataProvider:
    provider_name = settings.market_provider.lower()
    if provider_name == "csv":
        from providers.csv_seed_provider import CsvSeedProvider

        return CsvSeedProvider()
    if provider_name == "vnstock":
        from providers.vnstock_provider import VnstockProvider

        return VnstockProvider()
    raise ValueError("MARKET_PROVIDER must be 'vnstock' or 'csv'")
