'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUp, ArrowDown, ArrowUpDown, RefreshCw, Search } from 'lucide-react'

import { BreadthPanel, SectorPanel } from '@/components/dashboard/BreadthSectorPanel'
import { ExplainPanel } from '@/components/ai/ExplainPanel'
import { ChatWidget } from '@/components/ai/ChatWidget'
import { Skeleton } from '@/components/shared/Skeleton'
import { getScreenerData, getMarketCommentary } from '@/lib/api'
import { formatDataAsOf } from '@/lib/format'
import type {
  ScreenerStock,
  MarketBreadth,
  SectorPerformanceResponse,
  AIExplainRequest,
} from '@/lib/api'

// ── Formatters ────────────────────────────────────────────────

function fmtPrice(v: number | null) {
  if (v == null) return '-'
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtChange(v: number | null) {
  if (v == null) return '-'
  const prefix = v >= 0 ? '+' : ''
  return `${prefix}${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function fmtVol(v: number | null) {
  if (v == null) return '-'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return `${v}`
}

// ── Filters ───────────────────────────────────────────────────

const EXCHANGES = ['Tất cả', 'HOSE', 'HNX', 'UPCOM'] as const
type ExchangeFilter = (typeof EXCHANGES)[number]

type ChangeFilter = 'all' | 'strong_up' | 'up' | 'down' | 'strong_down'

const CHANGE_OPTS: { key: ChangeFilter; label: string }[] = [
  { key: 'all',         label: 'Tất cả' },
  { key: 'strong_up',   label: '>= +3%'  },
  { key: 'up',          label: 'Tăng'   },
  { key: 'down',        label: 'Giảm'   },
  { key: 'strong_down', label: '<= -3%'  },
]

function matchChange(pct: number | null, f: ChangeFilter): boolean {
  if (f === 'all') return true
  if (pct == null) return false
  if (f === 'strong_up')   return pct >= 3
  if (f === 'up')          return pct > 0 && pct < 3
  if (f === 'down')        return pct < 0 && pct > -3
  if (f === 'strong_down') return pct <= -3
  return true
}

// ── Sort ──────────────────────────────────────────────────────

type SortKey = keyof Pick<
  ScreenerStock,
  'symbol' | 'exchange' | 'sector' | 'current_price' | 'price_change' | 'percent_change' | 'volume'
>
type SortDir = 'asc' | 'desc'

function sortVal(s: ScreenerStock, key: SortKey): number | string {
  const v = s[key]
  if (v == null)
    return key === 'symbol' || key === 'exchange' || key === 'sector' ? '' : -Infinity
  return v
}

// ── Column definitions ────────────────────────────────────────

interface ColDef {
  key: SortKey
  label: string
  align: 'left' | 'right'
  thClass: string
  tdClass: string
  mobileHide?: boolean
}

const COLUMNS: ColDef[] = [
  { key: 'symbol',         label: 'Mã',       align: 'left',  thClass: 'w-[76px] pl-4',  tdClass: 'pl-4 pr-2' },
  { key: 'exchange',       label: 'Sàn',      align: 'left',  thClass: 'w-[68px]',        tdClass: 'px-2',      mobileHide: true },
  { key: 'sector',         label: 'Ngành',    align: 'left',  thClass: 'min-w-[130px]',   tdClass: 'px-2',      mobileHide: true },
  { key: 'current_price',  label: 'Giá',      align: 'right', thClass: 'w-[92px]',        tdClass: 'px-3'      },
  { key: 'price_change',   label: 'Thay đổi', align: 'right', thClass: 'w-[96px]',        tdClass: 'px-3',      mobileHide: true },
  { key: 'percent_change', label: '%',         align: 'right', thClass: 'w-[76px]',        tdClass: 'px-3'      },
  { key: 'volume',         label: 'KL',       align: 'right', thClass: 'w-[76px] pr-4',   tdClass: 'pr-4 pl-2' },
]

// ── Exchange badge colours ────────────────────────────────────

const EXCH_STYLE: Record<string, string> = {
  HOSE:  'bg-primary/10 text-primary border-primary/20',
  HNX:   'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20',
  UPCOM: 'bg-[#06b6d4]/10 text-[#06b6d4] border-[#06b6d4]/20',
}

// ── Subcomponents ─────────────────────────────────────────────

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col)
    return <ArrowUpDown className="w-3 h-3 opacity-20 ml-0.5 flex-shrink-0" />
  return sortDir === 'asc'
    ? <ArrowUp   className="w-3 h-3 text-primary ml-0.5 flex-shrink-0" />
    : <ArrowDown className="w-3 h-3 text-primary ml-0.5 flex-shrink-0" />
}

function ScreenerSkeleton() {
  return (
    <>
      {Array.from({ length: 14 }).map((_, i) => (
        <tr key={i} className="border-b border-[#0f1f3d]">
          {COLUMNS.map((col) => (
            <td key={col.key} className={`py-2.5 ${col.tdClass} ${col.mobileHide ? 'hidden sm:table-cell' : ''}`}>
              <Skeleton className={[
                'h-3',
                col.align === 'right' ? 'ml-auto' : '',
                col.key === 'sector' ? 'w-28' : col.key === 'symbol' ? 'w-10' : 'w-full',
              ].join(' ')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function MarketPage() {
  const [stocks,      setStocks]      = useState<ScreenerStock[]>([])
  const [breadth,     setBreadth]     = useState<MarketBreadth | null>(null)
  const [sectors,     setSectors]     = useState<SectorPerformanceResponse | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [syntheticData, setSyntheticData] = useState(false)
  const [dataSource, setDataSource] = useState<string | null>(null)

  const [explainOpen, setExplainOpen] = useState(false)
  const [explainReq,  setExplainReq]  = useState<AIExplainRequest | null>(null)
  const handleExplain = useCallback((req: AIExplainRequest) => {
    setExplainReq(req); setExplainOpen(true)
  }, [])

  const [exchange,     setExchange]     = useState<ExchangeFilter>('Tất cả')
  const [sector,       setSector]       = useState('Tất cả')
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>('all')
  const [symbolQuery,  setSymbolQuery]  = useState('')

  const [sortKey, setSortKey] = useState<SortKey>('percent_change')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filtersReady, setFiltersReady] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const queryExchange = params.get('exchange')
    const queryChange = params.get('change') as ChangeFilter | null
    const querySort = params.get('sort') as SortKey | null
    const validSorts: SortKey[] = ['symbol', 'exchange', 'sector', 'current_price', 'price_change', 'percent_change', 'volume']
    if (EXCHANGES.includes(queryExchange as ExchangeFilter)) setExchange(queryExchange as ExchangeFilter)
    if (params.has('sector')) setSector(params.get('sector') || 'Tất cả')
    if (queryChange && CHANGE_OPTS.some((option) => option.key === queryChange)) setChangeFilter(queryChange)
    if (querySort && validSorts.includes(querySort)) setSortKey(querySort)
    if (params.get('dir') === 'asc') setSortDir('asc')
    if (params.has('q')) setSymbolQuery(params.get('q') ?? '')
    setFiltersReady(true)
  }, [])

  useEffect(() => {
    if (!filtersReady) return
    const params = new URLSearchParams()
    if (symbolQuery.trim()) params.set('q', symbolQuery.trim())
    if (exchange !== 'Tất cả') params.set('exchange', exchange)
    if (sector !== 'Tất cả') params.set('sector', sector)
    if (changeFilter !== 'all') params.set('change', changeFilter)
    if (sortKey !== 'percent_change') params.set('sort', sortKey)
    if (sortDir !== 'desc') params.set('dir', sortDir)
    const query = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
  }, [filtersReady, symbolQuery, exchange, sector, changeFilter, sortKey, sortDir])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [screenerRes, commentaryRes] = await Promise.allSettled([
        getScreenerData({ q: symbolQuery.trim() || undefined, limit: 200 }),
        getMarketCommentary(),
      ])
      if (screenerRes.status === 'fulfilled') {
        setStocks(screenerRes.value.stocks)
        setSyntheticData(screenerRes.value.data_mode === 'synthetic-demo')
        setDataSource(screenerRes.value.source ?? null)
      } else {
        setError('Không tải được dữ liệu thị trường. Vui lòng thử lại.')
      }
      if (commentaryRes.status === 'fulfilled' && commentaryRes.value) {
        const d = commentaryRes.value
        if (d.breadth) setBreadth(d.breadth)
        if (d.leading_sectors || d.weak_sectors)
          setSectors({
            updated_at: d.updated_at,
            leading: d.leading_sectors ?? [],
            weak:    d.weak_sectors    ?? [],
          })
      }
      if (screenerRes.status === 'fulfilled' && screenerRes.value.updated_at) {
        const dataDate = new Date(screenerRes.value.updated_at)
        if (!Number.isNaN(dataDate.getTime())) setLastUpdated(screenerRes.value.updated_at)
      }
    } finally {
      setLoading(false)
    }
  }, [symbolQuery])

  useEffect(() => {
    if (!filtersReady) return
    const timer = window.setTimeout(() => { void fetchData() }, 250)
    return () => window.clearTimeout(timer)
  }, [fetchData, filtersReady])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'symbol' || key === 'exchange' || key === 'sector' ? 'asc' : 'desc')
    }
  }

  const allSectors = useMemo(() => {
    const set = new Set(stocks.map((s) => s.sector).filter(Boolean))
    return ['Tất cả', ...Array.from(set).sort()]
  }, [stocks])

  const displayed = useMemo(() => {
    let list = [...stocks]
    if (exchange !== 'Tất cả')  list = list.filter((s) => s.exchange === exchange)
    if (sector  !== 'Tất cả')   list = list.filter((s) => s.sector   === sector)
    if (changeFilter !== 'all') list = list.filter((s) => matchChange(s.percent_change, changeFilter))
    list.sort((a, b) => {
      const av = sortVal(a, sortKey)
      const bv = sortVal(b, sortKey)
      if (typeof av === 'string' && typeof bv === 'string')
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc'
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number)
    })
    return list
  }, [stocks, exchange, sector, changeFilter, sortKey, sortDir])

  return (
    <>
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-4">
        {syntheticData && (
          <div role="status" className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Dữ liệu minh họa tổng hợp, không phải giá thị trường thật.
          </div>
        )}
        {error && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-red-200">
            <span>{error}</span>
            <button type="button" onClick={() => void fetchData()} className="font-semibold underline underline-offset-2">Thử lại</button>
          </div>
        )}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

          {/* Screener panel */}
          <div className="xl:col-span-3">
            <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] overflow-hidden shadow-lg shadow-black/50">

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(79,142,247,0.12)]">
                <div className="flex items-center gap-2.5">
                  <span className="text-[13px] font-bold text-foreground">Bộ lọc cổ phiếu</span>
                  {!loading && (
                    <span className="text-[11px] text-[#7a8ba8] bg-[#1a2744] rounded-md px-2 py-0.5 font-medium tabular">
                      {displayed.length}/{stocks.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {lastUpdated && (
                    <span className="text-[10px] text-[#3d4f6b] hidden sm:block">
                      Phiên {formatDataAsOf(lastUpdated)}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label="Làm mới dữ liệu thị trường"
                    onClick={() => void fetchData()}
                    disabled={loading}
                    className="p-1.5 rounded-lg text-[#7a8ba8] hover:text-foreground hover:bg-[#0e1726] transition-colors disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Filter bar */}
              <div className="px-4 py-2.5 border-b border-[#0f1f3d] bg-[#070d1a] flex flex-wrap items-center gap-x-3 gap-y-2">

                {/* Exchange */}
                <div className="flex items-center gap-1">
                  {EXCHANGES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      aria-pressed={exchange === ex}
                      onClick={() => setExchange(ex)}
                      className={[
                        'text-[11px] font-semibold px-2.5 py-1 rounded-lg leading-none transition-colors',
                        exchange === ex
                          ? 'bg-primary text-white'
                          : 'text-[#7a8ba8] hover:text-foreground hover:bg-[#0e1726]',
                      ].join(' ')}
                    >
                      {ex}
                    </button>
                  ))}
                </div>

                <div className="w-px h-4 bg-[#1a2744] hidden sm:block" />

                {/* Sector */}
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="text-[11px] font-medium bg-[#0e1726] border border-[#1a2744] rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer leading-none"
                >
                  {allSectors.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <div className="w-px h-4 bg-[#1a2744] hidden sm:block" />

                {/* Change% */}
                <div className="flex items-center gap-1">
                  {CHANGE_OPTS.map((opt) => {
                    const active = changeFilter === opt.key
                    let activeClass = 'bg-primary text-white'
                    if (active && opt.key === 'strong_up')   activeClass = 'bg-[#34d399] text-[#052e16]'
                    if (active && opt.key === 'up')          activeClass = 'bg-[#34d399]/20 text-[#34d399] border border-[#34d399]/30'
                    if (active && opt.key === 'down')        activeClass = 'bg-[#f87171]/20 text-[#f87171] border border-[#f87171]/30'
                    if (active && opt.key === 'strong_down') activeClass = 'bg-[#f87171] text-white'
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        aria-pressed={changeFilter === opt.key}
                        onClick={() => setChangeFilter(opt.key)}
                        className={[
                          'text-[11px] font-semibold px-2.5 py-1 rounded-lg leading-none transition-colors',
                          active
                            ? activeClass
                            : 'text-[#7a8ba8] hover:text-foreground hover:bg-[#0e1726]',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>

                <div className="w-px h-4 bg-[#1a2744] hidden sm:block" />

                {/* Symbol search */}
                <div className="relative flex items-center">
                  <Search className="absolute left-2 w-3 h-3 text-[#3d4f6b] pointer-events-none" />
                  <input
                    type="text"
                    value={symbolQuery}
                    onChange={(e) => setSymbolQuery(e.target.value)}
                    aria-label="Tìm mã hoặc tên công ty"
                    placeholder="Mã / tên..."
                    className="pl-6 pr-2 py-1 text-[11px] bg-[#0e1726] border border-[#1a2744] rounded-lg text-foreground placeholder:text-[#3d4f6b] focus:outline-none focus:ring-1 focus:ring-primary w-24 leading-none"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[rgba(79,142,247,0.12)] bg-[#070d1a]">
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          scope="col"
                          aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                          className={[
                            'py-2.5 text-[11px] font-semibold uppercase tracking-wide select-none',
                            sortKey === col.key ? 'text-foreground' : 'text-[#3d4f6b] hover:text-[#9baac0]',
                            col.align === 'right' ? 'text-right' : 'text-left',
                            col.thClass,
                            col.mobileHide ? 'hidden sm:table-cell' : '',
                          ].join(' ')}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(col.key)}
                            className={`inline-flex w-full items-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded ${col.align === 'right' ? 'flex-row-reverse justify-start' : 'text-left'}`}
                          >
                            {col.label}<SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <ScreenerSkeleton />
                    ) : displayed.length === 0 ? (
                      <tr>
                        <td colSpan={COLUMNS.length} className="py-14 text-center text-sm text-[#7a8ba8]">
                          Không có kết quả phù hợp.
                        </td>
                      </tr>
                    ) : (
                      displayed.map((stock) => {
                        const pct    = stock.percent_change
                        const isUp   = (pct ?? 0) > 0
                        const isDown = (pct ?? 0) < 0
                        const strong = Math.abs(pct ?? 0) >= 3
                        const cc     = isUp ? 'text-[#34d399]' : isDown ? 'text-[#f87171]' : 'text-[#7a8ba8]'

                        return (
                          <tr key={stock.symbol} className="data-row group">
                            {/* Mã */}
                            <td className={`py-2.5 ${COLUMNS[0].tdClass}`}>
                              <Link
                                href={`/stock/${stock.symbol}`}
                                className="text-sm font-bold font-mono tracking-tight text-foreground group-hover:text-primary transition-colors"
                              >
                                {stock.symbol}
                              </Link>
                            </td>

                            {/* Sàn */}
                            <td className={`py-2.5 ${COLUMNS[1].tdClass} hidden sm:table-cell`}>
                              <span className={[
                                'text-[10px] font-semibold px-1.5 py-0.5 rounded border leading-none inline-block',
                                EXCH_STYLE[stock.exchange] ?? 'bg-[#1a2744] text-[#7a8ba8] border-[#1e3158]',
                              ].join(' ')}>
                                {stock.exchange}
                              </span>
                            </td>

                            {/* Ngành */}
                            <td className={`py-2.5 ${COLUMNS[2].tdClass} hidden sm:table-cell text-xs text-[#7a8ba8] truncate max-w-[160px]`}>
                              {stock.sector}
                            </td>

                            {/* Giá */}
                            <td className={`py-2.5 ${COLUMNS[3].tdClass} text-right text-xs tabular font-medium text-foreground`}>
                              {fmtPrice(stock.current_price)}
                            </td>

                            {/* Thay đổi VND */}
                            <td className={`py-2.5 ${COLUMNS[4].tdClass} hidden sm:table-cell text-right text-xs tabular font-medium ${cc}`}>
                              {fmtChange(stock.price_change)}
                            </td>

                            {/* % */}
                            <td className={`py-2.5 ${COLUMNS[5].tdClass} text-right`}>
                              {pct == null ? (
                                <span className="text-xs text-[#3d4f6b]">-</span>
                              ) : strong ? (
                                <span className={[
                                  'inline-block tabular font-bold text-[11px] px-1.5 py-0.5 rounded leading-none',
                                  isUp ? 'bg-[#34d399] text-[#052e16]' : 'bg-[#f87171] text-white',
                                ].join(' ')}>
                                  {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                                </span>
                              ) : (
                                <span className={`text-xs tabular font-semibold ${cc}`}>
                                  {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                                </span>
                              )}
                            </td>

                            {/* KL */}
                            <td className={`py-2.5 ${COLUMNS[6].tdClass} text-right text-xs tabular text-[#7a8ba8]`}>
                              {fmtVol(stock.volume)}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-[#0f1f3d] px-4 py-2 text-[10px] text-[#7a8ba8]" aria-live="polite">
                Nguồn: {dataSource ?? 'API FinSight'}
                {lastUpdated && <> · Dữ liệu đến {formatDataAsOf(lastUpdated)}</>}
                {syntheticData && ' · Dữ liệu minh họa'}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <BreadthPanel breadth={breadth} loading={loading} onExplain={handleExplain} />
            <SectorPanel leading={sectors?.leading ?? []} weak={sectors?.weak ?? []} loading={loading} onExplain={handleExplain} />
          </div>
        </div>
      </div>

      <ExplainPanel isOpen={explainOpen} onClose={() => setExplainOpen(false)} request={explainReq} />
      <ChatWidget contextData={{ type: 'market', title: 'Bộ lọc cổ phiếu', data: { breadth, leadingSectors: sectors?.leading ?? [], stockCount: stocks.length } }} />
    </>
  )
}
