import { describe, expect, it } from 'vitest'
import { dataModeLabel, fmtCompact, fmtPct } from '../format'

describe('fmtPct', () => {
  it('định dạng dấu và dấu phẩy thập phân', () => {
    expect(fmtPct(1.5)).toBe('+1,50%')
    expect(fmtPct(-0.25)).toBe('−0,25%')
    expect(fmtPct(null)).toBe('–')
  })
})

describe('fmtCompact', () => {
  it('dùng đơn vị nghìn tỷ', () => {
    expect(fmtCompact(2.5e12)).toContain('nghìn tỷ')
  })
})

describe('dataModeLabel', () => {
  it('có nhãn cho từng chế độ dữ liệu', () => {
    expect(dataModeLabel('synthetic-demo')).toBe('Dữ liệu minh hoạ')
    expect(dataModeLabel('market-provider')).toBe('Dữ liệu cuối ngày')
    expect(dataModeLabel('external-feed')).toBe('Nguồn ngoài')
    expect(dataModeLabel(null)).toBe('Chưa rõ nguồn')
  })
})
