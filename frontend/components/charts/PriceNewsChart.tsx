'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fmtPct, fmtPrice } from '@/lib/format';

export type ChartPoint = { date: string; close: number };
export type ChartPin = {
  id: string;
  index: number;
  category: string;
  headline: string;
  reaction: number | null;
  reason?: string;
};

function fmtDate(iso: string) {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}`;
}

const NO_REACTION = 'Chưa đo được';

const PAD = { top: 20, right: 56, bottom: 28, left: 0 };
const DRAW_S = 1.8; // thời gian vẽ đường giá (giây)

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function reactionColor(r: number | null) {
  if (r == null || Math.abs(r) < 0.2) return 'var(--fs-flat)';
  return r > 0 ? 'var(--fs-up)' : 'var(--fs-down)';
}

function reactionText(n: ChartPin) {
  if (n.reaction == null) return n.reason || NO_REACTION;
  if (Math.abs(n.reaction) < 0.2) return `${fmtPct(n.reaction)}, không phản ứng rõ`;
  return fmtPct(n.reaction);
}

interface Props {
  series: ChartPoint[];
  pins: ChartPin[];
  label: string;
  note: React.ReactNode;
  height?: number;
}

export function PriceNewsChart({ series, pins, label, note, height }: Props) {
  const news = useMemo(() => pins.filter((p) => p.index >= 0 && p.index < series.length), [pins, series.length]);
  const [ref, w] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<string | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const H = height ?? (w < 640 ? 220 : 300);

  const g = useMemo(() => {
    if (!w) return null;
    const closes = series.map((b) => b.close);
    const lo = Math.min(...closes);
    const hi = Math.max(...closes);
    const span = hi - lo || 1;
    const yMin = lo - span * 0.12;
    const yMax = hi + span * 0.12;
    const iw = w - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (i / Math.max(series.length - 1, 1)) * iw;
    const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * ih;
    const d = series.map((b, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(b.close).toFixed(1)}`).join('');
    const step = Math.max(10, Math.round((yMax - yMin) / 3 / 10) * 10);
    const ticks: number[] = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) ticks.push(v);
    const months: { i: number; label: string }[] = [];
    series.forEach((b, i) => {
      const m = b.date.slice(5, 7);
      if (i === 0 || series[i - 1].date.slice(5, 7) !== m) months.push({ i, label: `Th${Number(m)}` });
    });
    return { x, y, d, ticks, months, iw };
  }, [w, H, series]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!g) return;
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left - PAD.left;
    const i = Math.round((px / g.iw) * Math.max(series.length - 1, 1));
    setHoverIdx(Math.min(Math.max(i, 0), series.length - 1));
  };

  const last = series[series.length - 1];
  const shown = hoverIdx != null ? series[hoverIdx] : last;

  return (
    <div className="fs-chart">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-3">
          <span className="text-[15px] font-medium text-[var(--fs-ink)]">{label}</span>
          <span className="text-[22px] font-medium tabular-nums tracking-[-0.01em] text-[var(--fs-ink)]">
            {fmtPrice(shown.close)}
          </span>
          <span className="text-[13px] tabular-nums text-[var(--fs-muted)]">{fmtDate(shown.date)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-[var(--fs-muted)]">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--fs-signal)]" /> Bản tin
          </span>
          <span className="flex items-center gap-2">
            <span className="h-[3px] w-4 rounded-full bg-[var(--fs-up)]" /> Phản ứng phiên sau
          </span>
          <div>{note}</div>
        </div>
      </div>

      <div ref={ref} className="relative mt-4 w-full" style={{ height: H }}>
        {g && (
          <svg
            width={w}
            height={H}
            className="block overflow-visible"
            onMouseMove={onMove}
            onMouseLeave={() => setHoverIdx(null)}
            role="img"
            aria-label={`Biểu đồ ${label} ${series.length} phiên với ${news.length} bản tin được ghim`}
          >
            {/* Lưới ngang + nhãn trục giá */}
            {g.ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={w - PAD.right + 8} y1={g.y(t)} y2={g.y(t)} stroke="var(--fs-line)" />
                <text x={w - PAD.right + 14} y={g.y(t) + 4} className="fill-[var(--fs-muted)] text-[12px] tabular-nums">
                  {t.toLocaleString('vi-VN')}
                </text>
              </g>
            ))}
            {/* Nhãn tháng */}
            {g.months.map((m) => (
              <text key={m.i} x={g.x(m.i)} y={H - 6} className="fill-[var(--fs-muted)] text-[12px]">
                {m.label}
              </text>
            ))}

            {/* Đường giá */}
            <path d={g.d} fill="none" stroke="var(--fs-ink)" strokeWidth={1.5} strokeLinejoin="round" pathLength={1} className="fs-draw" />

            {/* Tin: đường dóng, đoạn phản ứng, chấm ghim */}
            {news.map((n) => {
              const delay = DRAW_S * (n.index / (series.length - 1));
              const x0 = g.x(n.index);
              const y0 = g.y(series[n.index].close);
              const next1 = n.reaction != null ? series[n.index + 1] : undefined;
              const x1 = g.x(n.index + 1);
              const y1 = next1 ? g.y(next1.close) : y0;
              const on = active === n.id;
              const dim = active && !on;
              return (
                <g key={n.id} className="fs-pop" style={{ animationDelay: `${delay}s` }}>
                <g opacity={dim ? 0.35 : 1} className="transition-opacity">
                  <line
                    x1={x0}
                    x2={x0}
                    y1={y0 + 8}
                    y2={H}
                    stroke="var(--fs-signal)"
                    strokeDasharray="2 3"
                    className="hidden lg:block"
                  />
                  {next1 && (
                    <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={reactionColor(n.reaction)} strokeWidth={4} strokeLinecap="round" />
                  )}
                  <circle
                    cx={x0}
                    cy={y0}
                    r={on ? 7 : 5.5}
                    fill={n.reaction == null ? 'var(--fs-paper)' : 'var(--fs-signal)'}
                    stroke={n.reaction == null ? 'var(--fs-signal)' : 'var(--fs-paper)'}
                    strokeWidth={2}
                    tabIndex={0}
                    role="button"
                    aria-label={`${fmtDate(series[n.index].date)}: ${n.headline}. ${n.reaction == null ? '' : 'Phiên sau '}${reactionText(n)}`}
                    onMouseEnter={() => setActive(n.id)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(n.id)}
                    onBlur={() => setActive(null)}
                    className="cursor-pointer outline-none transition-[r] focus-visible:stroke-[var(--fs-ink)]"
                  />
                </g>
                </g>
              );
            })}

            {/* Con trỏ dọc khi rê chuột */}
            {hoverIdx != null && (
              <line
                x1={g.x(hoverIdx)}
                x2={g.x(hoverIdx)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="var(--fs-ink)"
                strokeOpacity={0.25}
                pointerEvents="none"
              />
            )}
          </svg>
        )}
      </div>

      {/* Dải tin: desktop canh theo vị trí ghim, mobile là danh sách */}
      {g && (
        <>
          <div className="relative hidden h-[132px] lg:block">
            {news.map((n, k) => {
              const x = g.x(n.index);
              const next = news[k + 1] ? g.x(news[k + 1].index) : w;
              const width = Math.min(260, next - x - 24);
              const delay = DRAW_S * (n.index / (series.length - 1));
              return (
                <div
                  key={n.id}
                  className="fs-pop absolute top-0"
                  style={{ animationDelay: `${delay}s`, left: x, width }}
                >
                  <NewsItem
                    n={n}
                    date={series[n.index].date}
                    active={active}
                    setActive={setActive}
                    className="border-l pl-3 pt-1"
                    style={{ borderColor: 'var(--fs-signal)' }}
                  />
                </div>
              );
            })}
          </div>
          <ul className="mt-2 divide-y divide-[var(--fs-line)] border-t border-[var(--fs-line)] lg:hidden">
            {news.map((n) => (
              <li key={n.id}>
                <NewsItem n={n} date={series[n.index].date} active={active} setActive={setActive} className="py-3" />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function NewsItem({
  n,
  date,
  active,
  setActive,
  className = '',
  style,
}: {
  n: ChartPin;
  date: string;
  active: string | null;
  setActive: (id: string | null) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const on = active === n.id;
  const dim = active && !on;
  return (
    <div
      className={`${className} transition-opacity`}
      style={{ ...style, opacity: dim ? 0.4 : undefined }}
      onMouseEnter={() => setActive(n.id)}
      onMouseLeave={() => setActive(null)}
      onClick={() => setActive(on ? null : n.id)}
    >
      <div className="text-[12px] text-[var(--fs-muted)]">
        <span className="tabular-nums">{fmtDate(date)}</span>
        <span className="mx-1.5">/</span>
        {n.category}
      </div>
      <div className="mt-1 text-[15px] font-medium leading-[1.35] text-[var(--fs-ink)]">{n.headline}</div>
      <div className="mt-1.5 text-[13px] tabular-nums" style={{ color: reactionColor(n.reaction) }}>
        {n.reaction == null ? (
          <span className="text-[var(--fs-muted)]">{n.reason || NO_REACTION}</span>
        ) : (
          <>
            Phiên sau {fmtPct(n.reaction)}
            {Math.abs(n.reaction) < 0.2 && <span className="block text-[var(--fs-muted)]">Không phản ứng rõ</span>}
          </>
        )}
      </div>
    </div>
  );
}
