import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecapNotice } from './RecapNotice'
import { useRecapSource } from '../../hooks/useRecapSource'

vi.mock('../../hooks/useRecapSource', () => ({ useRecapSource: vi.fn() }))

function setPlaces(places: object[]) {
  vi.mocked(useRecapSource).mockReturnValue({
    source: { places, doodles: [], notes: [], moods: [], events: [], archive: [], answers: [], balance: [] },
    loading: false,
    error: null,
  })
}

describe('RecapNotice', () => {
  it('announces last month\'s recap and opens it', async () => {
    setPlaces([{ name: '부산', date: '2026-10-03' }])
    const onOpen = vi.fn()
    render(<RecapNotice month={{ year: 2026, month: 10 }} onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button', { name: /10월 돌아보기가 나왔어요/ }))
    expect(onOpen).toHaveBeenCalled()
  })

  it('stays away when last month had nothing', () => {
    setPlaces([])
    render(<RecapNotice month={{ year: 2026, month: 10 }} onOpen={() => {}} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
