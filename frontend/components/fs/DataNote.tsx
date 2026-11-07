import { dataModeLabel, formatDataAsOf } from '@/lib/format'

type Props = { dataMode?: string | null; asOf?: string | null; source?: string | null }

export function DataNote({ dataMode, asOf, source }: Props) {
  return (
    <p className="text-[13px] text-[var(--fs-muted)]" title={source ? `Nguồn: ${source}` : undefined}>
      {dataModeLabel(dataMode)}, tính đến {formatDataAsOf(asOf)}
    </p>
  )
}
