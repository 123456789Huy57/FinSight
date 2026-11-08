import type { ReactNode } from 'react'
import { DataNote } from './DataNote'

type Props = {
  title: string
  dataMode?: string | null
  asOf?: string | null
  source?: string | null
  note?: string
  actions?: ReactNode
}

export function PageHeader({ title, dataMode, asOf, source, note, actions }: Props) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <h1 className="text-[28px] font-medium tracking-[-0.025em] sm:text-[32px]">{title}</h1>
      <div className="flex flex-wrap items-center gap-3">
        {note ? <p className="text-[13px] text-[var(--fs-muted)]">{note}</p> :
          <DataNote dataMode={dataMode} asOf={asOf} source={source} />}
        {actions}
      </div>
    </div>
  )
}
