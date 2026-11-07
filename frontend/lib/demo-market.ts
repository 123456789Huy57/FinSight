// DỮ LIỆU MINH HOẠ (demo): chuỗi VN-Index và các bản tin ghim trên biểu đồ hero.
// Giá được sinh tất định (seeded) để lần nào render cũng giống nhau. Tiêu đề tin là ví dụ, không phải tin thật.
// Khi có backend: thay bằng GET /api/v1/stocks/VNINDEX/history và /api/v1/news?symbol=...

export interface Bar {
  date: string; // YYYY-MM-DD
  close: number;
}

export interface PinnedNews {
  id: string;
  /** chỉ số phiên đăng tin trong chuỗi */
  index: number;
  category: string;
  headline: string;
  /** % thay đổi của phiên kế tiếp (T+1) */
  reaction: number;
}

const SESSIONS = 80;

function weekdaysEndingAt(endIso: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(endIso + 'T00:00:00Z');
  while (out.length < n) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const HERO_NEWS: PinnedNews[] = [
  { id: 'n1', index: 7, category: 'Chính sách', headline: 'NHNN giảm lãi suất điều hành 0,5 điểm %', reaction: 1.82 },
  { id: 'n2', index: 25, category: 'Dòng tiền', headline: 'Khối ngoại bán ròng phiên thứ năm liên tiếp', reaction: -1.24 },
  { id: 'n3', index: 43, category: 'Doanh nghiệp', headline: 'Tin đồn sáp nhập hai ngân hàng tầm trung', reaction: 0.06 },
  { id: 'n4', index: 61, category: 'Vĩ mô', headline: 'CPI tháng 10 tăng thấp hơn dự báo', reaction: 0.94 },
];

function buildSeries(): Bar[] {
  const dates = weekdaysEndingAt('2026-11-05', SESSIONS);
  const rand = rng(20261105);
  const reactions = new Map(HERO_NEWS.map((n) => [n.index + 1, n.reaction / 100]));
  let close = 1612.4;
  return dates.map((date, i) => {
    if (i > 0) {
      const r = reactions.get(i);
      // nhiễu nhỏ quanh xu hướng tăng nhẹ; phiên sau tin dùng đúng phản ứng đã ghi
      const noise = (rand() + rand() + rand() - 1.5) * 0.0105 + 0.0011;
      close *= 1 + (r ?? noise);
    }
    return { date, close: Math.round(close * 100) / 100 };
  });
}

export const HERO_SERIES: Bar[] = buildSeries();

export function fmtPct(n: number, digits = 2) {
  const s = Math.abs(n).toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${s}%`;
}

export function fmtDate(iso: string) {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}`;
}
