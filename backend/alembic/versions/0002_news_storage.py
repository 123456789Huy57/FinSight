"""Persist RSS stories and their ticker links."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_news"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "news_articles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("url", sa.String(2048), nullable=False, unique=True),
        sa.Column("source", sa.String(160), nullable=False),
        sa.Column("title", sa.String(1000), nullable=False),
        sa.Column("summary", sa.Text()),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("category", sa.String(32)),
        sa.Column("sentiment", sa.String(16), nullable=False, server_default="neutral"),
        sa.Column("sentiment_score", sa.Numeric(5, 4), nullable=False, server_default="0"),
        sa.Column("raw_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("raw_hash", name="uq_news_articles_raw_hash"),
    )
    op.create_index("ix_news_articles_published_at", "news_articles", ["published_at"])
    op.create_table(
        "news_symbols",
        sa.Column("article_id", sa.String(36), sa.ForeignKey("news_articles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("symbol", sa.String(12), sa.ForeignKey("symbols.symbol", ondelete="CASCADE"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("news_symbols")
    op.drop_index("ix_news_articles_published_at", table_name="news_articles")
    op.drop_table("news_articles")
