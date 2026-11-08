"""Track each ticker's latest full-universe sync attempt."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_universe_sync_attempts"
down_revision: Union[str, None] = "0008_news_event_studies"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.create_table(
        "universe_sync_attempts",
        sa.Column("source", sa.String(32), primary_key=True),
        sa.Column("symbol", sa.String(12), sa.ForeignKey("symbols.symbol", ondelete="CASCADE"), primary_key=True),
        sa.Column("target_trade_date", sa.Date(), nullable=False),
        sa.Column("attempted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("universe_sync_attempts")
