import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionProvider, useSession, WHO_KEY } from './useSession'
import { getSettings, putSettings } from '../lib/api'
import { hasSession, onSignedOut, unlock } from '../lib/auth'
import { syncPushWho } from '../lib/push'

vi.mock('../lib/api', () => ({ getSettings: vi.fn(), putSettings: vi.fn() }))
vi.mock('../lib/auth', () => ({ hasSession: vi.fn(), unlock: vi.fn(), onSignedOut: vi.fn() }))
vi.mock('../lib/push', () => ({ syncPushWho: vi.fn().mockResolvedValue(undefined) }))
const settings = { nameA: '민수', nameB: '지은', startDate: null }

function Probe() {
  const { me, settings, switchUser } = useSession()
  return (
    <div>
      <span>me={me}</span>
      <span>{settings.nameA}</span>
      <button onClick={switchUser}>switch</button>
    </div>
  )
}

describe('SessionProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(getSettings).mockReset().mockResolvedValue(settings)
    vi.mocked(putSettings).mockReset()
    vi.mocked(hasSession).mockReset().mockResolvedValue(true)
    vi.mocked(unlock).mockReset().mockResolvedValue('ok')
    vi.mocked(onSignedOut).mockReset().mockReturnValue(() => {})
  })

  it('asks for the password before anything else on a phone that is not signed in', async () => {
    vi.mocked(hasSession).mockResolvedValue(false)
    render(<SessionProvider><Probe /></SessionProvider>)
    expect(await screen.findByLabelText('비밀번호')).toBeInTheDocument()
    expect(getSettings).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText('비밀번호'), '우리비번')
    await userEvent.click(screen.getByRole('button', { name: '들어가기' }))
    expect(await screen.findByRole('button', { name: /민수/ })).toBeInTheDocument()
  })

  it('goes back to the lock screen when the session ends', async () => {
    localStorage.setItem(WHO_KEY, 'A')
    let signedOut = () => {}
    vi.mocked(onSignedOut).mockImplementation((cb) => { signedOut = cb; return () => {} })
    render(<SessionProvider><Probe /></SessionProvider>)
    await screen.findByText('me=A')
    act(() => signedOut())
    expect(await screen.findByLabelText('비밀번호')).toBeInTheDocument()
    expect(screen.queryByText('me=A')).not.toBeInTheDocument()
  })

  it('stays locked when a settings refresh that was already on its way comes back after sign-out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      localStorage.setItem(WHO_KEY, 'A')
      let signedOut = () => {}
      vi.mocked(onSignedOut).mockImplementation((cb) => { signedOut = cb; return () => {} })
      render(<SessionProvider><Probe /></SessionProvider>)
      await screen.findByText('me=A')
      // Without a session the database answers with defaults, not an error.
      let answer: (s: typeof settings) => void = () => {}
      vi.mocked(getSettings).mockReturnValueOnce(new Promise((resolve) => { answer = resolve }))
      await act(() => vi.advanceTimersByTimeAsync(3000))
      act(() => signedOut())
      await act(async () => { answer({ nameA: '나', nameB: '상대방', startDate: null }) })
      expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
      expect(screen.queryByText('me=A')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the retry screen when the session check itself fails', async () => {
    vi.mocked(hasSession).mockRejectedValueOnce(new Error('storage broken'))
    render(<SessionProvider><Probe /></SessionProvider>)
    await userEvent.click(await screen.findByRole('button', { name: '다시 시도하기' }))
    expect(await screen.findByRole('button', { name: /민수/ })).toBeInTheDocument()
  })

  it('asks who you are with both names, then remembers the choice', async () => {
    render(<SessionProvider><Probe /></SessionProvider>)
    await userEvent.click(await screen.findByRole('button', { name: /지은/ }))
    expect(await screen.findByText('me=B')).toBeInTheDocument()
    expect(localStorage.getItem(WHO_KEY)).toBe('B')
    expect(syncPushWho).toHaveBeenCalledWith('B')
  })

  it('skips the picker when a valid choice is stored', async () => {
    localStorage.setItem(WHO_KEY, 'A')
    render(<SessionProvider><Probe /></SessionProvider>)
    expect(await screen.findByText('me=A')).toBeInTheDocument()
  })

  it('treats an invalid stored value as no choice', async () => {
    localStorage.setItem(WHO_KEY, 'C')
    render(<SessionProvider><Probe /></SessionProvider>)
    expect(await screen.findByRole('button', { name: /민수/ })).toBeInTheDocument()
  })

  it('switchUser clears the choice and shows the picker again', async () => {
    localStorage.setItem(WHO_KEY, 'A')
    render(<SessionProvider><Probe /></SessionProvider>)
    await userEvent.click(await screen.findByRole('button', { name: 'switch' }))
    expect(await screen.findByRole('button', { name: /민수/ })).toBeInTheDocument()
    expect(localStorage.getItem(WHO_KEY)).toBeNull()
  })

  it('shows a retry screen when the server is unreachable', async () => {
    vi.mocked(getSettings).mockRejectedValueOnce(new Error('down'))
    render(<SessionProvider><Probe /></SessionProvider>)
    await userEvent.click(await screen.findByRole('button', { name: '다시 시도하기' }))
    expect(await screen.findByRole('button', { name: /민수/ })).toBeInTheDocument()
  })
})
