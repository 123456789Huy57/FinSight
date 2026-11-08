import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMarketBoard } from '../api'

afterEach(() => vi.unstubAllGlobals())

describe('getMarketBoard', () => {
  it('lấy toàn bộ bảng giá trong một request và giữ mã chưa có giá', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe('/api/v1/market/board')
      return {
        ok: true,
        json: async () => ({
        total: 2, source: 'vnstock', dataMode: 'market-provider',
        quoteSource: 'kbs', snapshotAt: '2026-11-08T05:45:54Z', status: 'current',
        items: [
          { symbol: 'FPT', name: 'FPT', exchange: 'HOSE', sector: null, price: 50800, referencePrice: 52900, change: -2100, percentChange: -3.97 },
          { symbol: 'VCB', name: 'VCB', exchange: 'HOSE', sector: null, price: null, referencePrice: 54200, change: null, percentChange: null },
        ],
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const board = await getMarketBoard()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/market/board')
    expect(board.stocks).toHaveLength(2)
    expect(board.stocks[0].current_price).toBe(50800)
    expect(board.stocks[1].current_price).toBeNull()
    expect(board.stocks[1].reference_price).toBe(54200)
    expect(board.quote_source).toBe('kbs')
  })
})
