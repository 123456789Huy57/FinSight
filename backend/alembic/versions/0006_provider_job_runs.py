"""Track market price ingestion runs for freshness and diagnostics."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_provider_job_runs"
down_revision: Union[str, None] = "0005_source_scoped_price_bars"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "provider_job_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("source", sa.String(32), nullable=False),
        sa.Column("job_name", sa.String(64), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("summary", postgresql.JSONB()),
        sa.Column("error", sa.Text()),
    )
    op.create_index("ix_provider_job_runs_source_started", "provider_job_runs", ["source", "started_at"])


def downgrade() -> None:
    op.drop_index("ix_provider_job_runs_source_started", table_name="provider_job_runs")
    op.drop_table("provider_job_runs")
