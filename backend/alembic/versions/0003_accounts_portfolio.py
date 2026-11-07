"""Add accounts, refresh-token storage and user-owned investing records."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_accounts"
down_revision: Union[str, None] = "0002_news"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(512), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_table(
        "watchlist_items",
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("symbol", sa.String(12), sa.ForeignKey("symbols.symbol", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "portfolio_positions",
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("symbol", sa.String(12), sa.ForeignKey("symbols.symbol", ondelete="CASCADE"), primary_key=True),
        sa.Column("quantity", sa.BigInteger(), nullable=False),
        sa.Column("average_cost", sa.Numeric(18, 4), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("quantity > 0", name="ck_portfolio_positions_positive_quantity"),
    )
    op.create_table(
        "portfolio_transactions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.String(12), sa.ForeignKey("symbols.symbol", ondelete="CASCADE"), nullable=False),
        sa.Column("side", sa.String(4), nullable=False),
        sa.Column("quantity", sa.BigInteger(), nullable=False),
        sa.Column("price", sa.Numeric(18, 4), nullable=False),
        sa.Column("fee", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("tax", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("quantity > 0", name="ck_portfolio_transactions_positive_quantity"),
        sa.CheckConstraint("price > 0", name="ck_portfolio_transactions_positive_price"),
        sa.CheckConstraint("side IN ('BUY', 'SELL')", name="ck_portfolio_transactions_side"),
    )
    op.create_index("ix_portfolio_transactions_user_created", "portfolio_transactions", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_portfolio_transactions_user_created", table_name="portfolio_transactions")
    op.drop_table("portfolio_transactions")
    op.drop_table("portfolio_positions")
    op.drop_table("watchlist_items")
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
