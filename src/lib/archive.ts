import type { BucketCategory } from './bucket'

export type ArchiveType = 'food' | 'movie' | 'travel'

export const ARCHIVE_TYPES: { key: ArchiveType; label: string }[] = [
  { key: 'food', label: '맛집' },
  { key: 'movie', label: '영화' },
  { key: 'travel', label: '여행지' },
]

export interface ArchiveItem {
  id: string
  type: ArchiveType
  name: string
  rating: number
  note: string
  date: string
  createdBy?: 'A' | 'B'
  createdAt: number
}

/** What a finished bucket list item hands over to the 후기 form. */
export interface ReviewDraft {
  type: ArchiveType
  name: string
}

const REVIEW_TYPE = new Map<string, ArchiveType>([
  ['food', 'food'],
  ['movie', 'movie'],
  ['destination', 'travel'],
] satisfies [BucketCategory, ArchiveType][])

/** Which kind of 후기 a bucket list category leads to — null for a kind it does not know. */
export function reviewTypeFor(category: string): ArchiveType | null {
  return REVIEW_TYPE.get(category) ?? null
}
