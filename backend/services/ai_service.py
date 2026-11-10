from __future__ import annotations

import json
import os
import asyncio
from typing import Any, Dict

import pandas as pd
import requests
import re

from sqlalchemy import select

from db.models import MarketSnapshot, PriceBar
from db.session import AsyncSessionLocal
from providers.factory import get_configured_market_source_id
from services.stock_service import SECTOR_MAP

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


async def _load_price_bars(symbol: str, limit: int = 252) -> list[PriceBar]:
    source = get_configured_market_source_id()
    async with AsyncSessionLocal() as session:
        return list((await session.scalars(
            select(PriceBar).where(PriceBar.symbol == symbol.upper(), PriceBar.source == source)
            .order_by(PriceBar.trade_date.desc()).limit(limit)
        )).all())


def _read_history(symbol: str) -> pd.DataFrame:
    bars = asyncio.run(_load_price_bars(symbol))
    bars.reverse()
    return pd.DataFrame({"close": [float(bar.close) for bar in bars]})


async def _load_quote(symbol: str) -> dict[str, Any] | None:
    source = get_configured_market_source_id()
    async with AsyncSessionLocal() as session:
        snapshot = await session.scalar(
            select(MarketSnapshot).where(MarketSnapshot.payload["source"].as_string() == source)
            .order_by(MarketSnapshot.as_of.desc()).limit(1)
        )
        if snapshot is not None:
            item = next((row for row in snapshot.payload.get("items", [])
                         if str(row.get("symbol", "")).upper() == symbol.upper()), None)
            if item is not None and item.get("price") is not None:
                return {
                    "current_price": item["price"], "price_change": item.get("change"),
                    "percent_change": item.get("percentChange"), "volume": item.get("volume"),
                }
        bars = list((await session.scalars(
            select(PriceBar).where(PriceBar.symbol == symbol.upper(), PriceBar.source == source)
            .order_by(PriceBar.trade_date.desc()).limit(2)
        )).all())
    if not bars:
        return None
    latest = bars[0]
    previous = bars[1] if len(bars) > 1 else None
    change = float(latest.close - previous.close) if previous else None
    return {
        "current_price": float(latest.close), "price_change": change,
        "percent_change": change / float(previous.close) * 100 if change is not None and previous.close else None,
        "volume": latest.volume,
    }


def _read_quote(symbol: str) -> dict[str, Any] | None:
    return asyncio.run(_load_quote(symbol))


async def _technical_snapshot_async(symbol: str) -> Dict[str, Any] | None:
    try:
        bars = await _load_price_bars(symbol)
        bars.reverse()
        history = pd.DataFrame({"close": [float(bar.close) for bar in bars]})
        if history.empty:
            return None

        close_raw = pd.to_numeric(history["close"], errors="coerce").dropna()
        if len(close_raw) < 10:
            return None

        ma20 = close_raw.rolling(20).mean().iloc[-1] if len(close_raw) >= 20 else close_raw.mean()
        ma50 = close_raw.rolling(50).mean().iloc[-1] if len(close_raw) >= 50 else close_raw.mean()
        delta = close_raw.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / loss.replace(0, pd.NA)
        last_rs = rs.iloc[-1]
        rsi = 100 - (100 / (1 + last_rs)) if pd.notna(last_rs) else None

        last = float(close_raw.iloc[-1])
        prev = float(close_raw.iloc[-2]) if len(close_raw) >= 2 else last
        ret_5d = ((last / float(close_raw.iloc[-6])) - 1) * 100 if len(close_raw) >= 6 else None
        ret_20d = ((last / float(close_raw.iloc[-21])) - 1) * 100 if len(close_raw) >= 21 else None
        trend = "uptrend" if last > ma20 > ma50 else "downtrend" if last < ma20 < ma50 else "sideways"
        return {
            "last_price": round(last, 0),
            "daily_change_pct": round(((last / prev) - 1) * 100, 2) if prev else None,
            "ma20": round(float(ma20), 0) if pd.notna(ma20) else None,
            "ma50": round(float(ma50), 0) if pd.notna(ma50) else None,
            "rsi14": round(float(rsi), 2) if rsi is not None and pd.notna(rsi) else None,
            "ret_5d_pct": round(float(ret_5d), 2) if ret_5d is not None else None,
            "ret_20d_pct": round(float(ret_20d), 2) if ret_20d is not None else None,
            "trend": trend,
        }
    except Exception:
        return None


