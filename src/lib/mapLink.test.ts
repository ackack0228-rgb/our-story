import { describe, it, expect } from 'vitest'
import { mapLinkKind, mapLinkLabel, pickMapLink } from './mapLink'

describe('mapLinkKind', () => {
  it.each([
    ['https://kko.to/abc123', 'kakao'],
    ['https://kko.kakao.com/abc123', 'kakao'],
    ['https://place.map.kakao.com/12345', 'kakao'],
    ['https://map.kakao.com/?itemId=12345', 'kakao'],
    ['https://m.map.kakao.com/actions/detailMapView?id=1', 'kakao'],
    ['https://naver.me/xYz12', 'naver'],
    ['https://map.naver.com/p/entry/place/12345', 'naver'],
    ['https://m.place.naver.com/restaurant/12345', 'naver'],
    ['http://naver.me/xYz12', 'naver'],
  ])('%s → %s', (url, kind) => {
    expect(mapLinkKind(url)).toBe(kind)
  })

  it.each([
    'https://example.com/kko.to',
    'https://kko.to.evil.com/abc',
    'https://notnaver.me/abc',
    'https://www.google.com/maps/place/x',
    'javascript:alert(1)//naver.me',
    'naver.me/abc',
    '',
  ])('rejects %s', (url) => {
    expect(mapLinkKind(url)).toBeNull()
  })
})

describe('pickMapLink', () => {
  it('returns a bare link as is', () => {
    expect(pickMapLink('  https://naver.me/xYz12  ')).toBe('https://naver.me/xYz12')
  })

  it('pulls the link out of the text the map apps copy with it', () => {
    expect(pickMapLink('[카카오맵] 성수 파스타\n서울 성동구 성수동 1가 https://kko.to/abc123')).toBe('https://kko.to/abc123')
    expect(pickMapLink('[네이버지도]\n성수 파스타\nhttps://naver.me/xYz12\n')).toBe('https://naver.me/xYz12')
  })

  it('skips links that are not a map link', () => {
    expect(pickMapLink('https://example.com/a https://naver.me/xYz12')).toBe('https://naver.me/xYz12')
  })

  it('returns null when there is no map link', () => {
    expect(pickMapLink('https://example.com/a')).toBeNull()
    expect(pickMapLink('성수 파스타')).toBeNull()
  })
})

describe('mapLinkLabel', () => {
  it('names the map', () => {
    expect(mapLinkLabel('https://kko.to/abc')).toBe('카카오맵')
    expect(mapLinkLabel('https://naver.me/abc')).toBe('네이버지도')
    expect(mapLinkLabel('https://example.com')).toBeNull()
  })
})
