'use client'

import { CircleUser, Menu, Search, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { SearchResult } from '@/lib/api'
import { searchStocks } from '@/lib/api'
import { useMarketPolling } from '@/lib/useMarketPolling'
import { MarketStatusBadge } from '@/components/shared/MarketStatusBadge'
import { Logo } from '@/components/fs'

const noop = () => {}

const NAV_ITEMS = [
  { href: '/dashboard',   label: 'Tổng quan' },
  { href: '/market',      label: 'Cổ phiếu' },
  { href: '/news',        label: 'Tin tức' },
  { href: '/phuong-phap', label: 'Phương pháp' },
]

const USER_ITEMS = [
  { href: '/account',  label: 'Danh mục' },
  { href: '/backtest', label: 'Backtest' },
]

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(href + '/')

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const userBtnRef = useRef<HTMLButtonElement>(null)

  const marketStatus = useMarketPolling(noop, 60_000)
  const isHome = pathname === '/'

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (searchRef.current && !searchRef.current.contains(t)) setOpen(false)
      if (userRef.current && !userRef.current.contains(t)) setUserOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setUserOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

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
    setQuery(''); setOpen(false)
    router.push(`/stock/${symbol}`)
  }

  const linkCls = (on: boolean) =>
    `rounded-md px-3 py-2 text-[14px] transition-colors ${
      on
        ? 'bg-[var(--fs-surface)] font-medium text-[var(--fs-ink)]'
        : 'text-[var(--fs-ink-2)] hover:text-[var(--fs-ink)]'
    }`

  return (
    <>
      <header className="sticky top-0 z-50 h-16 border-b border-[var(--fs-line)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1240px] items-center gap-4 px-4 sm:px-6 md:gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-[var(--fs-ink)]" aria-label="FinSight, trang chủ">
            <Logo />
            <span className="text-[16px] font-semibold tracking-[-0.02em]">FinSight</span>
          </Link>

          <nav aria-label="Chính" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map(({ href, label }) => {
              const on = isActive(pathname, href)
              return (
                <Link key={href} href={href} aria-current={on ? 'page' : undefined} className={linkCls(on)}>
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-3">
            {isHome ? (
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center rounded-lg bg-[var(--fs-ink)] px-4 text-[14px] font-medium text-white"
              >
                Mở dashboard
              </Link>
            ) : (
              <div className="relative min-w-0" ref={searchRef}>
                <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-[var(--fs-line)] bg-[var(--fs-surface)] px-3 focus-within:border-[var(--fs-signal)] sm:w-[260px]">
                  <Search className="h-4 w-4 shrink-0 text-[var(--fs-muted)]" strokeWidth={1.75} aria-hidden="true" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value.toUpperCase())}
                    onFocus={() => { if (results.length > 0) setOpen(true) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setOpen(false); if (!open) setQuery('') }
                      if (e.key === 'Enter' && results[0]) navigate(results[0].symbol)
                    }}
                    placeholder="Tìm mã, ví dụ VCB"
                    aria-label="Tìm mã cổ phiếu"
                    className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--fs-ink)] placeholder:text-[var(--fs-muted)] focus:outline-none"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => { setQuery(''); setOpen(false) }}
                      aria-label="Xoá nội dung tìm"
                      className="shrink-0 text-[var(--fs-muted)] hover:text-[var(--fs-ink)]"
                    >
                      <X className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  )}
                </label>

                {open && (
                  <div
                    className="absolute right-0 top-full z-50 mt-2 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--fs-line)] bg-white py-1"
                    onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
                  >
                    {searching ? (
                      <div className="px-4 py-3 text-[13px] text-[var(--fs-muted)]">Đang tìm</div>
                    ) : results.length > 0 ? (
                      results.map((r) => (
                        <button
                          key={r.symbol}
                          type="button"
                          onClick={() => navigate(r.symbol)}
                          className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-[var(--fs-surface)] focus:bg-[var(--fs-surface)] focus:outline-none"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="text-[14px] font-semibold text-[var(--fs-ink)]">{r.symbol}</span>
                            {r.name && <span className="truncate text-[13px] text-[var(--fs-muted)]">{r.name}</span>}
                          </span>
                          <span className="shrink-0 text-[12px] text-[var(--fs-muted)]">{r.exchange}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-[13px] text-[var(--fs-muted)]">Không tìm thấy kết quả</div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="hidden shrink-0 lg:block">
              <MarketStatusBadge status={marketStatus} />
            </div>

            <div
              className="relative hidden md:block"
              ref={userRef}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && userOpen) { setUserOpen(false); userBtnRef.current?.focus() }
              }}
            >
              <button
                ref={userBtnRef}
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                aria-label="Tài khoản"
                aria-haspopup="menu"
                aria-expanded={userOpen}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fs-ink-2)] hover:bg-[var(--fs-surface)] hover:text-[var(--fs-ink)]"
              >
                <CircleUser className="h-5 w-5" strokeWidth={1.75} />
              </button>
              {userOpen && (
                <div role="menu" className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-[var(--fs-line)] bg-white py-1">
                  {USER_ITEMS.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      role="menuitem"
                      className="block px-3.5 py-2.5 text-[14px] text-[var(--fs-ink-2)] hover:bg-[var(--fs-surface)] hover:text-[var(--fs-ink)] focus:bg-[var(--fs-surface)] focus:outline-none"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--fs-ink-2)] hover:bg-[var(--fs-surface)] md:hidden"
              aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" strokeWidth={1.75} /> : <Menu className="h-5 w-5" strokeWidth={1.75} />}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed left-0 right-0 top-16 z-40 border-b border-[var(--fs-line)] bg-white md:hidden">
          <nav aria-label="Chính, di động" className="space-y-1 px-4 py-3">
            {NAV_ITEMS.map(({ href, label }) => {
              const on = isActive(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={on ? 'page' : undefined}
                  className={`block rounded-lg px-3 py-3 text-[15px] ${
                    on ? 'bg-[var(--fs-surface)] font-medium text-[var(--fs-ink)]' : 'text-[var(--fs-ink-2)]'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
            <div className="my-2 border-t border-[var(--fs-line)]" />
            {USER_ITEMS.map(({ href, label }) => {
              const on = isActive(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={on ? 'page' : undefined}
                  className={`block rounded-lg px-3 py-3 text-[15px] ${
                    on ? 'bg-[var(--fs-surface)] font-medium text-[var(--fs-ink)]' : 'text-[var(--fs-ink-2)]'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
            <div className="px-3 pt-2">
              <MarketStatusBadge status={marketStatus} />
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
