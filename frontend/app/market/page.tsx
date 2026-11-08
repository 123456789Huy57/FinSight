'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUp, ArrowDown, ArrowUpDown, RefreshCw, Search } from 'lucide-react'

import { BreadthPanel, SectorPanel } from '@/components/dashboard/BreadthSectorPanel'
import { ExplainPanel } from '@/components/ai/ExplainPanel'
import { ChatWidget } from '@/components/ai/ChatWidget'
import { Skeleton } from '@/components/shared/Skeleton'
import { Panel, PageHeader, Change, Segmented, EmptyState } from '@/components/fs'
import { getScreenerUniverse, getMarketCommentary, getMarketDataStatus } from '@/lib/api'
import { fmtPrice, fmtCompact } from '@/lib/format'
import type {
  ScreenerStock,
  MarketBreadth,
  SectorPerformanceResponse,
  AIExplainRequest,
} from '@/lib/api'

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
  | 'trading_value' | 'market_cap' | 'pe' | 'pb'
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
  show: string // lớp hiển thị theo độ rộng màn hình
}

const COLUMNS: ColDef[] = [
  { key: 'symbol',         label: 'Mã',       align: 'left',  show: '' },
  { key: 'sector',         label: 'Ngành',    align: 'left',  show: 'hidden md:table-cell' },
  { key: 'exchange',       label: 'Sàn',      align: 'left',  show: 'hidden sm:table-cell' },
  { key: 'current_price',  label: 'Giá',      align: 'right', show: '' },
  { key: 'percent_change', label: '%',        align: 'right', show: '' },
  { key: 'trading_value',  label: 'GTGD',     align: 'right', show: 'hidden md:table-cell' },
  { key: 'market_cap',     label: 'Vốn hoá',  align: 'right', show: 'hidden lg:table-cell' },
  { key: 'pe',             label: 'P/E',      align: 'right', show: 'hidden lg:table-cell' },
  { key: 'pb',             label: 'P/B',      align: 'right', show: 'hidden lg:table-cell' },
]

// ── Subcomponents ─────────────────────────────────────────────

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col)
    return <ArrowUpDown className="h-3 w-3 flex-shrink-0 opacity-40" aria-hidden="true" />
  return sortDir === 'asc'
    ? <ArrowUp   className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
    : <ArrowDown className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
}

