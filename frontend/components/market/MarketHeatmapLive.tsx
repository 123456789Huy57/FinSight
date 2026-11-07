'use client'

import { useCallback, useEffect, useState } from 'react'
import { getScreenerData, type ScreenerResponse } from '@/lib/api'
import { dataModeLabel, formatDataAsOf } from '@/lib/format'
import { EmptyState } from '@/components/fs'
import { MarketHeatmap, type HeatmapItem } from './MarketHeatmap'

// Backend giới hạn limit tối đa 200 cho /api/v1/stocks.
const MAX_LIMIT = 200

function toItems(res: ScreenerResponse): HeatmapItem[] {
  return res.stocks
    .filter((s) => s.percent_change != null)
    .map((s) => ({
      symbol: s.symbol,
      name: s.name ?? undefined,
      sector: s.sector || 'Khác',
      cap: s.market_cap ?? null,
      value: s.trading_value ?? (s.current_price && s.volume ? s.current_price * s.volume : null),
      price: s.current_price,
      change: s.percent_change as number,
    }))
}

export function MarketHeatmapLive({ height = 520 }: { height?: number }) {
  const [res, setRes] = useState<ScreenerResponse | null>(null)
  const [failed, setFailed] = useState(false)
  const [tick, setTick] = useState(0)

  const load = useCallback(() => {
    setFailed(false)
    setRes(null)
    setTick((n) => n + 1)
  }, [])

  useEffect(() => {
    let alive = true
    getScreenerData({ limit: MAX_LIMIT, sort: 'marketCap' })
      .then((r) => alive && setRes(r))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [tick])

  if (failed) {
    return (
      <div className="rounded-xl border border-[var(--fs-line)] bg-[var(--fs-surface)]" style={{ minHeight: height }}>
        <EmptyState title="Chưa tải được dữ liệu thị trường" action={{ label: 'Thử lại', onClick: load }} />
      </div>
    )
  }
  if (!res) {
    return <div className="rounded-xl bg-[var(--fs-surface)]" style={{ height }} aria-busy="true" />
  }
  const items = toItems(res)
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--fs-line)] bg-[var(--fs-surface)]" style={{ minHeight: height }}>
        <EmptyState title="Chưa có dữ liệu thị trường" action={{ label: 'Thử lại', onClick: load }} />
      </div>
    )
  }
  return (
    <MarketHeatmap
      data={items}
      height={height}
      note={
        <span title={res.source ? `Nguồn: ${res.source}` : undefined}>
          {dataModeLabel(res.data_mode)}, tính đến {formatDataAsOf(res.updated_at)}
        </span>
      }
    />
  )
}
