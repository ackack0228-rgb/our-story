import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Archive } from './Archive'

const add = vi.fn().mockResolvedValue('id')
const remove = vi.fn().mockResolvedValue(undefined)
const items = [
  { id: 'a1', type: 'food', name: '을지로 냉면', rating: 5, note: '최고', date: '2026-01-01', createdAt: null },
  { id: 'a2', type: 'movie', name: '영화A', rating: 3, note: '', date: '2026-01-02', createdAt: null },
  { id: 'a3', type: 'travel', name: '부산', rating: 4, note: '', date: '2026-01-03', createdAt: null },
]

vi.mock('../../hooks/useArchive', () => ({ useArchive: () => ({ items, loading: false, add, remove }) }))

describe('Archive', () => {
  it('shows only food items by default', () => {
    render(<Archive />)
    expect(screen.getByText('을지로 냉면')).toBeInTheDocument()
    expect(screen.queryByText('영화A')).not.toBeInTheDocument()
  })

  it('switches to movie items when that tab is clicked', async () => {
    render(<Archive />)
    await userEvent.click(screen.getByRole('button', { name: /영화/ }))
    expect(screen.getByText('영화A')).toBeInTheDocument()
  })

  it('shows 여행지 reviews under their own tab', async () => {
    render(<Archive />)
    expect(screen.queryByText('부산')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /여행지/ }))
    expect(screen.getByText('부산')).toBeInTheDocument()
    expect(screen.queryByText('을지로 냉면')).not.toBeInTheDocument()
  })

  it('opens filled in for a bucket list item that was just finished', async () => {
    render(<Archive draft={{ type: 'travel', name: '제주도' }} />)
    expect(screen.getByPlaceholderText(/이름을 입력하세요/)).toHaveValue('제주도')
    expect(screen.getByText(/버킷리스트 완료/)).toBeInTheDocument()
    expect(screen.getByText('부산')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /후기 남기기/ }))
    expect(add).toHaveBeenCalledWith('travel', '제주도', 5, '')
    expect(screen.queryByText(/버킷리스트 완료/)).not.toBeInTheDocument()
  })

  it('shows no bucket list hint when opened on its own', () => {
    render(<Archive />)
    expect(screen.queryByText(/버킷리스트 완료/)).not.toBeInTheDocument()
  })

  it('keeps the form folded until asked for', async () => {
    render(<Archive />)
    expect(screen.queryByPlaceholderText(/이름을 입력하세요/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '+ 맛집 후기 쓰기' }))
    expect(screen.getByPlaceholderText(/이름을 입력하세요/)).toBeInTheDocument()
  })

  it('shows each kind as its own keepsake', async () => {
    const { container } = render(<Archive />)
    expect(container.textContent).toContain('2026-01-01 · 맛집')
    await userEvent.click(screen.getByRole('button', { name: /영화/ }))
    expect(container.textContent).toContain('2026.01.02')
    await userEvent.click(screen.getByRole('button', { name: /여행지/ }))
    expect(screen.getByLabelText('2026-01-03')).toHaveTextContent('20261.3')
  })

  it('adds a new item with the selected star rating', async () => {
    render(<Archive />)
    await userEvent.click(screen.getByRole('button', { name: '+ 맛집 후기 쓰기' }))
    await userEvent.type(screen.getByPlaceholderText(/이름을 입력하세요/), '새 맛집')
    await userEvent.click(screen.getAllByRole('button', { name: '★' })[2]) // 3rd star
    await userEvent.click(screen.getByRole('button', { name: /후기 남기기/ }))
    expect(add).toHaveBeenCalledWith('food', '새 맛집', 3, '')
  })

  it('shows an error message when adding fails', async () => {
    add.mockRejectedValueOnce(new Error('denied'))
    render(<Archive />)
    await userEvent.click(screen.getByRole('button', { name: '+ 맛집 후기 쓰기' }))
    await userEvent.type(screen.getByPlaceholderText(/이름을 입력하세요/), '새 맛집')
    await userEvent.click(screen.getByRole('button', { name: /후기 남기기/ }))
    expect(await screen.findByText(/추가하지 못했어요/)).toBeInTheDocument()
  })

  it('asks before deleting a review', async () => {
    render(<Archive />)
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(remove).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(screen.queryByText('정말 삭제할까요?')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    await userEvent.click(screen.getByRole('group', { name: '삭제 확인' }).querySelector('button:last-child')!)
    expect(remove).toHaveBeenCalledWith('a1')
  })
})
