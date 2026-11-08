from types import SimpleNamespace

import pytest

import worker


def test_vnstock_worker_requires_key_and_package(monkeypatch):
    monkeypatch.setattr(worker, "settings", SimpleNamespace(market_provider="vnstock", vnstock_api_key=None))
    with pytest.raises(RuntimeError, match="VNSTOCK_API_KEY is required"):
        worker.validate_provider_ready()

    monkeypatch.setattr(worker.settings, "vnstock_api_key", "test-key")
    monkeypatch.setattr(worker.importlib.util, "find_spec", lambda _: None)
    with pytest.raises(RuntimeError, match="package is missing"):
        worker.validate_provider_ready()


def test_csv_worker_does_not_require_vnstock(monkeypatch):
    monkeypatch.setattr(worker, "settings", SimpleNamespace(market_provider="csv", vnstock_api_key=None))
    worker.validate_provider_ready()
