interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`skeleton-pulse ${className}`} />
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-[rgba(79,142,247,0.15)] bg-[#0e1726] p-5 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

export function TableRowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex justify-between items-center px-3 py-2.5 border-b border-[#0f1f3d] last:border-0">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </div>
  )
}
