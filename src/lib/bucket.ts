export type BucketCategory = 'destination' | 'food' | 'movie'

export const BUCKET_CATEGORIES: { key: BucketCategory; label: string; placeholder: string }[] = [
  { key: 'destination', label: '여행지', placeholder: '예: 부산 여행 가기' },
  { key: 'food', label: '맛집', placeholder: '예: 성수동 파스타집' },
  { key: 'movie', label: '영화', placeholder: '예: 같이 보고 싶은 영화' },
]

export const BUCKET_NOTE_MAX = 100

export interface BucketItem {
  id: string
  text: string
  category: BucketCategory
  done: boolean
  /** 이름 아래에 보이는 짧은 설명 */
  note?: string | null
  /** 맛집만: 카카오맵 또는 네이버지도 주소 */
  link?: string | null
  createdBy?: 'A' | 'B'
  createdAt: number
}
