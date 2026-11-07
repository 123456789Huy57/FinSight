export function formatDataAsOf(value: string | null | undefined): string {
  if (!value) return 'chưa có thời điểm'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const hasTime = /T\d{2}:\d{2}/.test(value)
  return hasTime
    ? parsed.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
    : parsed.toLocaleDateString('vi-VN', { timeZone: 'UTC', dateStyle: 'short' })
}
