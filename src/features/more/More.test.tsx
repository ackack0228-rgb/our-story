import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { More } from './More'

vi.mock('./BucketList', () => ({
  BucketList: ({ onReview }: { onReview: (d: { type: string; name: string }) => void }) => (
    <div>
      Bucket Mock
      <button onClick={() => onReview({ type: 'movie', name: '영화B' })}>finish-mock</button>
    </div>
  ),
}))
vi.mock('./MoodTracker', () => ({ MoodTracker: () => <div>Mood Mock</div> }))
vi.mock('./Archive', () => ({
  Archive: ({ draft }: { draft: { type: string; name: string } | null }) => <div>Archive Mock {draft ? `${draft.type}:${draft.name}` : 'empty'}</div>,
}))
vi.mock('./StampGame', () => ({ StampGame: () => <div>Game Mock</div> }))
vi.mock('./TravelVote', () => ({ TravelVote: () => <div>Vote Mock</div> }))
vi.mock('./MonthlyRecap', () => ({
  MonthlyRecap: ({ startAt }: { startAt: { year: number; month: number } | null }) => <div>Recap Mock {startAt ? `${startAt.year}-${startAt.month}` : 'now'}</div>,
}))

describe('More', () => {
  it('shows the bucket list subtab by default', () => {
    render(<More />)
    expect(screen.getByText(/Bucket Mock/)).toBeInTheDocument()
  })

  it('no longer holds the calendar, which has its own tab in the bottom nav', () => {
    render(<More />)
    expect(screen.queryByRole('button', { name: /달력/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button').map((b) => b.textContent).filter((t) => t !== 'finish-mock')).toEqual(['버킷리스트', '감정온도계', '후기', '여행투표', '돌아보기', '게임'])
  })

  it('switches to the mood tracker subtab', async () => {
    render(<More />)
    await userEvent.click(screen.getByRole('button', { name: /감정온도계/ }))
    expect(screen.getByText('Mood Mock')).toBeInTheDocument()
    expect(screen.queryByText(/Bucket Mock/)).not.toBeInTheDocument()
  })

  it('opens the monthly recap from its tab on the current month', async () => {
    render(<More />)
    await userEvent.click(screen.getByRole('button', { name: /돌아보기/ }))
    expect(screen.getByText('Recap Mock now')).toBeInTheDocument()
  })

  it('opens straight on the recap of a month when the home screen sent us there', () => {
    render(<More recapMonth={{ year: 2026, month: 10 }} />)
    expect(screen.getByText('Recap Mock 2026-10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /돌아보기/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens 후기 filled in when a bucket list item is finished', async () => {
    render(<More />)
    await userEvent.click(screen.getByRole('button', { name: 'finish-mock' }))
    expect(screen.getByText('Archive Mock movie:영화B')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /후기/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens 후기 empty when it is picked from the tabs, even after a finished item', async () => {
    render(<More />)
    await userEvent.click(screen.getByRole('button', { name: 'finish-mock' }))
    await userEvent.click(screen.getByRole('button', { name: /버킷리스트/ }))
    await userEvent.click(screen.getByRole('button', { name: /후기/ }))
    expect(screen.getByText('Archive Mock empty')).toBeInTheDocument()
  })
})
