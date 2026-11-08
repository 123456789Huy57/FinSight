import { describe, expect, it } from 'vitest'

import { changeColor } from '../heatmap-color'

describe('heatmap exchange bands', () => {
  it('normalizes color intensity by the exchange normal band', () => {
    expect(changeColor(7, 'HOSE')).toBe(changeColor(10, 'HNX'))
    expect(changeColor(10, 'HNX')).toBe(changeColor(15, 'UPCOM'))
    expect(changeColor(7, 'HNX')).not.toBe(changeColor(7, 'HOSE'))
    expect(changeColor(-7, 'HOSE')).toBe(changeColor(-10, 'HNX'))
  })
})
