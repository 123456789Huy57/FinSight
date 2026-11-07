export function formatDataAsOf(value: string | null | undefined): string {
  if (!value) return 'chưa có thời điểm'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const hasTime = /T\d{2}:\d{2}/.test(value)
  return hasTime
    ? parsed.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
    : parsed.toLocaleDateString('vi-VN', { timeZone: 'UTC', dateStyle: 'short' })
}

const NF = (digits: number) => ({ minimumFractionDigits: digits, maximumFractionDigits: digits })

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '–'
  const body = Math.abs(n).toLocaleString('vi-VN', NF(digits))
  if (n < 0) return `−${body}%`
  return n > 0 ? `+${body}%` : `${body}%`
}

export function fmtPrice(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '–'
  return n.toLocaleString('vi-VN', NF(digits))
}

export function fmtCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '–'
  const f = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
  if (n >= 1e12) return `${f(n / 1e12)} nghìn tỷ`
  if (n >= 1e9) return `${f(n / 1e9)} tỷ`
  if (n >= 1e6) return `${f(n / 1e6)} triệu`
  return n.toLocaleString('vi-VN')
}

export function dataModeLabel(mode?: string | null): string {
  switch (mode) {
    case 'synthetic-demo': return 'Dữ liệu minh hoạ'
    case 'market-provider': return 'Dữ liệu cuối ngày'
    case 'external-feed': return 'Nguồn ngoài'
    default: return 'Chưa rõ nguồn'
  }
}

export function toneOf(n: number | null | undefined): string {
  if (n == null || Math.abs(n) < 0.005) return 'var(--fs-flat)'
  return n > 0 ? 'var(--fs-up)' : 'var(--fs-down)'
}
