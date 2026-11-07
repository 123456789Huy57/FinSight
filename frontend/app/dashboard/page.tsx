'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { MarketTicker } from '@/components/layout/MarketTicker'
import { IndexStrip } from '@/components/dashboard/IndexCard'
import { MoversPanel } from '@/components/dashboard/MoversPanel'
import { CommentaryPanel } from '@/components/dashboard/CommentaryPanel'
import { BreadthPanel, SectorPanel } from '@/components/dashboard/BreadthSectorPanel'
import { Watchlist } from '@/components/dashboard/Watchlist'
import { NewsPanel } from '@/components/dashboard/NewsPanel'
import { ExplainPanel } from '@/components/ai/ExplainPanel'
import { ChatWidget } from '@/components/ai/ChatWidget'
import { MarketStatusBadge } from '@/components/shared/MarketStatusBadge'
import { useMarketPolling } from '@/lib/useMarketPolling'
import { formatDataAsOf } from '@/lib/format'

import {
  getMarketIndices,
  getMostActive,
  getMarketCommentary,
  getNewsIntelligence,
} from '@/lib/api'
import type {
  MarketIndex,
  MarketMover,
  MarketBreadth,
  SectorPerformanceResponse,
  MostActiveResponse,
  MarketCommentaryResponse,
  NewsItem,
  AIExplainRequest,
} from '@/lib/api'

const DEMO_LOSERS: MarketMover[] = [
  { symbol: 'HNG', exchange: 'HOSE', current_price: 8800,  price_change: -400,  percent_change: -4.35, volume: 2450000 },
  { symbol: 'PDR', exchange: 'HOSE', current_price: 22100, price_change: -700,  percent_change: -3.07, volume: 1450000 },
  { symbol: 'DXG', exchange: 'HOSE', current_price: 17150, price_change: -450,  percent_change: -2.56, volume: 5123000 },
  { symbol: 'VCI', exchange: 'HOSE', current_price: 48700, price_change: -1100, percent_change: -2.21, volume: 2890000 },
  { symbol: 'HCM', exchange: 'HOSE', current_price: 31400, price_change: -650,  percent_change: -2.03, volume: 1765000 },
]

