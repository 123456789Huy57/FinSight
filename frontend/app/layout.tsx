import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { TopNav } from '@/components/layout/TopNav'
import './globals.css'

export const metadata: Metadata = {
  title: 'FinSight AI — Vietnam Market Intelligence',
  description: 'Nền tảng phân tích thị trường chứng khoán Việt Nam với AI. Theo dõi VNINDEX, VN30, HNX30 và hàng trăm cổ phiếu theo thời gian thực.',
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
  colorScheme: 'dark',
  themeColor: '#070d1a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground min-h-screen">
        <TopNav />
        <main>{children}</main>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
