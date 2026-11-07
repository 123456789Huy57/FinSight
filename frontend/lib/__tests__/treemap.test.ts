import { describe, expect, it } from 'vitest'
import { squarify } from '../treemap'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('squarify', () => {
  const rand = seeded(42)
  const items = Array.from({ length: 10 }, (_, i) => ({ id: i, value: 1 + Math.floor(rand() * 100) }))
  const rect = { x: 10, y: 20, w: 800, h: 450 }
  const placed = squarify(items, (i) => i.value, rect)

  it('tổng diện tích ô xấp xỉ diện tích khung', () => {
    const total = placed.reduce((s, p) => s + p.w * p.h, 0)
    expect(Math.abs(total - rect.w * rect.h) / (rect.w * rect.h)).toBeLessThan(0.005)
  })

  it('mọi ô nằm trong khung', () => {
    const eps = 1e-6
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(rect.x - eps)
      expect(p.y).toBeGreaterThanOrEqual(rect.y - eps)
      expect(p.x + p.w).toBeLessThanOrEqual(rect.x + rect.w + eps)
      expect(p.y + p.h).toBeLessThanOrEqual(rect.y + rect.h + eps)
    }
  })

  it('bỏ item có value 0', () => {
    const out = squarify([...items, { id: 99, value: 0 }], (i) => i.value, rect)
    expect(out).toHaveLength(10)
    expect(out.some((p) => p.item.id === 99)).toBe(false)
  })
})
