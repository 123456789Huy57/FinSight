'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, RefreshCw, Star } from 'lucide-react'
import Link from 'next/link'

import { CandlestickChart } from '@/components/stock/CandlestickChart'
import { NewsCard } from '@/components/news/NewsCard'
import { ExplainPanel } from '@/components/ai/ExplainPanel'
import { ExplainButton } from '@/components/shared/ExplainButton'
import { ChatWidget } from '@/components/ai/ChatWidget'
import { Skeleton } from '@/components/shared/Skeleton'
import { Panel, DataNote, Change, Segmented } from '@/components/fs'
import { getNewsIntelligence, getQuote, getStockHistory, getStockIndicators, getStockProfile } from '@/lib/api'
import type { NewsItem, Quote, OHLCVCandle, StockIndicators, StockProfile, AIExplainRequest } from '@/lib/api'
import { useMarketPolling } from '@/lib/useMarketPolling'
import { accountFetch, ACCESS_TOKEN_KEY } from '@/lib/account'
import { fmtCompact, fmtPrice as fmtPriceVi, formatDataAsOf } from '@/lib/format'

const PERIODS: { label: string; days: number }[] = [
  { label: '1T',  days: 30  },
  { label: '3T',  days: 90  },
  { label: '6T',  days: 180 },
  { label: '1N',  days: 365 },
  { label: '5N',  days: 1250 },
]

const NO_DATA = 'Chưa có dữ liệu'

function fmtPrice(v: number | null) {
  if (v == null) return '-'
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function fmtVol(v: number | null) {
  if (v == null) return '-'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return `${v}`
}

function fmtIndicator(value: number | null | undefined, digits = 2) {
  return value == null ? 'Chưa đủ dữ liệu' : value.toLocaleString('vi-VN', { maximumFractionDigits: digits })
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--fs-line)] py-2 last:border-0">
      <dt className="text-[13px] text-[var(--fs-muted)]">{label}</dt>
      <dd className="text-right text-[14px] tabular-nums">{children}</dd>
    </div>
  )
}

function valueOrNoData(v: number | null | undefined, fmt: (n: number) => string) {
  return v == null ? <span className="text-[var(--fs-muted)]">{NO_DATA}</span> : fmt(v)
}

type TechRow = { name: string; value: string; state: string }

function technicalRows(ind: NonNullable<StockIndicators['indicators']>, price: number | null): TechRow[] {
  const vsAverage = (avg: number | null) => {
    if (avg == null || price == null) return 'Chưa đủ dữ liệu'
    return price >= avg ? 'Giá trên đường trung bình' : 'Giá dưới đường trung bình'
  }
  return [
    {
      name: 'RSI (14)',
      value: fmtIndicator(ind.rsi14),
      state: ind.rsi14 == null ? 'Chưa đủ dữ liệu' : ind.rsi14 >= 70 ? 'Vùng quá mua' : ind.rsi14 <= 30 ? 'Vùng quá bán' : 'Vùng trung tính',
    },
    { name: 'SMA (20)', value: fmtIndicator(ind.sma20), state: vsAverage(ind.sma20) },
    { name: 'SMA (50)', value: fmtIndicator(ind.sma50), state: vsAverage(ind.sma50) },
    {
      name: 'MACD histogram',
      value: fmtIndicator(ind.macdHistogram, 4),
      state: ind.macdHistogram == null ? 'Chưa đủ dữ liệu' : ind.macdHistogram > 0 ? 'Động lượng dương' : ind.macdHistogram < 0 ? 'Động lượng âm' : 'Động lượng bằng 0',
    },
  ]
}

function vietnamPublishTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? ''
  return { date: `${part('year')}-${part('month')}-${part('day')}`, hour: Number(part('hour')), minute: Number(part('minute')) }
}

interface Props { params: Promise<{ symbol: string }> }

