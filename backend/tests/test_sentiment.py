from domain.sentiment import score_sentiment


def test_vietnamese_sentiment_uses_explicit_baseline_keywords():
    assert score_sentiment("doanh nghiệp tăng lãi, vượt kế hoạch")[1] == "positive"
    assert score_sentiment("lỗ, nợ xấu, khó khăn")[1] == "negative"
    assert score_sentiment("thị trường hôm nay giao dịch bình thường")[1] == "neutral"
