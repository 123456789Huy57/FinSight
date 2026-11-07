'use client'

import { Newspaper, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import type { NewsItem, AIExplainRequest } from '@/lib/api'
import { ExplainButton } from '@/components/shared/ExplainButton'
import { Skeleton } from '@/components/shared/Skeleton'
import { classifyImpact, formatNewsTime } from '@/components/news/NewsCard'

const IMPACT_STYLE = {
  positive: 'bg-primary/10 text-primary border-primary/25',
  negative: 'bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/25',
  watch:    'bg-[#f59e0b]/8 text-[#f59e0b] border-[#f59e0b]/20',
  neutral:  'bg-[#1a2744] text-[#7a8ba8] border-[#1e3158]',
}

function SmallImpactBadge({ impact }: { impact: string }) {
  const cls = classifyImpact(impact)
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-px rounded border leading-none whitespace-nowrap ${IMPACT_STYLE[cls]}`}>
      {impact}
    </span>
  )
}

interface NewsPanelProps {
  items: NewsItem[]
  loading?: boolean
  onExplain: (req: AIExplainRequest) => void
}

export function NewsPanel({ items, loading, onExplain }: NewsPanelProps) {
  return (
    <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] overflow-hidden shadow-md shadow-black/40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(79,142,247,0.12)]">
        <div className="flex items-center gap-2">
          <Newspaper className="w-3.5 h-3.5 text-primary" strokeWidth={2} />
          <h2 className="text-[13px] font-bold text-foreground">Tin tức nổi bật</h2>
        </div>
        <Link href="/news" className="text-[11px] font-semibold text-primary/60 hover:text-primary transition-colors">
          Xem tất cả
        </Link>
      </div>

      <div>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-4 py-3.5 space-y-2 border-b border-[#0f1f3d] last:border-0">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
              <div className="flex gap-1.5">
                <Skeleton className="h-4 w-14 rounded" />
                <Skeleton className="h-4 w-10 rounded" />
              </div>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-[#7a8ba8]">
            Chưa có tin tức. Đang kết nối...
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="px-4 py-3.5 hover:bg-[#0e1726] transition-colors group border-b border-[#0f1f3d] last:border-0">
              {/* Meta row */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-semibold text-[#7a8ba8]">{item.source}</span>
                <span className="text-[#1e3158] text-[10px]">·</span>
                <span className="text-[10px] text-[#3d4f6b]">{formatNewsTime(item.time)}</span>
                <SmallImpactBadge impact={item.marketImpact} />
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                    className="ml-auto text-[#3d4f6b] hover:text-primary transition-colors">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Headline */}
              <p className="text-[13px] font-semibold text-foreground leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
                {item.headline}
              </p>

              {/* Tickers + explain */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {item.affectedTickers.slice(0, 4).map((t) => (
                    <Link
                      key={t}
                      href={`/stock/${t}`}
                      className="text-[10px] font-bold text-primary/75 bg-primary/6 border border-primary/15 rounded px-1.5 py-0.5 hover:bg-primary/15 transition-colors"
                    >
                      {t}
                    </Link>
                  ))}
                </div>
                <ExplainButton
                  onClick={() => onExplain({
                    type: 'news', title: item.headline,
                    context: `Nguồn: ${item.source}. Tác động: ${item.marketImpact}. Mã: ${item.affectedTickers.join(', ')}`,
                    snapshot: { headline: item.headline, source: item.source, impact: item.marketImpact, tickers: item.affectedTickers.join(', ') },
                  })}
                  size="sm"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
