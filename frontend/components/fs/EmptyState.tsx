'use client'

type Props = { title: string; hint?: string; action?: { label: string; onClick: () => void } }

export function EmptyState({ title, hint, action }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      {hint && <p className="max-w-sm text-[13px] text-[var(--fs-muted)]">{hint}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 h-9 rounded-lg border border-[var(--fs-line)] px-4 text-[13px] font-medium hover:bg-[var(--fs-surface)]"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
