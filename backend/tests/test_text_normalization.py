from domain.text import normalize_vi


def test_normalize_vi_matches_ascii_queries_and_normalizes_d():
    assert normalize_vi("Hòa Phát Group") == "hoa phat group"
    assert normalize_vi("Đặng Thị Đỏ") == "dang thi do"
    assert normalize_vi("  Ngân   hàng ") == "ngan hang"
