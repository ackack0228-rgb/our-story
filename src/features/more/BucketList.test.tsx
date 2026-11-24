import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BucketList } from './BucketList'

const add = vi.fn().mockResolvedValue('id')
const toggle = vi.fn().mockResolvedValue(undefined)
const edit = vi.fn().mockResolvedValue(undefined)
const remove = vi.fn().mockResolvedValue(undefined)
const items = [
  { id: 'b1', text: '부산 여행 가기', category: 'destination', done: false, createdAt: null },
  { id: 'b2', text: '제주 한 달 살기', category: 'destination', done: true, createdAt: null },
  { id: 'b3', text: '성수 파스타', category: 'food', done: false, link: 'https://kko.to/abc123', createdAt: null },
  { id: 'b4', text: '연남 라멘', category: 'food', done: false, note: '웨이팅 길다니까 평일에', createdAt: null },
]

vi.mock('../../hooks/useBucket', () => ({ useBucket: () => ({ items, loading: false, add, edit, toggle, remove }) }))

async function openTab(name: string) {
  await userEvent.click(screen.getByRole('button', { name }))
}

describe('BucketList', () => {
  beforeEach(() => {
    add.mockClear()
    edit.mockClear()
    toggle.mockClear()
    remove.mockClear()
  })

  it('shows progress as done/total over every kind', () => {
    render(<BucketList />)
    expect(screen.getByText('1 / 4 완료')).toBeInTheDocument()
  })

  it('has tabs for 여행지 · 맛집 · 영화 only — no 전체 or 도전과제', () => {
    render(<BucketList />)
    expect(screen.queryByRole('button', { name: '전체' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '도전과제' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '도전과제' })).not.toBeInTheDocument()
    for (const name of ['여행지', '맛집', '영화']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
  })

  it('opens on 여행지, showing only those', () => {
    render(<BucketList />)
    expect(screen.getByText('부산 여행 가기')).toBeInTheDocument()
    expect(screen.queryByText('성수 파스타')).not.toBeInTheDocument()
  })

  it('switching tabs shows that kind, and the add form follows it', async () => {
    render(<BucketList />)
    await openTab('맛집')
    expect(screen.getByText('성수 파스타')).toBeInTheDocument()
    expect(screen.queryByText('부산 여행 가기')).not.toBeInTheDocument()
  })

  it('adds a new item from the input row', async () => {
    render(<BucketList />)
    await userEvent.type(screen.getByPlaceholderText(/예: 부산 여행 가기/), '한강 피크닉')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(add).toHaveBeenCalledWith('한강 피크닉', 'destination', {})
  })

  it('shows an error message when adding fails', async () => {
    add.mockRejectedValueOnce(new Error('denied'))
    render(<BucketList />)
    await userEvent.type(screen.getByPlaceholderText(/예: 부산 여행 가기/), '한강 피크닉')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(await screen.findByText(/추가하지 못했어요/)).toBeInTheDocument()
  })

  it('shows an error message when toggling fails', async () => {
    toggle.mockRejectedValueOnce(new Error('denied'))
    render(<BucketList />)
    await userEvent.click(screen.getAllByLabelText('완료 표시')[0])
    expect(await screen.findByText(/상태를 변경하지 못했어요/)).toBeInTheDocument()
  })

  it('links a 맛집 to its map, and shows no link where there is none', async () => {
    render(<BucketList />)
    await openTab('맛집')
    const link = screen.getByRole('link', { name: '카카오맵' })
    expect(link).toHaveAttribute('href', 'https://kko.to/abc123')
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('asks for a link only when adding a 맛집', async () => {
    render(<BucketList />)
    expect(screen.queryByLabelText('지도 링크')).not.toBeInTheDocument()
    await openTab('맛집')
    expect(screen.getByLabelText('지도 링크')).toBeInTheDocument()
  })

  it('saves a 맛집 with just the link from what was pasted', async () => {
    render(<BucketList />)
    await openTab('맛집')
    await userEvent.type(screen.getByLabelText('이름'), '망원 떡볶이')
    await userEvent.click(screen.getByLabelText('지도 링크'))
    await userEvent.paste('[네이버지도] 망원 떡볶이 https://naver.me/xYz12')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(add).toHaveBeenCalledWith('망원 떡볶이', 'food', { link: 'https://naver.me/xYz12' })
    expect(screen.getByLabelText('지도 링크')).toHaveValue('')
  })

  it('saves a 맛집 without a link', async () => {
    render(<BucketList />)
    await openTab('맛집')
    await userEvent.type(screen.getByLabelText('이름'), '망원 떡볶이')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(add).toHaveBeenCalledWith('망원 떡볶이', 'food', {})
  })

  it('refuses a link that is not 카카오맵 or 네이버지도', async () => {
    render(<BucketList />)
    await openTab('맛집')
    await userEvent.type(screen.getByLabelText('이름'), '망원 떡볶이')
    await userEvent.type(screen.getByLabelText('지도 링크'), 'https://example.com/a')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(add).not.toHaveBeenCalled()
    expect(screen.getByText('카카오맵이나 네이버지도 링크만 넣을 수 있어요.')).toBeInTheDocument()
  })

  it('does not send a link typed for a 맛집 after switching to another kind', async () => {
    render(<BucketList />)
    await openTab('맛집')
    await userEvent.type(screen.getByLabelText('지도 링크'), 'https://naver.me/xYz12')
    await openTab('영화')
    await userEvent.type(screen.getByLabelText('이름'), '영화A')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(add).toHaveBeenCalledWith('영화A', 'movie', {})
  })

  it('shows the note under an item that has one', async () => {
    render(<BucketList />)
    await openTab('맛집')
    expect(screen.getByText('웨이팅 길다니까 평일에')).toBeInTheDocument()
  })

  it('saves a note with any kind of item and clears the box', async () => {
    render(<BucketList />)
    await userEvent.type(screen.getByLabelText('이름'), '한강 피크닉')
    await userEvent.type(screen.getByLabelText('설명'), '  돗자리 챙기기  ')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(add).toHaveBeenCalledWith('한강 피크닉', 'destination', { note: '돗자리 챙기기' })
    expect(screen.getByLabelText('설명')).toHaveValue('')
  })

  it('keeps the note to 100 characters', () => {
    render(<BucketList />)
    expect(screen.getByLabelText('설명')).toHaveAttribute('maxLength', '100')
  })

  it('hands a finished 맛집 over for a review', async () => {
    const onReview = vi.fn()
    render(<BucketList onReview={onReview} />)
    await openTab('맛집')
    await userEvent.click(screen.getAllByLabelText('완료 표시')[0])
    expect(toggle).toHaveBeenCalledWith('b3', true)
    expect(onReview).toHaveBeenCalledWith({ type: 'food', name: '성수 파스타' })
  })

  it('hands a finished 여행지 over as a 여행지 review', async () => {
    const onReview = vi.fn()
    render(<BucketList onReview={onReview} />)
    await userEvent.click(screen.getAllByLabelText('완료 표시')[0])
    expect(onReview).toHaveBeenCalledWith({ type: 'travel', name: '부산 여행 가기' })
  })

  it('asks for no review when saving fails', async () => {
    const onReview = vi.fn()
    render(<BucketList onReview={onReview} />)
    toggle.mockRejectedValueOnce(new Error('denied'))
    await userEvent.click(screen.getAllByLabelText('완료 표시')[0])
    expect(onReview).not.toHaveBeenCalled()
  })

  it('offers 영화 as a kind', async () => {
    render(<BucketList />)
    await openTab('영화')
    await userEvent.type(screen.getByLabelText('이름'), '영화C')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(add).toHaveBeenCalledWith('영화C', 'movie', {})
  })

  it('leaves finished items out of the list but still counts them', () => {
    render(<BucketList />)
    expect(screen.queryByText('제주 한 달 살기')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '완료 취소' })).not.toBeInTheDocument()
    expect(screen.getByText('1 / 4 완료')).toBeInTheDocument()
    const open = screen.getAllByRole('button', { name: '완료 표시' })
    expect(open).toHaveLength(1)
    expect(open[0]).toHaveTextContent(/^완료$/)
  })

  it('opens an item for changes, filled with what it says now', async () => {
    render(<BucketList />)
    await openTab('맛집')
    await userEvent.click(screen.getByRole('button', { name: '연남 라멘 수정' }))
    expect(screen.getByLabelText('고칠 이름')).toHaveValue('연남 라멘')
    expect(screen.getByLabelText('고칠 종류')).toHaveValue('food')
    expect(screen.getByLabelText('고칠 설명')).toHaveValue('웨이팅 길다니까 평일에')
    expect(screen.getByLabelText('고칠 지도 링크')).toHaveValue('')
  })

  it('saves the changed name, kind and note, then closes', async () => {
    render(<BucketList />)
    await userEvent.click(screen.getByRole('button', { name: '부산 여행 가기 수정' }))
    const name = screen.getByLabelText('고칠 이름')
    await userEvent.clear(name)
    await userEvent.type(name, '  부산 1박 2일  ')
    await userEvent.selectOptions(screen.getByLabelText('고칠 종류'), 'movie')
    await userEvent.type(screen.getByLabelText('고칠 설명'), '기차로')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(edit).toHaveBeenCalledWith('b1', { text: '부산 1박 2일', category: 'movie', note: '기차로', link: null })
    expect(screen.queryByLabelText('고칠 이름')).not.toBeInTheDocument()
  })

  it('clears a note or link that was emptied, and drops the link when it stops being a 맛집', async () => {
    render(<BucketList />)
    await openTab('맛집')
    await userEvent.click(screen.getByRole('button', { name: '성수 파스타 수정' }))
    expect(screen.getByLabelText('고칠 지도 링크')).toHaveValue('https://kko.to/abc123')
    await userEvent.selectOptions(screen.getByLabelText('고칠 종류'), 'movie')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(edit).toHaveBeenCalledWith('b3', { text: '성수 파스타', category: 'movie', note: null, link: null })
  })

  it('keeps a pasted map link when changing a 맛집', async () => {
    render(<BucketList />)
    await openTab('맛집')
    await userEvent.click(screen.getByRole('button', { name: '연남 라멘 수정' }))
    await userEvent.click(screen.getByLabelText('고칠 지도 링크'))
    await userEvent.paste('[네이버지도] 연남 라멘 https://naver.me/abc')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(edit).toHaveBeenCalledWith('b4', { text: '연남 라멘', category: 'food', note: '웨이팅 길다니까 평일에', link: 'https://naver.me/abc' })
  })

  it('refuses an empty name or a link that is not a map', async () => {
    render(<BucketList />)
    await openTab('맛집')
    await userEvent.click(screen.getByRole('button', { name: '연남 라멘 수정' }))
    await userEvent.type(screen.getByLabelText('고칠 지도 링크'), 'https://example.com')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(screen.getByText('카카오맵이나 네이버지도 링크만 넣을 수 있어요.')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('고칠 이름'))
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(screen.getByText('이름을 적어 주세요.')).toBeInTheDocument()
    expect(edit).not.toHaveBeenCalled()
  })

  it('leaves the item as it was on 취소', async () => {
    render(<BucketList />)
    await userEvent.click(screen.getByRole('button', { name: '부산 여행 가기 수정' }))
    await userEvent.type(screen.getByLabelText('고칠 이름'), '!!!')
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(edit).not.toHaveBeenCalled()
    expect(screen.getByText('부산 여행 가기')).toBeInTheDocument()
  })

  it('stays open with a message when saving fails', async () => {
    edit.mockRejectedValueOnce(new Error('denied'))
    render(<BucketList />)
    await userEvent.click(screen.getByRole('button', { name: '부산 여행 가기 수정' }))
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장하지 못했어요. 다시 시도해주세요.')).toBeInTheDocument()
    expect(screen.getByLabelText('고칠 이름')).toHaveValue('부산 여행 가기')
  })

  it('asks before deleting an item, and 취소 keeps it', async () => {
    render(<BucketList />)
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(screen.getByText('정말 삭제할까요?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(remove).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    await userEvent.click(screen.getByRole('group', { name: '삭제 확인' }).querySelector('button:last-child')!)
    expect(remove).toHaveBeenCalledWith('b1')
  })

  it('keeps finished items folded under the list, and can put one back', async () => {
    render(<BucketList />)
    const fold = screen.getByRole('button', { name: /완료한 여행지 1개 보기/ })
    expect(fold).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(fold)
    expect(screen.getByText('제주 한 달 살기')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '되돌리기' }))
    expect(toggle).toHaveBeenCalledWith('b2', false)
  })

  it('shows no fold for a kind with nothing finished', async () => {
    render(<BucketList />)
    await openTab('맛집')
    expect(screen.queryByRole('button', { name: /완료한/ })).not.toBeInTheDocument()
  })

  it('stamps 완료 on the card before it leaves, unless the phone asks for less motion', async () => {
    const original = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: false, media: q })) as unknown as typeof window.matchMedia
    try {
      render(<BucketList />)
      await userEvent.click(screen.getByLabelText('완료 표시'))
      expect(screen.getByText('완료', { selector: 'span' })).toBeInTheDocument()
      expect(toggle).not.toHaveBeenCalled()
      await waitFor(() => expect(toggle).toHaveBeenCalledWith('b1', true))
    } finally {
      window.matchMedia = original
    }
  })
})
