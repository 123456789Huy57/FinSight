from decimal import Decimal

import pytest

from domain.portfolio import remaining_quantity, weighted_average_cost


def test_weighted_average_includes_purchase_fee():
    result = weighted_average_cost(100, Decimal("10"), 100, Decimal("20"), Decimal("100"))
    assert result == Decimal("15.5")


def test_sell_quantity_cannot_exceed_position():
    assert remaining_quantity(300, 100) == 200
    with pytest.raises(ValueError):
        remaining_quantity(100, 200)
