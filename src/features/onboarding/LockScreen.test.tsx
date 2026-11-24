import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LockScreen } from './LockScreen'
import { unlock } from '../../lib/auth'

vi.mock('../../lib/auth', () => ({ unlock: vi.fn() }))

async function submit(password: string) {
  await userEvent.type(screen.getByLabelText('비밀번호'), password)
  await userEvent.click(screen.getByRole('button', { name: '들어가기' }))
}

describe('LockScreen', () => {
  beforeEach(() => vi.mocked(unlock).mockReset())

  it('unlocks with the right password', async () => {
    vi.mocked(unlock).mockResolvedValue('ok')
    const onUnlocked = vi.fn()
    render(<LockScreen onUnlocked={onUnlocked} />)
    await submit('우리비번')
    expect(unlock).toHaveBeenCalledWith('우리비번')
    expect(onUnlocked).toHaveBeenCalledTimes(1)
  })

  it('says so when the password is wrong and stays locked', async () => {
    vi.mocked(unlock).mockResolvedValue('wrong')
    const onUnlocked = vi.fn()
    render(<LockScreen onUnlocked={onUnlocked} />)
    await submit('틀림')
    expect(await screen.findByText('비밀번호가 맞지 않아요.')).toBeInTheDocument()
    expect(onUnlocked).not.toHaveBeenCalled()
  })

  it('tells a connection problem apart from a wrong password', async () => {
    vi.mocked(unlock).mockResolvedValue('error')
    render(<LockScreen onUnlocked={vi.fn()} />)
    await submit('우리비번')
    expect(await screen.findByText(/서버에 연결하지 못했어요/)).toBeInTheDocument()
  })

  it('does nothing when the field is empty', async () => {
    render(<LockScreen onUnlocked={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '들어가기' }))
    expect(unlock).not.toHaveBeenCalled()
  })

  it('lets you try again after a failure', async () => {
    vi.mocked(unlock).mockResolvedValueOnce('wrong').mockResolvedValueOnce('ok')
    const onUnlocked = vi.fn()
    render(<LockScreen onUnlocked={onUnlocked} />)
    await submit('틀림')
    await screen.findByText('비밀번호가 맞지 않아요.')
    await userEvent.clear(screen.getByLabelText('비밀번호'))
    await submit('우리비번')
    expect(onUnlocked).toHaveBeenCalledTimes(1)
  })
})
