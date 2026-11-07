'use client'

import { Sparkles } from 'lucide-react'

interface ExplainButtonProps {
  onClick: () => void
  label?: string
  size?: 'sm' | 'md'
  className?: string
}

export function ExplainButton({ onClick, label, size = 'sm', className = '' }: ExplainButtonProps) {
  if (size === 'md') {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick() }}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
          bg-primary/10 text-primary border border-primary/25
          hover:bg-primary/20 hover:border-primary/50 transition-all duration-150
          cursor-pointer select-none ${className}`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        {label ?? 'AI Explain'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold
        bg-primary/8 text-primary/70 border border-primary/20
        hover:bg-primary/15 hover:text-primary hover:border-primary/40 transition-all duration-150
        cursor-pointer select-none whitespace-nowrap ${className}`}
    >
      <Sparkles className="w-3 h-3" />
      Explain
    </button>
  )
}
