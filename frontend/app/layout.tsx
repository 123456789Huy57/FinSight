import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { TopNav } from '@/components/layout/TopNav'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'FinSight',
  description: 'Đọc tin tài chính Việt Nam cạnh phản ứng giá cổ phiếu.',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png',  media: '(prefers-color-scheme: dark)'  },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="font-sans antialiased bg-[var(--fs-surface)] text-[var(--fs-ink)] min-h-screen">
        <TopNav />
        <main>{children}</main>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
