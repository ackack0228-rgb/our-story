import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Home } from './Home'
import { useAnswers } from '../../hooks/useAnswers'

vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({ me: 'A', settings: { nameA: '나', nameB: '상대방', startDate: '2025-01-01' } }),
}))
vi.mock('../../lib/questions', () => ({ pickTodayQuestion: () => '테스트 질문' }))
vi.mock('./PokeButton', () => ({ PokeButton: () => <button>poke-mock</button> }))
vi.mock('./OnThisDay', () => ({ OnThisDay: () => <div>memory-mock</div> }))
vi.mock('./UpcomingEvents', () => ({ UpcomingEvents: () => <div>upcoming-mock</div> }))
vi.mock('./BalanceGame', () => ({ BalanceGame: () => <div>balance-mock</div> }))
vi.mock('../../hooks/useAnswers', () => ({ useAnswers: vi.fn() }))
vi.mock('../../lib/date', async (original) => ({
  ...(await original<typeof import('../../lib/date')>()),
  todayLocalISODate: () => '2026-10-08',
}))
vi.mock('./QuestionChat', () => ({
  QuestionChat: ({ answers, onClose }: { answers: unknown[]; onClose: () => void }) => (
    <div>
      chat-mock {answers.length}
      <button onClick={onClose}>close-chat</button>
    </div>
  ),
}))

const send = vi.fn()
function setAnswers(items: object[]) {
  vi.mocked(useAnswers).mockReturnValue({ items: items as never, loading: false, error: null, send })
}

describe('Home', () => {
  beforeEach(() => {
    setAnswers([])
  })

  it('shows a computed D+N day count', () => {
    render(<Home />)
    expect(screen.getByText(/^D\+\d+$/)).toBeInTheDocument()
  })

  it('shows the question of the day', () => {
    render(<Home />)
    expect(screen.getByText('"테스트 질문"')).toBeInTheDocument()
  })

  it('has no share button and no record counts', () => {
    render(<Home />)
    expect(screen.queryByRole('button', { name: /공유하기/ })).not.toBeInTheDocument()
    for (const label of ['다녀온 곳', '낙서', '한마디']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
  })

  it('renders the poke button', () => {
    render(<Home />)
    expect(screen.getByRole('button', { name: 'poke-mock' })).toBeInTheDocument()
  })

  it('shows upcoming events below the poke button and above the memories', () => {
    render(<Home />)
    const upcoming = screen.getByText('upcoming-mock')
    const poke = screen.getByRole('button', { name: 'poke-mock' })
    const memory = screen.getByText('memory-mock')
    expect(poke.compareDocumentPosition(upcoming) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(upcoming.compareDocumentPosition(memory) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders the on-this-day memories', () => {
    render(<Home />)
    expect(screen.getByText('memory-mock')).toBeInTheDocument()
  })

  it('has no letter button', () => {
    render(<Home />)
    expect(screen.queryByRole('button', { name: /편지/ })).not.toBeInTheDocument()
  })

  it('invites an answer on the question card when nobody has written today', () => {
    render(<Home />)
    expect(screen.getByRole('button', { name: /테스트 질문/ })).toHaveTextContent('눌러서 답하기')
  })

  it('says on the card that the other person answered, without showing it', () => {
    setAnswers([{ id: 'b', date: '2026-10-08', question: '테스트 질문', text: '비밀', sender: 'B', createdAt: 1 }])
    render(<Home />)
    const card = screen.getByRole('button', { name: /테스트 질문/ })
    expect(card).toHaveTextContent('상대방이 답했어요 · 답하면 볼 수 있어요')
    expect(card).not.toHaveTextContent('비밀')
  })

  it('opens the chat from the question card and closes it again', async () => {
    setAnswers([{ id: 'a', date: '2026-10-08', question: '테스트 질문', text: '답', sender: 'A', createdAt: 1 }])
    render(<Home />)
    expect(screen.queryByText(/chat-mock/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /테스트 질문/ }))
    expect(screen.getByText(/chat-mock 1/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'close-chat' }))
    expect(screen.queryByText(/chat-mock/)).not.toBeInTheDocument()
  })
})
