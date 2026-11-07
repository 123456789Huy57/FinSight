"""Persist user-owned backtest results."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_backtests"
down_revision: Union[str, None] = "0003_accounts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "backtest_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.String(12), sa.ForeignKey("symbols.symbol", ondelete="CASCADE"), nullable=False),
        sa.Column("strategy", sa.String(32), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("source", sa.String(32), nullable=False),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_backtest_runs_user_created", "backtest_runs", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_backtest_runs_user_created", table_name="backtest_runs")
    op.drop_table("backtest_runs")
