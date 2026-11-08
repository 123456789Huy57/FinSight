from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import BigInteger, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class CreatedAtMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Symbol(CreatedAtMixin, Base):
    __tablename__ = "symbols"

    symbol: Mapped[str] = mapped_column(String(12), primary_key=True)
    name: Mapped[str | None] = mapped_column(String(255))
    search_text: Mapped[str | None] = mapped_column(Text)
    exchange: Mapped[str | None] = mapped_column(String(16), index=True)
    sector: Mapped[str | None] = mapped_column(String(120))
    industry: Mapped[str | None] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)
    employees: Mapped[int | None] = mapped_column(BigInteger)
    website: Mapped[str | None] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")


class PriceBar(CreatedAtMixin, Base):
    __tablename__ = "price_bars"
    __table_args__ = (Index("ix_price_bars_trade_date", "trade_date"),)

    symbol: Mapped[str] = mapped_column(ForeignKey("symbols.symbol", ondelete="CASCADE"), primary_key=True)
    trade_date: Mapped[date] = mapped_column(Date, primary_key=True)
    source: Mapped[str] = mapped_column(String(32), primary_key=True)
    open: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    high: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    low: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    close: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    adjusted_close: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    volume: Mapped[int | None] = mapped_column(BigInteger)


class IndexBar(CreatedAtMixin, Base):
    __tablename__ = "index_bars"
    __table_args__ = (Index("ix_index_bars_trade_date", "trade_date"),)

    index_symbol: Mapped[str] = mapped_column(String(24), primary_key=True)
    trade_date: Mapped[date] = mapped_column(Date, primary_key=True)
    source: Mapped[str] = mapped_column(String(32), primary_key=True)
    open: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    high: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    low: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    close: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    volume: Mapped[int | None] = mapped_column(BigInteger)


class Fundamental(CreatedAtMixin, Base):
    __tablename__ = "fundamentals"
    __table_args__ = (Index("ix_fundamentals_symbol_as_of", "symbol", "as_of"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(ForeignKey("symbols.symbol", ondelete="CASCADE"), nullable=False)
    as_of: Mapped[date] = mapped_column(Date, nullable=False)
    market_cap: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    pe: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    pb: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    eps: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    dividend_yield: Mapped[Decimal | None] = mapped_column(Numeric(9, 4))
    source: Mapped[str] = mapped_column(String(32), nullable=False)


class MarketSnapshot(CreatedAtMixin, Base):
    __tablename__ = "market_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    as_of: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)


class ProviderJobRun(Base):
    __tablename__ = "provider_job_runs"
    __table_args__ = (Index("ix_provider_job_runs_source_started", "source", "started_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    job_name: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    error: Mapped[str | None] = mapped_column(Text)


class UniverseSyncAttempt(Base):
    __tablename__ = "universe_sync_attempts"

    source: Mapped[str] = mapped_column(String(32), primary_key=True)
    symbol: Mapped[str] = mapped_column(ForeignKey("symbols.symbol", ondelete="CASCADE"), primary_key=True)
    target_trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class NewsArticle(CreatedAtMixin, Base):
    __tablename__ = "news_articles"
    __table_args__ = (UniqueConstraint("raw_hash", name="uq_news_articles_raw_hash"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    url: Mapped[str] = mapped_column(String(2048), unique=True, nullable=False)
    source: Mapped[str] = mapped_column(String(160), nullable=False)
    title: Mapped[str] = mapped_column(String(1000), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    search_text: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    category: Mapped[str | None] = mapped_column(String(32))
    sentiment: Mapped[str] = mapped_column(String(16), nullable=False, server_default="neutral")
    sentiment_score: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False, server_default="0")
    raw_hash: Mapped[str] = mapped_column(String(64), nullable=False)


class NewsSymbol(Base):
    __tablename__ = "news_symbols"

    article_id: Mapped[str] = mapped_column(ForeignKey("news_articles.id", ondelete="CASCADE"), primary_key=True)
    symbol: Mapped[str] = mapped_column(ForeignKey("symbols.symbol", ondelete="CASCADE"), primary_key=True)


class NewsEventStudy(Base):
    __tablename__ = "news_event_studies"
    __table_args__ = (Index("ix_news_event_studies_symbol_event_date", "symbol", "event_trade_date"),)

    article_id: Mapped[str] = mapped_column(ForeignKey("news_articles.id", ondelete="CASCADE"), primary_key=True)
    symbol: Mapped[str] = mapped_column(ForeignKey("symbols.symbol", ondelete="CASCADE"), primary_key=True)
    method_version: Mapped[str] = mapped_column(String(32), primary_key=True)
    benchmark_symbol: Mapped[str] = mapped_column(String(24), nullable=False, server_default="VNINDEX")
    data_mode: Mapped[str | None] = mapped_column(String(24))
    price_source: Mapped[str | None] = mapped_column(String(32))
    benchmark_source: Mapped[str | None] = mapped_column(String(32))
    event_trade_date: Mapped[date | None] = mapped_column(Date)
    event_adjusted_close: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    benchmark_event_close: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    t1_status: Mapped[str] = mapped_column(String(24), nullable=False)
    t1_end_date: Mapped[date | None] = mapped_column(Date)
    t1_adjusted_close: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    t1_benchmark_close: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    t1_return_pct: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    t1_benchmark_return_pct: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    t1_abnormal_return_pct: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    t1_reason: Mapped[str | None] = mapped_column(String(64))
    t5_status: Mapped[str] = mapped_column(String(24), nullable=False)
    t5_end_date: Mapped[date | None] = mapped_column(Date)
    t5_adjusted_close: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    t5_benchmark_close: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    t5_return_pct: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    t5_benchmark_return_pct: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    t5_abnormal_return_pct: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    t5_reason: Mapped[str | None] = mapped_column(String(64))
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class User(CreatedAtMixin, Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")


class RefreshToken(CreatedAtMixin, Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class WatchlistItem(CreatedAtMixin, Base):
    __tablename__ = "watchlist_items"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    symbol: Mapped[str] = mapped_column(ForeignKey("symbols.symbol", ondelete="CASCADE"), primary_key=True)


class PortfolioPosition(CreatedAtMixin, Base):
    __tablename__ = "portfolio_positions"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_portfolio_positions_positive_quantity"),)

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    symbol: Mapped[str] = mapped_column(ForeignKey("symbols.symbol", ondelete="CASCADE"), primary_key=True)
    quantity: Mapped[int] = mapped_column(BigInteger, nullable=False)
    average_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)


class PortfolioTransaction(CreatedAtMixin, Base):
    __tablename__ = "portfolio_transactions"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_portfolio_transactions_positive_quantity"),
        CheckConstraint("price > 0", name="ck_portfolio_transactions_positive_price"),
        CheckConstraint("side IN ('BUY', 'SELL')", name="ck_portfolio_transactions_side"),
        Index("ix_portfolio_transactions_user_created", "user_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    symbol: Mapped[str] = mapped_column(ForeignKey("symbols.symbol", ondelete="CASCADE"), nullable=False)
    side: Mapped[str] = mapped_column(String(4), nullable=False)
    quantity: Mapped[int] = mapped_column(BigInteger, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    fee: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, server_default="0")
    tax: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, server_default="0")


class BacktestRun(CreatedAtMixin, Base):
    __tablename__ = "backtest_runs"
    __table_args__ = (Index("ix_backtest_runs_user_created", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    symbol: Mapped[str] = mapped_column(ForeignKey("symbols.symbol", ondelete="CASCADE"), nullable=False)
    strategy: Mapped[str] = mapped_column(String(32), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    result: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
