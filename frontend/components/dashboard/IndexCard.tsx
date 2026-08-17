'use client'

import type { MarketIndex, AIExplainRequest } from '@/lib/api'
import { ExplainButton } from '@/components/shared/ExplainButton'

function fmt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function fmtVol(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

const BAR_SCALE = 3

export function IndexCard({ index, onExplain, primary = false }: {
  index: MarketIndex
  onExplain: (req: AIExplainRequest) => void
  primary?: boolean
}) {
  const up = index.change >= 0
  const fillPct = Math.min(Math.abs(index.percent_change) / BAR_SCALE * 50, 50)

  const handleExplain = () =>
    onExplain({
      type: 'index', title: index.symbol, symbol: index.symbol,
      context: `Điểm: ${fmt(index.points)}, Biến động: ${index.change >= 0 ? '+' : ''}${fmt(index.change)} (${index.percent_change >= 0 ? '+' : ''}${index.percent_change.toFixed(2)}%), KL: ${fmtVol(index.volume)}`,
      snapshot: { symbol: index.symbol, exchange: index.exchange, points: index.points, change: index.change, percent_change: index.percent_change, volume: index.volume },
    })

  if (primary) {
    return (
      <div className={[
        'rounded-xl p-4 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 cursor-default border shadow-lg',
        up
          ? 'bg-gradient-to-br from-[#34d399]/[0.08] via-[#0e1726] to-[#0e1726] border-[#34d399]/25 shadow-black/50'
          : 'bg-gradient-to-br from-[#f87171]/[0.08] via-[#0e1726] to-[#0e1726] border-[#f87171]/25 shadow-black/50',
      ].join(' ')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-foreground">{index.symbol}</span>
            <span className="text-[9px] font-bold text-[#3d4f6b] border border-[#1e3158] rounded px-1.5 leading-4">{index.exchange}</span>
          </div>
          <ExplainButton onClick={handleExplain} size="sm" />
        </div>

        <div>
          <p className="text-[2rem] font-black tabular leading-none tracking-tight text-foreground">
            {fmt(index.points)}
          </p>
          <div className={`inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-md text-[12px] font-bold tabular ${up ? 'text-[#34d399] bg-[#34d399]/12' : 'text-[#f87171] bg-[#f87171]/12'}`}>
            {up ? '+' : ''}{fmt(index.change)} ({up ? '+' : ''}{index.percent_change.toFixed(2)}%)
          </div>
        </div>

        <p className="text-[11px] text-[#3d4f6b] tabular">
          KL <span className="font-bold text-[#7a8ba8]">{fmtVol(index.volume)}</span>
        </p>

        <div className="relative h-1 bg-[#1a2744] rounded-full overflow-hidden">
          <div className="absolute left-1/2 top-0 w-px h-full bg-[#1e3158] z-10" />
          {up ? (
            <div className="absolute top-0 h-full bg-[#34d399]/70 rounded-r-full" style={{ left: '50%', width: `${fillPct}%` }} />
          ) : (
            <div className="absolute top-0 h-full bg-[#f87171]/70 rounded-l-full" style={{ right: '50%', width: `${fillPct}%` }} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 cursor-default bg-[#0e1726] border border-[#1a2744] shadow-md shadow-black/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[#7a8ba8]">{index.symbol}</span>
          <span className="text-[9px] font-semibold text-[#3d4f6b] border border-[#1e3158] rounded px-1.5 leading-4">{index.exchange}</span>
        </div>
        <ExplainButton onClick={handleExplain} size="sm" />
      </div>

      <div>
        <p className="text-[1.6rem] font-black tabular leading-none tracking-tight text-foreground">
          {fmt(index.points)}
        </p>
        <div className={`flex items-center gap-1.5 mt-1.5 ${up ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
          <span className="text-[12px] font-bold tabular">{up ? '+' : ''}{fmt(index.change)}</span>
          <span className="text-[11px] font-semibold tabular opacity-70">{up ? '+' : ''}{index.percent_change.toFixed(2)}%</span>
        </div>
      </div>

      <p className="text-[11px] text-[#3d4f6b] tabular">
        KL <span className="font-semibold text-[#7a8ba8]">{fmtVol(index.volume)}</span>
      </p>

      <div className="relative h-1 bg-[#1a2744] rounded-full overflow-hidden">
        <div className="absolute left-1/2 top-0 w-px h-full bg-[#1e3158] z-10" />
        {up ? (
          <div className="absolute top-0 h-full bg-[#34d399]/50 rounded-r-full" style={{ left: '50%', width: `${fillPct}%` }} />
        ) : (
          <div className="absolute top-0 h-full bg-[#f87171]/50 rounded-l-full" style={{ right: '50%', width: `${fillPct}%` }} />
        )}
      </div>
    </div>
  )
}

export function IndexStrip({ indices, onExplain }: { indices: MarketIndex[]; onExplain: (req: AIExplainRequest) => void }) {
  if (!indices.length) return null
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {indices.slice(0, 4).map((idx, i) => (
        <IndexCard key={idx.symbol} index={idx} onExplain={onExplain} primary={i === 0} />
      ))}
    </section>
  )
}
