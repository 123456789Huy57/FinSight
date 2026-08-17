'use client'

import { TrendingUp, TrendingDown, Flame } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import type { MarketMover, AIExplainRequest } from '@/lib/api'
import { ExplainButton } from '@/components/shared/ExplainButton'
import { TableRowSkeleton } from '@/components/shared/Skeleton'

function fmtPrice(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function fmtVol(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return `${v}`
}

function MoverRow({ stock, showVol = false, onExplain }: {
  stock: MarketMover
  showVol?: boolean
  onExplain: (req: AIExplainRequest) => void
}) {
  const up = stock.percent_change >= 0
  const pctAbs = Math.abs(stock.percent_change)

  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 hover:bg-[#0e1726] transition-colors group">
      <div className="flex items-center gap-2 min-w-0">
        <Link
          href={`/stock/${stock.symbol}`}
          className="text-[13px] font-bold font-mono text-foreground group-hover:text-primary transition-colors flex-shrink-0"
        >
          {stock.symbol}
        </Link>
        <ExplainButton
          onClick={() => onExplain({
            type: 'stock', title: stock.symbol, symbol: stock.symbol,
            context: `Giá: ${fmtPrice(stock.current_price)}, Biến động: ${stock.percent_change >= 0 ? '+' : ''}${stock.percent_change.toFixed(2)}%, KL: ${fmtVol(stock.volume)}`,
            snapshot: { symbol: stock.symbol, exchange: stock.exchange, current_price: stock.current_price, price_change: stock.price_change, percent_change: stock.percent_change, volume: stock.volume },
          })}
        />
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {showVol ? (
          <span className="text-[11px] text-[#7a8ba8] tabular">{fmtVol(stock.volume)}</span>
        ) : (
          <span className="text-[11px] text-[#3d4f6b] tabular hidden sm:block">{fmtPrice(stock.current_price)}</span>
        )}
        <span className={[
          'text-[12px] font-bold tabular min-w-[52px] text-right',
          up ? 'text-[#34d399]' : 'text-[#f87171]',
          pctAbs >= 3 ? 'font-black' : '',
        ].join(' ')}>
          {up ? '+' : ''}{stock.percent_change.toFixed(2)}%
        </span>
      </div>
    </div>
  )
}

type Tab = 'gainers' | 'losers' | 'active'

const TABS: { key: Tab; label: string; icon: typeof TrendingUp; color: string }[] = [
  { key: 'gainers', label: 'Tăng mạnh',      icon: TrendingUp,  color: 'text-[#34d399]' },
  { key: 'losers',  label: 'Giảm mạnh',      icon: TrendingDown, color: 'text-[#f87171]' },
  { key: 'active',  label: 'Thanh khoản cao', icon: Flame,       color: 'text-[#f59e0b]' },
]

interface MoversPanelProps {
  gainers: MarketMover[]
  losers: MarketMover[]
  mostActive?: MarketMover[]
  loading?: boolean
  onExplain: (req: AIExplainRequest) => void
}

export function MoversPanel({ gainers, losers, mostActive, loading, onExplain }: MoversPanelProps) {
  const [tab, setTab] = useState<Tab>('gainers')

  const items =
    tab === 'gainers' ? gainers
    : tab === 'losers' ? losers
    : mostActive ?? []

  const showVol = tab === 'active'

  return (
    <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] overflow-hidden shadow-md shadow-black/40">
      {/* Tab bar */}
      <div className="flex items-center border-b border-[rgba(79,142,247,0.12)] px-1 pt-1 gap-0.5">
        {TABS.filter((t) => t.key !== 'active' || mostActive).map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={[
              'flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-t-lg transition-all duration-150 border-b-2',
              tab === key
                ? `${color} border-current bg-[#0e1726]`
                : 'text-[#7a8ba8] border-transparent hover:text-foreground hover:bg-[#0e1726]/50',
            ].join(' ')}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* Rows */}
      {loading ? (
        <TableRowSkeleton rows={5} />
      ) : items.length === 0 ? (
        <div className="px-4 py-8 text-center text-[13px] text-[#7a8ba8]">Không có dữ liệu</div>
      ) : (
        <div>
          {items.slice(0, 6).map((s) => (
            <MoverRow key={s.symbol} stock={s} showVol={showVol} onExplain={onExplain} />
          ))}
        </div>
      )}
    </div>
  )
}
