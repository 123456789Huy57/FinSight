'use client'

import { useEffect, useRef } from 'react'
import type { IChartApi } from 'lightweight-charts'
import type { OHLCVCandle } from '@/lib/api'

interface Props {
  candles: OHLCVCandle[]
  newsMarkers?: Array<{ time: string; title: string }>
  height?: number
}

export function CandlestickChart({ candles, newsMarkers = [], height = 360 }: Props) {
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

    // lightweight-charts cần chuỗi màu, nên đọc token từ CSS. Giá trị dự phòng khớp globals.css.
    const css = getComputedStyle(document.documentElement)
    const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
    const upColor = token('--fs-up', '#12a150')
    const downColor = token('--fs-down', '#d9343b')
    const signalColor = token('--fs-signal', '#2f4bff')
    const mutedColor = token('--fs-muted', '#6b7079')
    const lineColor = token('--fs-line', '#e6e8ec')
    const withAlpha = (color: string) => (/^#[0-9a-f]{6}$/i.test(color) ? `${color}59` : color)
    let chart: IChartApi | null = null
    let mounted = true

    import('lightweight-charts').then(({
      createChart,
      CandlestickSeries,
      HistogramSeries,
      LineSeries,
      ColorType,
      CrosshairMode,
      createSeriesMarkers,
    }) => {
      if (!mounted || !containerRef.current) return

      chart = createChart(container, {
        autoSize: true,
        height,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: mutedColor,
          fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: lineColor },
          horzLines: { color: lineColor },
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
          upColor,
          downColor,
          borderVisible: false,
          wickUpColor: upColor,
          wickDownColor: downColor,
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
        if (newsMarkers.length) {
          createSeriesMarkers(series, newsMarkers.map((marker, index) => ({
            id: `news-${index}-${marker.time}`,
            time: marker.time,
            position: 'aboveBar' as const,
            shape: 'circle' as const,
            color: signalColor,
            text: '',
            size: 1,
          })))
        }
      } else {
        const series = chart.addSeries(LineSeries, {
          color: up ? upColor : downColor,
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
        if (newsMarkers.length) {
          createSeriesMarkers(series, newsMarkers.map((marker, index) => ({
            id: `news-${index}-${marker.time}`,
            time: marker.time,
            position: 'aboveBar' as const,
            shape: 'circle' as const,
            color: signalColor,
            text: '',
            size: 1,
          })))
        }
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
                  ? withAlpha(upColor)
                  : withAlpha(downColor),
            }))
        )
      }

      chart.timeScale().fitContent()
    })

    return () => {
      mounted = false
      chart?.remove()
    }
  }, [candles, height, newsMarkers])

  if (!candles.length) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-[var(--fs-line)] text-[14px] text-[var(--fs-muted)]"
        style={{ height }}
      >
        Không có dữ liệu biểu đồ
      </div>
    )
  }

  return <div ref={containerRef} style={{ height }} />
}
