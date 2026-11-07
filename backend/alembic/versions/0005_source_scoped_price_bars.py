"""Allow prices from different providers to coexist without losing provenance."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_source_scoped_price_bars"
down_revision: Union[str, None] = "0004_backtests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.drop_constraint("price_bars_pkey", "price_bars", type_="primary")
    op.create_primary_key(
        "price_bars_pkey", "price_bars", ["symbol", "trade_date", "source"]
    )
    op.drop_constraint("index_bars_pkey", "index_bars", type_="primary")
    op.create_primary_key(
        "index_bars_pkey", "index_bars", ["index_symbol", "trade_date", "source"]
    )


def downgrade() -> None:
    connection = op.get_bind()
    price_duplicates = connection.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM price_bars GROUP BY symbol, trade_date HAVING COUNT(*) > 1)"
    )).scalar()
    index_duplicates = connection.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM index_bars GROUP BY index_symbol, trade_date HAVING COUNT(*) > 1)"
    )).scalar()
    if price_duplicates or index_duplicates:
        raise RuntimeError("Cannot downgrade while multiple provider bars exist for the same trading date")
    op.drop_constraint("index_bars_pkey", "index_bars", type_="primary")
    op.create_primary_key("index_bars_pkey", "index_bars", ["index_symbol", "trade_date"])
    op.drop_constraint("price_bars_pkey", "price_bars", type_="primary")
    op.create_primary_key("price_bars_pkey", "price_bars", ["symbol", "trade_date"])
