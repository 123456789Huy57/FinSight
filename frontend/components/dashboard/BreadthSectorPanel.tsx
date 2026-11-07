'use client'

import type { MarketBreadth, SectorItem, AIExplainRequest } from '@/lib/api'
import { ExplainButton } from '@/components/shared/ExplainButton'
import { Skeleton } from '@/components/shared/Skeleton'
import { Panel, Change } from '@/components/fs'

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

  const stats = [
    { label: 'Tăng', value: advancers, color: 'var(--fs-up)' },
    { label: 'Đứng', value: unchanged, color: 'var(--fs-flat)' },
    { label: 'Giảm', value: decliners, color: 'var(--fs-down)' },
  ]

  return (
    <Panel
      title="Độ rộng"
      aside={
        <ExplainButton
          onClick={() => onExplain({
            type: 'breadth', title: 'Độ rộng thị trường',
            context: `${advancers} tăng, ${decliners} giảm, ${unchanged} đứng giá. Tâm lý: ${breadth?.sentiment}`,
          })}
        />
      }
    >
      <div className="space-y-3 px-5 py-4">
        {loading ? (
          <Skeleton className="h-2 w-full rounded-full" />
        ) : (
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--fs-surface)]">
            <div style={{ width: `${advPct}%`, background: 'var(--fs-up)' }} />
            <div style={{ width: `${100 - advPct - decPct}%`, background: 'var(--fs-flat)' }} />
            <div style={{ width: `${decPct}%`, background: 'var(--fs-down)' }} />
          </div>
        )}
        <div className="grid grid-cols-3 text-center">
          {stats.map(({ label, value, color }) => (
            <div key={label}>
              {loading ? (
                <Skeleton className="mx-auto h-5 w-8" />
              ) : (
                <p className="text-[20px] font-medium tabular-nums" style={{ color }}>{value}</p>
              )}
              <p className="text-[13px] text-[var(--fs-muted)]">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </Panel>
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
    <Panel
      title="Ngành"
      aside={
        <ExplainButton
          onClick={() => onExplain({
            type: 'sectors', title: 'Phân tích ngành',
            context: `Dẫn dắt: ${leading[0]?.name ?? ''} (${leading[0]?.percent_change?.toFixed(2)}%). Yếu: ${weak[0]?.name ?? ''}`,
          })}
        />
      }
    >
      <ul className="divide-y divide-[var(--fs-line)]">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between px-5 py-2.5">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-2.5 w-10" />
              </li>
            ))
          : all.slice(0, 8).map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-[var(--fs-surface)]">
                <button
                  type="button"
                  onClick={() => onExplain({
                    type: 'sector', title: s.name, sector: s.name,
                    context: `Biến động: ${s.percent_change == null ? 'không có dữ liệu' : `${s.percent_change >= 0 ? '+' : ''}${s.percent_change.toFixed(2)}%`}, ${s.stocks} mã`,
                  })}
                  className="min-w-0 truncate text-left text-[14px]"
                >
                  {s.name}
                </button>
                <span className="text-[14px]"><Change value={s.percent_change} /></span>
              </li>
            ))}
      </ul>
    </Panel>
  )
}
