'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { NewsCard, classifyImpact } from '@/components/news/NewsCard'
import type { ImpactClass } from '@/components/news/NewsCard'
import { ExplainPanel } from '@/components/ai/ExplainPanel'
import { ChatWidget } from '@/components/ai/ChatWidget'
import { Skeleton } from '@/components/shared/Skeleton'
import { getNewsIntelligence } from '@/lib/api'
import type { NewsItem, AIExplainRequest } from '@/lib/api'

// ── Filter config ──────────────────────────────────────────────

const IMPACT_FILTERS: { key: ImpactClass | 'all'; label: string }[] = [
  { key: 'all',      label: 'Tất cả'   },
  { key: 'positive', label: 'Tích cực' },
  { key: 'negative', label: 'Tiêu cực' },
  { key: 'watch',    label: 'Theo dõi' },
  { key: 'neutral',  label: 'Trung lập'},
]

const IMPACT_BAR: Record<ImpactClass, string> = {
  positive: 'bg-[#34d399]',
  negative: 'bg-[#f87171]',
  watch:    'bg-[#f59e0b]',
  neutral:  'bg-[#3d4f6b]',
}

const IMPACT_TEXT: Record<ImpactClass, string> = {
  positive: 'text-[#34d399]',
  negative: 'text-[#f87171]',
  watch:    'text-[#f59e0b]',
  neutral:  'text-[#7a8ba8]',
}

const IMPACT_LABEL: Record<ImpactClass, string> = {
  positive: 'Tích cực',
  negative: 'Tiêu cực',
  watch:    'Theo dõi',
  neutral:  'Trung lập',
}

const IMPACT_ACTIVE: Record<ImpactClass, string> = {
  positive: 'bg-[#34d399]/15 text-[#34d399] border-[#34d399]/30',
  negative: 'bg-[#f87171]/15 text-[#f87171] border-[#f87171]/30',
  watch:    'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30',
  neutral:  'bg-[#1a2744] text-[#9baac0] border-[#1e3158]',
}

// ── Page ──────────────────────────────────────────────────────

