from domain.ticker_linking import core_name, related_symbols

UNIVERSE = [
    ("CEO", "Công ty Cổ phần Tập đoàn C.E.O"),
    ("LAI", "Công ty Cổ phần Đầu tư Tương Lai"),
    ("TRA", "Công ty Cổ phần Traphaco"),
    ("HPG", "Công ty Cổ phần Tập đoàn Hòa Phát"),
    ("XDG", "Công ty Cổ phần Xây dựng"),
    ("VCB", "Ngân hàng TMCP Ngoại thương Việt Nam"),
]


def test_nvidia_headline_links_nothing() -> None:
    text = "Vụ bê bối của CEO Jensen Huang đặt tương lai Nvidia vào thế khó"
    assert related_symbols(text, UNIVERSE) == []


def test_common_phrase_core_name_is_not_evidence() -> None:
    assert related_symbols("Tương lai thị trường còn bất định", UNIVERSE) == []


def test_sector_words_do_not_create_links() -> None:
    text = "Ngành xây dựng, dược phẩm và bất động sản phục hồi"
    assert related_symbols(text, UNIVERSE) == []


def test_company_name_links_ticker() -> None:
    assert related_symbols("Hòa Phát công bố kết quả kinh doanh", UNIVERSE) == ["HPG"]


def test_standalone_uppercase_ticker_links() -> None:
    found = related_symbols("Cổ phiếu VCB tăng 2%; TRA đi ngang", UNIVERSE)
    assert sorted(found) == ["TRA", "VCB"]


def test_ticker_inside_word_or_lowercase_is_ignored() -> None:
    assert related_symbols("HPGX và hpg không phải mã", UNIVERSE) == []


def test_core_name_strips_legal_form() -> None:
    assert core_name("Công ty Cổ phần Tập đoàn Hòa Phát") == "hoa phat"
    assert core_name("Ngân hàng TMCP Ngoại thương Việt Nam") == "ngoai thuong"
