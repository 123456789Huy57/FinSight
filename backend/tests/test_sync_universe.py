from datetime import date

from jobs.sync_universe import choose_due_symbols, quota_has_headroom


def test_universe_sync_resumes_missing_and_stale_symbols_without_retrying_same_target():
    target = date(2026, 11, 6)
    rows = [
        ("FPT", target, None),
        ("AAA", None, None),
        ("BBB", None, target),
        ("CCC", date(2026, 11, 4), None),
        ("DDD", date(2026, 11, 5), target),
    ]

    assert choose_due_symbols(rows, target, batch_size=2) == [
        ("AAA", None), ("CCC", date(2026, 11, 4)),
    ]
    assert choose_due_symbols(rows, date(2026, 11, 7), batch_size=5) == [
        ("AAA", None), ("BBB", None), ("CCC", date(2026, 11, 4)),
        ("DDD", date(2026, 11, 5)), ("FPT", target),
    ]


def test_quota_guard_reserves_capacity_for_other_vnstock_use():
    usage = {"limits": {"per_minute": 60, "per_hour": 3600, "per_day": 10000, "per_month": 100000},
             "used": {"minute": 10, "hour": 300, "day": 400, "month": 700}}
    assert quota_has_headroom(usage)
    usage["used"]["day"] = 8000
    assert not quota_has_headroom(usage)
    assert not quota_has_headroom({"limits": {}, "used": {}})
