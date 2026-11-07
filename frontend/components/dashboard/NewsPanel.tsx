'use client'

import Link from 'next/link'
import type { NewsItem, NewsReaction, AIExplainRequest } from '@/lib/api'
import { ExplainButton } from '@/components/shared/ExplainButton'
import { Skeleton } from '@/components/shared/Skeleton'
import { Panel, Change, SymbolChip, EmptyState } from '@/components/fs'
import { formatNewsTime } from '@/components/news/NewsCard'

function Reaction({ r }: { r: NewsReaction | undefined }) {
  if (!r) return <span className="text-[var(--fs-muted)]">–</span>
  switch (r.status) {
    case 'measured':
      return <Change value={r.t1.abnormalReturnPct} />
    case 'pending':
      return <span className="text-[var(--fs-muted)]">Chờ</span>
    case 'insufficient_data':
      return <span className="text-[var(--fs-muted)]">Chưa đủ dữ liệu</span>
    case 'overlapping_event':
      return <span className="text-[var(--fs-muted)]">Trùng tin khác</span>
    default:
      return <span className="text-[var(--fs-muted)]">–</span>
  }
}

interface NewsPanelProps {
  items: NewsItem[]
  loading?: boolean
  onExplain: (req: AIExplainRequest) => void
  className?: string
}

export function NewsPanel({ items, loading, onExplain, className = '' }: NewsPanelProps) {
  return (
    <Panel
      title="Tin & phản ứng giá"
      className={className}
      aside={<Link href="/news" className="text-[var(--fs-signal)]">Xem tất cả</Link>}
    >
      {loading ? (
        <div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 border-b border-[var(--fs-line)] px-5 py-3.5 last:border-0">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="Chưa có tin" hint="Dữ liệu tin sẽ hiện khi nguồn tin sẵn sàng." />
      ) : (
        <>
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--fs-line)] text-[12px] text-[var(--fs-muted)]">
                <th scope="col" className="px-5 py-2 font-normal">Ngày</th>
                <th scope="col" className="px-2 py-2 font-normal">Bản tin</th>
                <th scope="col" className="hidden px-2 py-2 font-normal sm:table-cell">Mã liên quan</th>
                <th scope="col" className="px-5 py-2 text-right font-normal">Phiên sau</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 8).map((item) => (
                <tr key={item.id} className="border-b border-[var(--fs-line)] align-top last:border-0 hover:bg-[var(--fs-surface)]">
                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-[var(--fs-muted)]">{formatNewsTime(item.time)}</td>
                  <td className="min-w-0 px-2 py-3">
                    <div className="flex items-start gap-2">
                      <p className="line-clamp-2 text-[14px] leading-snug">{item.headline}</p>
                      <ExplainButton
                        onClick={() => onExplain({
                          type: 'news', title: item.headline,
                          context: `Nguồn: ${item.source}. Tác động: ${item.marketImpact}. Mã: ${item.affectedTickers.join(', ')}`,
                          snapshot: { headline: item.headline, source: item.source, impact: item.marketImpact, tickers: item.affectedTickers.join(', ') },
                        })}
                        size="sm"
                      />
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--fs-muted)]">
                      {[item.category, item.marketImpact].filter(Boolean).join(', ')}
                    </p>
                  </td>
                  <td className="hidden px-2 py-3 sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {item.affectedTickers.slice(0, 3).map((t) => <SymbolChip key={t} symbol={t} />)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">
                    <Reaction r={item.reactions?.[0]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-[var(--fs-line)] px-5 py-3 text-[12px] text-[var(--fs-muted)]">
            Biến động so với VN-Index, không khẳng định nhân quả.
          </p>
        </>
      )}
    </Panel>
  )
}
