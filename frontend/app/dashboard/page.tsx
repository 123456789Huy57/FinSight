'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { IndexStrip } from '@/components/dashboard/IndexCard'
import { MoversPanel } from '@/components/dashboard/MoversPanel'
import { CommentaryPanel } from '@/components/dashboard/CommentaryPanel'
import { BreadthPanel, SectorPanel } from '@/components/dashboard/BreadthSectorPanel'
import { Watchlist } from '@/components/dashboard/Watchlist'
import { NewsPanel } from '@/components/dashboard/NewsPanel'
import { ExplainPanel } from '@/components/ai/ExplainPanel'
import { ChatWidget } from '@/components/ai/ChatWidget'
import { PageHeader } from '@/components/fs'
import { MarketHeatmapLive } from '@/components/market/MarketHeatmapLive'
import { MarketStatusBadge } from '@/components/shared/MarketStatusBadge'
import { useMarketPolling } from '@/lib/useMarketPolling'

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
      <div className="min-h-screen bg-[var(--fs-surface)] text-[var(--fs-ink)]">
        <main className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6">
          <PageHeader
            title="Tổng quan thị trường"
            dataMode={indices[0]?.data_mode}
            asOf={lastUpdated}
            source={indices[0]?.source}
            actions={
              <>
                <MarketStatusBadge status={marketStatus} />
                <button
                  type="button"
                  onClick={() => void fetchMain()}
                  disabled={loadingMain}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--fs-line)] bg-white px-3 text-[13px] hover:bg-[var(--fs-surface)] disabled:opacity-40"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingMain ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
              </>
            }
          />

          {syntheticData && (
            <p role="status" className="mt-3 text-[13px] text-[var(--fs-ink-2)]">
              Đây là dữ liệu minh hoạ, không phải giá thị trường thật.
            </p>
          )}

          <div className="mt-6 space-y-4">
            <IndexStrip indices={indices} onExplain={handleExplain} />

            <MarketHeatmapLive height={480} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <NewsPanel
                className="lg:col-span-8"
                items={news}
                loading={loadingNews}
                onExplain={handleExplain}
              />

              <div className="min-w-0 space-y-4 lg:col-span-4">
                <BreadthPanel breadth={breadth} loading={loadingMain} onExplain={handleExplain} />
                <SectorPanel
                  leading={sectors?.leading ?? []}
                  weak={sectors?.weak ?? []}
                  loading={loadingMain}
                  onExplain={handleExplain}
                />
                <CommentaryPanel commentary={commentary} loading={loadingCommentary} onExplain={handleExplain} />
              </div>

              <MoversPanel
                gainers={gainers}
                losers={losers}
                mostActive={mostActive?.stocks}
                loading={loadingMain}
                onExplain={handleExplain}
              />
              <Watchlist />
            </div>
          </div>

          <p className="mt-10 text-[12px] text-[var(--fs-muted)]">
            Thông tin chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.
          </p>
        </main>
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
