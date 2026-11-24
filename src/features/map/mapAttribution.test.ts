import { describe, it, expect } from 'vitest'
import { MAP_ATTRIBUTION } from './mapAttribution'

describe('MAP_ATTRIBUTION', () => {
  // The boundaries are KOSTAT's, published under 공공누리 제1유형: free to use and change as long as
  // the source is named.
  it('names the source of the boundaries and their licence', () => {
    expect(MAP_ATTRIBUTION).toContain('통계청')
    expect(MAP_ATTRIBUTION).toContain('공공누리 제1유형')
  })
})
