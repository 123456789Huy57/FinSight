import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Phương pháp | FinSight',
  description: 'FinSight gắn tin tức với mã cổ phiếu và đối chiếu với phản ứng giá như thế nào.',
};

const STEPS = [
  {
    title: 'Thu thập',
    body: 'Lấy tin RSS từ VnExpress Kinh doanh và VnEconomy chứng khoán. Loại tin trùng theo đường dẫn và mã băm của tiêu đề.',
  },
  {
    title: 'Gắn mã và chấm điểm',
    body: 'Khớp mã và tên doanh nghiệp trong tiêu đề và tóm tắt. Chấm sắc thái từ −1 đến +1 bằng từ điển từ khoá.',
  },
  {
    title: 'Đo phản ứng giá',
    body: 'Phiên sự kiện là phiên đóng cửa đầu tiên sau giờ đăng tin. Lợi nhuận bất thường T+1 và T+5 bằng lợi nhuận cổ phiếu (giá điều chỉnh) trừ lợi nhuận VN-Index cùng cửa sổ. Tin khác của cùng mã trong cửa sổ thì đánh dấu chồng lấn.',
  },
];

const LIMITS = [
  'Giá hiện là dữ liệu minh hoạ nên chưa có số đo thật.',
  'Từ điển từ khoá không phải mô hình học máy.',
  'Kết quả là biến động quan sát được, không khẳng định nhân quả và không phải khuyến nghị đầu tư.',
];

export default function Methodology() {
  return (
    <div className="bg-white text-[var(--fs-ink)]">
      <main className="mx-auto max-w-[1240px] px-4 pb-24 pt-14 sm:px-6 sm:pt-20">
        <h1 className="fs-display max-w-[760px] text-[40px] sm:text-[60px]">Từ tiêu đề đến bằng chứng</h1>
        <p className="mt-5 max-w-[520px] text-[18px] leading-[1.5] text-[var(--fs-ink-2)]">
          Cách FinSight gắn một bản tin với mã cổ phiếu và đo phản ứng giá đi kèm.
        </p>

        <ol className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t-2 border-[var(--fs-ink)] pt-5">
              <h2 className="text-[20px] font-medium tracking-[-0.01em]">
                <span className="tabular-nums">{i + 1}.</span> {s.title}
              </h2>
              <p className="mt-2 max-w-[340px] text-[15px] leading-[1.6] text-[var(--fs-ink-2)]">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-20 max-w-[680px] rounded-xl border border-[var(--fs-line)] p-6 sm:p-8">
          <h2 className="text-[18px] font-medium tracking-[-0.01em]">Giới hạn cần biết</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-[1.6] text-[var(--fs-ink-2)]">
            {LIMITS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

        <Link
          href="/dashboard"
          className="mt-12 inline-flex h-12 items-center rounded-lg bg-[var(--fs-ink)] px-6 text-[15px] font-medium text-white transition-opacity hover:opacity-85"
        >
          Mở dashboard
        </Link>
      </main>
    </div>
  );
}
