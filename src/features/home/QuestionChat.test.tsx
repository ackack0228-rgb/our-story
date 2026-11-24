import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestionChat } from './QuestionChat'
import type { Answer } from '../../lib/answers'

let today = '2026-10-08'

vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({ me: 'A', settings: { nameA: '갑', nameB: '을', startDate: null } }),
}))
vi.mock('../../lib/date', () => ({ todayLocalISODate: () => today }))
vi.mock('../../lib/questions', () => ({ pickTodayQuestion: () => '목록의 질문' }))

const onSend = vi.fn()
const onClose = vi.fn()

function ans(over: Partial<Answer>): Answer {
  return { id: 'a', date: '2026-10-08', question: '오늘의 질문', text: '답', sender: 'A', createdAt: 1, ...over }
}
function show(answers: Answer[], error: string | null = null) {
  return render(<QuestionChat answers={answers} error={error} onSend={onSend} onClose={onClose} />)
}
const bubbles = () => screen.queryAllByTestId('bubble')
const box = () => screen.getByLabelText('답 쓰기')
const sendBtn = () => screen.getByRole('button', { name: '보내기' })

describe('QuestionChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    today = '2026-10-08'
    onSend.mockResolvedValue(undefined)
  })

  it('opens on today with the question and an invitation when nobody has answered', () => {
    show([])
    expect(screen.getByRole('dialog', { name: '오늘의 질문' })).toBeInTheDocument()
    expect(screen.getByTestId('chat-date')).toHaveTextContent('오늘')
    expect(screen.getByText('"목록의 질문"')).toBeInTheDocument()
    expect(screen.getByText('첫 답을 남겨보세요')).toBeInTheDocument()
  })

  it('puts my words on the right and theirs on the left with a name', () => {
    show([
      ans({ id: 'mine', text: '내 답', sender: 'A', createdAt: new Date(2026, 9, 8, 9, 5).getTime() }),
      ans({ id: 'theirs', text: '상대 답', sender: 'B', createdAt: new Date(2026, 9, 8, 9, 6).getTime() }),
    ])
    const [mine, theirs] = bubbles()
    expect(mine).toHaveAttribute('data-mine', 'true')
    expect(mine).toHaveTextContent('내 답')
    expect(mine).toHaveTextContent('09:05')
    expect(mine).not.toHaveTextContent('갑')
    expect(theirs).toHaveAttribute('data-mine', 'false')
    expect(theirs).toHaveTextContent('을')
    expect(theirs).toHaveTextContent('상대 답')
  })

  it('shows the question saved with the day rather than the list', () => {
    show([ans({ question: '저장된 질문' })])
    expect(screen.getByText('"저장된 질문"')).toBeInTheDocument()
  })

  it('hides what the other person wrote until I answer, in a single line', () => {
    show([ans({ id: '1', text: '비밀 하나', sender: 'B' }), ans({ id: '2', text: '비밀 둘', sender: 'B', createdAt: 2 })])
    expect(screen.getAllByText('🔒 답하면 볼 수 있어요')).toHaveLength(1)
    expect(bubbles()).toHaveLength(0)
    expect(screen.queryByText(/비밀/)).not.toBeInTheDocument()
    expect(screen.queryByText('첫 답을 남겨보세요')).not.toBeInTheDocument()
  })

  it('opens everything once my answer is in', () => {
    const theirs = ans({ id: '1', text: '비밀 하나', sender: 'B' })
    const view = show([theirs])
    view.rerender(<QuestionChat answers={[theirs, ans({ id: 'me', text: '내 답', createdAt: 5 })]} error={null} onSend={onSend} onClose={onClose} />)
    expect(screen.queryByText('🔒 답하면 볼 수 있어요')).not.toBeInTheDocument()
    expect(screen.getByText('비밀 하나')).toBeInTheDocument()
  })

  it('cannot send nothing, or only spaces', async () => {
    show([])
    expect(sendBtn()).toBeDisabled()
    await userEvent.type(box(), '   ')
    expect(sendBtn()).toBeDisabled()
  })

  it('sends the trimmed text and clears the box', async () => {
    show([])
    await userEvent.type(box(), '  여행 갔던 날  ')
    await userEvent.click(sendBtn())
    expect(onSend).toHaveBeenCalledWith('여행 갔던 날')
    expect(box()).toHaveValue('')
  })

  it('stops typing at 300 characters', () => {
    show([])
    expect(box()).toHaveAttribute('maxLength', '300')
  })

  it('ignores a second tap while the first send is still going', async () => {
    let finish: () => void = () => {}
    onSend.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve }))
    show([])
    await userEvent.type(box(), '답')
    await userEvent.click(sendBtn())
    expect(sendBtn()).toBeDisabled()
    await userEvent.click(sendBtn())
    expect(onSend).toHaveBeenCalledTimes(1)
    finish()
    await waitFor(() => expect(box()).toHaveValue(''))
  })

  it('keeps the text and lets me try again when sending fails', async () => {
    onSend.mockRejectedValueOnce(new Error('denied'))
    show([])
    await userEvent.type(box(), '답')
    await userEvent.click(sendBtn())
    expect(await screen.findByText('보내지 못했어요. 다시 시도해주세요.')).toBeInTheDocument()
    expect(box()).toHaveValue('답')
    expect(sendBtn()).toBeEnabled()
    await userEvent.click(sendBtn())
    expect(onSend).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('보내지 못했어요. 다시 시도해주세요.')).not.toBeInTheDocument()
    expect(box()).toHaveValue('')
  })

  it('steps back and forth only through days that have a conversation', async () => {
    show([
      ans({ id: 'old', date: '2026-10-01', question: '1일의 질문', text: '1일의 답' }),
      ans({ id: 'mid', date: '2026-10-05', question: '5일의 질문', text: '5일의 답' }),
    ])
    const prev = screen.getByRole('button', { name: '이전 날' })
    const next = screen.getByRole('button', { name: '다음 날' })
    expect(next).toBeDisabled()
    await userEvent.click(prev)
    expect(screen.getByTestId('chat-date')).toHaveTextContent('10/5 (월)')
    expect(screen.getByText('"5일의 질문"')).toBeInTheDocument()
    expect(screen.getByText('5일의 답')).toBeInTheDocument()
    await userEvent.click(prev)
    expect(screen.getByTestId('chat-date')).toHaveTextContent('10/1 (목)')
    expect(prev).toBeDisabled()
    await userEvent.click(next)
    await userEvent.click(next)
    expect(screen.getByTestId('chat-date')).toHaveTextContent('오늘')
  })

  it('shows a past day in full and read-only', async () => {
    show([ans({ id: 'theirs', date: '2026-10-05', text: '내가 답 안 한 날', sender: 'B' })])
    await userEvent.click(screen.getByRole('button', { name: '이전 날' }))
    expect(screen.getByText('내가 답 안 한 날')).toBeInTheDocument()
    expect(screen.getByText('지난 날의 대화예요')).toBeInTheDocument()
    expect(screen.queryByLabelText('답 쓰기')).not.toBeInTheDocument()
  })

  it('moves on to the new day when midnight passes with the chat open', () => {
    const yesterday = ans({ id: 'y', text: '어제의 답' })
    const view = show([yesterday])
    expect(screen.getByText('어제의 답')).toBeInTheDocument()
    today = '2026-10-09'
    view.rerender(<QuestionChat answers={[yesterday]} error={null} onSend={onSend} onClose={onClose} />)
    expect(screen.getByTestId('chat-date')).toHaveTextContent('오늘')
    expect(screen.queryByText('어제의 답')).not.toBeInTheDocument()
    expect(screen.getByLabelText('답 쓰기')).toBeInTheDocument()
  })

  it('shows the load error', () => {
    show([], '데이터를 불러오지 못했어요.')
    expect(screen.getByText('데이터를 불러오지 못했어요.')).toBeInTheDocument()
  })

  it('closes', async () => {
    show([])
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
