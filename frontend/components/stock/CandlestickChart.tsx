'use client'

import { useEffect, useRef } from 'react'
import type { IChartApi } from 'lightweight-charts'
import type { OHLCVCandle } from '@/lib/api'

interface Props {
  candles: OHLCVCandle[]
  height?: number
}

export function CandlestickChart({ candles, height = 360 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !candles.length) return

    const hasRealOHLC = candles.some(
      c => c.open !== c.close || c.high !== c.close || c.low !== c.close
    )

    const seen = new Set<string>()
    const data = candles
      .filter(c => c.time && c.close != null)
      .map(c => ({
        time: c.time!.slice(0, 10),
        open: c.open ?? c.close,
        high: c.high ?? c.close,
        low: c.low ?? c.close,
        close: c.close,
        volume: c.volume,
      }))
      .sort((a, b) => a.time.localeCompare(b.time))
      .filter(c => {
        if (seen.has(c.time)) return false
        seen.add(c.time)
        return true
      })

    if (!data.length) return

    const up = data[data.length - 1].close >= data[0].close
    let chart: IChartApi | null = null
    let mounted = true

    import('lightweight-charts').then(({
      createChart,
      CandlestickSeries,
      HistogramSeries,
      LineSeries,
      ColorType,
      CrosshairMode,
    }) => {
      if (!mounted || !containerRef.current) return

      chart = createChart(container, {
        autoSize: true,
        height,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#94a3b8',
          fontFamily: "Inter, 'Segoe UI', system-ui, sans-serif",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: 'rgba(148,163,184,0.07)' },
          horzLines: { color: 'rgba(148,163,184,0.07)' },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: {
          borderVisible: false,
          scaleMargins: { top: 0.06, bottom: 0.28 },
        },
        timeScale: {
          borderVisible: false,
          fixLeftEdge: true,
          fixRightEdge: true,
        },
      })

      if (hasRealOHLC) {
        const series = chart.addSeries(CandlestickSeries, {
          upColor: '#34d399',
          downColor: '#f87171',
          borderVisible: false,
          wickUpColor: '#34d399',
          wickDownColor: '#f87171',
        })
        series.setData(
          data.map(c => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        )
      } else {
        const series = chart.addSeries(LineSeries, {
          color: up ? '#34d399' : '#f87171',
          lineWidth: 2 as const,
          lastValueVisible: false,
          priceLineVisible: false,
        })
        series.setData(
          data.map(c => ({
            time: c.time,
            value: c.close,
          }))
        )
      }

      const hasVolume = data.some(c => c.volume != null && c.volume > 0)
      if (hasVolume) {
        const volSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: '',
        })
        volSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.82, bottom: 0 },
        })
        volSeries.setData(
          data
            .filter(c => c.volume != null)
            .map(c => ({
              time: c.time,
              value: c.volume!,
              color:
                c.close >= c.open
                  ? 'rgba(34,197,94,0.35)'
                  : 'rgba(239,68,68,0.35)',
            }))
        )
      }

      chart.timeScale().fitContent()
    })

    return () => {
      mounted = false
      chart?.remove()
    }
  }, [candles, height])

  if (!candles.length) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground"
        style={{ height }}
      >
        Không có dữ liệu biểu đồ
      </div>
    )
  }

  return <div ref={containerRef} style={{ height }} />
}
