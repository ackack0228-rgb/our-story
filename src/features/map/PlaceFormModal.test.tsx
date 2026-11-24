import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlaceFormModal } from './PlaceFormModal'

const add = vi.fn().mockResolvedValue('newid')
const update = vi.fn().mockResolvedValue(undefined)
const remove = vi.fn().mockResolvedValue(undefined)
const NEW_PHOTO_BYTES = 'brand-new-photo-bytes'
const resizeImageFileToBlob = vi.fn().mockResolvedValue(new Blob([NEW_PHOTO_BYTES], { type: 'image/jpeg' }))

vi.mock('../../hooks/usePlaces', () => ({ usePlaces: () => ({ places: [], loading: false, add, update, remove }) }))
vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({ me: 'A', settings: { nameA: '나', nameB: '상대방', startDate: null } }),
}))
vi.mock('../../lib/imageResize', async () => {
  const actual = await vi.importActual<typeof import('../../lib/imageResize')>('../../lib/imageResize')
  return { ...actual, resizeImageFileToBlob: (...args: any[]) => resizeImageFileToBlob(...args) }
})

function selectFile(input: HTMLInputElement, name = 'photo.jpg') {
  const file = new File(['x'], name, { type: 'image/jpeg' })
  fireEvent.change(input, { target: { files: [file] } })
}

// Waits for the *new* photo to actually land in the preview — not just for an <img> to exist,
// since an existing place already renders one before any file is picked (a naive "wait for an
// img to appear" helper would pass immediately without the resize ever completing).
async function attachPhotoAndWait(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  selectFile(input)
  await waitFor(() => {
    const img = container.querySelector('img') as HTMLImageElement | null
    if (!img) throw new Error('no preview image yet')
    expect(atob(img.src.split(',')[1])).toBe(NEW_PHOTO_BYTES)
  })
  return input
}

describe('PlaceFormModal (new place)', () => {
  it('has a 닫기 button next to 저장하기 that closes without saving', async () => {
    add.mockClear()
    const onClose = vi.fn()
    render(<PlaceFormModal existing={null} region="32030" onClose={onClose} />)
    await userEvent.type(screen.getByPlaceholderText(/장소 이름/), '쓰다 만 기록')
    await userEvent.click(screen.getByText('닫기'))
    expect(onClose).toHaveBeenCalled()
    expect(add).not.toHaveBeenCalled()
  })

  it('saves a new place with the entered name and selected mood', async () => {
    const onClose = vi.fn()
    render(<PlaceFormModal existing={null} region="32030" onClose={onClose} />)
    await userEvent.type(screen.getByPlaceholderText(/장소 이름/), '강릉 안목해변')
    await userEvent.click(screen.getByText('🥰'))
    await userEvent.click(screen.getByRole('button', { name: /저장하기/ }))
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ name: '강릉 안목해변', mood: '🥰', region: '32030', photoUrl: null })
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('shows an error and keeps the modal open when saving fails', async () => {
    add.mockRejectedValueOnce(new Error('network error'))
    const onClose = vi.fn()
    render(<PlaceFormModal existing={null} region="32030" onClose={onClose} />)
    await userEvent.type(screen.getByPlaceholderText(/장소 이름/), '강릉 안목해변')
    await userEvent.click(screen.getByRole('button', { name: /저장하기/ }))
    expect(await screen.findByText(/저장하지 못했어요/)).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('saves the attached photo as a data URL directly on the place document', async () => {
    const onClose = vi.fn()
    const { container } = render(<PlaceFormModal existing={null} region="32030" onClose={onClose} />)
    await userEvent.type(screen.getByPlaceholderText(/장소 이름/), '강릉 안목해변')
    await attachPhotoAndWait(container)
    await userEvent.click(screen.getByRole('button', { name: /저장하기/ }))
    expect(onClose).toHaveBeenCalled()
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ photoUrl: expect.stringMatching(/^data:image\/jpeg;base64,/) })
    )
  })

  it('disables the save button while a photo is still being processed', async () => {
    let resolveResize: (blob: Blob) => void = () => {}
    resizeImageFileToBlob.mockImplementationOnce(() => new Promise((resolve) => { resolveResize = resolve }))
    const onClose = vi.fn()
    const { container } = render(<PlaceFormModal existing={null} region="32030" onClose={onClose} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    selectFile(input)
    await waitFor(() => expect(screen.getByRole('button', { name: /저장하기/ })).toBeDisabled())
    resolveResize(new Blob([NEW_PHOTO_BYTES], { type: 'image/jpeg' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /저장하기/ })).toBeEnabled())
  })

  it('resets the file input after a failed resize so the same file can be re-selected', async () => {
    resizeImageFileToBlob.mockRejectedValueOnce(new Error('decode failed'))
    const onClose = vi.fn()
    const { container } = render(<PlaceFormModal existing={null} region="32030" onClose={onClose} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    selectFile(input)
    await screen.findByText(/사진을 처리하지 못했어요/)
    expect(input.value).toBe('')
  })
})

