import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TravelVote } from './TravelVote'

const add = vi.fn().mockResolvedValue('id')
const toggleLike = vi.fn().mockResolvedValue(undefined)
const remove = vi.fn().mockResolvedValue(undefined)
const items = [
  { id: 'v1', name: '부산', note: '바다', likedBy: ['A', 'B'], createdAt: 1 },
  { id: 'v2', name: '제주', note: '', likedBy: ['A'], createdAt: 1 },
]

vi.mock('../../hooks/useVotes', () => ({ useVotes: () => ({ items, loading: false, add, toggleLike, remove }) }))
vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({ me: 'A', settings: { nameA: '나', nameB: '상대방', startDate: null } }),
}))

describe('TravelVote', () => {
  it('stamps 탑승 확정 only on a candidate both of us liked, and shows who is aboard', () => {
    render(<TravelVote />)
    expect(screen.getAllByText('탑승 확정')).toHaveLength(1)
    expect(screen.getAllByText('나 탑승')).toHaveLength(1)
    expect(screen.getByText('상대방 아직')).toBeInTheDocument()
  })

  it('keeps the add form folded until asked for', async () => {
    render(<TravelVote />)
    expect(screen.queryByPlaceholderText(/여행지 후보 이름/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '+ 여행지 후보 올리기' }))
    expect(screen.getByPlaceholderText(/여행지 후보 이름/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByPlaceholderText(/여행지 후보 이름/)).not.toBeInTheDocument()
  })

  it('adds a new candidate from the input row', async () => {
    render(<TravelVote />)
    await userEvent.click(screen.getByRole('button', { name: '+ 여행지 후보 올리기' }))
    await userEvent.type(screen.getByPlaceholderText(/여행지 후보 이름/), '강릉')
    await userEvent.click(screen.getByRole('button', { name: '후보 추가하기' }))
    expect(add).toHaveBeenCalledWith('강릉', '')
  })

  it('toggles a like when the heart is clicked', async () => {
    render(<TravelVote />)
    await userEvent.click(screen.getAllByRole('button', { name: /좋아요/ })[0])
    expect(toggleLike).toHaveBeenCalledWith('v1')
  })

  it('shows an error message when adding fails', async () => {
    add.mockRejectedValueOnce(new Error('denied'))
    render(<TravelVote />)
    await userEvent.click(screen.getByRole('button', { name: '+ 여행지 후보 올리기' }))
    await userEvent.type(screen.getByPlaceholderText(/여행지 후보 이름/), '강릉')
    await userEvent.click(screen.getByRole('button', { name: '후보 추가하기' }))
    expect(await screen.findByText(/추가하지 못했어요/)).toBeInTheDocument()
  })

  it('shows an error message when toggling a like fails', async () => {
    toggleLike.mockRejectedValueOnce(new Error('denied'))
    render(<TravelVote />)
    await userEvent.click(screen.getAllByRole('button', { name: /좋아요/ })[0])
    expect(await screen.findByText(/반응을 저장하지 못했어요/)).toBeInTheDocument()
  })

  it('asks before deleting a candidate', async () => {
    render(<TravelVote />)
    await userEvent.click(screen.getAllByRole('button', { name: '삭제' })[1])
    expect(remove).not.toHaveBeenCalled()
    expect(screen.getByText('정말 삭제할까요?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('group', { name: '삭제 확인' }).querySelector('button:last-child')!)
    expect(remove).toHaveBeenCalledWith('v2')
  })
})
