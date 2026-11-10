"""Link news text to listed Vietnamese tickers.

Rule: "not sure -> no link". A ticker is linked only when
  (1) the exact upper-case ticker appears as a standalone token, or
  (2) the distinctive core of the company name appears as whole words.
The core name is the company name with legal-form and generic sector words
removed (e.g. "Công ty Cổ phần Tập đoàn Hòa Phát" -> "hoa phat"). A core
that is a common Vietnamese phrase ("tuong lai", "phat trien") or too short
is never used as evidence.
"""

import re

from domain.text import normalize_vi

GENERIC_TICKER_TOKENS = {
    "AI", "CEO", "CFO", "CTO", "COO", "GDP", "IPO", "USD", "EUR", "ETF",
    "FED", "FTSE", "PMI", "CPI", "FDI", "ODA", "VND", "M&A", "ESG", "EPS",
    "ROE", "ROA", "PMP", "PMW",
}

# Legal-form and generic words stripped from a company name before matching.
NAME_STOPWORDS = (
    "tong cong ty", "cong ty co phan", "cong ty tnhh", "cong ty", "co phan",
    "ctcp", "tap doan", "ngan hang tmcp", "ngan hang thuong mai co phan",
    "ngan hang", "tmcp", "dau tu", "xay dung", "phat trien", "thuong mai",
    "dich vu", "san xuat", "bat dong san", "duoc pham", "tai chinh",
    "chung khoan", "viet nam", "group", "corporation", "corp", "jsc",
    "joint stock company", "holdings", "company",
)

# Core names that are ordinary phrases and must never count as evidence.
COMMON_PHRASES = {
    "tuong lai", "phat trien", "dau tu", "xay dung", "thuong mai", "dich vu",
    "bat dong san", "duoc pham", "ngan hang", "tai chinh", "viet nam",
    "kinh doanh", "san xuat", "cong nghe", "nang luong", "thuc pham",
    "xuat nhap khau", "van tai", "dau khi", "dien luc", "nong nghiep",
    "hang khong", "bao hiem", "chung khoan", "the gioi", "quoc te",
    "sai gon", "ha noi", "mien nam", "mien bac", "thanh cong", "hung thinh",
    "an phat", "phu cuong", "tan phu", "hoa binh",
}
MIN_CORE_LEN = 6


def core_name(name: str | None) -> str:
    text = normalize_vi(name).replace(".", "")
    text = re.sub(r"[^a-z0-9 ]", " ", text)
    for word in sorted(NAME_STOPWORDS, key=len, reverse=True):
        text = re.sub(rf"(?<![a-z0-9]){re.escape(word)}(?![a-z0-9])", " ", text)
    return " ".join(text.split())


def _usable_core(core: str) -> bool:
    return len(core) >= MIN_CORE_LEN and core not in COMMON_PHRASES


def related_symbols(text: str, symbols: list[tuple[str, str | None]]) -> list[str]:
    found: list[str] = []
    normalized_text = " ".join(re.sub(r"[^a-z0-9 ]", " ", normalize_vi(text)).split())
    for code, name in symbols:
        upper = code.upper()
        if upper in GENERIC_TICKER_TOKENS:
            continue
        if re.search(rf"(?<![A-Za-z0-9]){re.escape(upper)}(?![A-Za-z0-9])", text):
            found.append(code)
            continue
        core = core_name(name)
        if _usable_core(core) and re.search(
            rf"(?<![a-z0-9]){re.escape(core)}(?![a-z0-9])", normalized_text
        ):
            found.append(code)
    return list(dict.fromkeys(found))
