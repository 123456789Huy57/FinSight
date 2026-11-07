'use client'

type Props<T extends string> = {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}

export function Segmented<T extends string>({ options, value, onChange, label }: Props<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 rounded-lg bg-[var(--fs-surface)] p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`rounded-md px-3 py-1.5 text-[13px] ${
              active
                ? 'bg-white font-medium text-[var(--fs-ink)] shadow-[inset_0_0_0_1px_var(--fs-line)]'
                : 'text-[var(--fs-muted)] hover:text-[var(--fs-ink)]'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
