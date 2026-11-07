'use client'

import type { MarketCommentaryResponse, AIExplainRequest } from '@/lib/api'
import { ExplainButton } from '@/components/shared/ExplainButton'
import { Skeleton } from '@/components/shared/Skeleton'
import { Panel } from '@/components/fs'

interface CommentaryPanelProps {
  commentary: MarketCommentaryResponse | null
  loading?: boolean
  onExplain: (req: AIExplainRequest) => void
  className?: string
}

export function CommentaryPanel({ commentary, loading, onExplain, className = '' }: CommentaryPanelProps) {
  const handleExplain = () =>
    onExplain({
      type: 'market',
      title: 'Nhận định thị trường hôm nay',
      context: commentary?.summary ?? 'Phân tích toàn cảnh thị trường',
    })

  const groups = [
    { label: 'Động lực', items: commentary?.key_drivers },
    { label: 'Điểm tích cực', items: commentary?.bullish_factors },
    { label: 'Rủi ro', items: commentary?.risk_factors },
  ]

  return (
    <Panel title="Bình luận thị trường" className={className} aside={<ExplainButton onClick={handleExplain} size="md" label="Giải thích" />}>
      <div className="space-y-4 px-5 py-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        ) : (
          <>
            {commentary?.headline && (
              <p className="text-[15px] font-medium leading-snug">{commentary.headline}</p>
            )}
            <p className="text-[14px] leading-relaxed text-[var(--fs-ink-2)]">
              {commentary?.summary ?? 'Chưa có bình luận.'}
            </p>
          </>
        )}

        {groups.map(({ label, items }) => (
          <div key={label}>
            <h3 className="mb-1.5 text-[13px] text-[var(--fs-muted)]">{label}</h3>
            {loading ? (
              <div className="space-y-1.5"><Skeleton className="h-2.5 w-full" /><Skeleton className="h-2.5 w-4/5" /></div>
            ) : (
              <ul className="list-disc space-y-1 pl-4 text-[14px] text-[var(--fs-ink-2)]">
                {(items ?? []).map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            )}
          </div>
        ))}

        {!loading && commentary?.watch_next?.length ? (
          <div className="border-t border-[var(--fs-line)] pt-3">
            <h3 className="mb-1.5 text-[13px] text-[var(--fs-muted)]">Cần theo dõi</h3>
            <ul className="list-disc space-y-1 pl-4 text-[14px] text-[var(--fs-ink-2)]">
              {commentary.watch_next.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        ) : null}

        {commentary?.method === 'rule_based_snapshot' && (
          <p className="text-[12px] text-[var(--fs-muted)]">Tổng hợp theo quy tắc từ dữ liệu thị trường.</p>
        )}
      </div>
    </Panel>
  )
}