async def _merge_analysis_context_async(payload: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(payload)
    symbol = str(merged.get("symbol") or "").upper().strip()
    if symbol:
        merged["technical_snapshot"] = await _technical_snapshot_async(symbol)
        merged["sector"] = SECTOR_MAP.get(symbol)
    return merged


def _technical_snapshot(symbol: str) -> Dict[str, Any] | None:
    try:
        history = _read_history(symbol)
        if not isinstance(history, pd.DataFrame) or history.empty:
            return None

        price_col = next((c for c in ["close", "Close", "close_price", "price"] if c in history.columns), None)
        if not price_col:
            return None

        close_raw = pd.to_numeric(history[price_col], errors="coerce").dropna()
        if len(close_raw) < 10:
            return None

        close = close_raw  # keep unscaled for ratio calculations (RSI, returns)

        ma20 = close.rolling(20).mean().iloc[-1] if len(close) >= 20 else close.mean()
        ma50 = close.rolling(50).mean().iloc[-1] if len(close) >= 50 else close.mean()

        delta = close.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / loss.replace(0, pd.NA)
        last_rs = rs.iloc[-1]
        rsi = 100 - (100 / (1 + last_rs)) if pd.notna(last_rs) else None

        last = float(close.iloc[-1])
        prev = float(close.iloc[-2]) if len(close) >= 2 else last
        ret_5d = ((last / float(close.iloc[-6])) - 1) * 100 if len(close) >= 6 else None
        ret_20d = ((last / float(close.iloc[-21])) - 1) * 100 if len(close) >= 21 else None

        trend = "uptrend" if last > ma20 > ma50 else "downtrend" if last < ma20 < ma50 else "sideways"
        return {
            "last_price": round(last, 0),
            "daily_change_pct": round(((last / prev) - 1) * 100, 2) if prev else None,
            "ma20": round(float(ma20), 0) if pd.notna(ma20) else None,
            "ma50": round(float(ma50), 0) if pd.notna(ma50) else None,
            "rsi14": round(float(rsi), 2) if rsi is not None and pd.notna(rsi) else None,
            "ret_5d_pct": round(float(ret_5d), 2) if ret_5d is not None else None,
            "ret_20d_pct": round(float(ret_20d), 2) if ret_20d is not None else None,
            "trend": trend,
        }
    except Exception:
        return None


def _merge_analysis_context(payload: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(payload)
    symbol = str(merged.get("symbol") or "").upper().strip()
    if symbol:
        merged["technical_snapshot"] = _technical_snapshot(symbol)
        merged["sector"] = SECTOR_MAP.get(symbol)
    return merged


_TREND_VI = {"uptrend": "xu hướng tăng", "downtrend": "xu hướng giảm", "sideways": "đi ngang"}


def _stock_fallback(symbol: str, context: str = "", technical: Dict[str, Any] | None = None, sector: str | None = None) -> Dict[str, Any]:
    technical = technical or {}
    trend_en = technical.get("trend") or "sideways"
    trend = _TREND_VI.get(trend_en, trend_en)
    rsi = technical.get("rsi14")
    ma20 = technical.get("ma20")
    ma50 = technical.get("ma50")
    rsi_str = str(round(rsi, 1)) if rsi is not None else "N/A"
    ma20_str = str(round(ma20)) if ma20 is not None else "N/A"
    ma50_str = str(round(ma50)) if ma50 is not None else "N/A"

    return {
        "summary": (
            f"{symbol} đang trong {trend}. "
            f"Kỹ thuật: RSI14={rsi_str}, MA20={ma20_str}, MA50={ma50_str}. "
            f"{f'Ngành: {sector}. ' if sector else ''}"
            f"{context}".strip()
        ),
        "technical_snapshot": {
            "trend": trend_en,
            "rsi14": rsi,
            "ma20": ma20,
            "ma50": ma50,
            "last_price": technical.get("last_price"),
            "daily_change_pct": technical.get("daily_change_pct"),
            "ret_5d_pct": technical.get("ret_5d_pct"),
            "ret_20d_pct": technical.get("ret_20d_pct"),
        },
        "fundamental_snapshot": {
            "sector": sector or "N/A",
        },
        "key_drivers": [
            f"Diễn biến giá và đà tăng/giảm của {symbol}",
            f"Xu hướng kỹ thuật: {trend}, RSI14={rsi_str}",
            f"Bối cảnh ngành: {sector}" if sector else "Dòng tiền ngành và kỳ vọng lợi nhuận",
        ],
        "bullish_factors": [
            "Lực cầu bắt đáy xác nhận vùng hỗ trợ",
            "Giá duy trì trên đường MA — xu hướng còn nguyên",
            "Dòng tiền ngành và tâm lý vĩ mô vẫn hỗ trợ",
        ],
        "risk_factors": [
            "Xu hướng có thể đảo chiều nếu giá mất cấu trúc MA",
            "Rủi ro toàn thị trường có thể lấn át yếu tố riêng cổ phiếu",
            "Khối lượng giảm dần làm suy yếu độ tin cậy của nhịp tăng",
        ],
        "watch_next": [
            "Giá có giữ được trên MA20/MA50 không",
            "Lợi nhuận/tin tức có tiếp tục hỗ trợ câu chuyện không",
            "Khối lượng 2–3 phiên tới xác nhận hay bác bỏ xu hướng",
        ],
    }


def _mock_explanation(payload: Dict[str, Any]) -> Dict[str, Any]:
    title = payload.get("title") or "this item"
    item_type = payload.get("type") or "market"
    context = payload.get("context") or ""
    symbol = str(payload.get("symbol") or "").upper()
    technical = payload.get("technical_snapshot") or {}
    sector = payload.get("sector") or ""

    stock_templates = {
        "VCB": "VCB là cổ phiếu dẫn dắt nhóm ngân hàng — diễn biến của VCB phản ánh tâm lý với toàn bộ nhóm tài chính và hướng đi của VNINDEX.",
        "BID": "BID phản ánh tâm lý ngành ngân hàng và khẩu vị với cổ phiếu vốn hóa lớn của khối ngoại.",
        "CTG": "CTG thường đồng hành với chủ đề risk-on ngân hàng và là tín hiệu đọc đà tài chính rộng.",
        "TCB": "TCB được theo dõi như một ngân hàng nhạy cảm với tăng trưởng — dẫn đầu khi nhà đầu tư ưa thích cổ phiếu tín dụng và thanh khoản.",
        "FPT": "FPT là đại diện cho công nghệ, xuất khẩu phần mềm và chất lượng lợi nhuận dài hạn.",
        "MWG": "MWG gắn liền với tiêu dùng bán lẻ, sức cầu nội địa và kỳ vọng phục hồi biên lợi nhuận.",
        "HPG": "HPG nhạy cảm với nhu cầu thép, chi tiêu hạ tầng và dòng quay vòng vào nhóm chu kỳ.",
        "SSI": "SSI thường được dùng để đọc khẩu vị với chứng khoán và mức độ chấp nhận rủi ro của thị trường.",
        "VHM": "VHM phản ánh tâm lý bất động sản và cách thị trường định giá rủi ro địa ốc.",
    }

    if item_type == "index":
        summary = (
            f"{title} đang được dẫn dắt bởi bluechip, độ rộng thị trường và dòng tiền vào nhóm thanh khoản cao. "
            "Kỹ thuật cần đọc cùng khối lượng và xác nhận từ ngành, không chỉ nhìn vào điểm số tuyệt đối."
        )
    elif item_type == "sector":
        summary = f"{title} đang phản ứng với dòng tiền ngành, kỳ vọng lợi nhuận, định giá và tâm lý vĩ mô."
    elif item_type == "stock":
        if symbol in stock_templates:
            summary = stock_templates[symbol]
        else:
            return _stock_fallback(symbol or title, context=context, technical=technical, sector=sector)
    elif item_type == "news":
        summary = f"{title} đang tác động ở cấp độ ngành — cần theo dõi phản ứng dòng tiền, không chỉ tiêu đề tin tức."
    elif item_type == "breadth":
        summary = "Độ rộng đang hỗ trợ đợt tăng — nhịp phục hồi có nền tảng rộng hơn so với nhịp tăng hẹp một vài cổ phiếu."
    elif item_type == "sentiment":
        summary = "Tâm lý risk-on, nhà đầu tư ưa thích nhóm chu kỳ và nhạy cảm với tăng trưởng."
    else:
        summary = f"{title} có bối cảnh thị trường rõ ràng và có thể theo dõi qua giá, khối lượng, hành vi ngành và tin tức."

    return {
        "summary": f"{summary} {context}".strip(),
        "technical_snapshot": technical or None,
        "fundamental_snapshot": {
            "sector": sector or "N/A",
        },
        "key_drivers": [
            "Hành động giá và sức mạnh tương đối",
            "Xác nhận khối lượng và độ rộng thị trường",
            f"Bối cảnh: {context}" if context else (stock_templates.get(symbol) or "Vị thế ngành và định vị vĩ mô"),
        ],
        "bullish_factors": [
            "Thanh khoản hỗ trợ và dòng tiền quay vào nhóm dẫn dắt",
            "Độ rộng tích cực từ số lượng mã tăng",
            "Đà tăng tiếp diễn nếu khối lượng giữ vững",
        ],
        "risk_factors": [
            "Rủi ro đảo chiều nếu độ rộng thu hẹp",
            "Tin tức vĩ mô hoặc chính sách có thể thay đổi tâm lý nhanh",
            "Khối lượng fade cuối phiên làm yếu đi đợt tăng",
        ],
        "watch_next": [
            "Đợt tăng có mở rộng ra ngoài vài cổ phiếu dẫn dắt không",
            "Ngành chủ chốt có xác nhận xu hướng không",
            "Giá đóng cửa so với mức cao/thấp trong phiên như thế nào",
        ],
    }


def _mock_chat(question: str, context: Dict[str, Any] | None = None) -> str:
    q = question.lower()
    ctx = context or {}
    symbol = str((ctx.get("data") or {}).get("symbol") or ctx.get("title") or "").upper()

    if "vnindex" in q or "thị trường" in q or "market" in q:
        return (
            "VNINDEX đang được dẫn dắt bởi bluechip, độ rộng cải thiện và dòng tiền xoay vòng ngành. "
            "Nếu nhóm ngân hàng và công nghệ tiếp tục đóng cửa gần đỉnh phiên, đợt tăng đáng tin hơn. "
            "Nếu độ rộng thu hẹp, chỉ số có thể vẫn xanh nhưng đà tăng thực sự đã suy yếu."
        )
    if "tin tức" in q or "news" in q:
        return (
            "Tin tức chỉ quan trọng khi nó thay đổi dòng tiền. Kỳ vọng lãi suất hỗ trợ ngân hàng, lợi nhuận hỗ trợ công nghệ, "
            "tin vĩ mô quan trọng nhất khi ảnh hưởng đến thanh khoản hoặc tâm lý. "
            "Câu hỏi cốt lõi luôn là: ngành nào hấp thụ tin tức đầu tiên?"
        )
    if "ngân hàng" in q or "bank" in q or "vcb" in q or "bid" in q:
        return (
            f"Nhóm ngân hàng mạnh vì nhà đầu tư đang định giá bối cảnh vĩ mô hỗ trợ và vai trò dẫn dắt tương đối. "
            f"Theo dõi xem {symbol or 'VCB, BID'} có tiếp tục vượt trội hơn chỉ số không. "
            f"Nếu khối lượng tăng trong khi độ rộng vẫn tích cực, đó là tín hiệu khoẻ hơn."
        )
    if "fpt" in q or "công nghệ" in q or "technology" in q:
        return (
            "Nhóm công nghệ thường được đọc qua chất lượng lợi nhuận, tăng trưởng xuất khẩu phần mềm và nhu cầu cấu trúc dài hạn. "
            "Điểm mấu chốt là liệu hành động giá có xác nhận câu chuyện cơ bản hay đã bắt đầu phân kỳ."
        )
    return (
        "Diễn biến hiện tại được hỗ trợ bởi độ rộng, dòng tiền xoay vòng ngành, cổ phiếu dẫn dắt và tin tức trong phiên. "
        "Hỏi tôi về bất kỳ chỉ số, ngành, cổ phiếu hay tin tức nào — tôi có thể phân tích tại sao nó quan trọng, "
        "điều gì đang thúc đẩy và cần theo dõi gì tiếp theo."
    )


def _quick_price_response(question: str, context: Dict[str, Any] | None = None) -> str | None:
    """Detect simple Vietnamese price questions (e.g. "mua SSI giá 30") and return a concise, targeted answer without calling the model."""
    q = (question or "").lower()
    ctx = context or {}
    # Prefer explicit symbol from context
    symbol = str((ctx.get("data") or {}).get("symbol") or ctx.get("symbol") or ctx.get("title") or "").upper()

    # Find numeric price in the question
    m_num = re.search(r"(\d{1,4}(?:[\.,]\d{1,2})?)\s*(k|k|nghìn|nghin)?\b", q)
    # Find symbol token if not in context: letters 2-5 chars (e.g., ssi, vcb)
    if not symbol:
        m_sym = re.search(r"\b([a-zA-Z]{2,5})\b", q)
        if m_sym:
            symbol = m_sym.group(1).upper()

    if not m_num or not symbol:
        return None

    price_raw = float(m_num.group(1).replace(',', '.'))
    suffix = (m_num.group(2) or '').lower()
    # Interpret price: if suffix indicates 'k' or number looks like small int, treat as thousands
    if suffix in ("k", "nghìn", "nghin") or price_raw < 1000:
        price_vnd = int(price_raw * 1000)
        price_display = f"{int(price_raw)}k"
    else:
        price_vnd = int(price_raw)
        price_display = f"{price_vnd:,} VND"

    tech = _technical_snapshot(symbol)
    last = tech.get("last_price") if tech else None
    ma20 = tech.get("ma20") if tech else None
    rsi = tech.get("rsi14") if tech else None
    sector = SECTOR_MAP.get(symbol)

    # Build concise, direct answer
    if last:
        if price_vnd < last:
            direct = f"Nếu mua {symbol} ở {price_display}: mức này thấp hơn giá hiện tại ({int(last):,} VND). Có thể là vùng hấp dẫn nếu bạn chấp nhận rủi ro ngắn hạn."
        elif price_vnd > last:
            direct = f"Nếu mua {symbol} ở {price_display}: mức này cao hơn giá hiện tại ({int(last):,} VND), cân nhắc điểm mua rõ ràng hoặc chờ điều chỉnh."
        else:
            direct = f"Nếu mua {symbol} ở {price_display}: gần bằng giá hiện tại ({int(last):,} VND). Xem thêm TA/FA để quyết định."
    else:
        direct = f"Nếu mua {symbol} ở {price_display}: cần giá hiện tại để so sánh; hãy kiểm tra MA20/RSI và báo cáo lợi nhuận gần nhất."

    ta = f"TA: xu hướng {tech.get('trend') if tech else 'không rõ'}, MA20={ma20 if ma20 else 'N/A'}, RSI14={rsi if rsi else 'N/A'}."
    fa = f"FA: kiểm tra báo cáo lợi nhuận và vị thế ngành ({sector or 'N/A'})."
    watch = "Theo dõi: khối lượng xác nhận, đóng cửa so với MA20, và tin ngành." 

    return f"{direct} {ta} {fa} {watch}"


def _call_gemini(messages: list[dict[str, str]]) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    system = next((message["content"] for message in messages if message["role"] == "system"), None)
    contents = [
        {"role": "model" if message["role"] == "assistant" else "user",
         "parts": [{"text": message["content"]}]}
        for message in messages if message["role"] != "system"
    ]
    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 700,
        },
    }
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}
    response = requests.post(
        GEMINI_URL.format(model=model),
        params={"key": api_key},
        headers={"Content-Type": "application/json"},
        data=json.dumps(payload),
        timeout=20,
    )
    response.raise_for_status()
    data = response.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


