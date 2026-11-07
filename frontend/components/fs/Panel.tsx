import type { ReactNode } from 'react'

type Props = { title: string; aside?: ReactNode; children: ReactNode; className?: string }

export function Panel({ title, aside, children, className = '' }: Props) {
  return (
    <section className={`min-w-0 rounded-xl border border-[var(--fs-line)] bg-white ${className}`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-[var(--fs-line)] px-5 py-3.5">
        <h2 className="text-[15px] font-medium tracking-[-0.01em]">{title}</h2>
        {aside && <div className="text-[13px] text-[var(--fs-muted)]">{aside}</div>}
      </div>
      {children}
    </section>
  )
}
