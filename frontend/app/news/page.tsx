'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { NewsCard, classifyImpact } from '@/components/news/NewsCard'
import type { ImpactClass } from '@/components/news/NewsCard'
import { ExplainPanel } from '@/components/ai/ExplainPanel'
import { ChatWidget } from '@/components/ai/ChatWidget'
import { Skeleton } from '@/components/shared/Skeleton'
import { Panel, PageHeader, Segmented } from '@/components/fs'
import { getNewsIntelligence } from '@/lib/api'
import type { NewsItem, AIExplainRequest } from '@/lib/api'

// ── Filter config ──────────────────────────────────────────────

const IMPACT_FILTERS: { value: ImpactClass | 'all'; label: string }[] = [
  { value: 'all',      label: 'Tất cả'   },
  { value: 'positive', label: 'Tích cực' },
  { value: 'negative', label: 'Tiêu cực' },
  { value: 'watch',    label: 'Theo dõi' },
  { value: 'neutral',  label: 'Trung lập'},
]

const IMPACT_LABEL: Record<ImpactClass, string> = {
  positive: 'Tích cực',
  negative: 'Tiêu cực',
  watch:    'Theo dõi',
  neutral:  'Trung lập',
}

const FIELD =
  'h-9 rounded-lg border border-[var(--fs-line)] bg-white px-3 text-[13px] text-[var(--fs-ink)] placeholder:text-[var(--fs-muted)] focus:outline-none focus-visible:border-[var(--fs-signal)]'

// ── Page ──────────────────────────────────────────────────────

