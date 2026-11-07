'use client'

import { Plus, X, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getQuote } from '@/lib/api'
import type { Quote } from '@/lib/api'
import { Panel, Change } from '@/components/fs'
import { fmtPrice } from '@/lib/format'
import { accountFetch, ACCESS_TOKEN_KEY } from '@/lib/account'

const STORAGE_KEY = 'finsight_watchlist'
const DEFAULT_WATCHLIST = ['VCB', 'FPT', 'MWG', 'SSI', 'HPG']

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

  return { symbols, add, remove, replace: setSymbols }
}

export function Watchlist() {
  const { symbols, add, remove, replace } = useWatchlist()
  const [token, setToken] = useState('')
  const [quotes,   setQuotes]   = useState<Record<string, Quote>>({})
  const [loading,  setLoading]  = useState(false)
  const [addInput, setAddInput] = useState('')

  useEffect(() => {
    const savedToken = sessionStorage.getItem(ACCESS_TOKEN_KEY)
    if (!savedToken) return
    setToken(savedToken)
    void accountFetch('/api/v1/watchlist', { headers: { Authorization: `Bearer ${savedToken}` } })
      .then(async (response) => {
        if (!response.ok) return
        const data = await response.json() as { items: Array<{ symbol: string }> }
        const accountSymbols = data.items.map((item) => item.symbol)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(accountSymbols))
        setQuotes({})
        setAddInput('')
        replace(accountSymbols)
      })
      .catch(() => undefined)
  // Load the user-owned list once when this dashboard mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const sym = addInput.trim().toUpperCase()
    if (!sym || symbols.includes(sym)) return
    if (token) {
      const response = await accountFetch('/api/v1/watchlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol: sym }),
      })
      if (!response.ok) return
    }
    add(sym); setAddInput('')
  }

  const handleRemove = async (sym: string) => {
    if (token) {
      const response = await accountFetch(`/api/v1/watchlist/${encodeURIComponent(sym)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) return
    }
    remove(sym)
  }

  return (
    <Panel
      title="Danh sách theo dõi"
      className="lg:col-span-4"
      aside={
        <button
          type="button"
          onClick={() => void fetchQuotes()}
          disabled={loading}
          aria-label="Làm mới giá"
          className="rounded-md p-1 hover:bg-[var(--fs-surface)] disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      <ul className="divide-y divide-[var(--fs-line)]">
        {symbols.map((sym) => {
          const q = quotes[sym]
          return (
            <li key={sym} className="group flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-[var(--fs-surface)]">
              <div className="min-w-0">
                <Link href={`/stock/${sym}`} className="text-[14px] font-medium">{sym}</Link>
              </div>
              <div className="flex items-center gap-3">
                {q ? (
                  <div className="text-right tabular-nums">
                    <div className="text-[14px]">{fmtPrice(q.current_price, 0)}</div>
                    <div className="text-[12px]"><Change value={q.percent_change} /></div>
                  </div>
                ) : (
                  <span className="text-[var(--fs-muted)]">–</span>
                )}
                <button
                  type="button"
                  onClick={() => void handleRemove(sym)}
                  aria-label={`Bỏ ${sym} khỏi danh sách`}
                  className="text-[var(--fs-muted)] opacity-0 hover:text-[var(--fs-ink)] focus:opacity-100 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <form onSubmit={handleAdd} className="flex gap-2 border-t border-[var(--fs-line)] px-5 py-3">
        <input
          type="text"
          value={addInput}
          onChange={(e) => setAddInput(e.target.value.toUpperCase())}
          placeholder="Thêm mã"
          aria-label="Thêm mã vào danh sách theo dõi"
          maxLength={10}
          className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--fs-line)] bg-white px-3 text-[14px] outline-none focus:border-[var(--fs-ink)]"
        />
        <button
          type="submit"
          aria-label="Thêm mã"
          className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--fs-line)] hover:bg-[var(--fs-surface)]"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>
      <div className="border-t border-[var(--fs-line)] px-5 py-3 text-[12px] text-[var(--fs-muted)]">
        {token ? 'Danh sách đang đồng bộ với tài khoản.' : <Link href="/account" className="text-[var(--fs-signal)]">Đăng nhập để đồng bộ danh sách theo dõi</Link>}
      </div>
    </Panel>
  )
}
