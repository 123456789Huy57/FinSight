'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { BarChart3, LockKeyhole, Play, RefreshCw } from 'lucide-react'
import { accountFetch, ACCESS_TOKEN_KEY } from '@/lib/account'

type Strategy = 'buy_hold' | 'dca' | 'sma_crossover' | 'rsi_mean_reversion'
type BacktestRun = {
  id: string
  symbol: string
  strategy: Strategy
  start: string
  end: string
  source: string
  initialCapital: number
  finalEquity: number
  totalReturn: number
  cagr: number
  maxDrawdown: number
  annualizedVolatility: number
  sharpeRatio: number
  tradeCount: number
  benchmark: { strategy: string; totalReturn: number; finalEquity: number; excessReturn: number }
  createdAt?: string | null
}

const STRATEGIES: Array<{ id: Strategy; label: string }> = [
  { id: 'buy_hold', label: 'Mua và nắm giữ' },
  { id: 'dca', label: 'Đầu tư định kỳ (DCA)' },
  { id: 'sma_crossover', label: 'Giao cắt SMA20/50' },
  { id: 'rsi_mean_reversion', label: 'Hồi quy RSI' },
]
const fmtMoney = (value: number) => `${Math.round(value).toLocaleString('vi-VN')} ₫`
const fmtPercent = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`

export default function BacktestPage() {
  const [token, setToken] = useState('')
  const [symbol, setSymbol] = useState('VCB')
  const [strategy, setStrategy] = useState<Strategy>('buy_hold')
  const [start, setStart] = useState('2025-01-01')
  const [end, setEnd] = useState('2026-10-30')
  const [capital, setCapital] = useState('100000000')
  const [runs, setRuns] = useState<BacktestRun[]>([])
  const [selected, setSelected] = useState<BacktestRun | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refreshRuns = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await accountFetch('/api/v1/backtests?limit=50')
      if (!response.ok) throw new Error('Không tải được lịch sử backtest')
      const data = await response.json() as { items: BacktestRun[] }
      setRuns(data.items)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được lịch sử backtest')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const saved = sessionStorage.getItem(ACCESS_TOKEN_KEY)
    if (saved) setToken(saved)
  }, [])

  useEffect(() => { if (token) void refreshRuns() }, [token, refreshRuns])

  const runBacktest = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true); setError(''); setSelected(null)
    try {
      const response = await accountFetch('/api/v1/backtests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.trim().toUpperCase(), strategy, start, end, initialCapital: Number(capital) }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.detail ?? 'Không chạy được backtest')
      setSelected(body as BacktestRun)
      await refreshRuns()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không chạy được backtest')
    } finally {
      setLoading(false)
    }
  }

  const openRun = async (id: string) => {
    setError('')
    try {
      const response = await accountFetch(`/api/v1/backtests/${encodeURIComponent(id)}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body?.detail ?? 'Không tải được kết quả')
      setSelected(body as BacktestRun)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được kết quả')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 lg:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">FinSight / Backtest</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Kiểm thử chiến lược</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Mô phỏng trên daily bars lịch sử. Tín hiệu ở giá đóng cửa, khớp lệnh tại giá mở cửa phiên tiếp theo; có tính phí, thuế bán và lô 100 cổ phiếu.</p>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      {!token ? (
        <section className="panel-shell flex flex-col items-center gap-3 rounded-2xl p-8 text-center">
          <LockKeyhole className="h-6 w-6 text-primary" />
          <h2 className="font-semibold">Đăng nhập để chạy và lưu backtest</h2>
          <p className="text-sm text-muted-foreground">Kết quả được lưu riêng theo tài khoản của bạn.</p>
          <Link href="/account" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Đến trang tài khoản</Link>
        </section>
      ) : (
        <>
          <section className="panel-shell rounded-2xl p-5">
            <form onSubmit={runBacktest} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <label className="text-xs text-muted-foreground">Mã cổ phiếu<input required maxLength={12} value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-mono text-foreground" /></label>
              <label className="text-xs text-muted-foreground">Chiến lược<select value={strategy} onChange={(event) => setStrategy(event.target.value as Strategy)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground">{STRATEGIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label className="text-xs text-muted-foreground">Từ<input required type="date" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground" /></label>
              <label className="text-xs text-muted-foreground">Đến<input required type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground" /></label>
              <label className="text-xs text-muted-foreground">Vốn ban đầu<input required type="number" min="1" max="100000000000" value={capital} onChange={(event) => setCapital(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground" /></label>
              <button disabled={loading} className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Play className="h-4 w-4" /> Chạy mô phỏng</button>
            </form>
          </section>

          {selected && (
            <section className="panel-shell rounded-2xl p-5">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-mono text-sm font-bold text-primary">{selected.symbol} · {STRATEGIES.find((item) => item.id === selected.strategy)?.label ?? selected.strategy}</p><p className="mt-1 text-xs text-muted-foreground">{selected.start} — {selected.end} · nguồn {selected.source === 'csv-demo' ? 'dữ liệu minh họa' : selected.source}</p></div>
                <span className={`rounded-full border px-2.5 py-1 text-xs ${selected.source === 'csv-demo' ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'}`}>{selected.source === 'csv-demo' ? 'Synthetic demo' : 'Provider data'}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Giá trị cuối kỳ', fmtMoney(selected.finalEquity)],
                  ['Lợi nhuận chiến lược', fmtPercent(selected.totalReturn)],
                  ['Buy & hold benchmark', fmtPercent(selected.benchmark.totalReturn)],
                  ['Vượt benchmark', fmtPercent(selected.benchmark.excessReturn)],
                  ['CAGR', fmtPercent(selected.cagr)],
                  ['Sụt giảm tối đa', fmtPercent(selected.maxDrawdown)],
                  ['Sharpe ratio', selected.sharpeRatio.toFixed(2)],
                  ['Số giao dịch', String(selected.tradeCount)],
                ].map(([label, value]) => <div key={label} className="rounded-xl border border-border/70 bg-background/60 p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p></div>)}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Kết quả lịch sử không đảm bảo hiệu quả trong tương lai; dữ liệu demo không phải giá giao dịch thật.</p>
            </section>
          )}

          <section className="panel-shell rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4 text-primary" /> Lịch sử của bạn</h2><button type="button" onClick={() => void refreshRuns()} disabled={loading} aria-label="Làm mới lịch sử" className="rounded-lg p-2 text-muted-foreground hover:bg-card hover:text-foreground"><RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /></button></div>
            {runs.length ? <div className="divide-y divide-border/60">{runs.map((run) => <button key={run.id} type="button" onClick={() => void openRun(run.id)} className="flex w-full flex-wrap items-center justify-between gap-3 py-3 text-left hover:bg-card/40"><span><span className="font-mono font-semibold text-foreground">{run.symbol}</span><span className="ml-2 text-sm text-muted-foreground">{STRATEGIES.find((item) => item.id === run.strategy)?.label ?? run.strategy}</span><span className="ml-2 text-xs text-muted-foreground">{run.start} — {run.end}</span></span><span className={`text-sm font-semibold tabular-nums ${run.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtPercent(run.totalReturn)}</span></button>)}</div> : <p className="py-6 text-center text-sm text-muted-foreground">Chưa có kết quả. Chạy mô phỏng đầu tiên để lưu vào tài khoản.</p>}
          </section>
        </>
      )}
    </div>
  )
}
