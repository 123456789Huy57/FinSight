import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Logo } from '@/components/fs';
import { HeroChart } from '@/components/landing/HeroChart';
import { MarketHeatmapLive } from '@/components/market/MarketHeatmapLive';

export const metadata: Metadata = {
  title: 'FinSight: tin tức đi trước, giá theo sau',
  description: 'Xem mỗi bản tin tài chính Việt Nam đi kèm biến động giá ra sao.',
};

const container = 'mx-auto max-w-[1240px] px-4 sm:px-6';

export default function Landing() {
  return (
    <div className="bg-white text-[var(--fs-ink)]">
      <main>
        {/* 1. Hero: chính là biểu đồ tin → giá */}
        <section className={`${container} pt-12 sm:pt-20`}>
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <h1 className="fs-display text-[44px] sm:text-[64px] lg:col-span-8 lg:text-[84px]">
              Tin tức đi trước,
              <br />
              giá theo sau.
            </h1>
            <div className="lg:col-span-4 lg:pb-3">
              <p className="max-w-[360px] text-[18px] leading-[1.5] text-[var(--fs-ink-2)]">
                Xem mỗi bản tin tài chính đi kèm biến động giá ra sao.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex h-11 items-center rounded-lg bg-[var(--fs-ink)] px-5 text-[15px] font-medium text-white transition-opacity hover:opacity-85"
                >
                  Mở dashboard
                </Link>
                <Link
                  href="/phuong-phap"
                  className="inline-flex h-11 items-center rounded-lg border border-[var(--fs-line)] px-5 text-[15px] text-[var(--fs-ink)] transition-colors hover:border-[var(--fs-ink)]"
                >
                  Xem cách đo
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-12 border-t border-[var(--fs-line)] pt-6 sm:mt-16">
            <HeroChart />
          </div>
        </section>

        {/* 2. Demo: bản đồ nhiệt */}
        <section id="ban-do-nhiet" className={`${container} mt-24 sm:mt-32`}>
          <div className="mb-8 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <h2 className="fs-display text-[32px] sm:text-[44px]">Cả thị trường trong một khung hình</h2>
            <p className="text-[15px] text-[var(--fs-muted)]">Cỡ ô theo vốn hoá, màu theo % thay đổi.</p>
          </div>
          <MarketHeatmapLive height={520} />
        </section>

        {/* 3. Điểm khác biệt */}
        <section className={`${container} mt-24 sm:mt-32`}>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-5">
              <h2 className="fs-display text-[32px] sm:text-[44px]">Một bản tin, nhiều ngành</h2>
              <p className="mt-5 max-w-[420px] text-[17px] leading-[1.6] text-[var(--fs-ink-2)]">
                Mỗi tin được gắn với các mã liên quan, rồi nhóm theo ngành.
              </p>
              <Link
                href="/phuong-phap"
                className="mt-6 inline-block text-[15px] font-medium text-[var(--fs-signal)] underline decoration-[var(--fs-signal)]/30 underline-offset-4 hover:decoration-[var(--fs-signal)]"
              >
                Xem phương pháp
              </Link>
            </div>
            <div className="lg:col-span-7">
              <ImpactCard />
            </div>
          </div>
        </section>

        {/* 4. Ba tính năng */}
        <section className={`${container} mt-24 sm:mt-32`}>
          <h2 className="fs-display text-[32px] sm:text-[44px]">Dùng được ngay hôm nay</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="border-t-2 border-[var(--fs-ink)] pt-5">
                <h3 className="text-[19px] font-medium tracking-[-0.01em]">{f.title}</h3>
                <p className="mt-2 max-w-[320px] text-[15px] leading-[1.6] text-[var(--fs-ink-2)]">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Niềm tin */}
        <section className={`${container} mt-24 sm:mt-32`}>
          <p className="fs-display max-w-[860px] text-[26px] sm:text-[36px]">
            Mọi con số đều ghi rõ nguồn và thời điểm dữ liệu. Không giả làm realtime.
          </p>
        </section>

        {/* 6. CTA */}
        <section className="mt-24 bg-[var(--fs-ink)] sm:mt-32">
          <div className={`${container} flex flex-col items-start justify-between gap-8 py-16 sm:py-20 md:flex-row md:items-center`}>
            <h2 className="fs-display text-[36px] text-white sm:text-[52px]">Xem thị trường hôm nay</h2>
            <Link
              href="/dashboard"
              className="inline-flex h-12 shrink-0 items-center rounded-lg bg-white px-6 text-[15px] font-medium text-[var(--fs-ink)] transition-opacity hover:opacity-90"
            >
              Mở dashboard
            </Link>
          </div>
        </section>
      </main>

      <footer className={`${container} flex flex-col gap-4 py-10 text-[13px] text-[var(--fs-muted)] md:flex-row md:items-center md:justify-between`}>
        <div className="flex items-center gap-2 text-[var(--fs-ink)]">
          <Logo size={16} />
          <span className="font-medium">FinSight</span>
        </div>
        <p className="max-w-[520px] md:text-right">
          Thông tin chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.
        </p>
      </footer>
    </div>
  );
}

