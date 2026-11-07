export function Logo({ size = 20 }: { size?: number }) {
  // Biểu tượng: một đường giá với chấm ghim tin
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect width="20" height="20" rx="5" fill="var(--fs-ink)" />
      <path d="M3.5 13.5 L7.5 10 L10.5 12 L16.5 6" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10.5" cy="12" r="2.1" fill="var(--fs-signal)" stroke="white" strokeWidth="1" />
    </svg>
  )
}
