import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsModal } from './SettingsModal'
import { enablePush, getPushState } from '../lib/push'
import { getCalendarFeed } from '../lib/calendarFeed'

const updateSettings = vi.fn()
const switchUser = vi.fn()
vi.mock('../hooks/useSession', () => ({
  useSession: () => ({
    me: 'A',
    settings: { nameA: '민수', nameB: '지은', startDate: '2025-09-29' },
    updateSettings,
    switchUser,
  }),
}))

vi.mock('../lib/push', () => ({ getPushState: vi.fn(), enablePush: vi.fn() }))
vi.mock('../lib/calendarFeed', () => ({ getCalendarFeed: vi.fn() }))

const feed = {
  https: 'https://abc.supabase.co/functions/v1/calendar?key=k',
  webcal: 'webcal://abc.supabase.co/functions/v1/calendar?key=k',
}
const writeText = vi.fn()

describe('SettingsModal', () => {
  beforeEach(() => {
    updateSettings.mockReset().mockResolvedValue(undefined)
    switchUser.mockReset()
    vi.mocked(getPushState).mockReset().mockResolvedValue('off')
    vi.mocked(enablePush).mockReset().mockResolvedValue('on')
    vi.mocked(getCalendarFeed).mockReset().mockResolvedValue(null)
    writeText.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  })

  it('saves trimmed names and the start date', async () => {
    const onClose = vi.fn()
    render(<SettingsModal onClose={onClose} />)
    const nameA = screen.getByDisplayValue('민수')
    await userEvent.clear(nameA)
    await userEvent.type(nameA, '  철수  ')
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }))
    expect(updateSettings).toHaveBeenCalledWith({ nameA: '철수', nameB: '지은', startDate: '2025-09-29' })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows an error when saving fails', async () => {
    updateSettings.mockRejectedValueOnce(new Error('down'))
    render(<SettingsModal onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }))
    expect(await screen.findByText(/저장하지 못했어요/)).toBeInTheDocument()
  })

  it('turns notifications on for this phone as me', async () => {
    render(<SettingsModal onClose={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
    expect(enablePush).toHaveBeenCalledWith('A')
    expect(await screen.findByText('알림이 켜져 있어요 ✓')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '알림 켜기' })).not.toBeInTheDocument()
  })

  it('shows that notifications are already on', async () => {
    vi.mocked(getPushState).mockResolvedValue('on')
    render(<SettingsModal onClose={vi.fn()} />)
    expect(await screen.findByText('알림이 켜져 있어요 ✓')).toBeInTheDocument()
  })

  it('explains the home screen step on an iPhone browser tab', async () => {
    vi.mocked(getPushState).mockResolvedValue('needs-install')
    render(<SettingsModal onClose={vi.fn()} />)
    expect(await screen.findByText('홈 화면에 추가한 뒤 켤 수 있어요')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '알림 켜기' })).not.toBeInTheDocument()
  })

  it('says where to fix it when permission was refused', async () => {
    vi.mocked(enablePush).mockResolvedValue('denied')
    render(<SettingsModal onClose={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
    expect(await screen.findByText('알림이 꺼져 있어요. 아이폰 설정에서 켤 수 있어요.')).toBeInTheDocument()
  })

  it('reports a failure to turn notifications on and lets you retry', async () => {
    vi.mocked(enablePush).mockRejectedValueOnce(new Error('down'))
    render(<SettingsModal onClose={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
    expect(await screen.findByText('알림을 켜지 못했어요. 다시 시도해주세요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '알림 켜기' })).toBeInTheDocument()
  })

  it('offers the iPhone calendar link once the address is known', async () => {
    vi.mocked(getCalendarFeed).mockResolvedValue(feed)
    render(<SettingsModal onClose={vi.fn()} />)
    expect(await screen.findByRole('link', { name: '아이폰 캘린더에 연결' })).toHaveAttribute('href', feed.webcal)
    expect(screen.getByText(/다른 사람에게 보내지 마세요/)).toBeInTheDocument()
  })

  it('shows no calendar section when the address is not set up or cannot be read', async () => {
    const first = render(<SettingsModal onClose={vi.fn()} />)
    await waitFor(() => expect(getCalendarFeed).toHaveBeenCalled())
    expect(screen.queryByRole('link', { name: '아이폰 캘린더에 연결' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '주소 복사' })).not.toBeInTheDocument()
    first.unmount()

    vi.mocked(getCalendarFeed).mockRejectedValue(new Error('down'))
    render(<SettingsModal onClose={vi.fn()} />)
    await screen.findByRole('button', { name: '알림 켜기' })
    expect(screen.queryByRole('link', { name: '아이폰 캘린더에 연결' })).not.toBeInTheDocument()
  })

  it('copies the calendar address', async () => {
    vi.mocked(getCalendarFeed).mockResolvedValue(feed)
    render(<SettingsModal onClose={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: '주소 복사' }))
    expect(writeText).toHaveBeenCalledWith(feed.https)
    expect(await screen.findByText('주소를 복사했어요 ✓')).toBeInTheDocument()
  })

  it('says so when the address cannot be copied', async () => {
    vi.mocked(getCalendarFeed).mockResolvedValue(feed)
    writeText.mockRejectedValueOnce(new Error('denied'))
    render(<SettingsModal onClose={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: '주소 복사' }))
    expect(await screen.findByText('복사하지 못했어요. 다시 시도해주세요.')).toBeInTheDocument()
  })

  it('switches user', async () => {
    const onClose = vi.fn()
    render(<SettingsModal onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '사용자 바꾸기' }))
    expect(switchUser).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