// ─── Page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const [indices,    setIndices]    = useState<MarketIndex[]>([])
  const [gainers,    setGainers]    = useState<MarketMover[]>([])
  const [losers,     setLosers]     = useState<MarketMover[]>([])
  const [breadth,    setBreadth]    = useState<MarketBreadth | null>(null)
  const [sectors,    setSectors]    = useState<SectorPerformanceResponse | null>(null)
  const [mostActive, setMostActive] = useState<MostActiveResponse | null>(null)
  const [commentary, setCommentary] = useState<MarketCommentaryResponse | null>(null)
  const [news,       setNews]       = useState<NewsItem[]>([])

  const [loadingMain,       setLoadingMain]       = useState(true)
  const [loadingCommentary, setLoadingCommentary] = useState(true)
  const [loadingNews,       setLoadingNews]       = useState(true)
  const [lastUpdated,       setLastUpdated]       = useState<string | null>(null)
  const [syntheticData,     setSyntheticData]     = useState(false)

  const [explainOpen, setExplainOpen] = useState(false)
  const [explainReq,  setExplainReq]  = useState<AIExplainRequest | null>(null)

  const handleExplain = useCallback((req: AIExplainRequest) => {
    setExplainReq(req)
    setExplainOpen(true)
  }, [])

  const aiContext = useMemo(() => ({
    type: 'dashboard',
    title: 'FinSight Market Dashboard',
    data: {
      mainIndex: indices[0],
      breadth,
      topGainers: gainers.slice(0, 5),
      topLosers: losers.slice(0, 5),
      leadingSectors: sectors?.leading?.slice(0, 5) ?? [],
      news: news.slice(0, 5),
    },
  }), [indices, breadth, gainers, losers, sectors, news])

  const fetchMain = useCallback(async (silent = false) => {
    // Keep rendered data visible during background polling; only the manual
    // first load should replace panels with loading states.
    if (!silent) {
      setLoadingMain(true)
      setLoadingCommentary(true)
      setLoadingNews(true)
    }
    try {
      const [idxRes, commentaryRes, actRes] = await Promise.allSettled([
        getMarketIndices(),
        getMarketCommentary(),
        getMostActive(),
      ])

      if (idxRes.status === 'fulfilled' && idxRes.value?.indices?.length)
        setIndices(idxRes.value.indices)
      if (idxRes.status === 'fulfilled')
        setSyntheticData(idxRes.value.data_mode === 'synthetic-demo')

      if (commentaryRes.status === 'fulfilled' && commentaryRes.value) {
        const data = commentaryRes.value
        setCommentary(data)
        if (data.top_gainers?.length) setGainers(data.top_gainers)
        if (data.top_losers?.length) setLosers(data.top_losers)
        if (data.breadth) setBreadth(data.breadth)
        if (data.leading_sectors || data.weak_sectors) {
          setSectors({
            updated_at: data.updated_at,
            leading: data.leading_sectors ?? [],
            weak: data.weak_sectors ?? [],
          })
        }
      }

      if (actRes.status === 'fulfilled' && actRes.value)
        setMostActive(actRes.value)

      try {
        const newsRes = await getNewsIntelligence()
        if (newsRes?.items?.length) setNews(newsRes.items)
      } catch {
        setNews([])
      }

      const timestamps = [
        idxRes.status === 'fulfilled' ? idxRes.value.timestamp : null,
        commentaryRes.status === 'fulfilled' ? commentaryRes.value?.updated_at : null,
        actRes.status === 'fulfilled' ? actRes.value?.updated_at : null,
      ].filter((value): value is string => Boolean(value))
      const parsed = timestamps
        .map((value) => ({ value, time: new Date(value).getTime() }))
        .filter((item) => !Number.isNaN(item.time))
      if (parsed.length) setLastUpdated(parsed.sort((a, b) => b.time - a.time)[0].value)
    } finally {
      if (!silent) {
        setLoadingMain(false)
        setLoadingCommentary(false)
        setLoadingNews(false)
      }
    }
  }, [])

  useEffect(() => {
    void fetchMain()
  }, [fetchMain])

  const marketStatus = useMarketPolling(() => fetchMain(true), 10_000)

  return (
    <>
      <MarketTicker indices={indices} />

      <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-4 space-y-4">

        {/* Status bar */}
        {syntheticData && (
          <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Dữ liệu minh họa tổng hợp, không phải giá thị trường thật.
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MarketStatusBadge status={marketStatus} />
            <span className="text-[11px] text-[#3d4f6b]">
              {lastUpdated
                ? `Dữ liệu phiên ${formatDataAsOf(lastUpdated)}`
                : 'Đang tải...'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void fetchMain()}
            disabled={loadingMain}
            className="flex items-center gap-1.5 text-[11px] text-[#7a8ba8] hover:text-foreground transition-colors disabled:opacity-40 px-2 py-1 rounded-md hover:bg-[#0e1726]"
          >
            <RefreshCw className={`w-3 h-3 ${loadingMain ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>

        {/* Index strip */}
        <IndexStrip indices={indices} onExplain={handleExplain} />

        {/* Main 3-col grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left — wider column */}
          <div className="lg:col-span-2 space-y-4">
            <CommentaryPanel
              commentary={commentary}
              loading={loadingCommentary}
              onExplain={handleExplain}
            />

            <MoversPanel
              gainers={gainers}
              losers={losers}
              mostActive={mostActive?.stocks}
              loading={loadingMain}
              onExplain={handleExplain}
            />

            <NewsPanel
              items={news}
              loading={loadingNews}
              onExplain={handleExplain}
            />
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            <BreadthPanel
              breadth={breadth}
              loading={loadingMain}
              onExplain={handleExplain}
            />
            <SectorPanel
              leading={sectors?.leading ?? []}
              weak={sectors?.weak ?? []}
              loading={loadingMain}
              onExplain={handleExplain}
            />
            <Watchlist />
          </div>
        </div>
      </div>

      <ExplainPanel
        isOpen={explainOpen}
        onClose={() => setExplainOpen(false)}
        request={explainReq}
      />

      <ChatWidget contextData={aiContext} />
    </>
  )
}