describe('PlaceFormModal (existing place)', () => {
  const existing = {
    id: 'p1', name: '강릉', date: '2026-01-01', mood: '❤️', diary: '좋았다',
    region: '32030', photoUrl: null, createdBy: 'A', createdAt: 1,
  }

  it('asks before deleting, then deletes the place and closes', async () => {
    remove.mockClear()
    const onClose = vi.fn()
    render(<PlaceFormModal existing={existing} region={null} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(screen.getByText(/정말 삭제할까요/)).toBeInTheDocument()
    expect(remove).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(remove).toHaveBeenCalledWith('p1')
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps the place when the delete question is answered with 취소', async () => {
    remove.mockClear()
    const onClose = vi.fn()
    render(<PlaceFormModal existing={existing} region={null} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(remove).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /저장하기/ })).toBeInTheDocument()
  })

  it('takes the photo off the place with 사진 빼기', async () => {
    update.mockClear()
    const existingWithPhoto = { ...existing, photoUrl: 'data:image/jpeg;base64,b2xk' }
    render(<PlaceFormModal existing={existingWithPhoto} region={null} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '사진 빼기' }))
    expect(screen.queryByRole('button', { name: '사진 빼기' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /저장하기/ }))
    expect(update).toHaveBeenCalledWith('p1', expect.objectContaining({ photoUrl: null }))
  })

  it('offers no 사진 빼기 when there is no photo', () => {
    render(<PlaceFormModal existing={existing} region={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '사진 빼기' })).not.toBeInTheDocument()
  })

  it('replaces the existing photo with the new one as a data URL', async () => {
    const existingWithPhoto = { ...existing, photoUrl: 'data:image/jpeg;base64,b2xk' }
    const onClose = vi.fn()
    const { container } = render(<PlaceFormModal existing={existingWithPhoto} region={null} onClose={onClose} />)
    await attachPhotoAndWait(container)
    await userEvent.click(screen.getByRole('button', { name: /저장하기/ }))
    expect(update).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ photoUrl: expect.stringMatching(/^data:image\/jpeg;base64,/) })
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('does not resend the existing photo when only editing other fields', async () => {
    const existingWithPhoto = { ...existing, photoUrl: 'data:image/jpeg;base64,b2xk' }
    const onClose = vi.fn()
    render(<PlaceFormModal existing={existingWithPhoto} region={null} onClose={onClose} />)
    await userEvent.clear(screen.getByPlaceholderText(/장소 이름/))
    await userEvent.type(screen.getByPlaceholderText(/장소 이름/), '강릉 (수정)')
    await userEvent.click(screen.getByRole('button', { name: /저장하기/ }))
    expect(update).toHaveBeenCalledWith('p1', expect.not.objectContaining({ photoUrl: expect.anything() }))
    const patch = update.mock.calls[update.mock.calls.length - 1][1]
    expect('photoUrl' in patch).toBe(false)
  })
})

describe('PlaceFormModal (area)', () => {
  it('starts a new place in the area that was pressed and writes no pin position', async () => {
    add.mockClear()
    render(<PlaceFormModal existing={null} region="21" onClose={vi.fn()} />)
    expect(screen.getByLabelText('지역')).toHaveValue('21')
    await userEvent.click(screen.getByRole('button', { name: /저장하기/ }))
    const saved = add.mock.calls[0][0]
    expect(saved.region).toBe('21')
    expect(saved).not.toHaveProperty('x')
    expect(saved).not.toHaveProperty('y')
  })

  it('lets the area be changed before saving', async () => {
    add.mockClear()
    render(<PlaceFormModal existing={null} region="21" onClose={vi.fn()} />)
    await userEvent.selectOptions(screen.getByLabelText('지역'), '경기 가평군')
    await userEvent.click(screen.getByRole('button', { name: /저장하기/ }))
    expect(add.mock.calls[0][0].region).toBe('31370')
  })

  it('asks for an area on a place saved before the map had areas, and saves it once chosen', async () => {
    update.mockClear()
    const old = { id: 'old', name: '예전', date: '2025-12-01', mood: '❤️', diary: '', x: 30, y: 40, photoUrl: null, createdBy: 'A', createdAt: 1 }
    const onClose = vi.fn()
    render(<PlaceFormModal existing={old} region={null} onClose={onClose} />)
    expect(screen.getByLabelText('지역')).toHaveValue('')
    await userEvent.click(screen.getByRole('button', { name: /저장하기/ }))
    expect(screen.getByText('지역을 골라 주세요.')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.selectOptions(screen.getByLabelText('지역'), '부산')
    await userEvent.click(screen.getByRole('button', { name: /저장하기/ }))
    expect(update).toHaveBeenCalledWith('old', expect.objectContaining({ region: '21' }))
    expect(onClose).toHaveBeenCalled()
  })
})
