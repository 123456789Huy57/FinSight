"""Store accent-insensitive search text for symbols and RSS articles."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_normalized_search"
down_revision: Union[str, None] = "0006_provider_job_runs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column("symbols", sa.Column("search_text", sa.Text(), nullable=True))
    op.add_column("news_articles", sa.Column("search_text", sa.Text(), nullable=True))
    accented = "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ"
    plain = "a" * 17 + "e" * 11 + "i" * 5 + "o" * 17 + "u" * 11 + "y" * 5 + "d"
    source_literal = accented.replace("'", "''")
    target_literal = plain.replace("'", "''")
    op.execute(sa.text(
        "UPDATE symbols SET search_text = concat_ws(' ', "
        "translate(lower(coalesce(symbol, '')), '" + source_literal + "', '" + target_literal + "'), "
        "translate(lower(coalesce(name, '')), '" + source_literal + "', '" + target_literal + "'), "
        "translate(lower(coalesce(sector, '')), '" + source_literal + "', '" + target_literal + "'))"
    ))
    op.execute(sa.text(
        "UPDATE news_articles SET search_text = concat_ws(' ', "
        "translate(lower(coalesce(title, '')), '" + source_literal + "', '" + target_literal + "'), "
        "translate(lower(coalesce(summary, '')), '" + source_literal + "', '" + target_literal + "'), "
        "translate(lower(coalesce(source, '')), '" + source_literal + "', '" + target_literal + "'))"
    ))


def downgrade() -> None:
    op.drop_column("news_articles", "search_text")
    op.drop_column("symbols", "search_text")