export default function StockPage({ params }: Props) {
  const { symbol } = use(params)
  const SYM = symbol.toUpperCase()

  const [quote,        setQuote]        = useState<Quote | null>(null)
  const [profile,      setProfile]      = useState<StockProfile | null>(null)
  const [candles,      setCandles]      = useState<OHLCVCandle[]>([])
  const [indicators,   setIndicators]   = useState<StockIndicators | null>(null)
  const [newsItems,    setNewsItems]    = useState<NewsItem[]>([])
  const [period,       setPeriod]       = useState(180)
  const [loadingQuote, setLoadingQuote] = useState(true)
  const [loadingChart, setLoadingChart] = useState(true)
  const [loadingIndicators, setLoadingIndicators] = useState(true)
  const [loadingNews, setLoadingNews] = useState(true)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [chartError, setChartError] = useState<string | null>(null)
  const [indicatorsError, setIndicatorsError] = useState<string | null>(null)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [historySource, setHistorySource] = useState<string | null>(null)
  const [historyAsOf, setHistoryAsOf] = useState<string | null>(null)
  const [historyDataMode, setHistoryDataMode] = useState<'synthetic-demo' | 'market-provider' | 'external-feed' | null>(null)
  const [explainOpen,  setExplainOpen]  = useState(false)
  const [explainReq,   setExplainReq]   = useState<AIExplainRequest | null>(null)
  const [inWatchlist,  setInWatchlist]  = useState(false)

  useEffect(() => {
    const token = sessionStorage.getItem(ACCESS_TOKEN_KEY)
    if (token) {
      void accountFetch('/api/v1/watchlist', { headers: { Authorization: `Bearer ${token}` } })
        .then(async (response) => {
          if (!response.ok) return
          const data = await response.json() as { items: Array<{ symbol: string }> }
          setInWatchlist(data.items.some((item) => item.symbol === SYM))
        }).catch(() => undefined)
      return
    }
    const stored = localStorage.getItem('finsight_watchlist')
    if (stored) {
      try {
        const list = JSON.parse(stored) as string[]
        setInWatchlist(list.includes(SYM))
      } catch { /* ignore */ }
    }
  }, [SYM])

  const toggleWatchlist = useCallback(async () => {
    const token = sessionStorage.getItem(ACCESS_TOKEN_KEY)
    if (token) {
      const response = await accountFetch(`/api/v1/watchlist${inWatchlist ? `/${encodeURIComponent(SYM)}` : ''}`, {
        method: inWatchlist ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        ...(inWatchlist ? {} : { body: JSON.stringify({ symbol: SYM }) }),
      })
      if (!response.ok) return
      setInWatchlist(!inWatchlist)
      return
    }
    const stored = localStorage.getItem('finsight_watchlist')
    let list: string[] = []
    try { list = stored ? (JSON.parse(stored) as string[]) : [] } catch { /* ignore */ }
    const next = inWatchlist ? list.filter((s) => s !== SYM) : [...new Set([...list, SYM])]
    localStorage.setItem('finsight_watchlist', JSON.stringify(next))
    setInWatchlist(!inWatchlist)
  }, [SYM, inWatchlist])

  const handleExplain = useCallback((req: AIExplainRequest) => {
    setExplainReq(req); setExplainOpen(true)
  }, [])

  const explainStock = useCallback(() => {
    const parts: string[] = []
    if (profile?.company_name) parts.push(profile.company_name)
    parts.push(`(${SYM})`)
    if (profile?.sector) parts.push(`ngành ${profile.sector}`)
    if (quote?.current_price != null) {
      parts.push(`giá ${fmtPrice(quote.current_price)} VND`)
      if (quote.percent_change != null)
        parts.push(`biến động ${quote.percent_change >= 0 ? '+' : ''}${quote.percent_change.toFixed(2)}%`)
      if (quote.volume != null) parts.push(`KL ${fmtVol(quote.volume)}`)
    }
    handleExplain({
      type: 'stock',
      title: profile?.company_name ? `${profile.company_name} (${SYM})` : SYM,
      symbol: SYM,
      sector: profile?.sector ?? undefined,
      context: parts.join(', '),
      snapshot: {
        symbol: SYM,
        company_name: profile?.company_name ?? null,
        sector: profile?.sector ?? null,
        exchange: quote?.exchange ?? null,
        current_price: quote?.current_price ?? null,
        price_change: quote?.price_change ?? null,
        percent_change: quote?.percent_change ?? null,
        volume: quote?.volume ?? null,
        week52_high: profile?.week52_high ?? null,
        week52_low: profile?.week52_low ?? null,
      },
    })
  }, [SYM, quote, profile, handleExplain])

  const fetchQuote = useCallback(async () => {
    setLoadingQuote(true)
    setQuoteError(null)
    try { setQuote(await getQuote(SYM)) }
    catch { setQuote(null); setQuoteError(`Không tải được dữ liệu cho mã ${SYM}. Kiểm tra mã hoặc kết nối API.`) }
    finally { setLoadingQuote(false) }
  }, [SYM])

  const fetchChart = useCallback(async () => {
    setLoadingChart(true)
    setChartError(null)
    try {
      const response = await getStockHistory(SYM, period)
      setCandles(response.candles ?? [])
      setHistorySource(response.source ?? null)
      setHistoryAsOf(response.updated_at ?? null)
      setHistoryDataMode(response.data_mode ?? null)
    }
    catch { setCandles([]); setChartError('Không tải được lịch sử giá.') }
    finally { setLoadingChart(false) }
  }, [SYM, period])

  const fetchProfile = useCallback(async () => {
    try { setProfile(await getStockProfile(SYM)) }
    catch { setProfile(null) }
  }, [SYM])

  const fetchIndicators = useCallback(async () => {
    setLoadingIndicators(true)
    setIndicatorsError(null)
    try { setIndicators(await getStockIndicators(SYM)) }
    catch { setIndicators(null); setIndicatorsError('Không tải được chỉ báo kỹ thuật.') }
    finally { setLoadingIndicators(false) }
  }, [SYM])

  const fetchNews = useCallback(async () => {
    setLoadingNews(true)
    setNewsError(null)
    try { setNewsItems((await getNewsIntelligence({ symbol: SYM, limit: 100 })).items ?? []) }
    catch { setNewsItems([]); setNewsError('Không tải được tin liên quan đến mã này.') }
    finally { setLoadingNews(false) }
  }, [SYM])

  useEffect(() => { void fetchQuote(); void fetchProfile(); void fetchIndicators(); void fetchNews() }, [fetchQuote, fetchProfile, fetchIndicators, fetchNews])
  useEffect(() => { void fetchChart() }, [fetchChart])

  const newsMarkers = useMemo(() => {
    const tradingDates = candles.map((candle) => candle.time?.slice(0, 10)).filter((value): value is string => Boolean(value))
    const uniqueDates = [...new Set(tradingDates)].sort()
    return newsItems.flatMap((item) => {
      const reaction = item.reactions?.find((entry) => entry.symbol === SYM)
      let eventDate = reaction?.eventTradeDate ?? null
      if (!eventDate) {
        const published = vietnamPublishTime(item.time)
        if (!published) return []
        const sameDayCloseEligible = published.hour < 15
        eventDate = uniqueDates.find((date) => date > published.date || (sameDayCloseEligible && date === published.date)) ?? null
      }
      if (!eventDate || !uniqueDates.includes(eventDate)) return []
      return [{ time: eventDate, title: item.headline }]
    })
  }, [candles, newsItems, SYM])

  useMarketPolling(fetchQuote, 10_000)

  const loading = loadingQuote

  const rangePosition = (() => {
    if (!quote || quote.current_price == null || profile?.week52_high == null || profile?.week52_low == null) return null
    const range = profile.week52_high - profile.week52_low
    if (range <= 0) return 50
    return Math.max(2, Math.min(98, ((quote.current_price - profile.week52_low) / range) * 100))
  })()

  const exchange = quote?.exchange ?? profile?.exchange ?? null
  const sector = profile?.sector ?? profile?.industry ?? null
  const identityLine = [exchange ? `Sàn ${exchange}` : null, sector ? `ngành ${sector}` : null].filter(Boolean).join(', ')
  const shownNews = newsItems.slice(0, 5)
  const techRows = indicators?.indicators ? technicalRows(indicators.indicators, indicators.lastPrice ?? quote?.current_price ?? null) : []

  return (
    <>
      <div className="mx-auto max-w-screen-2xl space-y-5 px-4 py-6 lg:px-6">

        <Link href="/market" className="inline-flex items-center gap-1 text-[13px] text-[var(--fs-muted)] hover:text-[var(--fs-ink)]">
          <ArrowLeft className="h-3.5 w-3.5" />
          Thị trường
        </Link>

        {quoteError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--fs-line)] bg-white px-4 py-3 text-[13px] text-[var(--fs-down)]">
            <span>{quoteError}</span>
            <button type="button" onClick={() => { void fetchQuote(); void fetchProfile() }} className="font-medium text-[var(--fs-signal)] underline underline-offset-2">Thử lại</button>
          </div>
        )}

        {/* Đầu trang */}
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[var(--fs-line)] bg-white p-5">
          <div className="min-w-0 space-y-1">
            <h1 className="text-[32px] font-medium leading-none tracking-[-0.025em]">{SYM}</h1>
            {profile?.company_name && <p className="text-[15px] text-[var(--fs-ink-2)]">{profile.company_name}</p>}
            {identityLine && <p className="text-[13px] text-[var(--fs-muted)]">{identityLine}</p>}

            {loading ? (
              <div className="space-y-1.5 pt-3">
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : quote?.current_price != null ? (
              <div className="pt-3">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-[28px] font-medium leading-none tabular-nums">{fmtPriceVi(quote.current_price, 0)}</span>
                  <span className="text-[13px] text-[var(--fs-muted)]">VND</span>
                  <Change value={quote.percent_change} className="text-[16px] font-medium" />
                </div>
              </div>
            ) : (
              <p className="pt-3 text-[14px] text-[var(--fs-muted)]">Không tải được dữ liệu</p>
            )}

            <div className="space-y-0.5 pt-2">
              {quote && <DataNote dataMode={quote.data_mode} asOf={quote.updated_at} source={quote.source} />}
              {profile?.as_of && (
                <div className="flex gap-1 text-[13px] text-[var(--fs-muted)]">
                  <span>Hồ sơ:</span>
                  <DataNote dataMode={profile.data_mode} asOf={profile.as_of} source={profile.source} />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={inWatchlist}
              onClick={() => void toggleWatchlist()}
              title={inWatchlist ? 'Xoá khỏi danh sách theo dõi' : 'Thêm vào danh sách theo dõi'}
              className={[
                'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium',
                inWatchlist
                  ? 'border-[var(--fs-ink)] bg-[var(--fs-ink)] text-white'
                  : 'border-[var(--fs-line)] bg-white text-[var(--fs-ink)] hover:bg-[var(--fs-surface)]',
              ].join(' ')}
            >
              <Star className={`h-3.5 w-3.5 ${inWatchlist ? 'fill-current' : ''}`} />
              {inWatchlist ? 'Đang theo dõi' : 'Theo dõi'}
            </button>
            <ExplainButton onClick={explainStock} size="md" label="Giải thích" />
            <button
              type="button"
              onClick={() => { void fetchQuote(); void fetchChart(); void fetchIndicators(); void fetchNews() }}
              disabled={loading || loadingChart}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--fs-line)] bg-white px-3 text-[13px] text-[var(--fs-ink-2)] hover:bg-[var(--fs-surface)] disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${(loading || loadingChart) ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          </div>
        </header>

        {/* Biểu đồ + thông tin */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          <Panel
            className="lg:col-span-2"
            title="Biểu đồ giá"
            aside={
              <Segmented
                label="Khoảng thời gian"
                options={PERIODS.map((p) => ({ value: String(p.days), label: p.label }))}
                value={String(period)}
                onChange={(v) => setPeriod(Number(v))}
              />
            }
          >
            {loadingChart ? (
              <div className="p-4"><Skeleton className="h-[340px] w-full rounded-lg" /></div>
            ) : (
              <>
                {chartError && <p role="alert" className="px-5 pt-3 text-[13px] text-[var(--fs-down)]">{chartError}</p>}
                <div className="p-3">
                  <CandlestickChart candles={candles} newsMarkers={newsMarkers} height={340} />
                </div>
              </>
            )}
            <div className="space-y-0.5 border-t border-[var(--fs-line)] px-5 py-3 text-[13px] text-[var(--fs-muted)]">
              {newsMarkers.length > 0 && <p>Chấm xanh trên biểu đồ là phiên có tin về {SYM}.</p>}
              {candles.length > 0 && (
                <p>
                  {candles.length} phiên lịch sử, nguồn giá {historySource ?? 'chưa rõ'}
                  {historyAsOf ? `, đến ${formatDataAsOf(historyAsOf)}` : ''}
                  {historyDataMode === 'synthetic-demo' ? '. Dữ liệu minh hoạ.' : '.'}
                </p>
              )}
            </div>
          </Panel>

          <div className="space-y-5">
            <Panel title="Thông tin">
              <div className="px-5 py-2">
                {loading ? (
                  <div className="space-y-2 py-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex justify-between">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    ))}
                  </div>
                ) : quote ? (
                  <dl>
                    <Row label="Giá hiện tại">{valueOrNoData(quote.current_price, (n) => fmtPriceVi(n, 0))}</Row>
                    <Row label="Thay đổi">{valueOrNoData(quote.price_change, (n) => fmtPriceVi(n, 0))}</Row>
                    <Row label="Biến động"><Change value={quote.percent_change} /></Row>
                    <Row label="Khối lượng">{valueOrNoData(quote.volume, (n) => fmtVol(n))}</Row>
                    <Row label="Sàn">{quote.exchange}</Row>
                    {sector && <Row label="Ngành">{sector}</Row>}
                  </dl>
                ) : (
                  <p className="py-3 text-[14px] text-[var(--fs-muted)]">{NO_DATA}</p>
                )}
              </div>
            </Panel>

            <Panel title="Chỉ số tài chính" aside={profile?.fundamental_as_of ? `đến ${formatDataAsOf(profile.fundamental_as_of)}` : undefined}>
              <div className="px-5 py-2">
                <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-1">
                  <Row label="Vốn hoá">{valueOrNoData(profile?.market_cap, fmtCompact)}</Row>
                  <Row label="P/E">{valueOrNoData(profile?.pe, (n) => fmtPriceVi(n, 2))}</Row>
                  <Row label="P/B">{valueOrNoData(profile?.pb, (n) => fmtPriceVi(n, 2))}</Row>
                  <Row label="EPS">{valueOrNoData(profile?.eps, (n) => fmtPriceVi(n, 0))}</Row>
                  <Row label="Cổ tức">{valueOrNoData(profile?.dividend_yield, (n) => `${fmtPriceVi(n * 100, 2)}%`)}</Row>
                  <Row label="KL trung bình">{valueOrNoData(profile?.avg_volume, fmtCompact)}</Row>
                </dl>
                {profile?.fundamental_source && (
                  <p className="pb-2 text-[13px] text-[var(--fs-muted)]">Nguồn: {profile.fundamental_source}</p>
                )}
              </div>
            </Panel>

            <Panel title="Biên độ 52 tuần">
              <div className="px-5 py-2">
                <dl>
                  <Row label="Thấp nhất">{valueOrNoData(profile?.week52_low, (n) => fmtPriceVi(n, 0))}</Row>
                  <Row label="Cao nhất">{valueOrNoData(profile?.week52_high, (n) => fmtPriceVi(n, 0))}</Row>
                </dl>
                {rangePosition !== null && (
                  <div className="pb-3 pt-2">
                    <div className="relative h-1.5 rounded-full bg-[var(--fs-surface)]">
                      <div
                        className="absolute top-1/2 h-3 w-3 rounded-full border-2 border-[var(--fs-ink)] bg-white"
                        style={{ left: `${rangePosition}%`, transform: 'translate(-50%, -50%)' }}
                      />
                    </div>
                    <p className="mt-2 text-[13px] text-[var(--fs-muted)]">Giá hiện tại nằm ở {Math.round(rangePosition)}% biên độ tính từ đáy.</p>
                  </div>
                )}
              </div>
            </Panel>
          </div>
        </div>

        {/* Chỉ báo kỹ thuật */}
        <Panel title="Chỉ báo kỹ thuật" aside={indicators ? <DataNote dataMode={indicators.dataMode} asOf={indicators.asOf} source={indicators.source} /> : undefined}>
          {loadingIndicators ? (
            <p className="px-5 py-4 text-[14px] text-[var(--fs-muted)]">Đang tải chỉ báo.</p>
          ) : indicatorsError ? (
            <p role="alert" className="px-5 py-4 text-[14px] text-[var(--fs-down)]">{indicatorsError}</p>
          ) : techRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[14px]">
                <thead>
                  <tr className="border-b border-[var(--fs-line)] text-[13px] text-[var(--fs-muted)]">
                    <th scope="col" className="px-5 py-2.5 font-normal">Chỉ báo</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-normal">Giá trị</th>
                    <th scope="col" className="px-5 py-2.5 font-normal">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {techRows.map((r) => (
                    <tr key={r.name} className="border-b border-[var(--fs-line)] last:border-0">
                      <td className="px-5 py-2.5">{r.name}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{r.value}</td>
                      <td className="px-5 py-2.5 text-[var(--fs-ink-2)]">{r.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-4 text-[14px] text-[var(--fs-muted)]">Chưa đủ lịch sử giá để tính.</p>
          )}
          <p className="border-t border-[var(--fs-line)] px-5 py-3 text-[13px] text-[var(--fs-muted)]">
            Tổng hợp từ ngưỡng kỹ thuật phổ biến, không phải khuyến nghị đầu tư.
          </p>
        </Panel>

        {/* Tin về mã */}
        <Panel title={`Tin về ${SYM}`} aside={!loadingNews ? <span className="tabular-nums">{newsItems.length} tin</span> : undefined}>
          {loadingNews ? (
            <div className="space-y-2 p-5"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
          ) : newsError ? (
            <p role="alert" className="px-5 py-6 text-[14px] text-[var(--fs-down)]">{newsError}</p>
          ) : newsItems.length === 0 ? (
            <p className="px-5 py-6 text-[14px] text-[var(--fs-muted)]">Chưa có tin về {SYM}.</p>
          ) : (
            <>
              <div>
                {shownNews.map((item) => (
                  <NewsCard key={item.id} item={item} onExplain={handleExplain} focusSymbol={SYM} />
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--fs-line)] px-5 py-3">
                <p className="text-[13px] text-[var(--fs-muted)]">
                  T+1/T+5 là biến động so với VN-Index, không khẳng định nhân quả. Sắc thái chấm bằng từ điển từ khoá.
                </p>
                <Link href={`/news?symbol=${encodeURIComponent(SYM)}`} className="text-[13px] font-medium text-[var(--fs-signal)] hover:underline">
                  Xem tất cả tin về {SYM}
                </Link>
              </div>
            </>
          )}
        </Panel>
      </div>

      <ExplainPanel isOpen={explainOpen} onClose={() => setExplainOpen(false)} request={explainReq} />
      <ChatWidget contextData={{
        type: 'stock',
        title: profile?.company_name ? `${profile.company_name} (${SYM})` : SYM,
        data: { ...quote, ...profile },
      }} />
    </>
  )
}
