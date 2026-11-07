'use client'

import Link from 'next/link'
import type { MarketMover, AIExplainRequest } from '@/lib/api'
import { ExplainButton } from '@/components/shared/ExplainButton'
import { TableRowSkeleton } from '@/components/shared/Skeleton'
import { Panel, Change, EmptyState } from '@/components/fs'
import { fmtPrice } from '@/lib/format'

function MoverRow({ stock, onExplain }: {
  stock: MarketMover
  onExplain: (req: AIExplainRequest) => void
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-[var(--fs-surface)]">
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0">
          <Link href={`/stock/${stock.symbol}`} className="text-[14px] font-medium">{stock.symbol}</Link>
          <div className="text-[12px] text-[var(--fs-muted)]">{stock.exchange}</div>
        </div>
        <ExplainButton
          onClick={() => onExplain({
            type: 'stock', title: stock.symbol, symbol: stock.symbol,
            context: `Giá: ${fmtPrice(stock.current_price, 0)}, Biến động: ${stock.percent_change == null ? 'không có dữ liệu' : `${stock.percent_change >= 0 ? '+' : ''}${stock.percent_change.toFixed(2)}%`}`,
            snapshot: { symbol: stock.symbol, exchange: stock.exchange, current_price: stock.current_price, price_change: stock.price_change, percent_change: stock.percent_change, volume: stock.volume },
          })}
        />
      </div>
      <div className="text-right tabular-nums">
        <div className="text-[14px]">{fmtPrice(stock.current_price, 0)}</div>
        <div className="text-[12px]"><Change value={stock.percent_change} /></div>
      </div>
    </li>
  )
}

function MoverList({ title, items, loading, onExplain, className }: {
  title: string
  items: MarketMover[]
  loading?: boolean
  onExplain: (req: AIExplainRequest) => void
  className?: string
}) {
  return (
    <Panel title={title} className={className}>
      {loading ? (
        <TableRowSkeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyState title="Chưa có dữ liệu" />
      ) : (
        <ul className="divide-y divide-[var(--fs-line)]">
          {items.slice(0, 6).map((s) => (
            <MoverRow key={s.symbol} stock={s} onExplain={onExplain} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

interface MoversPanelProps {
  gainers: MarketMover[]
  losers: MarketMover[]
  mostActive?: MarketMover[]
  loading?: boolean
  onExplain: (req: AIExplainRequest) => void
}

// Hai khung độc lập (tăng mạnh nhất, giảm mạnh nhất) nằm trong lưới 3 cột của trang.
export function MoversPanel({ gainers, losers, loading, onExplain }: MoversPanelProps) {
  return (
    <>
      <MoverList title="Tăng mạnh nhất" items={gainers} loading={loading} onExplain={onExplain} className="lg:col-span-4" />
      <MoverList title="Giảm mạnh nhất" items={losers} loading={loading} onExplain={onExplain} className="lg:col-span-4" />
    </>
  )
}