export default function NewsPage() {
  const [items,      setItems]      = useState<NewsItem[]>([])
  const [updatedAt,  setUpdatedAt]  = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)

  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [impactFilter, setImpactFilter] = useState<ImpactClass | 'all'>('all')

  const [explainOpen, setExplainOpen] = useState(false)
  const [explainReq,  setExplainReq]  = useState<AIExplainRequest | null>(null)

  const handleExplain = useCallback((req: AIExplainRequest) => {
    setExplainReq(req); setExplainOpen(true)
  }, [])

  const fetchNews = useCallback(() => {
    setLoading(true)
    getNewsIntelligence()
      .then((res) => {
        if (res?.items?.length) setItems(res.items)
        if (res?.updated_at) setUpdatedAt(res.updated_at)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchNews() }, [fetchNews])

  const sources = useMemo(
    () => ['all', ...Array.from(new Set(items.map((i) => i.source)))],
    [items]
  )

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false
      if (impactFilter !== 'all' && classifyImpact(item.marketImpact) !== impactFilter) return false
      return true
    })
  }, [items, sourceFilter, impactFilter])

  const impactCounts = useMemo(() => {
    const counts: Record<ImpactClass, number> = { positive: 0, negative: 0, watch: 0, neutral: 0 }
    items.forEach((i) => { counts[classifyImpact(i.marketImpact)]++ })
    return counts
  }, [items])

  const topTickers = useMemo(() => {
    const counts: Record<string, number> = {}
    items.forEach((i) => {
      i.affectedTickers.forEach((t) => { counts[t] = (counts[t] ?? 0) + 1 })
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [items])

  const formattedUpdated = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <>
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-5 space-y-4">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">News Intelligence</h1>
            <p className="text-xs text-[#7a8ba8] mt-0.5">
              Tin tài chính được AI phân tích tác động lên thị trường và ngành
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {!loading && formattedUpdated && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#7a8ba8]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] live-dot" />
                <span>Cập nhật {formattedUpdated}</span>
              </div>
            )}
            <button
              type="button"
              onClick={fetchNews}
              disabled={loading}
              className="flex items-center gap-1.5 text-[11px] text-[#7a8ba8] hover:text-foreground transition-colors disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-[#0e1726] border border-[#1a2744]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-x-5">

          {/* Source filter */}
          {sources.length > 2 && (
            <div className="overflow-x-auto pb-0.5 -mb-0.5 scrollbar-none">
              <div className="flex items-center gap-1.5 min-w-max">
                <span className="text-[11px] font-semibold text-[#3d4f6b] mr-0.5">Nguồn</span>
                {sources.map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setSourceFilter(src)}
                    className={[
                      'text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors',
                      sourceFilter === src
                        ? 'bg-primary text-white border-primary'
                        : 'border-[#1a2744] text-[#7a8ba8] hover:border-primary/40 hover:text-foreground',
                    ].join(' ')}
                  >
                    {src === 'all' ? 'Tất cả' : src}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Impact filter */}
          <div className="overflow-x-auto pb-0.5 -mb-0.5 scrollbar-none">
            <div className="flex items-center gap-1.5 min-w-max">
              <span className="text-[11px] font-semibold text-[#3d4f6b] mr-0.5">Tác động</span>
              {IMPACT_FILTERS.map(({ key, label }) => {
                const active = impactFilter === key
                const activeClass = key === 'all'
                  ? 'bg-primary text-white border-primary'
                  : active && key !== ('all' as string)
                    ? IMPACT_ACTIVE[key as ImpactClass]
                    : 'border-[#1a2744] text-[#7a8ba8] hover:border-primary/40 hover:text-foreground'
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setImpactFilter(key)}
                    className={[
                      'text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors',
                      active ? activeClass : 'border-[#1a2744] text-[#7a8ba8] hover:border-primary/40 hover:text-foreground',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* News feed */}
          <div className="lg:col-span-2 rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] overflow-hidden shadow-lg shadow-black/50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(79,142,247,0.12)]">
              <span className="text-[13px] font-bold text-foreground">Bản tin</span>
              {!loading && (
                <span className="text-[11px] text-[#7a8ba8] bg-[#1a2744] rounded-md px-2 py-0.5 font-medium tabular">
                  {filtered.length}/{items.length}
                </span>
              )}
            </div>

            <div>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 space-y-2.5 border-b border-[#0f1f3d] last:border-0">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-4 w-28 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <div className="flex gap-1.5 pt-0.5">
                      <Skeleton className="h-5 w-10 rounded" />
                      <Skeleton className="h-5 w-10 rounded" />
                    </div>
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <div className="px-5 py-12 text-center text-[13px] text-[#7a8ba8]">
                  {items.length === 0
                    ? 'Chưa có tin tức. Đang kết nối nguồn...'
                    : 'Không có tin tức phù hợp với bộ lọc đã chọn.'}
                </div>
              ) : (
                filtered.map((item) => (
                  <NewsCard key={item.id} item={item} onExplain={handleExplain} />
                ))
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">

            {/* Impact overview */}
            <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] p-4 space-y-3">
              <h3 className="text-[13px] font-bold text-foreground">Phân tích tác động</h3>

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-4" />
                      </div>
                      <Skeleton className="h-1.5 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {(Object.entries(impactCounts) as [ImpactClass, number][])
                    .sort((a, b) => b[1] - a[1])
                    .map(([cls, count]) => {
                      const pct = items.length > 0 ? (count / items.length) * 100 : 0
                      return (
                        <div key={cls}>
                          <div className="flex justify-between items-center mb-1">
                            <span className={`text-[12px] font-semibold ${IMPACT_TEXT[cls]}`}>
                              {IMPACT_LABEL[cls]}
                            </span>
                            <span className="text-[11px] font-bold text-[#7a8ba8] tabular">{count}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#1a2744] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${IMPACT_BAR[cls]}`}
                              style={{ width: `${pct}%`, opacity: 0.75 }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>

            {/* Most mentioned tickers */}
            <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] p-4 space-y-3">
              <h3 className="text-[13px] font-bold text-foreground">Mã được nhắc đến</h3>

              {loading ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-12 rounded" />
                  ))}
                </div>
              ) : topTickers.length === 0 ? (
                <p className="text-[12px] text-[#7a8ba8]">Không có dữ liệu</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {topTickers.map(([ticker, count]) => (
                    <a
                      key={ticker}
                      href={`/stock/${ticker}`}
                      className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/8 border border-primary/20 rounded px-2 py-1 hover:bg-primary/15 transition-colors"
                    >
                      <span>{ticker}</span>
                      {count > 1 && (
                        <span className="text-[9px] font-black text-primary/50">x{count}</span>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ExplainPanel isOpen={explainOpen} onClose={() => setExplainOpen(false)} request={explainReq} />
      <ChatWidget
        contextData={{
          type: 'news',
          title: 'News Intelligence',
          data: { items: items.slice(0, 5) },
        }}
      />
    </>
  )
}
