from vnstock import Trading

board = Trading(
    source="KBS"
)

print(
    board.price_board(
        ["VCB"]
    )
)