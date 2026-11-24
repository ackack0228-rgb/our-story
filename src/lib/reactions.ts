import { REACTION_EMOJI, type Who } from '../../supabase/functions/_shared/rules'

export type ReactionKey = keyof typeof REACTION_EMOJI

export interface Reaction {
  id: string
  eventId: string
  emoji: ReactionKey
  sender: Who
  eventTitle?: string
  createdAt: number
}

export interface ReactionGroup {
  key: ReactionKey
  emoji: string
  who: Who[]
}

export const REACTION_KEYS = Object.keys(REACTION_EMOJI) as ReactionKey[]

const isKey = (v: unknown): v is ReactionKey => typeof v === 'string' && Object.prototype.hasOwnProperty.call(REACTION_EMOJI, v)

// Rows are free-form JSON. Anything that is not a known reaction on some event from A or B is left out.
export function isReaction(v: unknown): v is Reaction {
  const r = v as Partial<Reaction> | null
  return !!r && typeof r.eventId === 'string' && r.eventId !== '' && isKey(r.emoji) && (r.sender === 'A' || r.sender === 'B')
}

// One id per event, person and kind: pressing the same reaction twice can only ever make one row.
export function reactionId(eventId: string, sender: Who, key: ReactionKey): string {
  return `${eventId}_${sender}_${key}`
}

// Every kind in button order, with who pressed it (A before B) — empty ones included, for the buttons.
export function reactionsFor(reactions: Reaction[], eventId: string): ReactionGroup[] {
  const mine = reactions.filter((r) => r.eventId === eventId)
  return REACTION_KEYS.map((key) => ({
    key,
    emoji: REACTION_EMOJI[key],
    who: (['A', 'B'] as Who[]).filter((who) => mine.some((r) => r.emoji === key && r.sender === who)),
  }))
}

// The emojis an event has received, for places that only show them: '❤️💪'.
export function reactionSummary(reactions: Reaction[], eventId: string): string {
  return reactionsFor(reactions, eventId).filter((g) => g.who.length > 0).map((g) => g.emoji).join('')
}
