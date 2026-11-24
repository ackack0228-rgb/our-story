import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

vi.mock('./hooks/useSession', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSession: () => ({
    me: 'A',
    settings: { nameA: '나', nameB: '상대방', startDate: '2025-01-01' },
    updateSettings: vi.fn(),
    switchUser: vi.fn(),
  }),
}))
vi.mock('./features/home/Home', () => ({ Home: () => <div>Home Mock</div> }))
vi.mock('./features/map/MapScreen', () => ({ MapScreen: () => <div>Map Mock</div> }))
vi.mock('./features/doodle/DoodleBoard', () => ({ DoodleBoard: () => <div>Doodle Mock</div> }))
vi.mock('./features/more/Calendar', () => ({ Calendar: () => <div>Calendar Mock</div> }))
vi.mock('./features/more/More', () => ({ More: () => <div>More Mock</div> }))
vi.mock('./components/SettingsModal', () => ({ SettingsModal: ({ onClose }: { onClose: () => void }) => <div data-testid="settings-modal">Settings Modal Mock<button onClick={onClose}>Close</button></div> }))

describe('App', () => {
  it('shows the couple names in the top bar', () => {
    render(<App />)
    expect(screen.getByText('나 ♥ 상대방')).toBeInTheDocument()
  })

  it('starts on the home tab and switches screens via the bottom nav', async () => {
    render(<App />)
    expect(screen.getByTestId('screen-home')).toHaveTextContent('Home Mock')
    await userEvent.click(screen.getByRole('button', { name: /지도/ }))
    expect(screen.getByTestId('screen-map')).toHaveTextContent('Map Mock')
    await userEvent.click(screen.getByRole('button', { name: /낙서/ }))
    expect(screen.getByTestId('screen-doodle')).toHaveTextContent('Doodle Mock')
    await userEvent.click(screen.getByRole('button', { name: /달력/ }))
    expect(screen.getByTestId('screen-calendar')).toHaveTextContent('Calendar Mock')
    await userEvent.click(screen.getByRole('button', { name: /더보기/ }))
    expect(screen.getByTestId('screen-more')).toHaveTextContent('More Mock')
  })

  it('has the calendar in the bottom nav where the record list used to be', () => {
    render(<App />)
    const labels = screen.getAllByRole('button').map((b) => b.textContent).filter((t) => t !== '⚙')
    expect(labels).toEqual(['🏠홈', '🗺지도', '🖍낙서', '📅달력', '🗂더보기'])
  })

  it('opens the settings modal when the gear button is clicked', async () => {
    render(<App />)
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '설정' }))
    expect(screen.getByTestId('settings-modal')).toBeInTheDocument()
  })
})
