'use client'

import { Star, Plus, X, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getQuote } from '@/lib/api'
import type { Quote } from '@/lib/api'

const STORAGE_KEY = 'finsight_watchlist'
const DEFAULT_WATCHLIST = ['VCB', 'FPT', 'MWG', 'SSI', 'HPG']

function fmtPrice(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>([])

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try { setSymbols(JSON.parse(stored) as string[]) }
      catch { setSymbols(DEFAULT_WATCHLIST) }
    } else {
      setSymbols(DEFAULT_WATCHLIST)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WATCHLIST))
    }
  }, [])

  const add = (sym: string) => {
    const next = [...new Set([...symbols, sym.toUpperCase()])]
    setSymbols(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const remove = (sym: string) => {
    const next = symbols.filter((s) => s !== sym)
    setSymbols(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return { symbols, add, remove }
}

export function Watchlist() {
  const { symbols, add, remove } = useWatchlist()
  const [quotes,   setQuotes]   = useState<Record<string, Quote>>({})
  const [loading,  setLoading]  = useState(false)
  const [addInput, setAddInput] = useState('')

  const fetchQuotes = async () => {
    if (!symbols.length) return
    setLoading(true)
    const fetched: Record<string, Quote> = {}
    await Promise.allSettled(
      symbols.map(async (sym) => {
        try { fetched[sym] = await getQuote(sym) }
        catch { /* keep existing */ }
      })
    )
    setQuotes((prev) => ({ ...prev, ...fetched }))
    setLoading(false)
  }

  useEffect(() => {
    if (symbols.length) void fetchQuotes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(',')])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const sym = addInput.trim().toUpperCase()
    if (sym && !symbols.includes(sym)) { add(sym); setAddInput('') }
  }

  return (
    <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] overflow-hidden shadow-md shadow-black/40">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[rgba(79,142,247,0.12)]">
        <div className="flex items-center gap-2">
          <Star className="w-3.5 h-3.5 text-[#f59e0b]" strokeWidth={2} fill="currentColor" fillOpacity={0.3} />
          <span className="text-[13px] font-bold text-foreground">Danh sách theo dõi</span>
        </div>
        <button
          type="button"
          onClick={() => void fetchQuotes()}
          disabled={loading}
          className="p-1 text-[#7a8ba8] hover:text-foreground transition-colors disabled:opacity-40 rounded-md hover:bg-[#1a2744]"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div>
        {symbols.map((sym) => {
          const q = quotes[sym]
          const up = (q?.percent_change ?? 0) >= 0
          return (
            <div
              key={sym}
              className="flex items-center justify-between px-3 py-2.5 hover:bg-[#0e1726] transition-colors group border-b border-[#0f1f3d] last:border-0"
            >
              <Link
                href={`/stock/${sym}`}
                className="text-[13px] font-bold font-mono text-foreground hover:text-primary transition-colors"
              >
                {sym}
              </Link>
              <div className="flex items-center gap-2.5">
                {q ? (
                  <>
                    <span className="text-[11px] text-[#7a8ba8] tabular">{fmtPrice(q.current_price)}</span>
                    <span className={`text-[12px] font-bold tabular w-[46px] text-right ${up ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                      {up ? '+' : ''}{q.percent_change.toFixed(2)}%
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-[#3d4f6b]">-</span>
                )}
                <button
                  type="button"
                  onClick={() => remove(sym)}
                  className="opacity-0 group-hover:opacity-100 text-[#3d4f6b] hover:text-[#f87171] transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={handleAdd} className="px-3 py-2.5 border-t border-[#1a2744] flex gap-2">
        <input
          type="text"
          value={addInput}
          onChange={(e) => setAddInput(e.target.value.toUpperCase())}
          placeholder="Thêm mã CK..."
          maxLength={10}
          className="flex-1 bg-[#0e1726] border border-[#1a2744] rounded-lg px-2.5 py-1 text-[12px] text-foreground
            placeholder:text-[#3d4f6b] focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
        />
        <button
          type="submit"
          className="px-2 py-1 bg-primary/10 border border-primary/20 text-primary rounded-lg hover:bg-primary/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  )
}