function ScreenerSkeleton() {
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => (
        <tr key={i} className="border-b border-[var(--fs-line)]">
          {COLUMNS.map((col) => (
            <td key={col.key} className={`px-3 py-3 ${col.show}`}>
              <Skeleton className={`h-3 ${col.align === 'right' ? 'ml-auto' : ''} ${col.key === 'symbol' ? 'w-10' : 'w-full'}`} />
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
  const [coverage, setCoverage] = useState<{ listed: number; withHistory: number } | null>(null)
  const [visibleCount, setVisibleCount] = useState(100)
  const requestId = useRef(0)

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
    const validSorts: SortKey[] = ['symbol', 'exchange', 'sector', 'current_price', 'price_change', 'percent_change', 'volume', 'trading_value', 'market_cap', 'pe', 'pb']
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
    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const [screenerRes, commentaryRes, statusRes] = await Promise.allSettled([
        getScreenerUniverse(symbolQuery.trim() || undefined),
        getMarketCommentary(),
        getMarketDataStatus(),
      ])
      if (currentRequest !== requestId.current) return
      if (screenerRes.status === 'fulfilled') {
        setStocks(screenerRes.value.stocks)
        setVisibleCount(100)
        setSyntheticData(screenerRes.value.data_mode === 'synthetic-demo')
        setDataSource(screenerRes.value.source ?? null)
      } else {
        setError('Không tải được dữ liệu thị trường. Vui lòng thử lại.')
      }
      if (statusRes.status === 'fulfilled' && statusRes.value.symbolCoverage)
        setCoverage(statusRes.value.symbolCoverage)
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
      if (currentRequest === requestId.current) setLoading(false)
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

  const clearFilters = () => {
    setExchange('Tất cả')
    setSector('Tất cả')
    setChangeFilter('all')
    setSymbolQuery('')
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

  const counts = useMemo(() => {
    let up = 0, down = 0, flat = 0
    for (const s of displayed) {
      const p = s.percent_change
      if (p == null) continue
      if (p > 0) up++
      else if (p < 0) down++
      else flat++
    }
    return { up, down, flat }
  }, [displayed])

  const filtersActive = exchange !== 'Tất cả' || sector !== 'Tất cả' || changeFilter !== 'all' || symbolQuery.trim() !== ''
  const visibleStocks = displayed.slice(0, visibleCount)

  return (
    <>
      <div className="min-h-screen bg-[var(--fs-surface)] text-[var(--fs-ink)]">
        <main className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6">
          <PageHeader
            title="Cổ phiếu"
            dataMode={syntheticData ? 'synthetic-demo' : lastUpdated ? 'market-provider' : null}
            asOf={lastUpdated}
            source={dataSource}
            actions={
              <button
                type="button"
                aria-label="Làm mới dữ liệu thị trường"
                onClick={() => void fetchData()}
                disabled={loading}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--fs-line)] bg-white hover:bg-[var(--fs-surface)] disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            }
          />

          {error && (
            <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--fs-line)] bg-white px-4 py-3 text-[13px]">
              <span style={{ color: 'var(--fs-down)' }}>{error}</span>
              <button type="button" onClick={() => void fetchData()} className="font-medium underline underline-offset-2">Thử lại</button>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
            <div className="min-w-0 xl:col-span-3">
              <Panel
                title="Danh sách cổ phiếu"
                aside={!loading ? <span className="tabular-nums">{displayed.length} mã đang lọc</span> : undefined}
              >
                {/* Thanh lọc */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-3 border-b border-[var(--fs-line)] px-5 py-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--fs-muted)]" aria-hidden="true" />
                    <input
                      type="text"
                      value={symbolQuery}
                      onChange={(e) => setSymbolQuery(e.target.value)}
                      aria-label="Tìm mã hoặc tên công ty"
                      placeholder="Tìm mã hoặc tên"
                      className="h-9 w-44 rounded-lg border border-[var(--fs-line)] bg-white pl-9 pr-3 text-[14px] outline-none focus:border-[var(--fs-ink)]"
                    />
                  </div>
                  <Segmented
                    label="Sàn giao dịch"
                    options={EXCHANGES.map((ex) => ({ value: ex, label: ex }))}
                    value={exchange}
                    onChange={setExchange}
                  />
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    aria-label="Ngành"
                    className="h-9 max-w-full rounded-lg border border-[var(--fs-line)] bg-white px-3 text-[14px] outline-none focus:border-[var(--fs-ink)]"
                  >
                    {allSectors.map((s) => (
                      <option key={s} value={s}>{s === 'Tất cả' ? 'Mọi ngành' : s}</option>
                    ))}
                  </select>
                  <Segmented
                    label="Biến động giá"
                    options={CHANGE_OPTS.map((o) => ({ value: o.key, label: o.label }))}
                    value={changeFilter}
                    onChange={setChangeFilter}
                  />
                </div>

                {/* Dải thống kê */}
                {!loading && (
                  <p className="border-b border-[var(--fs-line)] px-5 py-2.5 text-[13px] text-[var(--fs-muted)]">
                    {coverage && <span className="block">Đã có giá cho {coverage.withHistory.toLocaleString('vi-VN')} / {coverage.listed.toLocaleString('vi-VN')} mã niêm yết.</span>}
                    Trong {displayed.length} mã đang lọc:{' '}
                    <span className="tabular-nums" style={{ color: 'var(--fs-up)' }}>{counts.up} tăng</span>,{' '}
                    <span className="tabular-nums" style={{ color: 'var(--fs-flat)' }}>{counts.flat} đứng</span>,{' '}
                    <span className="tabular-nums" style={{ color: 'var(--fs-down)' }}>{counts.down} giảm</span>.
                  </p>
                )}

                {!loading && displayed.length === 0 ? (
                  <EmptyState
                    title="Không có mã phù hợp"
                    hint="Thử bỏ bớt điều kiện lọc."
                    action={filtersActive ? { label: 'Xoá bộ lọc', onClick: clearFilters } : undefined}
                  />
                ) : (
                  <table className="w-full border-collapse text-left text-[14px]">
                    <thead>
                      <tr className="border-b border-[var(--fs-line)] text-[12px] text-[var(--fs-muted)]">
                        {COLUMNS.map((col) => (
                          <th
                            key={col.key}
                            scope="col"
                            aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                            className={`px-3 py-2 font-normal first:pl-5 last:pr-5 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.show}`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort(col.key)}
                              className={`inline-flex items-center gap-1 rounded hover:text-[var(--fs-ink)] ${sortKey === col.key ? 'font-medium text-[var(--fs-ink)]' : ''} ${col.align === 'right' ? 'flex-row-reverse' : ''}`}
                            >
                              {col.label}
                              <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <ScreenerSkeleton />
                      ) : (
                        visibleStocks.map((stock) => (
                          <tr key={stock.symbol} className="border-b border-[var(--fs-line)] last:border-0 hover:bg-[var(--fs-surface)]">
                            <td className="px-3 py-2.5 pl-5">
                              <Link href={`/stock/${stock.symbol}`} className="font-medium">{stock.symbol}</Link>
                              {stock.name && <div className="max-w-[160px] truncate text-[12px] text-[var(--fs-muted)]">{stock.name}</div>}
                            </td>
                            <td className="hidden max-w-[160px] truncate px-3 py-2.5 text-[13px] text-[var(--fs-ink-2)] md:table-cell">{stock.sector || '–'}</td>
                            <td className="hidden px-3 py-2.5 text-[13px] text-[var(--fs-ink-2)] sm:table-cell">{stock.exchange}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{fmtPrice(stock.current_price, 0)}</td>
                            <td className="px-3 py-2.5 text-right"><Change value={stock.percent_change} /></td>
                            <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">{fmtCompact(stock.trading_value)}</td>
                            <td className="hidden px-3 py-2.5 text-right tabular-nums lg:table-cell">{fmtCompact(stock.market_cap)}</td>
                            <td className="hidden px-3 py-2.5 text-right tabular-nums lg:table-cell">{fmtPrice(stock.pe, 1)}</td>
                            <td className="hidden px-3 py-2.5 pr-5 text-right tabular-nums lg:table-cell">{fmtPrice(stock.pb, 1)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
                {!loading && visibleCount < displayed.length && (
                  <div className="border-t border-[var(--fs-line)] px-5 py-3 text-center">
                    <button type="button" onClick={() => setVisibleCount((count) => count + 100)} className="rounded-lg border border-[var(--fs-line)] px-4 py-2 text-[13px] font-medium hover:bg-[var(--fs-surface)]">
                      Xem thêm mã ({visibleStocks.length}/{displayed.length})
                    </button>
                  </div>
                )}
              </Panel>
            </div>

            <div className="min-w-0 space-y-4">
              <BreadthPanel breadth={breadth} loading={loading} onExplain={handleExplain} />
              <SectorPanel leading={sectors?.leading ?? []} weak={sectors?.weak ?? []} loading={loading} onExplain={handleExplain} />
            </div>
          </div>

          <p className="mt-10 text-[12px] text-[var(--fs-muted)]">
            Thông tin chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.
          </p>
        </main>
      </div>

      <ExplainPanel isOpen={explainOpen} onClose={() => setExplainOpen(false)} request={explainReq} />
      <ChatWidget contextData={{ type: 'market', title: 'Bộ lọc cổ phiếu', data: { breadth, leadingSectors: sectors?.leading ?? [], stockCount: stocks.length } }} />
    </>
  )
}
