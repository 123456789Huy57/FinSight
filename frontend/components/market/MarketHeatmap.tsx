'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { squarify } from '@/lib/treemap';
import { fmtCompact, fmtPrice } from '@/lib/format';

export type HeatmapItem = {
  symbol: string;
  name?: string;
  sector: string;
  cap: number | null;
  value: number | null;
  price: number | null;
  change: number;
};

const HOSE_LIMIT = 6.9;

type Mode = 'cap' | 'value';

const MODES: { id: Mode; label: string }[] = [
  { id: 'cap', label: 'Vốn hoá' },
  { id: 'value', label: 'GTGD' },
];

// ---- Màu theo % thay đổi (kiểu bảng điện Việt Nam) ----
const CEILING = '#a24bd6';
const FLOOR = '#1ba9c4';
const UNCHANGED = '#6a5d22';
const UP_STOPS = ['#34514a', '#2c6b4e', '#23894f', '#18a957'];
const DOWN_STOPS = ['#5e3a43', '#823a46', '#a8353f', '#df2f37'];

function hexToRgb(h: string) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
function ramp(stops: string[], t: number) {
  const x = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  return mix(stops[i], stops[i + 1], x - i);
}

export function changeColor(change: number) {
  if (change >= HOSE_LIMIT) return CEILING;
  if (change <= -HOSE_LIMIT) return FLOOR;
  if (Math.abs(change) < 0.005) return UNCHANGED;
  const t = Math.min(Math.abs(change) / 4, 1);
  return change > 0 ? ramp(UP_STOPS, t) : ramp(DOWN_STOPS, t);
}

function fmtPct(n: number) {
  const s = n.toFixed(2);
  return `${n > 0 ? '+' : ''}${s}%`;
}

interface SectorGroup {
  sector: string;
  weight: number;
  change: number;
  stocks: HeatmapItem[];
}

function weightOf(s: HeatmapItem, mode: Mode): number {
  const w = s[mode];
  return w != null && w > 0 ? w : 0;
}