def _call_openrouter(messages: list[dict[str, str]]) -> str:
    if os.getenv("GEMINI_API_KEY"):
        return _call_gemini(messages)
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    model = os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash")
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    if referrer := os.getenv("OPENROUTER_SITE_URL"):
        headers["HTTP-Referer"] = referrer
    if title := os.getenv("OPENROUTER_SITE_NAME"):
        headers["X-Title"] = title

    payload = {"model": model, "messages": messages, "temperature": 0.3}
    response = requests.post(OPENROUTER_URL, headers=headers, data=json.dumps(payload), timeout=45)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


def _parse_json_response(content: str) -> Dict[str, Any]:
    """Extract a JSON object from a model response that may include
    markdown code fences or surrounding prose."""
    content = (content or "").strip()
    if content.startswith("```"):
        # ```json ... ``` or ``` ... ```
        inner = content.split("```")
        if len(inner) >= 2:
            content = inner[1]
        if content.lstrip().lower().startswith("json"):
            content = content.lstrip()[4:]
        content = content.strip()
    try:
        parsed = json.loads(content)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        # Last resort: grab the outermost {...} block
        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end > start:
            try:
                parsed = json.loads(content[start : end + 1])
                return parsed if isinstance(parsed, dict) else {}
            except Exception:
                return {}
        return {}


