'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, LogOut, Plus, RefreshCw, UserRound } from 'lucide-react'
import { ACCESS_TOKEN_KEY, accountFetch } from '@/lib/account'

type Position = { symbol: string; name: string | null; quantity: number; averageCost: number }
type Transaction = { id: string; symbol: string; side: 'BUY' | 'SELL'; quantity: number; price: number; fee: number; tax: number; createdAt: string | null }

async function accountRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await accountFetch(`/api/v1/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail ?? body?.error?.message ?? `Yêu cầu thất bại (${response.status})`)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

export default function AccountPage() {
  const [token, setToken] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [registering, setRegistering] = useState(false)
  const [positions, setPositions] = useState<Position[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [trade, setTrade] = useState({ symbol: '', side: 'BUY', quantity: '', price: '', fee: '0' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async (accessToken = token) => {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      const [positionData, transactionData] = await Promise.all([
        accountRequest<{ items: Position[] }>('portfolio/positions', accessToken),
        accountRequest<{ items: Transaction[] }>('portfolio/transactions?limit=50', accessToken),
      ])
      setPositions(positionData.items)
      setTransactions(transactionData.items)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu tài khoản')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    const saved = sessionStorage.getItem(ACCESS_TOKEN_KEY)
    if (saved) setToken(saved)
  }, [])

  useEffect(() => { if (token) void refresh(token) }, [token, refresh])

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch(`/api/v1/auth/${registering ? 'register' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }), credentials: 'same-origin',
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.detail ?? 'Đăng nhập không thành công')
      sessionStorage.setItem(ACCESS_TOKEN_KEY, body.accessToken)
      setToken(body.accessToken)
      setNotice(`Đã ${registering ? 'tạo tài khoản' : 'đăng nhập'}: ${body.user.email}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xác thực tài khoản')
    } finally {
      setLoading(false)
    }
  }

  const recordTrade = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(''); setNotice('')
    try {
      await accountRequest('portfolio/trades', token, {
        method: 'POST', body: JSON.stringify({
          symbol: trade.symbol.trim().toUpperCase(), side: trade.side,
          quantity: Number(trade.quantity), price: Number(trade.price), fee: Number(trade.fee),
        }),
      })
      setNotice('Đã ghi nhận giao dịch và cập nhật vị thế.')
      setTrade({ ...trade, quantity: '', price: '', fee: '0' })
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không ghi được giao dịch')
    }
  }

  const logout = async () => {
    try { await accountFetch('/api/v1/auth/logout', { method: 'POST' }) } catch { /* clear local session anyway */ }
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    setToken(''); setPositions([]); setTransactions([]); setNotice('Đã đăng xuất.')
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">FinSight / Tài khoản</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">Danh mục đầu tư</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Lưu watchlist và ghi nhận giao dịch mô phỏng. FinSight không đặt lệnh thật.</p>
        </div>
        {token && <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-card disabled:opacity-50"><RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Làm mới</button>}
      </header>

      {(error || notice) && <div role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>{error || notice}</div>}

      {!token ? (
        <section className="panel-shell mx-auto max-w-md rounded-2xl p-6">
          <div className="mb-5 flex items-center gap-3"><UserRound className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">{registering ? 'Tạo tài khoản' : 'Đăng nhập'}</h2><p className="text-xs text-muted-foreground">Email và mật khẩu tối thiểu 10 ký tự</p></div></div>
          <form onSubmit={authenticate} className="space-y-3">
            <label className="block text-xs text-muted-foreground">Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground" /></label>
            <label className="block text-xs text-muted-foreground">Mật khẩu<input type="password" required minLength={10} autoComplete={registering ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground" /></label>
            <button disabled={loading} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Đang xử lý...' : registering ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
          </form>
          <button type="button" onClick={() => setRegistering(!registering)} className="mt-4 text-sm text-primary hover:underline">{registering ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}</button>
        </section>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="panel-shell rounded-2xl p-5">
              <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Vị thế đang nắm giữ</h2><button type="button" onClick={() => void logout()} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><LogOut className="h-3.5 w-3.5" /> Đăng xuất</button></div>
              {positions.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="py-2">Mã</th><th>Tên</th><th className="text-right">Số lượng</th><th className="text-right">Giá vốn TB</th></tr></thead><tbody>{positions.map((position) => <tr key={position.symbol} className="border-t border-border/60"><td className="py-3 font-mono font-bold"><Link href={`/stock/${position.symbol}`} className="hover:text-primary">{position.symbol}<ArrowUpRight className="ml-1 inline h-3 w-3" /></Link></td><td className="max-w-48 truncate text-muted-foreground">{position.name ?? '—'}</td><td className="text-right tabular-nums">{position.quantity.toLocaleString('vi-VN')}</td><td className="text-right tabular-nums">{position.averageCost.toLocaleString('vi-VN')}</td></tr>)}</tbody></table></div> : <p className="py-8 text-center text-sm text-muted-foreground">Chưa có vị thế. Ghi nhận giao dịch mua ở bên cạnh.</p>}
            </div>
            <div className="panel-shell rounded-2xl p-5">
              <h2 className="mb-4 font-semibold">Ghi nhận giao dịch mô phỏng</h2>
              <form onSubmit={recordTrade} className="grid grid-cols-2 gap-3">
                <label className="col-span-2 text-xs text-muted-foreground">Mã cổ phiếu<input required maxLength={12} value={trade.symbol} onChange={(event) => setTrade({ ...trade, symbol: event.target.value.toUpperCase() })} placeholder="VD: FPT" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
                <label className="text-xs text-muted-foreground">Loại<select value={trade.side} onChange={(event) => setTrade({ ...trade, side: event.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"><option value="BUY">Mua</option><option value="SELL">Bán</option></select></label>
                <label className="text-xs text-muted-foreground">Số lượng<input required type="number" min="1" step="1" value={trade.quantity} onChange={(event) => setTrade({ ...trade, quantity: event.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
                <label className="text-xs text-muted-foreground">Giá khớp<input required type="number" min="0.0001" step="0.0001" value={trade.price} onChange={(event) => setTrade({ ...trade, price: event.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
                <label className="text-xs text-muted-foreground">Phí<input type="number" min="0" step="0.0001" value={trade.fee} onChange={(event) => setTrade({ ...trade, fee: event.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
                <button disabled={loading} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Ghi nhận</button>
              </form>
            </div>
          </section>
          <section className="panel-shell rounded-2xl p-5">
            <h2 className="mb-3 font-semibold">Lịch sử giao dịch</h2>
            {transactions.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="py-2">Thời gian</th><th>Mã</th><th>Loại</th><th className="text-right">Khối lượng</th><th className="text-right">Giá</th><th className="text-right">Phí / thuế</th></tr></thead><tbody>{transactions.map((item) => <tr key={item.id} className="border-t border-border/60"><td className="py-3 text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '—'}</td><td className="font-mono font-semibold">{item.symbol}</td><td className={item.side === 'BUY' ? 'text-emerald-400' : 'text-amber-300'}>{item.side === 'BUY' ? 'Mua' : 'Bán'}</td><td className="text-right tabular-nums">{item.quantity.toLocaleString('vi-VN')}</td><td className="text-right tabular-nums">{item.price.toLocaleString('vi-VN')}</td><td className="text-right tabular-nums">{(item.fee + item.tax).toLocaleString('vi-VN')}</td></tr>)}</tbody></table></div> : <p className="py-5 text-sm text-muted-foreground">Chưa có giao dịch được ghi nhận.</p>}
          </section>
        </>
      )}
    </div>
  )
}
