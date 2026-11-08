import { afterEach, describe, expect, it, vi } from 'vitest'
import { getScreenerUniverse } from '../api'

afterEach(() => vi.unstubAllGlobals())

describe('getScreenerUniverse', () => {
  it('lấy các trang sau khi danh sách vượt 200 mã', async () => {
    const offsets: number[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const params = new URL(url, 'http://localhost').searchParams
      const offset = Number(params.get('offset'))
      offsets.push(offset)
      expect(params.get('sort')).toBe('symbol')
      const count = offset === 0 ? 200 : 1
      return {
        ok: true,
        json: async () => ({
          total: 201, limit: 200, offset, asOf: offset ? '2026-11-07' : '2026-11-06',
          items: Array.from({ length: count }, (_, i) => ({
            symbol: `S${String(offset + i).padStart(3, '0')}`, name: null,
            exchange: 'HOSE', sector: null, price: 1000, change: null,
            percentChange: null, volume: null, tradingValue: null,
            marketCap: null, pe: null, pb: null, eps: null,
            dividendYield: null, fundamentalAsOf: null, fundamentalSource: null,
            asOf: '2026-11-06', source: 'vnstock',
          })),
        }),
      }
    }))

    const result = await getScreenerUniverse()
    expect(offsets).toEqual([0, 200])
    expect(result.stocks).toHaveLength(201)
    expect(result.stocks.at(-1)?.symbol).toBe('S200')
    expect(result.updated_at).toBe('2026-11-07')
  })
})
