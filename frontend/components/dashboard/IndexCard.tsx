'use client'

import type { MarketIndex, AIExplainRequest } from '@/lib/api'
import { ExplainButton } from '@/components/shared/ExplainButton'
import { Change } from '@/components/fs'
import { fmtPrice, fmtCompact } from '@/lib/format'

function fmtVol(n: number | null) {
  if (n == null) return '-'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

export function IndexCard({ index, onExplain }: {
  index: MarketIndex
  onExplain: (req: AIExplainRequest) => void
  primary?: boolean
}) {
  const handleExplain = () =>
    onExplain({
      type: 'index', title: index.symbol, symbol: index.symbol,
      context: `Điểm: ${fmtPrice(index.points)}, Biến động: ${index.change == null ? 'không có dữ liệu' : `${index.change >= 0 ? '+' : ''}${fmtPrice(index.change)}`}, %: ${index.percent_change == null ? 'không có dữ liệu' : `${index.percent_change >= 0 ? '+' : ''}${index.percent_change.toFixed(2)}%`}, KL: ${fmtVol(index.volume)}`,
      snapshot: { symbol: index.symbol, exchange: index.exchange, points: index.points, change: index.change, percent_change: index.percent_change, volume: index.volume },
    })

  return (
    <div className="min-w-0 px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] text-[var(--fs-muted)]">{index.symbol}</span>
        <ExplainButton onClick={handleExplain} size="sm" />
      </div>
      <p className="mt-1 text-[22px] font-medium leading-tight tabular-nums tracking-[-0.01em]">{fmtPrice(index.points)}</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[13px]">
        <Change value={index.percent_change} />
        <span className="text-[var(--fs-muted)] tabular-nums">KL {fmtCompact(index.volume)}</span>
      </p>
    </div>
  )
}

export function IndexStrip({ indices, onExplain }: { indices: MarketIndex[]; onExplain: (req: AIExplainRequest) => void }) {
  if (!indices.length) return null
  return (
    <section
      aria-label="Chỉ số thị trường"
      className="grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--fs-line)] bg-[var(--fs-line)] lg:grid-cols-4"
    >
      {indices.slice(0, 4).map((idx) => (
        <div key={idx.symbol} className="min-w-0 bg-white">
          <IndexCard index={idx} onExplain={onExplain} />
        </div>
      ))}
    </section>
  )
}
