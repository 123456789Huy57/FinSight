import { fmtPct, toneOf } from '@/lib/format'

type Props = { value: number | null | undefined; digits?: number; className?: string }

export function Change({ value, digits = 2, className = '' }: Props) {
  return (
    <span className={`tabular-nums ${className}`} style={{ color: toneOf(value) }}>
      {fmtPct(value, digits)}
    </span>
  )
}