export default function NewsPage() {
  const [items,      setItems]      = useState<NewsItem[]>([])
  const [updatedAt,  setUpdatedAt]  = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [feedStatus, setFeedStatus] = useState<'disabled' | 'available' | 'no_data' | null>(null)
  const [feedSource, setFeedSource] = useState<string | null>(null)
  const [feedDataMode, setFeedDataMode] = useState<string | null>(null)
  const [feedAsOf, setFeedAsOf] = useState<string | null>(null)

  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [impactFilter, setImpactFilter] = useState<ImpactClass | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [symbolFilter, setSymbolFilter] = useState('')
  const [filtersReady, setFiltersReady] = useState(false)

  const [explainOpen, setExplainOpen] = useState(false)
  const [explainReq,  setExplainReq]  = useState<AIExplainRequest | null>(null)

  const handleExplain = useCallback((req: AIExplainRequest) => {
    setExplainReq(req); setExplainOpen(true)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sentiment = params.get('sentiment')
    if (sentiment === 'positive' || sentiment === 'negative' || sentiment === 'neutral') setImpactFilter(sentiment)
    if (sentiment === 'watch') setImpactFilter('watch')
    if (params.has('source')) setSourceFilter(params.get('source') || 'all')
    setSearchQuery(params.get('q') ?? '')
    setCategoryFilter(params.get('category') ?? '')
    setSymbolFilter(params.get('symbol') ?? '')
    setFiltersReady(true)
  }, [])

  useEffect(() => {
    if (!filtersReady) return
    const params = new URLSearchParams()
    if (searchQuery.trim()) params.set('q', searchQuery.trim())
    if (categoryFilter) params.set('category', categoryFilter)
    if (impactFilter !== 'all') params.set('sentiment', impactFilter)
    if (symbolFilter.trim()) params.set('symbol', symbolFilter.trim().toUpperCase())
    if (sourceFilter !== 'all') params.set('source', sourceFilter)
    const query = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
  }, [filtersReady, searchQuery, categoryFilter, impactFilter, symbolFilter, sourceFilter])

  const fetchNews = useCallback(() => {
    setLoading(true)
    setError(null)
    getNewsIntelligence({
      q: searchQuery.trim() || undefined,
      category: categoryFilter || undefined,
      sentiment: impactFilter === 'all' || impactFilter === 'watch' ? undefined : impactFilter,
      symbol: symbolFilter.trim() || undefined,
      limit: 200,
    })
      .then((res) => {
        setItems(res?.items ?? [])
        setFeedStatus(res?.status ?? null)
        setFeedSource(res?.source ?? null)
        setFeedDataMode(res?.data_mode ?? null)
        setFeedAsOf(res?.as_of ?? null)
        if (res?.updated_at) setUpdatedAt(res.updated_at)
        else setUpdatedAt(null)
      })
      .catch(() => setError('Không tải được dữ liệu tin. Vui lòng thử lại.'))
      .finally(() => setLoading(false))
  }, [searchQuery, categoryFilter, impactFilter, symbolFilter])

  useEffect(() => {
    if (!filtersReady) return
    const timer = window.setTimeout(fetchNews, 250)
    return () => window.clearTimeout(timer)
  }, [fetchNews, filtersReady])

  const sources = useMemo(
    () => ['all', ...Array.from(new Set(items.map((i) => i.source)))],
    [items]
  )
  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category).filter((value): value is string => Boolean(value)))).sort(),
    [items],
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

  return (
    <>
      <div className="mx-auto max-w-screen-2xl space-y-5 px-4 py-6 lg:px-8">

        <PageHeader
          title="Tin tức"
          dataMode={feedDataMode}
          asOf={feedAsOf ?? updatedAt}
          source={feedSource}
          actions={
            <button
              type="button"
              onClick={fetchNews}
              disabled={loading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--fs-line)] bg-white px-3 text-[13px] text-[var(--fs-ink-2)] hover:bg-[var(--fs-surface)] disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          }
        />

        {(feedStatus === 'no_data' || feedStatus === 'disabled') && (
          <p role="status" className="text-[13px] text-[var(--fs-muted)]">
            {feedStatus === 'no_data' ? 'Nguồn tin đang rỗng hoặc chưa có tin mới.' : 'Nguồn tin đang tắt.'}
          </p>
        )}

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--fs-line)] bg-white px-4 py-3 text-[13px] text-[var(--fs-down)]">
            <span>{error}</span>
            <button type="button" onClick={fetchNews} className="font-medium text-[var(--fs-signal)] underline underline-offset-2">Thử lại</button>
          </div>
        )}

        {/* Filter bar */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm nội dung tin"
              aria-label="Tìm tin theo nội dung"
              className={`${FIELD} w-full sm:w-64`}
            />
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="Lọc theo loại tin"
              className={FIELD}
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <input
              type="text"
              value={symbolFilter}
              onChange={(event) => setSymbolFilter(event.target.value.toUpperCase())}
              placeholder="Lọc mã"
              aria-label="Lọc tin theo mã cổ phiếu"
              maxLength={10}
              className={`${FIELD} w-24`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex max-w-full items-center gap-2">
              <span className="shrink-0 text-[13px] text-[var(--fs-muted)]">Sắc thái</span>
              <div className="overflow-x-auto">
                <Segmented
                  label="Lọc theo sắc thái"
                  options={IMPACT_FILTERS}
                  value={impactFilter}
                  onChange={setImpactFilter}
                />
              </div>
            </div>

            {sources.length > 2 && (
              <div className="flex max-w-full items-center gap-2">
                <span className="shrink-0 text-[13px] text-[var(--fs-muted)]">Nguồn</span>
                <div className="overflow-x-auto">
                  <Segmented
                    label="Lọc theo nguồn"
                    options={sources.map((src) => ({ value: src, label: src === 'all' ? 'Tất cả' : src }))}
                    value={sourceFilter}
                    onChange={setSourceFilter}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* News feed */}
          <div className="lg:col-span-2">
            <Panel title="Bản tin" aside={!loading ? <span className="tabular-nums">{filtered.length}/{items.length}</span> : undefined}>
              <div>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-2.5 border-b border-[var(--fs-line)] px-5 py-4 last:border-0">
                      <Skeleton className="h-3 w-24" />
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
                  <div className="px-5 py-12 text-center text-[14px] text-[var(--fs-muted)]">
                    {items.length === 0
                      ? feedStatus === 'disabled'
                        ? 'Nguồn tin chưa được bật.'
                        : searchQuery.trim() || categoryFilter || symbolFilter.trim() || impactFilter !== 'all' || sourceFilter !== 'all'
                          ? 'Không có tin phù hợp với bộ lọc đã chọn.'
                          : feedStatus === 'no_data' ? 'Nguồn tin hiện chưa có bài khả dụng.' : 'Chưa có dữ liệu tin.'
                      : 'Không có tin tức phù hợp với bộ lọc đã chọn.'}
                  </div>
                ) : (
                  filtered.map((item) => (
                    <NewsCard key={item.id} item={item} onExplain={handleExplain} />
                  ))
                )}
              </div>
              {!loading && filtered.length > 0 && (
                <p className="border-t border-[var(--fs-line)] px-5 py-3 text-[13px] text-[var(--fs-muted)]">
                  T+1/T+5 là biến động so với VN-Index, không khẳng định nhân quả. Sắc thái chấm bằng từ điển từ khoá.
                </p>
              )}
            </Panel>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">

            <Panel title="Sắc thái theo từ khoá">
              <div className="space-y-3 p-5">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-4" />
                      </div>
                      <Skeleton className="h-1.5 w-full rounded-full" />
                    </div>
                  ))
                ) : (
                  (Object.entries(impactCounts) as [ImpactClass, number][])
                    .sort((a, b) => b[1] - a[1])
                    .map(([cls, count]) => {
                      const pct = items.length > 0 ? (count / items.length) * 100 : 0
                      return (
                        <div key={cls}>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-[13px] text-[var(--fs-ink-2)]">{IMPACT_LABEL[cls]}</span>
                            <span className="text-[13px] text-[var(--fs-muted)] tabular-nums">{count}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--fs-surface)]">
                            <div className="h-full rounded-full bg-[var(--fs-ink-2)]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </Panel>

            <Panel title="Mã được nhắc đến">
              <div className="p-5">
                {loading ? (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-6 w-12 rounded" />
                    ))}
                  </div>
                ) : topTickers.length === 0 ? (
                  <p className="text-[13px] text-[var(--fs-muted)]">Chưa có dữ liệu</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {topTickers.map(([ticker, count]) => (
                      <a
                        key={ticker}
                        href={`/stock/${ticker}`}
                        className="inline-flex items-center gap-1 rounded-md bg-[var(--fs-signal-soft)] px-2 py-1 text-[13px] font-medium text-[var(--fs-signal)]"
                      >
                        <span>{ticker}</span>
                        {count > 1 && <span className="text-[12px] tabular-nums">{count}</span>}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <ExplainPanel isOpen={explainOpen} onClose={() => setExplainOpen(false)} request={explainReq} />
      <ChatWidget
        contextData={{
          type: 'news',
          title: 'Tin tức',
          data: { items: items.slice(0, 5) },
        }}
      />
    </>
  )
}
