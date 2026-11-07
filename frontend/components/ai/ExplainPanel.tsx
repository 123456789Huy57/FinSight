'use client'

import { X, Sparkles, TrendingUp, ShieldAlert, Eye, Zap, Cpu, BookOpen, Loader2 } from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'
import type { AIExplainRequest, AIExplainResponse } from '@/lib/api'
import { explainItem } from '@/lib/api'

function buildFallback(req: AIExplainRequest | null): AIExplainResponse | null {
  if (!req) return null
  const t = req.symbol ?? req.title
  if (req.type === 'stock') {
    return {
      summary: `Đang phân tích ${t}. FinSight sẽ tổng hợp dữ liệu kỹ thuật (MA, RSI, xu hướng giá) và cơ bản (ngành, vĩ mô, tin tức).`,
      key_drivers: ['Giá và khối lượng giao dịch', 'Xu hướng kỹ thuật ngắn hạn', 'Bối cảnh ngành và tin tức'],
      bullish_factors: ['Dòng tiền đang chú ý mã này', 'Xu hướng có thể đang cải thiện', 'Ngành hỗ trợ'],
      risk_factors: ['Rung lắc theo thị trường chung', 'Khối lượng chưa xác nhận', 'Tin xấu đột ngột'],
      watch_next: ['MA20 và MA50', 'RSI14', 'Phản ứng phiên tới'],
    }
  }
  return {
    summary: `Phân tích ${req.title} sẽ rõ hơn khi FinSight thu thập đủ dữ liệu ngữ cảnh.`,
    key_drivers: ['Dòng tiền và độ rộng', 'Ngành liên quan', 'Tín hiệu tin tức'],
    bullish_factors: ['Hỗ trợ từ nhóm dẫn dắt', 'Bối cảnh tích cực', 'Xác suất lan tỏa'],
    risk_factors: ['Có thể đảo nhịp', 'Dữ liệu chưa đủ', 'Tin tức bất ngờ'],
    watch_next: ['Xác nhận đóng cửa', 'Phản ứng ngành liên quan', 'Thanh khoản'],
  }
}

const SNAPSHOT_LABELS: Record<string, string> = {
  symbol: 'Mã', company_name: 'Công ty', sector: 'Ngành', exchange: 'Sàn',
  current_price: 'Giá', price_change: 'Thay đổi', percent_change: '% Biến động',
  volume: 'Khối lượng', week52_high: '52W cao', week52_low: '52W thấp',
  points: 'Điểm số', change: 'Thay đổi', headline: 'Tiêu đề',
  source: 'Nguồn', impact: 'Tác động', tickers: 'Mã liên quan', insight: 'Phân tích',
}

function fmt(v: string | number | boolean | null | undefined) {
  if (v === null || v === undefined) return 'N/A'
  if (typeof v === 'number') return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (typeof v === 'boolean') return v ? 'Có' : 'Không'
  return v
}

interface Props {
  isOpen: boolean
  onClose: () => void
  request: AIExplainRequest | null
}

