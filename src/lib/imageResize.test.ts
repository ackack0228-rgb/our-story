import { describe, it, expect } from 'vitest'
import {
  calcResizeDimensions,
  blobToDataUrl,
  compressWithinBudget,
  RESIZE_STEPS,
} from './imageResize'

describe('calcResizeDimensions', () => {
  it('leaves a smaller-than-max image unchanged', () => {
    expect(calcResizeDimensions(400, 300, 1280)).toEqual({ width: 400, height: 300 })
  })

  it('scales a wider-than-max image down, preserving aspect ratio', () => {
    expect(calcResizeDimensions(2560, 1280, 1280)).toEqual({ width: 1280, height: 640 })
  })
})

describe('blobToDataUrl', () => {
  it('encodes a blob as a base64 data URL with the correct mime type', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' })
    const url = await blobToDataUrl(blob)
    expect(url.startsWith('data:text/plain;base64,')).toBe(true)
    expect(atob(url.split(',')[1])).toBe('hello')
  })
})

describe('compressWithinBudget', () => {
  it('returns the first attempt that already fits, without trying smaller sizes', async () => {
    const calls: Array<[number, number]> = []
    const encode = async (width: number, quality: number) => {
      calls.push([width, quality])
      return new Blob([new Uint8Array(100)])
    }
    const blob = await compressWithinBudget(encode, 500)
    expect(blob.size).toBe(100)
    expect(calls).toEqual([[RESIZE_STEPS[0].width, RESIZE_STEPS[0].quality]])
  })

  it('moves to a smaller width after only a couple of quality drops, instead of exhausting every quality level at full width first', () => {
    // Regression guard for a real bug: trying every quality level at the largest width before
    // ever shrinking the width means the fallback is a blocky full-resolution JPEG, which usually
    // looks worse than a crisp smaller image — RESIZE_STEPS must pair width+quality, not form a
    // full width-outer/quality-inner cross product.
    const firstWidth = RESIZE_STEPS[0].width
    const leadingRunAtFirstWidth = RESIZE_STEPS.filter((s) => s.width === firstWidth).length
    const totalQualityLevelsUsed = new Set(RESIZE_STEPS.map((s) => s.quality)).size
    expect(leadingRunAtFirstWidth).toBeLessThan(totalQualityLevelsUsed)
  })

  it('shrinks step by step until a combo fits under budget', async () => {
    const last = RESIZE_STEPS[RESIZE_STEPS.length - 1]
    const encode = async (width: number, quality: number) => {
      const fits = width === last.width && quality === last.quality
      return new Blob([new Uint8Array(fits ? 100 : 100000)])
    }
    const blob = await compressWithinBudget(encode, 500)
    expect(blob.size).toBe(100)
  })

  it('falls back to the last (smallest) attempt when nothing fits under budget', async () => {
    const encode = async () => new Blob([new Uint8Array(100000)])
    const blob = await compressWithinBudget(encode, 500)
    expect(blob.size).toBe(100000)
  })
})
