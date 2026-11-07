import unicodedata


def normalize_vi(value: str | None) -> str:
    if not value:
        return ""
    decomposed = unicodedata.normalize("NFKD", value.casefold().replace("đ", "d"))
    plain = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(plain.split())
