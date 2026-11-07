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
      <span className={`inline-flex items-center gap-1.5 text-[11px] text-[#3d4f6b] ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-[#1e3158]" />
        Đang kiểm tra
      </span>
    )
  }

  const open = status.is_open
  const label = SESSION_LABEL[status.session] ?? 'Thị trường'

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap',
        open
          ? 'text-[#34d399] border-[#34d399]/25 bg-[#34d399]/8'
          : 'text-[#7a8ba8] border-[#1a2744] bg-[#0e1726]',
        className,
      ].join(' ')}
      title={`Giờ máy chủ: ${new Date(status.server_time).toLocaleTimeString('vi-VN')}`}
    >
      <span
        className={[
          'w-1.5 h-1.5 rounded-full',
          open ? 'bg-[#34d399] live-dot' : 'bg-[#3d4f6b]',
        ].join(' ')}
      />
      {open ? `LIVE · ${label}` : label}
    </span>
  )
}
