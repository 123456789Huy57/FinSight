import uuid

from main import safe_request_id


def test_request_id_preserves_valid_client_value():
    assert safe_request_id("trace-123_abc.4") == "trace-123_abc.4"


def test_request_id_replaces_unsafe_or_long_client_value():
    for supplied in (None, "bad id", "x" * 129, "bad\tvalue"):
        result = safe_request_id(supplied)
        assert result != supplied
        uuid.UUID(result)