function groupBySector(data: HeatmapItem[], mode: Mode): SectorGroup[] {
  const map = new Map<string, HeatmapItem[]>();
  for (const s of data) {
    if (weightOf(s, mode) <= 0) continue;
    if (!map.has(s.sector)) map.set(s.sector, []);
    map.get(s.sector)!.push(s);
  }
  return [...map.entries()].map(([sector, stocks]) => {
    const weight = stocks.reduce((a, s) => a + weightOf(s, mode), 0);
    const change = stocks.reduce((a, s) => a + s.change * weightOf(s, mode), 0) / weight;
    return { sector, weight, change, stocks };
  });
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

const HEADER_H = 22;

interface Props {
  data: HeatmapItem[];
  /** Chiều cao vùng bản đồ (px). Mặc định 520. */
  height?: number;
  title?: string;
  exchange?: string;
  className?: string;
  /** Ghi chú nguồn dữ liệu, hiện ở góc phải dưới. */
  note?: React.ReactNode;
}

export function MarketHeatmap({
  data,
  height = 520,
  title = 'Bản đồ nhiệt',
  exchange = 'HSX',
  className = '',
  note,
}: Props) {
  const router = useRouter();
  const hasCap = useMemo(() => data.some((s) => weightOf(s, 'cap') > 0), [data]);
  const modes = hasCap ? MODES : MODES.filter((m) => m.id === 'value');
  const [picked, setPicked] = useState<Mode>('cap');
  const mode: Mode = hasCap ? picked : 'value';
  const setMode = setPicked;
  const [ref, size] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<{ s: HeatmapItem; x: number; y: number } | null>(null);

  const layout = useMemo(() => {
    if (!size.w || !size.h) return [];
    const groups = groupBySector(data, mode);
    const sectors = squarify(groups, (g) => g.weight, { x: 0, y: 0, w: size.w, h: size.h });
    return sectors.map((sr) => {
      const showHeader = sr.w > 70 && sr.h > HEADER_H + 24;
      const headerH = showHeader ? HEADER_H : 0;
      const inner = { x: sr.x + 2, y: sr.y + headerH + 2, w: sr.w - 4, h: sr.h - headerH - 4 };
      const tiles = squarify(sr.item.stocks, (s) => weightOf(s, mode), inner);
      return { ...sr, showHeader, tiles };
    });
  }, [data, mode, size.w, size.h]);

  return (
    <div className={`fs-heatmap rounded-[18px] bg-[#16181d] text-white ring-1 ring-white/[0.06] ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[15px] font-medium tracking-[-0.01em] text-white">{title}</h3>
          <span className="text-[13px] text-white/45">{exchange}</span>
        </div>
        <div role="tablist" aria-label="Kích thước ô theo" className="flex rounded-full bg-white/[0.06] p-1">
          {modes.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-full px-3.5 py-1 text-[13px] transition-colors ${
                mode === m.id ? 'bg-white text-[#16181d]' : 'text-white/60 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="p-2 sm:p-3">
        <div
          ref={ref}
          className="relative w-full overflow-hidden rounded-[10px] bg-[#0f1114]"
          style={{ height }}
          onMouseLeave={() => setHover(null)}
        >
          {layout.map((sr) => (
            <div
              key={sr.item.sector}
              className="absolute"
              style={{ left: sr.x, top: sr.y, width: sr.w, height: sr.h }}
            >
              {sr.showHeader && (
                <div
                  className="flex h-[22px] items-center gap-1.5 overflow-hidden whitespace-nowrap px-1.5 text-[12px] leading-none"
                  title={sr.item.sector}
                >
                  <span className="truncate text-white/80">{sr.item.sector}</span>
                  <span className="shrink-0 font-medium tabular-nums" style={{ color: sr.item.change >= 0 ? '#3ddc84' : '#ff5a5f' }}>
                    {fmtPct(sr.item.change)}
                  </span>
                </div>
              )}
            </div>
          ))}
          {layout.flatMap((sr) =>
            sr.tiles.map((t) => {
              const s = t.item;
              const minSide = Math.min(t.w, t.h);
              const sym = Math.max(10, Math.min(minSide * 0.28, t.w / (s.symbol.length * 0.62), 40));
              const showSym = t.w > 24 && t.h > 14;
              const showPct = t.h > sym * 2.1 && t.w > 40;
              return (
                <button
                  key={s.symbol}
                  type="button"
                  aria-label={`${s.symbol} ${fmtPct(s.change)}`}
                  onClick={() => router.push('/stock/' + s.symbol)}
                  className="absolute flex flex-col items-center justify-center overflow-hidden text-center transition-[filter] hover:brightness-125 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  style={{
                    left: t.x + 0.5,
                    top: t.y + 0.5,
                    width: Math.max(t.w - 1, 0),
                    height: Math.max(t.h - 1, 0),
                    background: changeColor(s.change),
                  }}
                  onMouseMove={(e) => {
                    const box = (e.currentTarget.offsetParent as HTMLElement).getBoundingClientRect();
                    setHover({ s, x: e.clientX - box.left, y: e.clientY - box.top });
                  }}
                  onFocus={() => setHover({ s, x: t.x + t.w / 2, y: t.y + t.h / 2 })}
                  onBlur={() => setHover(null)}
                >
                  {showSym && (
                    <span className="font-semibold leading-none tracking-[0.01em] text-white" style={{ fontSize: sym }}>
                      {s.symbol}
                    </span>
                  )}
                  {showPct && (
                    <span
                      className="mt-[0.3em] font-medium leading-none tabular-nums text-white/90"
                      style={{ fontSize: Math.max(10, sym * 0.62) }}
                    >
                      {fmtPct(s.change)}
                    </span>
                  )}
                </button>
              );
            }),
          )}

          {hover && <Tooltip {...hover} width={size.w} height={size.h} />}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-3 text-[12px] text-white/55">
          <span className="tabular-nums">−4%</span>
          <div className="flex gap-[3px]">
            {[-4, -2.5, -1.2, -0.3, 0, 0.3, 1.2, 2.5, 4].map((v) => (
              <span key={v} className="h-3 w-5 rounded-[2px] sm:w-6" style={{ background: changeColor(v) }} />
            ))}
          </div>
          <span className="tabular-nums">+4%</span>
          <span className="ml-1 flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[2px]" style={{ background: CEILING }} /> Trần
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[2px]" style={{ background: FLOOR }} /> Sàn
          </span>
        </div>
        {note && <div className="ml-auto text-[12px] text-white/50">{note}</div>}
      </div>
    </div>
  );
}

function Tooltip({ s, x, y, width, height }: { s: HeatmapItem; x: number; y: number; width: number; height: number }) {
  const W = 220;
  const H = 120;
  const left = x + 16 + W > width ? x - W - 12 : x + 16;
  const top = Math.min(Math.max(y - H / 2, 8), height - H - 8);
  const up = s.change > 0;
  const flat = Math.abs(s.change) < 0.005;
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-xl bg-white p-3.5 text-[#1b0624] shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
      style={{ left: Math.max(8, left), top, width: W }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[16px] font-semibold">{s.symbol}</span>
        <span
          className="text-[13px] font-medium tabular-nums"
          style={{ color: flat ? '#8a7a2a' : up ? '#14804a' : '#c62f36' }}
        >
          {fmtPct(s.change)}
        </span>
      </div>
      <div className="mt-0.5 truncate text-[12px] text-[#766a7c]">{s.name}</div>
      <dl className="mt-2.5 grid grid-cols-2 gap-y-1 text-[12px]">
        <dt className="text-[#898683]">Giá</dt>
        <dd className="text-right tabular-nums">{fmtPrice(s.price)}</dd>
        <dt className="text-[#898683]">Vốn hoá</dt>
        <dd className="text-right tabular-nums">{fmtCompact(s.cap)}</dd>
        <dt className="text-[#898683]">GTGD</dt>
        <dd className="text-right tabular-nums">{fmtCompact(s.value)}</dd>
      </dl>
    </div>
  );
}
