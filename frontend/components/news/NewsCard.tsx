'use client'

import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import type { NewsItem, AIExplainRequest } from '@/lib/api'
import { ExplainButton } from '@/components/shared/ExplainButton'

export type ImpactClass = 'positive' | 'negative' | 'watch' | 'neutral'

export function classifyImpact(impact: string): ImpactClass {
  const s = impact.toLowerCase()
  if (/tích cực/.test(s)) return 'positive'
  if (/áp lực|biến động/.test(s)) return 'negative'
  if (/nhạy cảm|hỗn hợp|theo dõi/.test(s)) return 'watch'
  if (/bullish|positive/.test(s)) return 'positive'
  if (/pressure|bearish|volatile/.test(s)) return 'negative'
  if (/sensitive|mixed|watch/.test(s)) return 'watch'
  return 'neutral'
}

const IMPACT_STYLE: Record<ImpactClass, string> = {
  positive: 'bg-[#34d399]/8 text-[#34d399] border-[#34d399]/25',
  negative: 'bg-[#f87171]/8 text-[#f87171] border-[#f87171]/25',
  watch:    'bg-[#f59e0b]/8 text-[#f59e0b] border-[#f59e0b]/25',
  neutral:  'bg-[#1a2744] text-[#7a8ba8] border-[#1e3158]',
}

function ImpactBadge({ impact }: { impact: string }) {
  const cls = classifyImpact(impact)
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${IMPACT_STYLE[cls]}`}>
      {impact}
    </span>
  )
}

export function formatNewsTime(time: string): string {
  if (!time || time === 'Now') return 'Vừa xong'
  try {
    const d = new Date(time)
    if (isNaN(d.getTime())) return time
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
    if (diffMin < 1) return 'Vừa xong'
    if (diffMin < 60) return `${diffMin} phút trước`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h trước`
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  } catch {
    return time
  }
}

interface Props {
  item: NewsItem
  onExplain: (req: AIExplainRequest) => void
}

export function NewsCard({ item, onExplain }: Props) {
  return (
    <div className="group px-5 py-4 hover:bg-[#0e1726] transition-colors border-b border-[#0f1f3d] last:border-0">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-[11px] font-bold text-[#7a8ba8]">{item.source}</span>
          <span className="text-[#1e3158] text-[11px]">·</span>
          <span className="text-[11px] text-[#3d4f6b]">{formatNewsTime(item.time)}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ImpactBadge impact={item.marketImpact} />
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[#3d4f6b] hover:text-primary transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Headline */}
      <h3 className="text-sm font-bold text-foreground leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
        {item.headline}
      </h3>

      {/* Insight */}
      {item.insight && (
        <p className="text-xs text-[#7a8ba8] leading-relaxed mb-3 line-clamp-2">
          {item.insight}
        </p>
      )}

      {/* Tickers + AI */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {item.affectedTickers.slice(0, 4).map((t) => (
            <Link
              key={t}
              href={`/stock/${t}`}
              className="text-[10px] font-bold text-primary bg-primary/8 border border-primary/20 rounded px-1.5 py-0.5 hover:bg-primary/15 transition-colors"
            >
              {t}
            </Link>
          ))}
        </div>
        <ExplainButton
          onClick={() => onExplain({
            type: 'news',
            title: item.headline,
            context: `Nguồn: ${item.source}. Tác động: ${item.marketImpact}. Mã liên quan: ${item.affectedTickers.join(', ')}. Tóm tắt: ${item.insight ?? ''}`,
            snapshot: {
              headline: item.headline,
              source: item.source,
              impact: item.marketImpact,
              tickers: item.affectedTickers.join(', '),
              insight: item.insight ?? '',
            },
          })}
          size="sm"
        />
      </div>
    </div>
  )
}
