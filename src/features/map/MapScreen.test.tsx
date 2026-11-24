import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MapScreen } from './MapScreen'

vi.mock('./MapView', () => ({ MapView: () => <div>Map Mock</div> }))
vi.mock('../record/RecordList', () => ({ RecordList: () => <div>Record Mock</div> }))

describe('MapScreen', () => {
  it('opens on the map', () => {
    render(<MapScreen />)
    expect(screen.getByText('Map Mock')).toBeInTheDocument()
    expect(screen.queryByText('Record Mock')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /지도/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /기록/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches to the list of places and back', async () => {
    render(<MapScreen />)
    await userEvent.click(screen.getByRole('button', { name: /기록/ }))
    expect(screen.getByText('Record Mock')).toBeInTheDocument()
    expect(screen.queryByText('Map Mock')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /기록/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: /지도/ }))
    expect(screen.getByText('Map Mock')).toBeInTheDocument()
  })
})
