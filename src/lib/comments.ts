// Comments on a place record. One row each in `comments`, oldest first under the record.
import type { Who } from '../../supabase/functions/_shared/rules'
import { pad2 } from './isoDate'

export const COMMENT_MAX = 200

export interface PlaceComment {
  id: string
  placeId: string
  /** The place's name when the comment was written — for the notification line. */
  placeName?: string
  text: string
  sender: Who
  createdAt: number
}

// Rows are free-form JSON. Anything without a place, some words, or a known author is left out.
export function isComment(v: unknown): v is PlaceComment {
  const c = v as Partial<PlaceComment> | null
  return !!c && typeof c.placeId === 'string' && c.placeId !== '' && typeof c.text === 'string' && c.text.trim() !== ''
    && (c.sender === 'A' || c.sender === 'B')
}

export function commentsFor(comments: PlaceComment[], placeId: string): PlaceComment[] {
  return comments.filter((c) => c.placeId === placeId).sort((a, b) => a.createdAt - b.createdAt)
}

// '10/30 14:05' in local time, or '' when the row has no usable time.
export function commentTime(createdAt: number): string {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return ''
  const d = new Date(createdAt)
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
