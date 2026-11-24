import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordList } from './RecordList'
import { usePlaces } from '../../hooks/usePlaces'

vi.mock('../../hooks/usePlaces', () => ({ usePlaces: vi.fn() }))

const toggle = vi.fn().mockResolvedValue(undefined)
const addComment = vi.fn().mockResolvedValue(undefined)
const removeComment = vi.fn().mockResolvedValue(undefined)
let reactionItems: unknown[] = []
let commentItems: unknown[] = []
vi.mock('../../hooks/useReactions', () => ({ useReactions: () => ({ items: reactionItems, loading: false, error: null, toggle, clearFor: vi.fn() }) }))
vi.mock('../../hooks/useComments', () => ({ useComments: () => ({ items: commentItems, loading: false, error: null, add: addComment, remove: removeComment }) }))
vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({ me: 'A', settings: { nameA: '갑', nameB: '을', startDate: null } }),
}))

const places = [
  { id: 'p1', name: '강릉', date: '2026-01-01', mood: '🌊', diary: '좋았다', x: 1, y: 2, photoUrl: null, createdBy: 'A', createdAt: 1 },
  { id: 'p2', name: '부산', date: '2026-03-01', mood: '🍜', diary: '맛있었다', x: 3, y: 4, photoUrl: 'https://x/p.jpg', createdBy: 'A', createdAt: 1 },
]

describe('RecordList', () => {
  it('lists places with the most recent visit date first', () => {
    vi.mocked(usePlaces).mockReturnValue({ places, loading: false, error: null, add: vi.fn(), update: vi.fn(), remove: vi.fn() })
    render(<RecordList />)
    const names = screen.getAllByTestId('record-name').map((el) => el.textContent)
    expect(names).toEqual(['부산', '강릉'])
  })

  it('opens a place for editing when its card is pressed', async () => {
    vi.mocked(usePlaces).mockReturnValue({ places, loading: false, error: null, add: vi.fn(), update: vi.fn(), remove: vi.fn() })
    render(<RecordList />)
    expect(screen.queryByText('장소 기록 수정')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /강릉/ }))
    expect(screen.getByText('장소 기록 수정')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/장소 이름/)).toHaveValue('강릉')
  })

  it('shows an empty state when there are no places', () => {
    vi.mocked(usePlaces).mockReturnValue({ places: [], loading: false, error: null, add: vi.fn(), update: vi.fn(), remove: vi.fn() })
    render(<RecordList />)
    expect(screen.getByText(/아직 기록된 장소가 없어요/)).toBeInTheDocument()
  })

  it('shows an error message instead of the list when loading fails', () => {
    vi.mocked(usePlaces).mockReturnValue({
      places: [], loading: false, error: '데이터를 불러오지 못했어요.', add: vi.fn(), update: vi.fn(), remove: vi.fn(),
    })
    render(<RecordList />)
    expect(screen.getByText('데이터를 불러오지 못했어요.')).toBeInTheDocument()
  })

  it("reacts to a record with the place's name, and shows who reacted", async () => {
    vi.mocked(usePlaces).mockReturnValue({ places, loading: false, error: null, add: vi.fn(), update: vi.fn(), remove: vi.fn() })
    reactionItems = [{ id: 'p1_B_heart', eventId: 'p1', emoji: 'heart', sender: 'B', createdAt: 1 }]
    render(<RecordList />)
    const hearts = screen.getAllByRole('button', { name: '❤️ 반응' })
    expect(hearts[1]).toHaveTextContent('을') // 강릉 is second: newest first
    await userEvent.click(hearts[0])
    expect(toggle).toHaveBeenCalledWith({ id: 'p2', title: '부산' }, 'heart')
    expect(screen.queryByText('장소 기록 수정')).not.toBeInTheDocument()
    reactionItems = []
  })

  it("opens a record's comments, sends one, and lets me delete only my own", async () => {
    vi.mocked(usePlaces).mockReturnValue({ places, loading: false, error: null, add: vi.fn(), update: vi.fn(), remove: vi.fn() })
    commentItems = [
      { id: 'c1', placeId: 'p1', text: '또 가자', sender: 'B', createdAt: 1 },
      { id: 'c2', placeId: 'p1', text: '좋아!', sender: 'A', createdAt: 2 },
    ]
    render(<RecordList />)
    await userEvent.click(screen.getByRole('button', { name: /댓글 2/ }))
    expect(screen.getByText('또 가자')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '댓글 삭제' })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: '댓글 삭제' }))
    expect(removeComment).toHaveBeenCalledWith('c2')
    await userEvent.type(screen.getByRole('textbox', { name: '댓글' }), '다음엔 겨울에')
    await userEvent.click(screen.getByRole('button', { name: '보내기' }))
    expect(addComment).toHaveBeenCalledWith({ id: 'p1', name: '강릉' }, '다음엔 겨울에')
    expect(screen.getByRole('textbox', { name: '댓글' })).toHaveValue('')
    commentItems = []
  })

  it('shows the visit date as a postmark on the photo stamp', () => {
    vi.mocked(usePlaces).mockReturnValue({ places, loading: false, error: null, add: vi.fn(), update: vi.fn(), remove: vi.fn() })
    render(<RecordList />)
    expect(screen.getByLabelText('2026-03-01')).toHaveTextContent('20263.1')
  })
})
