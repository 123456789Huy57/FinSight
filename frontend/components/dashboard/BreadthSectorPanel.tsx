'use client'

import { Activity, BarChart2 } from 'lucide-react'
import type { MarketBreadth, SectorItem, AIExplainRequest } from '@/lib/api'
import { ExplainButton } from '@/components/shared/ExplainButton'
import { Skeleton } from '@/components/shared/Skeleton'

// ─── Breadth ──────────────────────────────────────────────────

export function BreadthPanel({ breadth, loading, onExplain }: {
  breadth: MarketBreadth | null
  loading?: boolean
  onExplain: (req: AIExplainRequest) => void
}) {
  const advancers = breadth?.advancers ?? 0
  const decliners = breadth?.decliners ?? 0
  const unchanged = breadth?.unchanged ?? 0
  const total = advancers + decliners + unchanged || 1
  const advPct = (advancers / total) * 100
  const decPct = (decliners / total) * 100
  const riskOn = (breadth?.sentiment ?? '') === 'RISK-ON'

  return (
    <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] overflow-hidden shadow-md shadow-black/40">
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[rgba(79,142,247,0.12)]">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-primary" strokeWidth={2} />
          <span className="text-[13px] font-bold text-foreground">Độ rộng</span>
        </div>
        <div className="flex items-center gap-2">
          {!loading && breadth && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border leading-none ${
              riskOn
                ? 'bg-[#34d399]/10 text-[#34d399] border-[#34d399]/25'
                : 'bg-[#f87171]/10 text-[#f87171] border-[#f87171]/25'
            }`}>
              {breadth.sentiment}
            </span>
          )}
          <ExplainButton
            onClick={() => onExplain({
              type: 'breadth', title: 'Độ rộng thị trường',
              context: `${advancers} tăng, ${decliners} giảm, ${unchanged} đứng giá. Tâm lý: ${breadth?.sentiment}`,
            })}
          />
        </div>
      </div>

      <div className="p-3.5 space-y-3">
        {/* Tricolor progress bar */}
        {loading ? (
          <Skeleton className="h-2 w-full rounded-full" />
        ) : (
          <div className="w-full h-2 rounded-full bg-[#1a2744] overflow-hidden flex">
            <div className="bg-[#34d399] h-full transition-all duration-700 ease-out" style={{ width: `${advPct}%` }} />
            <div className="bg-[#1e3158]/40 h-full" style={{ width: `${100 - advPct - decPct}%` }} />
            <div className="bg-[#f87171] h-full transition-all duration-700 ease-out" style={{ width: `${decPct}%` }} />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 text-center">
          {[
            { label: 'Tăng', value: advancers, color: 'text-[#34d399]' },
            { label: 'Đứng', value: unchanged, color: 'text-[#7a8ba8]' },
            { label: 'Giảm', value: decliners, color: 'text-[#f87171]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="space-y-0.5 py-1">
              {loading ? (
                <Skeleton className="h-5 w-8 mx-auto" />
              ) : (
                <p className={`text-[18px] font-black tabular ${color}`}>{value}</p>
              )}
              <p className="text-[10px] text-[#3d4f6b] uppercase tracking-wide font-semibold">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Sector ───────────────────────────────────────────────────

export function SectorPanel({ leading, weak, onExplain, loading }: {
  leading: SectorItem[]
  weak: SectorItem[]
  loading?: boolean
  onExplain: (req: AIExplainRequest) => void
}) {
  const all = [
    ...leading.map((s) => ({ ...s, direction: 'up' as const })),
    ...weak.map((s)    => ({ ...s, direction: 'down' as const })),
  ].sort((a, b) => (b.percent_change ?? Number.NEGATIVE_INFINITY) - (a.percent_change ?? Number.NEGATIVE_INFINITY))

  return (
    <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] overflow-hidden shadow-md shadow-black/40">
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[rgba(79,142,247,0.12)]">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-3.5 h-3.5 text-primary" strokeWidth={2} />
          <span className="text-[13px] font-bold text-foreground">Ngành hôm nay</span>
        </div>
        <ExplainButton
          onClick={() => onExplain({
            type: 'sectors', title: 'Phân tích ngành',
            context: `Dẫn dắt: ${leading[0]?.name ?? ''} (${leading[0]?.percent_change?.toFixed(2)}%). Yếu: ${weak[0]?.name ?? ''}`,
          })}
        />
      </div>

      <div className="py-1">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-3.5 py-2">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-2.5 w-10" />
              </div>
            ))
          : all.slice(0, 8).map((s) => {
              const up = (s.percent_change ?? 0) >= 0
              const barW = s.percent_change == null ? 0 : Math.min(Math.abs(s.percent_change) * 22, 100)
              const valueColor = s.percent_change == null ? 'text-[#7a8ba8]' : up ? 'text-[#34d399]' : 'text-[#f87171]'
              return (
                <div
                  key={s.name}
                  className="flex items-center justify-between px-3.5 py-2 hover:bg-[#0e1726] transition-colors group"
                >
                  <button
                    type="button"
                    onClick={() => onExplain({
                      type: 'sector', title: s.name, sector: s.name,
                      context: `Biến động: ${s.percent_change == null ? 'không có dữ liệu' : `${s.percent_change >= 0 ? '+' : ''}${s.percent_change.toFixed(2)}%`}, ${s.stocks} mã`,
                    })}
                    className="text-[12px] text-[#9baac0] group-hover:text-foreground transition-colors truncate max-w-[140px] text-left leading-none"
                  >
                    {s.name}
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-14 h-1 bg-[#1a2744] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${up ? 'bg-[#34d399]/60' : 'bg-[#f87171]/60'}`}
                        style={{ width: `${barW}%` }}
                      />
                    </div>
                    <span className={`text-[12px] font-bold tabular min-w-[48px] text-right ${valueColor}`}>
                      {s.percent_change == null ? '-' : `${up ? '+' : ''}${s.percent_change.toFixed(2)}%`}
                    </span>
                  </div>
                </div>
              )
            })}
      </div>
    </div>
  )
}
