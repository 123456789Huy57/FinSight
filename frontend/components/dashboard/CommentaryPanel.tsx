'use client'

import { Zap, TrendingUp, ShieldAlert, Eye } from 'lucide-react'
import type { MarketCommentaryResponse, AIExplainRequest } from '@/lib/api'
import { ExplainButton } from '@/components/shared/ExplainButton'
import { Skeleton } from '@/components/shared/Skeleton'

interface CommentaryPanelProps {
  commentary: MarketCommentaryResponse | null
  loading?: boolean
  onExplain: (req: AIExplainRequest) => void
}

export function CommentaryPanel({ commentary, loading, onExplain }: CommentaryPanelProps) {
  const handleExplain = () =>
    onExplain({
      type: 'market',
      title: 'Nhận định thị trường hôm nay',
      context: commentary?.summary ?? 'Phân tích toàn cảnh thị trường',
    })

  return (
    <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] overflow-hidden shadow-md shadow-black/40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(79,142,247,0.12)]">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[#f59e0b]" strokeWidth={2.5} />
          <h2 className="text-[13px] font-bold text-foreground">Nhận định thị trường</h2>
        </div>
        <ExplainButton onClick={handleExplain} size="md" label="Phân tích AI" />
      </div>

      <div className="p-4 space-y-4">
        {/* Headline + summary */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        ) : (
          <>
            {commentary?.headline && (
              <p className="text-[15px] font-black text-foreground leading-snug tracking-tight">{commentary.headline}</p>
            )}
            <p className="text-[13px] text-[#9baac0] leading-relaxed border-l-2 border-primary/30 pl-3.5">
              {commentary?.summary ?? 'Đang tải nhận định thị trường...'}
            </p>
          </>
        )}

        {/* 3-col: drivers / bullish / risk */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            {
              icon: Zap, label: 'Động lực',
              borderColor: 'border-[#06b6d4]/15', bgColor: 'bg-[#06b6d4]/[0.03]',
              labelColor: 'text-[#06b6d4]', markerColor: 'text-[#06b6d4]',
              marker: '→', items: commentary?.key_drivers,
            },
            {
              icon: TrendingUp, label: 'Tích cực',
              borderColor: 'border-[#34d399]/15', bgColor: 'bg-[#34d399]/[0.03]',
              labelColor: 'text-[#34d399]', markerColor: 'text-[#34d399]',
              marker: '+', items: commentary?.bullish_factors,
            },
            {
              icon: ShieldAlert, label: 'Rủi ro',
              borderColor: 'border-[#f87171]/15', bgColor: 'bg-[#f87171]/[0.03]',
              labelColor: 'text-[#f87171]', markerColor: 'text-[#f87171]',
              marker: '-', items: commentary?.risk_factors,
            },
          ].map(({ icon: Icon, label, borderColor, bgColor, labelColor, markerColor, marker, items }) => (
            <div key={label} className={`rounded-lg border ${borderColor} ${bgColor} p-3`}>
              <div className="flex items-center gap-1.5 mb-2.5">
                <Icon className={`w-3 h-3 ${labelColor}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${labelColor}`}>{label}</span>
              </div>
              {loading ? (
                <div className="space-y-1.5"><Skeleton className="h-2.5 w-full" /><Skeleton className="h-2.5 w-4/5" /></div>
              ) : (
                <ul className="space-y-1.5">
                  {(items ?? []).map((item, i) => (
                    <li key={i} className="flex gap-1.5 text-[12px] text-foreground/80 leading-snug">
                      <span className={`${markerColor} font-bold flex-shrink-0 mt-px`}>{marker}</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Watch next */}
        {!loading && commentary?.watch_next?.length ? (
          <div className="pt-3 border-t border-[#0f1f3d]">
            <div className="flex items-center gap-1.5 mb-2">
              <Eye className="w-3 h-3 text-[#f59e0b]" />
              <span className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-wider">Theo dõi</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {commentary.watch_next.map((item, i) => (
                <span key={i} className="text-[11px] bg-[#f59e0b]/8 border border-[#f59e0b]/20 text-[#f59e0b]/90 rounded-md px-2 py-0.5 font-semibold">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
