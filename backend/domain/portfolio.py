from decimal import Decimal


def weighted_average_cost(
    old_quantity: int,
    old_average_cost: Decimal,
    added_quantity: int,
    price: Decimal,
    fee: Decimal = Decimal("0"),
) -> Decimal:
    if old_quantity < 0 or added_quantity <= 0 or price <= 0 or fee < 0:
        raise ValueError("Invalid position or purchase values")
    total_quantity = old_quantity + added_quantity
    return (old_average_cost * old_quantity + price * added_quantity + fee) / total_quantity


def remaining_quantity(current_quantity: int, sold_quantity: int) -> int:
    if sold_quantity <= 0:
        raise ValueError("Sold quantity must be positive")
    if sold_quantity > current_quantity:
        raise ValueError("Cannot sell more shares than the position holds")
    return current_quantity - sold_quantity
