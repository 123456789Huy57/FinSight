"""Create the initial migration baseline.

The first domain tables are introduced in the market-data milestone.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "symbols",
        sa.Column("symbol", sa.String(12), primary_key=True),
        sa.Column("name", sa.String(255)),
        sa.Column("exchange", sa.String(16)),
        sa.Column("sector", sa.String(120)),
        sa.Column("industry", sa.String(160)),
        sa.Column("description", sa.Text()),
        sa.Column("employees", sa.BigInteger()),
        sa.Column("website", sa.String(512)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_symbols_exchange", "symbols", ["exchange"])
    op.create_table(
        "price_bars",
        sa.Column("symbol", sa.String(12), sa.ForeignKey("symbols.symbol", ondelete="CASCADE"), primary_key=True),
        sa.Column("trade_date", sa.Date(), primary_key=True),
        sa.Column("open", sa.Numeric(18, 2)), sa.Column("high", sa.Numeric(18, 2)),
        sa.Column("low", sa.Numeric(18, 2)), sa.Column("close", sa.Numeric(18, 2), nullable=False),
        sa.Column("volume", sa.BigInteger()), sa.Column("source", sa.String(32), nullable=False, server_default="vnstock"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_price_bars_trade_date", "price_bars", ["trade_date"])
    op.create_table(
        "index_bars",
        sa.Column("index_symbol", sa.String(24), primary_key=True),
        sa.Column("trade_date", sa.Date(), primary_key=True),
        sa.Column("open", sa.Numeric(18, 2)), sa.Column("high", sa.Numeric(18, 2)),
        sa.Column("low", sa.Numeric(18, 2)), sa.Column("close", sa.Numeric(18, 2), nullable=False),
        sa.Column("volume", sa.BigInteger()), sa.Column("source", sa.String(32), nullable=False, server_default="vnstock"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_index_bars_trade_date", "index_bars", ["trade_date"])
    op.create_table(
        "fundamentals",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("symbol", sa.String(12), sa.ForeignKey("symbols.symbol", ondelete="CASCADE"), nullable=False),
        sa.Column("as_of", sa.Date(), nullable=False), sa.Column("market_cap", sa.Numeric(18, 2)),
        sa.Column("pe", sa.Numeric(18, 2)), sa.Column("pb", sa.Numeric(18, 2)),
        sa.Column("eps", sa.Numeric(18, 2)), sa.Column("dividend_yield", sa.Numeric(9, 4)),
        sa.Column("source", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_fundamentals_symbol_as_of", "fundamentals", ["symbol", "as_of"])
    op.create_table(
        "market_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_market_snapshots_as_of", "market_snapshots", ["as_of"])


def downgrade() -> None:
    op.drop_index("ix_market_snapshots_as_of", table_name="market_snapshots")
    op.drop_table("market_snapshots")
    op.drop_index("ix_fundamentals_symbol_as_of", table_name="fundamentals")
    op.drop_table("fundamentals")
    op.drop_index("ix_index_bars_trade_date", table_name="index_bars")
    op.drop_table("index_bars")
    op.drop_index("ix_price_bars_trade_date", table_name="price_bars")
    op.drop_table("price_bars")
    op.drop_index("ix_symbols_exchange", table_name="symbols")
    op.drop_table("symbols")
