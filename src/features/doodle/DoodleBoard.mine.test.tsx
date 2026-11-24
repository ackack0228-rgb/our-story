import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DoodleBoard } from './DoodleBoard'
import styles from './DoodleBoard.module.css'

// Regression test for "mine" alignment: the viewer here is B, so their own message (sender 'B')
// must get the "mine" styling and the partner's (sender 'A') must NOT — alignment is keyed off
// the viewer (`me`), not off person A.
vi.mock('../../hooks/useDoodleFeed', () => ({
  useDoodleFeed: () => ({
    items: [
      { type: 'note', id: 'n1', text: '내가 보낸 한마디', sender: 'B', createdAt: 200 },
      { type: 'note', id: 'n2', text: '상대방이 보낸 한마디', sender: 'A', createdAt: 100 },
    ],
    loading: false,
    sendDoodle: vi.fn(),
    sendNote: vi.fn(),
  }),
}))
vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({ me: 'B', settings: { nameA: '상대방', nameB: '나', startDate: null } }),
}))

describe('DoodleBoard mine/partner alignment', () => {
  it('marks the viewer\'s own message as mine based on me, not person A', () => {
    render(<DoodleBoard />)
    const mine = screen.getByText('내가 보낸 한마디').closest(`.${styles.feedItem}`)
    const partner = screen.getByText('상대방이 보낸 한마디').closest(`.${styles.feedItem}`)
    expect(mine).toHaveClass(styles.mineA)
    expect(partner).not.toHaveClass(styles.mineA)
  })
})
