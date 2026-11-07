import type { NewsReaction } from '@/lib/api'

export type ReactionLabel =
  | { kind: 'number'; value: number }
  | { kind: 'text'; text: string; title?: string }

/**
 * Nhãn hiển thị cho cửa sổ T+1 / T+5 của một phản ứng giá.
 * Chỉ trả số khi giá là thật (market-provider) và có phiên bản phương pháp.
 */
export function reactionLabel(reaction: NewsReaction | null | undefined, window: 't1' | 't5'): ReactionLabel {
  if (!reaction) return { kind: 'text', text: '–' }
  const w = reaction[window]
  const title = w?.reason ?? undefined
  switch (reaction.status) {
    case 'measured':
      if (reaction.dataMode === 'market-provider' && reaction.methodVersion && w?.abnormalReturnPct != null) {
        return { kind: 'number', value: w.abnormalReturnPct }
      }
      return { kind: 'text', text: 'Dữ liệu minh hoạ', title }
    case 'pending':
      return { kind: 'text', text: 'Chờ phiên sau', title }
    case 'insufficient_data':
      return { kind: 'text', text: 'Chưa đủ dữ liệu', title }
    case 'overlapping_event':
      return { kind: 'text', text: 'Trùng tin khác', title }
    default:
      return { kind: 'text', text: '–' }
  }
}
