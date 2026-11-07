import { describe, expect, it } from 'vitest'
import type { EventWindow, NewsReaction } from '../api'
import { reactionLabel } from '../reactions'

const win = (over: Partial<EventWindow> = {}): EventWindow => ({
  status: 'measured', endDate: '2026-01-05', returnPct: 1.2, benchmarkReturnPct: 0.2, abnormalReturnPct: 1.0, reason: null, ...over,
})

const reaction = (over: Partial<NewsReaction> = {}): NewsReaction => ({
  symbol: 'FPT', status: 'measured', methodVersion: 'v1', benchmarkSymbol: 'VNINDEX', dataMode: 'market-provider',
  priceSource: 'x', benchmarkSource: 'x', asOf: null, t1: win(), t5: win({ abnormalReturnPct: -2 }), ...over,
})

describe('reactionLabel', () => {
  it('trả số khi measured, market-provider và có methodVersion', () => {
    expect(reactionLabel(reaction(), 't1')).toEqual({ kind: 'number', value: 1.0 })
    expect(reactionLabel(reaction(), 't5')).toEqual({ kind: 'number', value: -2 })
  })

  it('measured nhưng dữ liệu minh hoạ thì hiện chữ', () => {
    expect(reactionLabel(reaction({ dataMode: 'synthetic-demo' }), 't1')).toMatchObject({ kind: 'text', text: 'Dữ liệu minh hoạ' })
    expect(reactionLabel(reaction({ dataMode: null }), 't1')).toMatchObject({ kind: 'text', text: 'Dữ liệu minh hoạ' })
  })

  it('measured thiếu methodVersion thì hiện chữ', () => {
    expect(reactionLabel(reaction({ methodVersion: null }), 't5')).toMatchObject({ kind: 'text', text: 'Dữ liệu minh hoạ' })
  })

  it('các trạng thái khác hiện đúng nhãn', () => {
    expect(reactionLabel(reaction({ status: 'pending' }), 't1')).toMatchObject({ kind: 'text', text: 'Chờ phiên sau' })
    expect(reactionLabel(reaction({ status: 'insufficient_data' }), 't1')).toMatchObject({ kind: 'text', text: 'Chưa đủ dữ liệu' })
    expect(reactionLabel(reaction({ status: 'overlapping_event' }), 't5')).toMatchObject({ kind: 'text', text: 'Trùng tin khác' })
  })

  it('không có reaction thì hiện gạch ngang', () => {
    expect(reactionLabel(undefined, 't1')).toEqual({ kind: 'text', text: '–' })
  })
})
