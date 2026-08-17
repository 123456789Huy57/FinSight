'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw, Building2, Star } from 'lucide-react'
import Link from 'next/link'

import { CandlestickChart } from '@/components/stock/CandlestickChart'
import { ExplainPanel } from '@/components/ai/ExplainPanel'
import { ExplainButton } from '@/components/shared/ExplainButton'
import { ChatWidget } from '@/components/ai/ChatWidget'
import { Skeleton } from '@/components/shared/Skeleton'
import { getQuote, getStockHistory, getStockProfile } from '@/lib/api'
import type { Quote, OHLCVCandle, StockProfile, AIExplainRequest } from '@/lib/api'
import { useMarketPolling } from '@/lib/useMarketPolling'
import { MarketStatusBadge } from '@/components/shared/MarketStatusBadge'

const PERIODS: { label: string; days: number }[] = [
  { label: '1T',  days: 30  },
  { label: '3T',  days: 90  },
  { label: '6T',  days: 180 },
  { label: '1N',  days: 365 },
]

function fmtPrice(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function fmtVol(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return `${v}`
}

function StatRow({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[#0f1f3d] last:border-0">
      <span className="text-[12px] text-[#7a8ba8]">{label}</span>
      <span className={`text-[13px] font-semibold tabular ${valueClass}`}>{value}</span>
    </div>
  )
}

interface Props { params: Promise<{ symbol: string }> }

export default function StockPage({ params }: Props) {
  const { symbol } = use(params)
  const SYM = symbol.toUpperCase()

  const [quote,        setQuote]        = useState<Quote | null>(null)
  const [profile,      setProfile]      = useState<StockProfile | null>(null)
  const [candles,      setCandles]      = useState<OHLCVCandle[]>([])
  const [period,       setPeriod]       = useState(180)
  const [loadingQuote, setLoadingQuote] = useState(true)
  const [loadingChart, setLoadingChart] = useState(true)
  const [explainOpen,  setExplainOpen]  = useState(false)
  const [explainReq,   setExplainReq]   = useState<AIExplainRequest | null>(null)
  const [inWatchlist,  setInWatchlist]  = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('finsight_watchlist')
    if (stored) {
      try {
        const list = JSON.parse(stored) as string[]
        setInWatchlist(list.includes(SYM))
      } catch { /* ignore */ }
    }
  }, [SYM])

  const toggleWatchlist = useCallback(() => {
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
    if (quote) {
      parts.push(`giá ${fmtPrice(quote.current_price)} VND`)
      parts.push(`biến động ${quote.percent_change >= 0 ? '+' : ''}${quote.percent_change.toFixed(2)}%`)
      parts.push(`KL ${fmtVol(quote.volume)}`)
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
    try { setQuote(await getQuote(SYM)) }
    catch { setQuote(null) }
    finally { setLoadingQuote(false) }
  }, [SYM])

  const fetchChart = useCallback(async () => {
    setLoadingChart(true)
    try { setCandles((await getStockHistory(SYM, period)).candles ?? []) }
    catch { setCandles([]) }
    finally { setLoadingChart(false) }
  }, [SYM, period])

  const fetchProfile = useCallback(async () => {
    try { setProfile(await getStockProfile(SYM)) }
    catch { setProfile(null) }
  }, [SYM])

  useEffect(() => { void fetchQuote(); void fetchProfile() }, [fetchQuote, fetchProfile])
  useEffect(() => { void fetchChart() }, [fetchChart])

  const marketStatus = useMarketPolling(fetchQuote, 10_000)

  const up = (quote?.percent_change ?? 0) >= 0
  const loading = loadingQuote

  const rangePosition = (() => {
    if (!quote || profile?.week52_high == null || profile?.week52_low == null) return null
    const range = profile.week52_high - profile.week52_low
    if (range <= 0) return 50
    return Math.max(2, Math.min(98, ((quote.current_price - profile.week52_low) / range) * 100))
  })()

  const heroAccentClass = up
    ? 'border-l-[3px] border-l-[#34d399]'
    : 'border-l-[3px] border-l-[#f87171]'

  return (
    <>
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-4 space-y-4">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[12px]">
          <Link href="/market" className="flex items-center gap-1 text-[#7a8ba8] hover:text-foreground transition-colors">
            <ArrowLeft className="w-3 h-3" />
            Thị trường
          </Link>
          <span className="text-[#1e3158]">/</span>
          <span className="font-bold text-foreground font-mono">{SYM}</span>
          {profile?.sector && (
            <>
              <span className="text-[#1e3158]">/</span>
              <span className="text-[#7a8ba8]">{profile.sector}</span>
            </>
          )}
          <div className="ml-auto">
            <MarketStatusBadge status={marketStatus} />
          </div>
        </div>

        {/* Hero card */}
        <div className={`rounded-xl bg-[#0e1726] border border-[#1a2744] p-4 sm:p-5 relative overflow-hidden ${heroAccentClass}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">

            {/* Left: identity + price */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[1.6rem] font-black text-foreground tracking-tight font-mono leading-none">
                  {SYM}
                </h1>
                {quote && (
                  <span className="text-[10px] font-bold uppercase tracking-wider border border-primary/30 text-primary bg-primary/8 rounded px-1.5 py-0.5 leading-none">
                    {quote.exchange}
                  </span>
                )}
              </div>

              {profile?.company_name && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 text-[#7a8ba8] flex-shrink-0" />
                  <p className="text-[13px] text-[#7a8ba8] truncate max-w-xs">{profile.company_name}</p>
                </div>
              )}

              {loading ? (
                <div className="space-y-1.5 pt-1">
                  <Skeleton className="h-9 w-36" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ) : quote ? (
                <div className="pt-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[2.2rem] leading-none font-black tabular text-foreground">
                      {fmtPrice(quote.current_price)}
                    </span>
                    <span className="text-[11px] font-semibold text-[#7a8ba8]">VND</span>
                  </div>
                  <div className={`flex items-center gap-2 mt-1 ${up ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                    <span className="text-[14px] font-bold tabular">{up ? '+' : ''}{fmtPrice(quote.price_change)}</span>
                    <span className="text-[14px] font-bold opacity-80">({up ? '+' : ''}{quote.percent_change.toFixed(2)}%)</span>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-[#7a8ba8] pt-1">Không tải được dữ liệu</p>
              )}
            </div>

            {/* Right: actions */}
            <div className="flex flex-col items-end gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleWatchlist}
                  title={inWatchlist ? 'Xóa khỏi watchlist' : 'Thêm vào watchlist'}
                  className={[
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    inWatchlist
                      ? 'bg-[#f59e0b]/12 border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/20'
                      : 'bg-[#1a2744] border-[#1e3158] text-[#7a8ba8] hover:text-foreground hover:border-[#f59e0b]/30 hover:bg-[#f59e0b]/8',
                  ].join(' ')}
                >
                  <Star className={`w-3.5 h-3.5 ${inWatchlist ? 'fill-[#f59e0b]' : ''}`} />
                  {inWatchlist ? 'Đang theo dõi' : 'Theo dõi'}
                </button>
                <ExplainButton onClick={explainStock} size="md" label="Phân tích AI" />
              </div>
              {quote && (
                <div className="text-right">
                  <p className="text-[11px] text-[#7a8ba8]">
                    KL: <span className="font-bold text-foreground tabular">{fmtVol(quote.volume)}</span>
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => { void fetchQuote(); void fetchChart() }}
                disabled={loading || loadingChart}
                className="flex items-center gap-1.5 text-[11px] text-[#7a8ba8] hover:text-foreground transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-3 h-3 ${(loading || loadingChart) ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>
          </div>
        </div>

        {/* Chart + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Chart panel */}
          <div className="lg:col-span-2 rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] overflow-hidden shadow-lg shadow-black/50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(79,142,247,0.12)]">
              <span className="text-[13px] font-bold text-foreground">Biểu đồ giá</span>
              <div className="flex gap-0.5">
                {PERIODS.map(({ label, days }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setPeriod(days)}
                    className={[
                      'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors',
                      period === days
                        ? 'bg-primary text-white'
                        : 'text-[#7a8ba8] hover:text-foreground hover:bg-[#0e1726]',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {loadingChart ? (
              <div className="p-4"><Skeleton className="w-full rounded-lg h-[340px]" /></div>
            ) : (
              <CandlestickChart candles={candles} height={340} />
            )}
          </div>

          {/* Stats sidebar */}
          <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] p-4 space-y-0.5">
            <p className="text-[13px] font-bold text-foreground pb-2 border-b border-[rgba(79,142,247,0.12)] mb-1">
              Thông tin
            </p>

            {loading ? (
              <div className="space-y-2 pt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            ) : quote ? (
              <>
                <StatRow label="Giá hiện tại" value={fmtPrice(quote.current_price)} />
                <StatRow
                  label="Thay đổi"
                  value={`${up ? '+' : ''}${fmtPrice(quote.price_change)}`}
                  valueClass={up ? 'text-[#34d399]' : 'text-[#f87171]'}
                />
                <StatRow
                  label="% Biến động"
                  value={`${up ? '+' : ''}${quote.percent_change.toFixed(2)}%`}
                  valueClass={up ? 'text-[#34d399]' : 'text-[#f87171]'}
                />
                <StatRow label="Khối lượng" value={fmtVol(quote.volume)} />
                <StatRow label="Sàn" value={quote.exchange} />
                {profile?.sector && <StatRow label="Ngành" value={profile.sector} />}
              </>
            ) : (
              <p className="text-[13px] text-[#7a8ba8] py-2">Không có dữ liệu</p>
            )}

            {/* 52W range */}
            {rangePosition !== null && profile && (
              <div className="pt-4 pb-1">
                <p className="text-[12px] font-bold text-foreground mb-3">Biên độ 52 tuần</p>
                <div className="flex justify-between text-[11px] font-bold mb-1.5">
                  <span className="text-[#f87171] tabular">{fmtPrice(profile.week52_low!)}</span>
                  <span className="text-[#34d399] tabular">{fmtPrice(profile.week52_high!)}</span>
                </div>
                <div className="relative h-1.5 rounded-full overflow-visible">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ background: 'linear-gradient(to right, #f87171 0%, #f59e0b 50%, #34d399 100%)' }}
                  />
                  <div
                    className="absolute top-1/2 w-3 h-3 rounded-full bg-[#070d1a] border-2 border-primary shadow-md shadow-primary/30"
                    style={{ left: `${rangePosition}%`, transform: 'translate(-50%, -50%)' }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-[#3d4f6b]">52W thấp</span>
                  <span className="text-[10px] text-[#3d4f6b]">52W cao</span>
                </div>
              </div>
            )}

            {/* AI CTA */}
            <div className="pt-3 border-t border-[#1a2744]">
              <ExplainButton onClick={explainStock} size="md" label="Phân tích AI đầy đủ" className="w-full justify-center" />
            </div>
          </div>
        </div>

        {candles.length > 0 && (
          <p className="text-[10px] text-[#3d4f6b]/60 text-center">
            {candles.length} phiên lịch sử · nguồn VCI/TCBS qua vnstock
          </p>
        )}
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
