import Link from 'next/link'

export function SymbolChip({ symbol }: { symbol: string }) {
  return (
    <Link
      href={`/stock/${symbol}`}
      className="rounded-md bg-[var(--fs-signal-soft)] px-1.5 py-0.5 text-[12px] font-medium text-[var(--fs-signal)]"
    >
      {symbol}
    </Link>
  )
}
