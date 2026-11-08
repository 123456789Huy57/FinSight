// Normal equity bands from HOSE and HNX; first sessions and resumptions may differ.
const NORMAL_BANDS: Record<string, number> = { HOSE: 7, HNX: 10, UPCOM: 15 }

const UNCHANGED = '#6a5d22'
const UP_STOPS = ['#34514a', '#2c6b4e', '#23894f', '#18a957']
const DOWN_STOPS = ['#5e3a43', '#823a46', '#a8353f', '#df2f37']

export const HEATMAP_LEGEND = {
  down: DOWN_STOPS[2], flat: UNCHANGED, up: UP_STOPS[2],
} as const

function hexToRgb(hex: string) {
  const number = parseInt(hex.slice(1), 16)
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255]
}

function mix(a: string, b: string, t: number) {
  const first = hexToRgb(a)
  const second = hexToRgb(b)
  const color = first.map((value, i) => Math.round(value + (second[i] - value) * t))
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`
}

function ramp(stops: string[], t: number) {
  const position = Math.min(Math.max(t, 0), 1) * (stops.length - 1)
  const index = Math.min(Math.floor(position), stops.length - 2)
  return mix(stops[index], stops[index + 1], position - index)
}

export function changeColor(change: number, exchange?: string) {
  if (Math.abs(change) < 0.005) return UNCHANGED
  const intensity = Math.min(Math.abs(change) / (NORMAL_BANDS[exchange ?? ''] ?? 4), 1)
  return change > 0 ? ramp(UP_STOPS, intensity) : ramp(DOWN_STOPS, intensity)
}