export function ExplainPanel({ isOpen, onClose, request }: Props) {
  const [data, setData] = useState<AIExplainResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const fallback = useMemo(() => buildFallback(request), [request])

  useEffect(() => {
    if (!isOpen || !request) { setData(null); return }
    let cancelled = false
    setLoading(true)
    setData(null)

    explainItem(request)
      .then((res) => { if (!cancelled) setData(res) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [isOpen, request])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!isOpen) return null

  const active = data ?? (loading ? null : fallback)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-full md:w-[480px] flex flex-col border-l border-[#1a2744] bg-[#0e1726] shadow-2xl shadow-black/60 slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(79,142,247,0.12)] bg-[#0e1726] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-[13px] font-bold text-foreground">FinSight</h2>
              <p className="text-[11px] text-[#7a8ba8] font-medium mt-0.5 truncate max-w-[280px]">
                {request?.title ?? 'Phân tích'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#7a8ba8] hover:bg-[#1a2744] hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm font-bold text-primary">Đang phân tích...</p>
              <p className="text-xs text-[#7a8ba8]">Tổng hợp dữ liệu kỹ thuật và cơ bản</p>
            </div>
          )}

          {/* Preview while loading */}
          {loading && fallback && (
            <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] p-4 opacity-40">
              <p className="text-xs text-[#7a8ba8] italic">{fallback.summary}</p>
            </div>
          )}

          {/* Result */}
          {!loading && active && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Nhận định</span>
                </div>
                <p className="text-[13px] font-semibold text-foreground leading-relaxed">{active.summary}</p>
              </div>

              {/* Live snapshot */}
              {request?.snapshot && (
                <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="w-3.5 h-3.5 text-[#06b6d4]" />
                    <span className="text-[10px] font-bold text-[#06b6d4] uppercase tracking-wider">Dữ liệu thực tế</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(request.snapshot).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2 text-xs border-b border-[#0f1f3d] pb-1.5">
                        <span className="text-[#7a8ba8]">{SNAPSHOT_LABELS[k] ?? k.replace(/_/g, ' ')}</span>
                        <span className="font-semibold text-foreground">{fmt(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Technical snapshot from AI */}
              {active.technical_snapshot && (
                <div className="rounded-xl border border-[#06b6d4]/20 bg-[#06b6d4]/[0.04] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="w-3.5 h-3.5 text-[#06b6d4]" />
                    <span className="text-[10px] font-bold text-[#06b6d4] uppercase tracking-wider">Kỹ thuật</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      ['Xu hướng', active.technical_snapshot.trend],
                      ['RSI 14', active.technical_snapshot.rsi14],
                      ['MA 20', active.technical_snapshot.ma20],
                      ['MA 50', active.technical_snapshot.ma50],
                      ['5D%', active.technical_snapshot.ret_5d_pct ? `${active.technical_snapshot.ret_5d_pct > 0 ? '+' : ''}${active.technical_snapshot.ret_5d_pct}%` : null],
                      ['20D%', active.technical_snapshot.ret_20d_pct ? `${active.technical_snapshot.ret_20d_pct > 0 ? '+' : ''}${active.technical_snapshot.ret_20d_pct}%` : null],
                    ].map(([label, val]) => val !== null && val !== undefined ? (
                      <div key={label as string} className="flex justify-between border-b border-[#0f1f3d] pb-1">
                        <span className="text-[#7a8ba8]">{label as string}</span>
                        <span className="font-semibold text-foreground">{fmt(val)}</span>
                      </div>
                    ) : null)}
                  </div>
                </div>
              )}

              {/* Fundamental snapshot */}
              {active.fundamental_snapshot && (
                <div className="rounded-xl border border-[#34d399]/20 bg-[#34d399]/[0.04] p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <TrendingUp className="w-3.5 h-3.5 text-[#34d399]" />
                    <span className="text-[10px] font-bold text-[#34d399] uppercase tracking-wider">Cơ bản</span>
                  </div>
                  <p className="text-xs text-[#7a8ba8] mb-1">
                    <span className="font-semibold text-foreground">Ngành: </span>
                    {active.fundamental_snapshot.sector ?? 'N/A'}
                  </p>
                  {active.fundamental_snapshot.read && (
                    <p className="text-xs text-foreground leading-relaxed">{active.fundamental_snapshot.read}</p>
                  )}
                </div>
              )}

              {/* Key drivers */}
              {active.key_drivers?.length ? (
                <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-3.5 h-3.5 text-[#06b6d4]" />
                    <span className="text-[10px] font-bold text-[#06b6d4] uppercase tracking-wider">Động lực chính</span>
                  </div>
                  <ul className="space-y-2">
                    {active.key_drivers.map((item, i) => (
                      <li key={i} className="flex gap-2.5 text-xs text-foreground leading-relaxed">
                        <span className="text-[#06b6d4] font-black mt-0.5 flex-shrink-0">→</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Bullish */}
              {active.bullish_factors?.length ? (
                <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-3.5 h-3.5 text-[#34d399]" />
                    <span className="text-[10px] font-bold text-[#34d399] uppercase tracking-wider">Điểm tích cực</span>
                  </div>
                  <ul className="space-y-2">
                    {active.bullish_factors.map((item, i) => (
                      <li key={i} className="flex gap-2.5 text-xs text-foreground leading-relaxed">
                        <span className="text-[#34d399] font-black mt-0.5 flex-shrink-0">+</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Risk */}
              {active.risk_factors?.length ? (
                <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#f87171]" />
                    <span className="text-[10px] font-bold text-[#f87171] uppercase tracking-wider">Rủi ro</span>
                  </div>
                  <ul className="space-y-2">
                    {active.risk_factors.map((item, i) => (
                      <li key={i} className="flex gap-2.5 text-xs text-foreground leading-relaxed">
                        <span className="text-[#f87171] font-black mt-0.5 flex-shrink-0">-</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Watch next */}
              {active.watch_next?.length ? (
                <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="w-3.5 h-3.5 text-[#f59e0b]" />
                    <span className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-wider">Cần theo dõi</span>
                  </div>
                  <ul className="space-y-2">
                    {active.watch_next.map((item, i) => (
                      <li key={i} className="flex gap-2.5 text-xs text-foreground leading-relaxed">
                        <span className="text-[#f59e0b] font-black mt-0.5 flex-shrink-0">◎</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1a2744] flex-shrink-0">
          <p className="text-[10px] text-[#3d4f6b] leading-relaxed">
            Phân tích do AI tạo từ dữ liệu kỹ thuật và cơ bản. Không phải khuyến nghị đầu tư.
          </p>
        </div>
      </div>
    </>
  )
}
