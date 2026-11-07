'use client'

import { reactionLabel } from '@/lib/reactions'
import type { NewsItem, NewsReaction, AIExplainRequest } from '@/lib/api'
import { ExplainButton } from '@/components/shared/ExplainButton'
import { Change, SymbolChip } from '@/components/fs'

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

export function formatNewsTime(time: string): string {
  if (!time || time === 'Now') return 'Vừa xong'
  try {
    const d = new Date(time)
    if (isNaN(d.getTime())) return time
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
    if (diffMin < 1) return 'Vừa xong'
    if (diffMin < 60) return `${diffMin} phút trước`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH} giờ trước`
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  } catch {
    return time
  }
}

const SENTIMENT_WORD: Record<ImpactClass, string> = {
  positive: 'tích cực',
  negative: 'tiêu cực',
  watch: 'cần theo dõi',
  neutral: 'trung lập',
}

export function sentimentLine(item: NewsItem): string {
  if (item.sentimentScore == null || Number.isNaN(item.sentimentScore)) {
    return `Sắc thái ${SENTIMENT_WORD[classifyImpact(item.marketImpact)]}`
  }
  const s = item.sentimentScore
  const word = s > 0.05 ? 'tích cực' : s < -0.05 ? 'tiêu cực' : 'trung lập'
  const body = Math.abs(s).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sign = s > 0.005 ? '+' : s < -0.005 ? '−' : ''
  return `Sắc thái ${word}, điểm ${sign}${body}`
}

function WindowValue({ reaction, window }: { reaction: NewsReaction; window: 't1' | 't5' }) {
  const label = reactionLabel(reaction, window)
  if (label.kind === 'number') {
    return <Change value={label.value} className="text-[14px] font-medium" />
  }
  return <span className="text-[13px] text-[var(--fs-muted)]" title={label.title}>{label.text}</span>
}

export function ReactionColumns({ reaction, extra = 0 }: { reaction?: NewsReaction; extra?: number }) {
  if (!reaction) return null
  return (
    <div className="flex gap-6 sm:gap-5">
      <div className="min-w-[88px]">
        <p className="text-[12px] text-[var(--fs-muted)]">Phiên sau</p>
        <WindowValue reaction={reaction} window="t1" />
      </div>
      <div className="min-w-[88px]">
        <p className="text-[12px] text-[var(--fs-muted)]">5 phiên</p>
        <WindowValue reaction={reaction} window="t5" />
        {extra > 0 && <p className="text-[12px] text-[var(--fs-muted)]">+{extra} mã</p>}
      </div>
    </div>
  )
}

interface Props {
  item: NewsItem
  onExplain: (req: AIExplainRequest) => void
  /** Mã ưu tiên khi chọn reaction (trang chi tiết mã). */
  focusSymbol?: string
}

export function NewsCard({ item, onExplain, focusSymbol }: Props) {
  const reactions = item.reactions ?? []
  const reaction = (focusSymbol && reactions.find((r) => r.symbol === focusSymbol)) || reactions[0]
  const extra = focusSymbol ? 0 : Math.max(0, reactions.length - 1)

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--fs-line)] px-5 py-4 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-[var(--fs-muted)]">
          {formatNewsTime(item.time)}, {item.source}
        </p>

        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block rounded text-[15px] font-medium leading-snug text-[var(--fs-ink)] hover:text-[var(--fs-signal)] hover:underline sm:text-[16px]"
          >
            {item.headline}
            <span className="sr-only"> (mở bài viết từ {item.source} ở tab mới)</span>
          </a>
        ) : (
          <h3 className="mt-1 text-[15px] font-medium leading-snug text-[var(--fs-ink)] sm:text-[16px]">{item.headline}</h3>
        )}

        {item.insight && (
          <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-[var(--fs-ink-2)]">{item.insight}</p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {item.affectedTickers.slice(0, 4).map((t) => (
            <SymbolChip key={t} symbol={t} />
          ))}
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

        <p className="mt-2 text-[13px] text-[var(--fs-muted)]">{sentimentLine(item)}</p>
      </div>

      {reaction && (
        <div className="shrink-0 sm:pt-5">
          {reactions.length > 1 && (
            <p className="mb-1 text-[12px] text-[var(--fs-muted)]">{reaction.symbol}</p>
          )}
          <ReactionColumns reaction={reaction} extra={extra} />
        </div>
      )}
    </div>
  )
}
