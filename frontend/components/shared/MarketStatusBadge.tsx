'use client'

import type { MarketStatus, MarketSession } from '@/lib/api'

const SESSION_LABEL: Record<MarketSession, string> = {
  morning:     'Phiên sáng',
  afternoon:   'Phiên chiều',
  lunch_break: 'Nghỉ trưa',
  pre_open:    'Chưa mở',
  closed:      'Đã đóng',
  weekend:     'Cuối tuần',
}

interface Props {
  status: MarketStatus | null
  className?: string
}

export function MarketStatusBadge({ status, className = '' }: Props) {
  if (!status) {
    return (
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-[var(--fs-muted)] ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--fs-muted)]" />
        Đang kiểm tra
      </span>
    )
  }

  const open = status.is_open
  const label = SESSION_LABEL[status.session] ?? 'Thị trường'

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-[var(--fs-muted)] ${className}`}
      title={`Giờ máy chủ: ${new Date(status.server_time).toLocaleTimeString('vi-VN')}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-[var(--fs-up)]' : 'bg-[var(--fs-muted)]'}`} />
      {label}
    </span>
  )
}
