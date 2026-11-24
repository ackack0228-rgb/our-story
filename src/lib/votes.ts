export interface Vote {
  id: string
  name: string
  note: string
  likedBy: string[]
  createdBy?: 'A' | 'B'
  createdAt: number
}
