export interface Place {
  id: string
  name: string
  date: string
  mood: string
  diary: string
  /** Which area of the map it is in — an id from lib/regions. Missing on places saved before the map had areas. */
  region?: string
  /** Where the pin sat on the old picture map. No longer written or read. */
  x?: number
  y?: number
  photoUrl: string | null
  createdBy: string
  createdAt: number
}

export type NewPlaceInput = Omit<Place, 'id' | 'createdAt'>
