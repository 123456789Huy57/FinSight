'use client'

import { BarChart2, TrendingUp, Newspaper, Search, X, ChevronRight, Menu } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { SearchResult } from '@/lib/api'
import { searchStocks } from '@/lib/api'
import { useMarketPolling } from '@/lib/useMarketPolling'
import { MarketStatusBadge } from '@/components/shared/MarketStatusBadge'

const noop = () => {}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart2 },
  { href: '/market',    label: 'Thị trường', icon: TrendingUp },
  { href: '/news',      label: 'Tin tức',    icon: Newspaper  },
]

export function TopNav() {
  const pathname  = usePathname()
  const router    = useRouter()
  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState<SearchResult[]>([])
  const [open,       setOpen]       = useState(false)
  const [searching,  setSearching]  = useState(false)
  const [focused,    setFocused]    = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const inputRef    = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const marketStatus = useMarketPolling(noop, 60_000)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchStocks(query)
        setResults(data.results ?? [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const navigate = (symbol: string) => {
    setQuery(''); setOpen(false); setFocused(false)
    router.push(`/stock/${symbol}`)
  }

  return (
    <>
    <header className="sticky top-0 z-50 h-16 border-b border-[rgba(79,142,247,0.12)] bg-[#060c18]/95 backdrop-blur-xl">
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 h-full flex items-center gap-4">

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0 group">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-shadow">
            <TrendingUp className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-black text-foreground tracking-tight leading-none">FinSight</span>
            <span className="text-[9px] font-black text-primary tracking-[0.15em] uppercase leading-none border border-primary/30 rounded px-1 py-px">AI</span>
          </div>
        </Link>

        {/* Divider */}
        <div className="h-5 w-px bg-[#1a2744] hidden md:block flex-shrink-0" />

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-150',
                  active
                    ? 'bg-[#1a2744] text-foreground'
                    : 'text-[#7a8ba8] hover:text-foreground hover:bg-[#0e1726]',
                ].join(' ')}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Search */}
        <div className="flex-1 max-w-[300px] ml-auto relative" ref={dropdownRef}>
          <div className={[
            'flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all duration-150',
            focused
              ? 'bg-[#0e1726] border-primary/50 shadow-sm shadow-primary/10'
              : 'bg-[#0e1726] border-[#1a2744] hover:border-[#1e3158]',
          ].join(' ')}>
            <Search className="w-3.5 h-3.5 text-[#3d4f6b] flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value.toUpperCase())}
              onFocus={() => setFocused(true)}
              placeholder="Tìm mã CK..."
              className="flex-1 text-[13px] bg-transparent text-foreground placeholder:text-[#3d4f6b] focus:outline-none min-w-0"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setOpen(false) }}
                className="text-[#3d4f6b] hover:text-foreground flex-shrink-0 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown */}
          {open && (
            <div className="absolute top-full mt-2 w-full rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] shadow-2xl shadow-black/60 z-50 overflow-hidden py-1 fade-up">
              {searching ? (
                <div className="px-4 py-3 text-xs text-[#7a8ba8]">Đang tìm...</div>
              ) : results.length > 0 ? (
                results.map((r) => (
                  <button
                    key={r.symbol}
                    type="button"
                    onClick={() => navigate(r.symbol)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-[#0e1726] transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors font-mono">{r.symbol}</span>
                      {r.name && <span className="text-xs text-[#7a8ba8] truncate">{r.name}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] font-semibold text-[#3d4f6b] border border-[#1e3158] rounded px-1.5 py-0.5 leading-none">{r.exchange}</span>
                      <ChevronRight className="w-3 h-3 text-[#3d4f6b] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-xs text-[#7a8ba8]">Không tìm thấy kết quả</div>
              )}
            </div>
          )}
        </div>

          {/* Market status — desktop */}
          <div className="flex-shrink-0 hidden sm:block">
            <MarketStatusBadge status={marketStatus} />
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[#7a8ba8] hover:text-foreground hover:bg-[#0e1726] transition-colors"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
    </header>

    {/* Mobile nav drawer */}
    {mobileOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 z-40 bg-[#060c18]/98 backdrop-blur-xl border-b border-[rgba(79,142,247,0.12)] fade-up">
          <div className="px-4 py-3 space-y-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    'flex items-center gap-3 px-3 py-3 rounded-xl text-[14px] font-semibold transition-all',
                    active
                      ? 'bg-[#1a2744] text-foreground'
                      : 'text-[#7a8ba8] hover:text-foreground hover:bg-[#0e1726]',
                  ].join(' ')}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </Link>
              )
            })}
            <div className="pt-2 pb-1 px-3">
              <MarketStatusBadge status={marketStatus} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
