import { describe, it, expect } from 'vitest'
import { canvasPointerPosition, strokeFor, TOOL_SIZES } from './canvasMath'

describe('canvasPointerPosition', () => {
  it('maps a client point through a scaled rect to canvas pixel coordinates', () => {
    const rect = { left: 10, top: 20, width: 250, height: 250 }
    // canvas is 500x500 but displayed at 250x250 -> 2x scale factor
    expect(canvasPointerPosition(135, 145, rect, 500, 500)).toEqual({ x: 250, y: 250 })
  })
})

describe('strokeFor', () => {
  it('draws with the chosen colour and size', () => {
    expect(strokeFor('pen', '#FF8465', 5)).toEqual({ color: '#FF8465', width: 5 })
  })

  it('erases by painting the paper colour at the eraser size', () => {
    expect(strokeFor('eraser', '#FF8465', 30)).toEqual({ color: '#fff', width: 30 })
  })

  it('lets the eraser grow far wider than the pen, and starts each tool inside its range', () => {
    expect(TOOL_SIZES.eraser.max).toBeGreaterThan(TOOL_SIZES.pen.max * 5)
    for (const { min, max, initial } of Object.values(TOOL_SIZES)) {
      expect(initial).toBeGreaterThanOrEqual(min)
      expect(initial).toBeLessThanOrEqual(max)
    }
  })
})
