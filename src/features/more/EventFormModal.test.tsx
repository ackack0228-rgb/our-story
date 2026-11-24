import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventFormModal } from './EventFormModal'
import type { CalendarEvent } from '../../lib/events'

vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({ me: 'B', settings: { nameA: '갑', nameB: '을', startDate: null } }),
}))

const onSave = vi.fn()
const onDelete = vi.fn()
const onClose = vi.fn()

const existing: CalendarEvent = {
  id: 'e1', title: '저녁 약속', date: '2026-10-12', time: '19:00', owner: 'both', note: '강남역', createdBy: 'A', createdAt: 1,
}

function renderNew() {
  return render(<EventFormModal initial={null} defaultDate="2026-10-09" onSave={onSave} onClose={onClose} />)
}
function renderEdit() {
  return render(<EventFormModal initial={existing} defaultDate="2026-10-09" onSave={onSave} onDelete={onDelete} onClose={onClose} />)
}

describe('EventFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onSave.mockResolvedValue(undefined)
    onDelete.mockResolvedValue(undefined)
  })

  it('starts on the selected day, all day, as my own event', () => {
    renderNew()
    expect(screen.getByLabelText('제목')).toHaveValue('')
    expect(screen.getByLabelText('시작하는 날')).toHaveValue('2026-10-09')
    expect(screen.getByLabelText(/시간/)).toHaveValue('')
    expect(screen.getByRole('button', { name: '을' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '갑' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '우리' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  })

  it('lists my name first, then the other person, then 우리', () => {
    renderNew()
    const names = screen.getAllByRole('button').map((b) => b.textContent).filter((t) => ['갑', '을', '우리'].includes(t ?? ''))
    expect(names).toEqual(['을', '갑', '우리'])
  })

  it('cannot be saved without a title, or with only spaces', async () => {
    renderNew()
    expect(screen.getByRole('button', { name: '저장하기' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('제목'), '   ')
    expect(screen.getByRole('button', { name: '저장하기' })).toBeDisabled()
  })

  it('cannot be saved once the date is cleared', async () => {
    renderNew()
    await userEvent.type(screen.getByLabelText('제목'), '약속')
    fireEvent.change(screen.getByLabelText('시작하는 날'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: '저장하기' })).toBeDisabled()
  })

  it('saves trimmed values and closes', async () => {
    renderNew()
    await userEvent.type(screen.getByLabelText('제목'), '  시험  ')
    fireEvent.change(screen.getByLabelText(/시간/), { target: { value: '09:00' } })
    await userEvent.click(screen.getByRole('button', { name: '갑' }))
    await userEvent.type(screen.getByLabelText(/메모/), ' 2교시 ')
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }))
    expect(onSave).toHaveBeenCalledWith({ title: '시험', date: '2026-10-09', endDate: '', time: '09:00', owner: 'A', note: '2교시' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('limits the title to 40 characters and the note to 200', () => {
    renderNew()
    expect(screen.getByLabelText('제목')).toHaveAttribute('maxLength', '40')
    expect(screen.getByLabelText(/메모/)).toHaveAttribute('maxLength', '200')
  })

  it('opens filled in when editing, with a delete button', () => {
    renderEdit()
    expect(screen.getByLabelText('제목')).toHaveValue('저녁 약속')
    expect(screen.getByLabelText('시작하는 날')).toHaveValue('2026-10-12')
    expect(screen.getByLabelText(/시간/)).toHaveValue('19:00')
    expect(screen.getByLabelText(/메모/)).toHaveValue('강남역')
    expect(screen.getByRole('button', { name: '우리' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
  })

  it('turns a timed event into an all-day one when the time is cleared', async () => {
    renderEdit()
    fireEvent.change(screen.getByLabelText(/시간/), { target: { value: '' } })
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ time: '' }))
  })

  it('deletes and closes', async () => {
    renderEdit()
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stays open with the message and the typed text when saving fails', async () => {
    onSave.mockRejectedValueOnce(new Error('denied'))
    renderNew()
    await userEvent.type(screen.getByLabelText('제목'), '약속')
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }))
    expect(await screen.findByText('저장하지 못했어요. 다시 시도해주세요.')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText('제목')).toHaveValue('약속')
    expect(screen.getByRole('button', { name: '저장하기' })).toBeEnabled()
  })

  it('stays open with a message when deleting fails', async () => {
    onDelete.mockRejectedValueOnce(new Error('denied'))
    renderEdit()
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(await screen.findByText('삭제하지 못했어요. 다시 시도해주세요.')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('ignores a second tap while the first save is still going', async () => {
    let finish: () => void = () => {}
    onSave.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve }))
    renderNew()
    await userEvent.type(screen.getByLabelText('제목'), '약속')
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }))
    expect(screen.getByRole('button', { name: '저장하기' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    finish()
  })

  it('saves a span of days in one go', async () => {
    renderNew()
    await userEvent.type(screen.getByLabelText('제목'), '여행')
    expect(screen.getByLabelText('끝나는 날')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('끝나는 날'), { target: { value: '2026-10-12' } })
    expect(screen.getByText('10/9 ~ 10/12 · 4일')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-09', endDate: '2026-10-12' }))
  })

  it('saves an end on the same day as a one-day event', async () => {
    renderNew()
    await userEvent.type(screen.getByLabelText('제목'), '약속')
    fireEvent.change(screen.getByLabelText('끝나는 날'), { target: { value: '2026-10-09' } })
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ endDate: '' }))
  })

  it('will not save an end before the start', async () => {
    renderNew()
    await userEvent.type(screen.getByLabelText('제목'), '여행')
    fireEvent.change(screen.getByLabelText('끝나는 날'), { target: { value: '2026-10-05' } })
    expect(screen.getByText('끝나는 날이 시작하는 날보다 앞이에요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '저장하기' })).toBeDisabled()
  })

  it('opens a multi-day event with both days and can shrink it back to one day', async () => {
    render(<EventFormModal initial={{ ...existing, endDate: '2026-10-14' }} defaultDate="2026-10-09" onSave={onSave} onClose={onClose} />)
    expect(screen.getByLabelText('끝나는 날')).toHaveValue('2026-10-14')
    await userEvent.click(screen.getByRole('button', { name: '끝나는 날 지우기' }))
    expect(screen.getByLabelText('끝나는 날')).toHaveValue('')
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ endDate: '' }))
  })

  it('closes without saving', async () => {
    renderNew()
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })
})
