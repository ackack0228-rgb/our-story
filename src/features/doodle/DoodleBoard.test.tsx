import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DoodleBoard } from './DoodleBoard'

const sendNote = vi.fn().mockResolvedValue(undefined)
const sendDoodle = vi.fn().mockResolvedValue(undefined)

vi.mock('../../hooks/useDoodleFeed', () => ({
  useDoodleFeed: () => ({
    items: [
      { type: 'note', id: 'n1', text: '안녕', sender: 'B', createdAt: 200 },
      { type: 'doodle', id: 'd1', imageUrl: 'https://x/img.png', sender: 'A', createdAt: 100 },
    ],
    loading: false,
    sendDoodle,
    sendNote,
  }),
}))
vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({ me: 'A', settings: { nameA: '나', nameB: '상대방', startDate: null } }),
}))

describe('DoodleBoard', () => {
  it('shows both feed items with the correct sender name', () => {
    render(<DoodleBoard />)
    expect(screen.getByText('안녕')).toBeInTheDocument()
    expect(screen.getByText(/상대방/)).toBeInTheDocument()
    expect(screen.getByText(/나 ·/)).toBeInTheDocument()
  })

  it('sends a note and clears the input', async () => {
    render(<DoodleBoard />)
    await userEvent.click(screen.getByRole('button', { name: /한마디 남기기/ }))
    await userEvent.type(screen.getByPlaceholderText(/오늘의 한마디/), '반가워')
    await userEvent.click(screen.getByRole('button', { name: /한마디 보내기/ }))
    expect(sendNote).toHaveBeenCalledWith('반가워')
  })

  it('keeps the same canvas element mounted when toggling between draw and note mode', async () => {
    const { container } = render(<DoodleBoard />)
    const canvasBefore = container.querySelector('canvas')
    expect(canvasBefore).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /한마디 남기기/ }))
    await userEvent.click(screen.getByRole('button', { name: /그림 그리기/ }))
    const canvasAfter = container.querySelector('canvas')
    expect(canvasAfter).toBe(canvasBefore)
  })

  it('shows an error message and keeps the text when sending a note fails', async () => {
    sendNote.mockRejectedValueOnce(new Error('network error'))
    render(<DoodleBoard />)
    await userEvent.click(screen.getByRole('button', { name: /한마디 남기기/ }))
    await userEvent.type(screen.getByPlaceholderText(/오늘의 한마디/), '반가워')
    await userEvent.click(screen.getByRole('button', { name: /한마디 보내기/ }))
    expect(await screen.findByText('한마디를 보내지 못했어요. 다시 시도해주세요.')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/오늘의 한마디/)).toHaveValue('반가워')
  })

  describe('eraser', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    // jsdom has no canvas: record what would be painted instead.
    function fakeCanvas() {
      const strokes: { color: string; width: number; from: number[]; to: number[] }[] = []
      const fills: string[] = []
      const dots: { color: string; at: number[]; radius: number }[] = []
      let dot = { at: [0, 0], radius: 0 }
      let from: number[] = []
      let to: number[] = []
      const ctx = {
        strokeStyle: '', lineWidth: 0, fillStyle: '', lineCap: '', lineJoin: '',
        fillRect() { fills.push(ctx.fillStyle) },
        beginPath() {},
        moveTo(x: number, y: number) { from = [x, y] },
        lineTo(x: number, y: number) { to = [x, y] },
        stroke() { strokes.push({ color: ctx.strokeStyle, width: ctx.lineWidth, from, to }) },
        arc(x: number, y: number, radius: number) { dot = { at: [x, y], radius } },
        fill() { dots.push({ color: ctx.fillStyle, ...dot }) },
      }
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
      vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 500, height: 500 } as DOMRect)
      return { strokes, fills, dots }
    }

    // jsdom's PointerEvent drops clientX/clientY, so send a MouseEvent under the pointer event's name.
    function pointer(target: EventTarget, type: string, clientX: number, clientY: number) {
      act(() => {
        target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }))
      })
    }

    it('is off at first and turns on and off from its button', async () => {
      render(<DoodleBoard />)
      const eraser = screen.getByRole('button', { name: /지우개/ })
      expect(eraser).toHaveAttribute('aria-pressed', 'false')
      await userEvent.click(eraser)
      expect(eraser).toHaveAttribute('aria-pressed', 'true')
      await userEvent.click(eraser)
      expect(eraser).toHaveAttribute('aria-pressed', 'false')
    })

    it('goes back to the pen when a colour is picked', async () => {
      render(<DoodleBoard />)
      const eraser = screen.getByRole('button', { name: /지우개/ })
      await userEvent.click(eraser)
      await userEvent.click(screen.getByRole('button', { name: '색상 #FF8465' }))
      expect(eraser).toHaveAttribute('aria-pressed', 'false')
    })

    it('rubs out only where the finger goes, in the paper colour and wider than the pen', async () => {
      const { strokes, fills, dots } = fakeCanvas()
      const { container } = render(<DoodleBoard />)
      const canvas = container.querySelector('canvas')!
      pointer(canvas, 'pointerdown', 10, 10)
      pointer(canvas, 'pointermove', 20, 20)
      pointer(window, 'pointerup', 0, 0)
      await userEvent.click(screen.getByRole('button', { name: /지우개/ }))
      pointer(canvas, 'pointerdown', 100, 100)
      pointer(canvas, 'pointermove', 120, 100)
      pointer(window, 'pointerup', 0, 0)
      pointer(canvas, 'pointermove', 300, 300)

      const pen = strokes.filter((s) => s.color === '#2A2438')
      const rubbed = strokes.filter((s) => s.color === '#fff')
      expect(pen.length).toBe(1)
      expect(rubbed).toEqual([{ color: '#fff', width: 30, from: [100, 100], to: [120, 100] }])
      // Touching down marks that spot on its own, before any movement.
      expect(dots).toEqual([
        { color: '#2A2438', at: [10, 10], radius: 2.5 },
        { color: '#fff', at: [100, 100], radius: 15 },
      ])
      expect(pen[0].width).toBe(5)
      // The whole canvas was filled once, on mount — turning the eraser on wiped nothing.
      expect(fills).toHaveLength(1)
    })

    it('shows a ring the size of the eraser where the finger is, and takes it away on lifting', async () => {
      fakeCanvas()
      const { container } = render(<DoodleBoard />)
      const canvas = container.querySelector('canvas')!
      const ring = container.querySelector<HTMLElement>('[data-eraser-ring]')!
      expect(ring.hidden).toBe(true)

      // The pen shows no ring.
      pointer(canvas, 'pointerdown', 50, 50)
      expect(ring.hidden).toBe(true)
      pointer(window, 'pointerup', 0, 0)

      await userEvent.click(screen.getByRole('button', { name: /지우개/ }))
      pointer(canvas, 'pointerdown', 100, 100)
      expect(ring.hidden).toBe(false)
      // The eraser starts 30 wide on the 500-wide canvas, shown at the same size on a 500px-wide screen box.
      expect(ring.style.width).toBe('30px')
      expect(ring.style.height).toBe('30px')
      expect(ring.style.left).toBe('85px')
      expect(ring.style.top).toBe('85px')
      pointer(canvas, 'pointermove', 120, 100)
      expect(ring.style.left).toBe('105px')
      pointer(window, 'pointerup', 0, 0)
      expect(ring.hidden).toBe(true)
    })

    it('hides the ring when going back to the pen', async () => {
      fakeCanvas()
      const { container } = render(<DoodleBoard />)
      const ring = container.querySelector<HTMLElement>('[data-eraser-ring]')!
      await userEvent.click(screen.getByRole('button', { name: /지우개/ }))
      pointer(container.querySelector('canvas')!, 'pointermove', 100, 100)
      expect(ring.hidden).toBe(false)
      await userEvent.click(screen.getByRole('button', { name: '색상 #FF8465' }))
      expect(ring.hidden).toBe(true)
    })

    it('gives the eraser its own, much wider size range and remembers each tool size', async () => {
      const { strokes } = fakeCanvas()
      const { container } = render(<DoodleBoard />)
      const canvas = container.querySelector('canvas')!
      const slider = screen.getByLabelText('굵기') as HTMLInputElement
      expect([slider.min, slider.max, slider.value]).toEqual(['2', '18', '5'])

      await userEvent.click(screen.getByRole('button', { name: /지우개/ }))
      expect([slider.min, slider.max, slider.value]).toEqual(['10', '120', '30'])
      fireEvent.change(slider, { target: { value: '120' } })
      pointer(canvas, 'pointerdown', 100, 100)
      pointer(canvas, 'pointermove', 150, 100)
      pointer(window, 'pointerup', 0, 0)
      expect(strokes[strokes.length - 1]).toMatchObject({ color: '#fff', width: 120 })
      expect(container.querySelector<HTMLElement>('[data-eraser-ring]')!.style.width).toBe('120px')

      // Back to the pen: its size is untouched, and the eraser keeps what was set.
      await userEvent.click(screen.getByRole('button', { name: /지우개/ }))
      expect(slider.value).toBe('5')
      await userEvent.click(screen.getByRole('button', { name: /지우개/ }))
      expect(slider.value).toBe('120')
    })

    it('keeps a separate button for wiping the whole canvas', async () => {
      const { fills } = fakeCanvas()
      render(<DoodleBoard />)
      await userEvent.click(screen.getByRole('button', { name: '전체 지우기' }))
      expect(fills).toHaveLength(2)
    })
  })
})