def explain(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = _merge_analysis_context(payload)
    system = (
        "Bạn là FinSight AI — chuyên gia phân tích tài chính thị trường chứng khoán Việt Nam. "
        "Nhiệm vụ: giải thích ngắn gọn, rõ ràng, chuyên sâu bằng tiếng Việt cho nhà đầu tư cá nhân. "
        "Phân tích PHẢI bao gồm cả Phân tích kỹ thuật (TA): xu hướng giá, khối lượng, MA, RSI, momentum "
        "VÀ Phân tích cơ bản (FA): lợi nhuận, tăng trưởng doanh nghiệp, vĩ mô, ngành liên quan. "
        "KHÔNG đưa khuyến nghị mua/bán/nắm giữ. "
        "Trả lời ĐÚNG định dạng JSON thuần (không markdown, không giải thích thêm), với các trường sau:\n"
        '{\n'
        '  "summary": "1-2 câu tóm tắt lý do biến động",\n'
        '  "key_drivers": ["lý do 1", "lý do 2", "lý do 3"],\n'
        '  "bullish_factors": ["điểm tích cực 1", "điểm tích cực 2", "điểm tích cực 3"],\n'
        '  "risk_factors": ["rủi ro 1", "rủi ro 2", "rủi ro 3"],\n'
        '  "watch_next": ["cần theo dõi 1", "cần theo dõi 2", "cần theo dõi 3"]\n'
        '}\n'
        "Mỗi mảng PHẢI có đúng 3 phần tử. Mỗi phần tử là 1 câu ngắn, cụ thể, có số liệu nếu có trong ngữ cảnh."
    )

    try:
        content = _call_openrouter(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
            ]
        )
        parsed = _parse_json_response(content)
        if parsed and "summary" in parsed:
            return parsed
        return _mock_explanation(payload)
    except Exception:
        return _mock_explanation(payload)