const FEATURES = [
  { title: 'Bản đồ nhiệt', body: 'Cả sàn theo ngành, cỡ ô theo vốn hoá hoặc thanh khoản.' },
  { title: 'Tin gắn mã', body: 'Tin tài chính được lọc trùng và gắn đúng mã liên quan.' },
  { title: 'Phản ứng giá', body: 'Xem tin nào thật sự đi kèm biến động giá.' },
];

const IMPACTS = [
  { label: 'Ngân hàng', tickers: 'VCB, CTG, MBB', dir: 1, strength: 0.72 },
  { label: 'Bất động sản', tickers: 'VHM, KDH, NLG', dir: 1, strength: 0.58 },
  { label: 'Chứng khoán', tickers: 'SSI, VCI, HCM', dir: 1, strength: 0.46 },
  { label: 'Bảo hiểm', tickers: 'BVH', dir: -1, strength: 0.22 },
];

function ImpactCard() {
  return (
    <div className="rounded-xl border border-[var(--fs-line)] p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3 text-[13px] text-[var(--fs-muted)]">
        <span>Chính sách tiền tệ</span>
        <span>Ví dụ minh hoạ</span>
      </div>
      <h3 className="mt-3 text-[22px] font-medium leading-[1.3] tracking-[-0.015em] sm:text-[26px]">
        NHNN giảm lãi suất điều hành 0,5 điểm %
      </h3>
      <p className="mt-3 text-[14px] text-[var(--fs-up)]">Sắc thái tích cực, điểm +0,64</p>

      <table className="mt-6 w-full border-t border-[var(--fs-line)] text-left">
        <caption className="sr-only">Tác động ước lượng theo ngành</caption>
        <thead>
          <tr className="text-[12px] text-[var(--fs-muted)]">
            <th className="py-3 font-normal">Ngành</th>
            <th className="hidden py-3 font-normal sm:table-cell">Độ tin cậy</th>
            <th className="py-3 text-right font-normal">Hướng</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--fs-line)] border-t border-[var(--fs-line)]">
          {IMPACTS.map((it) => {
            const up = it.dir > 0;
            const color = up ? 'var(--fs-up)' : 'var(--fs-down)';
            return (
              <tr key={it.label}>
                <td className="py-3.5 pr-4">
                  <div className="text-[15px] font-medium">{it.label}</div>
                  <div className="text-[12px] text-[var(--fs-muted)]">{it.tickers}</div>
                </td>
                <td className="hidden w-1/2 py-3.5 pr-6 sm:table-cell">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--fs-surface)]">
                    <div className="h-full rounded-full" style={{ width: `${it.strength * 100}%`, background: color }} />
                  </div>
                </td>
                <td className="py-3.5 text-right">
                  <span className="inline-flex items-center gap-1 text-[14px] font-medium" style={{ color }}>
                    {up ? <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} /> : <ArrowDownRight className="h-4 w-4" strokeWidth={1.75} />}
                    {up ? 'Tăng' : 'Giảm'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
