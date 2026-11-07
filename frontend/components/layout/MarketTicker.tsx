'use client'

import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { MarketIndex } from '@/lib/api'

function TickerItem({ index }: { index: MarketIndex }) {
  const up = (index.change ?? 0) >= 0
  return (
    <div className="flex items-center gap-3 px-6 border-r border-[#1a2744]/60 flex-shrink-0 h-full">
      <span className="text-[10px] font-black text-[#3d4f6b] tracking-[0.14em] uppercase">{index.symbol}</span>
      <span className="text-[12px] font-bold tabular text-[#9baac0]">
        {index.points.toLocaleString('en-US', { maximumFractionDigits: 2 })}
      </span>
      {index.percent_change == null ? <span className="text-[11px] text-[#7a8ba8]">-</span> : (
        <span className={`flex items-center gap-0.5 text-[11px] font-bold tabular ${up ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
          {up ? <ArrowUpRight className="w-3 h-3 flex-shrink-0" /> : <ArrowDownRight className="w-3 h-3 flex-shrink-0" />}
          {up ? '+' : ''}{index.percent_change.toFixed(2)}%
        </span>
      )}
    </div>
  )
}

export function MarketTicker({ indices }: { indices: MarketIndex[] }) {
  if (!indices.length) return null
  const items = [...indices, ...indices, ...indices, ...indices]

  return (
    <div className="h-8 bg-[#060c18] border-b border-[rgba(79,142,247,0.12)] overflow-hidden flex items-center">
      <div className="ticker-animate flex items-center h-full">
        {items.map((index, i) => (
          <TickerItem key={`${index.symbol}-${i}`} index={index} />
        ))}
      </div>
    </div>
  )
}
