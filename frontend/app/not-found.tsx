import Link from 'next/link'
import { TrendingUp, Home, BarChart2, Newspaper } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
          <TrendingUp className="w-8 h-8 text-primary" />
        </div>

        <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-3">404</p>
        <h1 className="text-2xl font-black text-foreground mb-2">Trang không tìm thấy</h1>
        <p className="text-[13px] text-[#7a8ba8] leading-relaxed mb-8">
          Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 text-[13px] font-semibold text-white bg-primary hover:bg-primary-hover px-4 py-2.5 rounded-xl transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Dashboard
          </Link>
          <Link
            href="/market"
            className="flex items-center justify-center gap-2 text-[13px] font-semibold text-[#7a8ba8] hover:text-foreground bg-[#0e1726] hover:bg-[#1a2744] border border-[#1a2744] px-4 py-2.5 rounded-xl transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Thị trường
          </Link>
          <Link
            href="/news"
            className="flex items-center justify-center gap-2 text-[13px] font-semibold text-[#7a8ba8] hover:text-foreground bg-[#0e1726] hover:bg-[#1a2744] border border-[#1a2744] px-4 py-2.5 rounded-xl transition-colors"
          >
            <Newspaper className="w-3.5 h-3.5" />
            Tin tức
          </Link>
        </div>
      </div>
    </div>
  )
}