async def explain_async(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = await _merge_analysis_context_async(payload)
    system = (
        "Bạn là FinSight AI — chuyên gia phân tích tài chính thị trường chứng khoán Việt Nam. "
        "Nhiệm vụ: giải thích ngắn gọn, rõ ràng, chuyên sâu bằng tiếng Việt cho nhà đầu tư cá nhân. "
        "Phân tích PHẢI bao gồm cả Phân tích kỹ thuật (TA) và Phân tích cơ bản (FA). "
        "KHÔNG đưa khuyến nghị mua/bán/nắm giữ. Trả lời ĐÚNG định dạng JSON thuần."
    )
    try:
        content = await asyncio.to_thread(
            _call_openrouter,
            [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
            ],
        )
        parsed = _parse_json_response(content)
        return parsed if parsed and "summary" in parsed else _mock_explanation(payload)
    except Exception:
        return _mock_explanation(payload)


def generate_market_commentary(market_data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate AI-powered market commentary from real market data."""
    system = (
        "Bạn là FinSight AI — chuyên gia phân tích vĩ mô thị trường chứng khoán Việt Nam. "
        "Dựa vào dữ liệu thị trường được cung cấp, viết nhận định ngắn, trọng tâm bằng tiếng Việt. "
        "KHÔNG đưa khuyến nghị mua/bán. Tập trung vào: diễn biến chỉ số, dòng tiền, ngành dẫn dắt, rủi ro, và số liệu chính. "
        "Trả lời JSON thuần:\n"
        '{\n'
        '  "headline": "1 câu tóm tắt ngắn (10-15 từ)",\n'
        '  "summary": "3-4 câu nhận định súc tích, có số liệu nếu có",\n'
        '  "key_drivers": ["động lực 1 với số liệu", "động lực 2", "động lực 3"],\n'
        '  "bullish_factors": ["điểm tích cực 1", "điểm tích cực 2", "điểm tích cực 3"],\n'
        '  "risk_factors": ["rủi ro 1", "rủi ro 2", "rủi ro 3"],\n'
        '  "watch_next": ["điều cần theo dõi 1", "điều cần theo dõi 2"]\n'
        '}'
    )
    try:
        content = _call_openrouter([
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(market_data, ensure_ascii=False)},
        ])
        parsed = _parse_json_response(content)
        if parsed and "summary" in parsed:
            return parsed
    except Exception:
        pass
    return {}


def _price_question_needs_ticker(question: str, context: Dict[str, Any] | None = None) -> bool:
    q = (question or "").lower()
    ctx = context or {}
    # detect a price mention
    m_num = re.search(r"(\d{1,4}(?:[\.,]\d{1,2})?)\s*(k|nghìn|nghin)?\b", q)
    if not m_num:
        return False
    # check if a ticker exists in context
    symbol = str((ctx.get("data") or {}).get("symbol") or ctx.get("symbol") or ctx.get("title") or "").strip()
    if symbol:
        return False
    # find an in-text ticker-like token (2-5 letters)
    m_sym = re.search(r"\b([a-zA-Z]{2,5})\b", q)
    if not m_sym:
        return True
    # If token is a common word (like "market", "dashboard"), treat as not ticker
    token = m_sym.group(1).lower()
    if token in {"market","dashboard","report","price","mua","bán","mua"}:
        return True
    return False


def chat(question: str, context: Dict[str, Any] | None = None) -> str:
    """Always call the OpenRouter model with enriched context (technical + sector) and let the model
    perform analysis using available data (including any vnstock-derived features passed in context).
    Return a concise Vietnamese answer (1-3 sentences, optional up to 3 short bullets: TA, FA, Watch).
    If model call fails, fall back to mock explanation.
    """
    context = context or {}
    # Merge context with technical snapshot and sector so model receives local computed features
    merged = _merge_analysis_context({**context, "question": question})

    system = (
        "Bạn là FinSight AI, chuyên gia phân tích thị trường Việt Nam. "
        "Sử dụng mọi dữ liệu được cung cấp trong payload (technical_snapshot, sector, snapshot, và các trường khác). "
        "Phân tích dựa trên dữ liệu từ các mô-đun nội bộ (ví dụ vnstock) đã được đính kèm — dùng các số liệu đó trong phân tích. "
        "Trả lời bằng tiếng Việt, ngắn gọn: 1-2 câu tóm tắt trọng tâm ở đầu; nếu cần, tối đa 3 bullets ngắn: TA, FA, Theo dõi. "
        "Cuối phân tích, thêm một câu rõ ràng bắt đầu bằng 'Kết luận:' tóm tắt ý chính (một câu). "
        "Không dùng markdown, không giải thích meta, không khuyến nghị mua/bán. Nếu thiếu dữ liệu quan trọng (ví dụ mã chứng khoán), hỏi người dùng cụ thể và ngắn gọn."
    )

    user_payload = {"question": question, "context": merged}

    # Enrich from persisted data only; the web process must not call provider APIs.
    symbol = (merged.get("symbol") or (merged.get("data") or {}).get("symbol") or "").strip()
    if symbol:
        try:
            quote = _read_quote(symbol)
            if quote and isinstance(quote, dict):
                merged.setdefault("snapshot", {})
                if quote.get("current_price") is not None:
                    merged["snapshot"]["last_price"] = quote.get("current_price")
                if quote.get("volume") is not None:
                    merged["snapshot"]["volume"] = quote.get("volume")
        except Exception:
            # ignore quote fetch errors
            quote = None
        try:
            tech = _technical_snapshot(symbol)
            if tech:
                merged["technical_snapshot"] = {**(merged.get("technical_snapshot") or {}), **tech}
        except Exception:
            pass

    try:
        content = _call_openrouter([
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ])
        text = re.sub(r"\s+", " ", (content or "").strip())
        # Prefer to keep first 2 sentences as summary, and ensure a 'Kết luận:' sentence exists
        parts = re.split(r'(?<=[\.\!\?])\s+', text)
        summary_parts = [p.strip() for p in parts if p.strip()][:2]
        # Find explicit conclusion in model output
        m_concl = re.search(r'(?i)(kết luận)[:\-]?\s*(.+?)(?=[\.\!\?]\s|$)', text)
        if m_concl:
            concl = f"Kết luận: {m_concl.group(2).strip()}"
        else:
            # synthesize short conclusion from first sentence
            first = summary_parts[0] if summary_parts else (parts[0].strip() if parts else '')
            concl = f"Kết luận: {first}"
        final = " ".join(summary_parts + [concl])
        return final if final.strip() else text
    except Exception:
        # fallback to mock explanation that uses merged context
        raw = _mock_chat(question, context=merged)
        raw_text = re.sub(r"\s+", " ", (raw or "").strip())
        parts = re.split(r'(?<=[\.\!\?])\s+', raw_text)
        summary_parts = [p.strip() for p in parts if p.strip()][:2]
        first = summary_parts[0] if summary_parts else (parts[0].strip() if parts else '')
        concl = f"Kết luận: {first}"
        return " ".join(summary_parts + [concl])


async def chat_async(question: str, context: Dict[str, Any] | None = None) -> str:
    context = context or {}
    merged = await _merge_analysis_context_async({**context, "question": question})
    symbol = (merged.get("symbol") or (merged.get("data") or {}).get("symbol") or "").strip()
    if symbol:
        quote = await _load_quote(symbol)
        if quote:
            merged.setdefault("snapshot", {})
            if quote.get("current_price") is not None:
                merged["snapshot"]["last_price"] = quote["current_price"]
            if quote.get("volume") is not None:
                merged["snapshot"]["volume"] = quote["volume"]
        technical = await _technical_snapshot_async(symbol)
        if technical:
            merged["technical_snapshot"] = {**(merged.get("technical_snapshot") or {}), **technical}

    system = (
        "Bạn là FinSight, chuyên gia phân tích thị trường Việt Nam. "
        "Trả lời bằng tiếng Việt, ngắn gọn, không khuyến nghị mua/bán. "
        "Cuối câu trả lời thêm một câu bắt đầu bằng 'Kết luận:'."
    )
    try:
        content = await asyncio.to_thread(
            _call_openrouter,
            [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(
                    {"question": question, "context": merged}, ensure_ascii=False
                )},
            ],
        )
        text = re.sub(r"\s+", " ", (content or "").strip())
        parts = [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]
        summary_parts = parts[:2]
        conclusion = next(
            (f"Kết luận: {match.group(2).strip()}" for match in
             [re.search(r"(?i)(kết luận)[:\-]?\s*(.+?)(?=[.!?]\s|$)", text)]
             if match),
            f"Kết luận: {summary_parts[0]}" if summary_parts else "Kết luận: Chưa đủ dữ liệu.",
        )
        return " ".join(summary_parts + [conclusion])
    except Exception:
        raw = _mock_chat(question, context=merged)
        parts = [part.strip() for part in re.split(r"(?<=[.!?])\s+", raw) if part.strip()]
        first = parts[0] if parts else "Chưa đủ dữ liệu."
        return f"{first} Kết luận: {first}"
