"""Persist auditable T+1/T+5 news event-study results."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_news_event_studies"
down_revision: Union[str, None] = "0007_normalized_search"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column("price_bars", sa.Column("adjusted_close", sa.Numeric(18, 2), nullable=True))
    op.create_table(
        "news_event_studies",
        sa.Column("article_id", sa.String(36), sa.ForeignKey("news_articles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("symbol", sa.String(12), sa.ForeignKey("symbols.symbol", ondelete="CASCADE"), primary_key=True),
        sa.Column("method_version", sa.String(32), primary_key=True),
        sa.Column("benchmark_symbol", sa.String(24), nullable=False, server_default="VNINDEX"),
        sa.Column("data_mode", sa.String(24)),
        sa.Column("price_source", sa.String(32)),
        sa.Column("benchmark_source", sa.String(32)),
        sa.Column("event_trade_date", sa.Date()),
        sa.Column("event_adjusted_close", sa.Numeric(18, 2)),
        sa.Column("benchmark_event_close", sa.Numeric(18, 2)),
        sa.Column("t1_status", sa.String(24), nullable=False),
        sa.Column("t1_end_date", sa.Date()),
        sa.Column("t1_adjusted_close", sa.Numeric(18, 2)),
        sa.Column("t1_benchmark_close", sa.Numeric(18, 2)),
        sa.Column("t1_return_pct", sa.Numeric(12, 6)),
        sa.Column("t1_benchmark_return_pct", sa.Numeric(12, 6)),
        sa.Column("t1_abnormal_return_pct", sa.Numeric(12, 6)),
        sa.Column("t1_reason", sa.String(64)),
        sa.Column("t5_status", sa.String(24), nullable=False),
        sa.Column("t5_end_date", sa.Date()),
        sa.Column("t5_adjusted_close", sa.Numeric(18, 2)),
        sa.Column("t5_benchmark_close", sa.Numeric(18, 2)),
        sa.Column("t5_return_pct", sa.Numeric(12, 6)),
        sa.Column("t5_benchmark_return_pct", sa.Numeric(12, 6)),
        sa.Column("t5_abnormal_return_pct", sa.Numeric(12, 6)),
        sa.Column("t5_reason", sa.String(64)),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_news_event_studies_symbol_event_date",
        "news_event_studies",
        ["symbol", "event_trade_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_news_event_studies_symbol_event_date", table_name="news_event_studies")
    op.drop_table("news_event_studies")
    op.drop_column("price_bars", "adjusted_close")
