'use client'

import { useEffect, useState } from 'react'
import { getNewsIntelligence, getStockHistory } from '@/lib/api'
import { HERO_NEWS, HERO_SERIES } from '@/lib/demo-market'
import { DataNote } from '@/components/fs'
import { PriceNewsChart, type ChartPin, type ChartPoint } from '@/components/charts/PriceNewsChart'

type Live = { symbol: string; series: ChartPoint[]; pins: ChartPin[]; note: React.ReactNode }

const MIN_PINS = 3

async function loadLive(): Promise<Live | null> {
  const news = await getNewsIntelligence({ limit: 50 })
  const bySymbol = new Map<string, { id: string; category: string; headline: string; date: string; reaction: number }[]>()
  for (const item of news.items) {
    for (const r of item.reactions ?? []) {
      if (r.status !== 'measured' || r.dataMode !== 'market-provider') continue
      if (r.t1.abnormalReturnPct == null || !r.eventTradeDate) continue
      const list = bySymbol.get(r.symbol) ?? []
      list.push({
        id: `${item.id}-${r.symbol}`,
        category: item.category || 'Tin tức',
        headline: item.headline,
        date: r.eventTradeDate.slice(0, 10),
        reaction: r.t1.abnormalReturnPct,
      })
      bySymbol.set(r.symbol, list)
    }
  }
  const best = [...bySymbol.entries()].sort((a, b) => b[1].length - a[1].length)[0]
  if (!best || best[1].length < MIN_PINS) return null

  const [symbol, events] = best
  const history = await getStockHistory(symbol, 120)
  const series: ChartPoint[] = history.candles
    .filter((c) => c.time && c.close != null)
    .map((c) => ({ date: (c.time as string).slice(0, 10), close: c.close }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const seen = new Set<number>()
  const pins: ChartPin[] = []
  for (const e of events) {
    const index = series.findIndex((p) => p.date === e.date)
    if (index < 0 || seen.has(index)) continue
    seen.add(index)
    pins.push({ id: e.id, index, category: e.category, headline: e.headline, reaction: e.reaction })
  }
  if (pins.length < MIN_PINS) return null
  pins.sort((a, b) => a.index - b.index)
  return {
    symbol,
    series,
    pins,
    note: <DataNote dataMode={history.data_mode} asOf={history.updated_at} source={history.source} />,
  }
}

export function HeroChart() {
  const [live, setLive] = useState<Live | null>(null)

  useEffect(() => {
    let alive = true
    loadLive()
      .then((r) => alive && r && setLive(r))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  if (live) {
    return <PriceNewsChart series={live.series} pins={live.pins} label={live.symbol} note={live.note} />
  }
  return <PriceNewsChart series={HERO_SERIES} pins={HERO_NEWS} label="VN-Index" note="Ví dụ minh hoạ" />
}
