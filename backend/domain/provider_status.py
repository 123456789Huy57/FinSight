"""Small, testable status mapping for persisted market-provider runs."""


def market_data_status(has_price_data: bool, latest_run_status: str | None) -> tuple[str, bool]:
    if not has_price_data:
        return "no_data", False
    if latest_run_status == "success":
        return "current", False
    return "stale", True
