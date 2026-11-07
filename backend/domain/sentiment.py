import re

POSITIVE = ("tăng", "lãi", "vượt kế hoạch", "kỷ lục", "khởi sắc", "mở rộng", "phục hồi", "tích cực")
NEGATIVE = ("giảm", "lỗ", "suy giảm", "bị phạt", "điều tra", "nợ xấu", "khó khăn", "tiêu cực")


def score_sentiment(text: str) -> tuple[float, str]:
    normalized = re.sub(r"\s+", " ", text.lower())
    score = sum(normalized.count(word) for word in POSITIVE) - sum(normalized.count(word) for word in NEGATIVE)
    normalized_score = max(-1.0, min(1.0, score / 3))
    label = "positive" if normalized_score > 0.2 else "negative" if normalized_score < -0.2 else "neutral"
    return normalized_score, label
