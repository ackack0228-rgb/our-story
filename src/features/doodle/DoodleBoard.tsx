import { useEffect, useRef, useState } from 'react'
import { SubTabs } from '../../components/SubTabs'
import { useDoodleFeed } from '../../hooks/useDoodleFeed'
import { useSession } from '../../hooks/useSession'
import { canvasPointerPosition, PAPER_COLOR, strokeFor, TOOL_SIZES, type DoodleTool } from './canvasMath'
import styles from './DoodleBoard.module.css'

const COLORS = ['#2A2438', '#FF8465', '#E8B75E', '#4C7C6B', '#5B6EE8', '#E85B87']
const DOODLE_MAX_BLOB_BYTES = 600_000

function fmtTime(ts: unknown): string {
  let d: Date
  if (ts && typeof ts === 'object' && 'toMillis' in (ts as object)) d = new Date((ts as { toMillis(): number }).toMillis())
  else if (typeof ts === 'number') d = new Date(ts)
  else return ''
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const DOODLE_TABS: { key: 'draw' | 'note'; label: string }[] = [
  { key: 'draw', label: '그림 그리기' },
  { key: 'note', label: '한마디 남기기' },
]

export function DoodleBoard() {
  const { items, sendDoodle, sendNote, error: loadError } = useDoodleFeed()
  const { settings, me } = useSession()
  const [mode, setMode] = useState<'draw' | 'note'>('draw')
  const [color, setColor] = useState(COLORS[0])
  // The pen and the eraser each remember their own size.
  const [sizes, setSizes] = useState({ pen: TOOL_SIZES.pen.initial, eraser: TOOL_SIZES.eraser.initial })
  const [tool, setTool] = useState<DoodleTool>('pen')
  const size = sizes[tool]
  const [noteText, setNoteText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)

  // One-time canvas init (white fill + line style) — must run only on mount, never again on
  // color/size change, or switching color/brush mid-drawing would silently wipe the canvas.
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.fillStyle = PAPER_COLOR
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const stroke = strokeFor(tool, color, size)
    const line = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    }
    // The ring that shows how much the eraser covers. Moved by hand rather than through state, so a
    // drag does not re-render the screen on every point.
    const showRing = (e: PointerEvent, rect: DOMRect) => {
      const ring = ringRef.current
      if (!ring || tool !== 'eraser') return
      const size = (stroke.width * rect.width) / canvas.width
      ring.style.width = ring.style.height = `${size}px`
      ring.style.left = `${e.clientX - rect.left - size / 2}px`
      ring.style.top = `${e.clientY - rect.top - size / 2}px`
      ring.hidden = false
    }
    const hideRing = () => {
      if (ringRef.current) ringRef.current.hidden = true
    }
    const start = (e: PointerEvent) => {
      drawing.current = true
      const rect = canvas.getBoundingClientRect()
      showRing(e, rect)
      const pos = canvasPointerPosition(e.clientX, e.clientY, rect, canvas.width, canvas.height)
      // A tap alone draws (or rubs out) that spot. A filled circle, because browsers skip a zero-length line.
      ctx.fillStyle = stroke.color
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, stroke.width / 2, 0, Math.PI * 2)
      ctx.fill()
      last.current = pos
    }
    const move = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      // With a mouse the ring also follows the pointer before pressing; a finger only moves while touching.
      showRing(e, rect)
      if (!drawing.current || !last.current) return
      const pos = canvasPointerPosition(e.clientX, e.clientY, rect, canvas.width, canvas.height)
      line(last.current, pos)
      last.current = pos
    }
    const end = (e: PointerEvent) => {
      drawing.current = false
      if (e.pointerType !== 'mouse') hideRing()
    }
    hideRing()

    canvas.addEventListener('pointerdown', start)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerleave', hideRing)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      canvas.removeEventListener('pointerleave', hideRing)
      window.removeEventListener('pointercancel', end)
      canvas.removeEventListener('pointerdown', start)
      canvas.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }
  }, [color, size, tool])

  function clearCanvas() {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !canvasRef.current) return
    ctx.fillStyle = PAPER_COLOR
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  async function handleSendDoodle() {
    const canvas = canvasRef.current
    if (!canvas) return
    setError(null)
    try {
      let blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      // PNG is normally tiny for this limited-palette canvas; a very busy drawing falls back to a
      // (still opaque, since the canvas is pre-filled white) lossy JPEG to keep the upload small.
      if (blob && blob.size > DOODLE_MAX_BLOB_BYTES) {
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7))
      }
      if (!blob) return
      await sendDoodle(blob)
      clearCanvas()
    } catch {
      setError('낙서를 보내지 못했어요. 다시 시도해주세요.')
    }
  }

  async function handleSendNote() {
    const text = noteText.trim()
    if (!text) return
    setError(null)
    try {
      await sendNote(text)
      setNoteText('')
    } catch {
      setError('한마디를 보내지 못했어요. 다시 시도해주세요.')
    }
  }

  return (
    <div>
      <SubTabs tabs={DOODLE_TABS} active={mode} onChange={setMode} />

      <div style={{ display: mode === 'draw' ? undefined : 'none' }}>
        <div className={styles.canvasCard}>
          <canvas ref={canvasRef} width={500} height={500} className={styles.canvas} />
          <div ref={ringRef} className={styles.eraserRing} data-eraser-ring hidden />
        </div>
        <div className={styles.swatches}>
          {COLORS.map((c) => (
            <button
              key={c}
              className={`${styles.swatch} ${tool === 'pen' && color === c ? styles.selected : ''}`}
              style={{ background: c }}
              onClick={() => { setColor(c); setTool('pen') }}
              aria-label={`색상 ${c}`}
            />
          ))}
          <button
            className={`${styles.toolBtn} ${tool === 'eraser' ? styles.toolOn : ''}`}
            aria-pressed={tool === 'eraser'}
            onClick={() => setTool(tool === 'eraser' ? 'pen' : 'eraser')}
          >
            🧽 지우개
          </button>
        </div>
        <div className={styles.sizeRow}>
          <span className={styles.sizeLabel}>{tool === 'eraser' ? '지우개 굵기' : '펜 굵기'}</span>
          <input
            type="range"
            aria-label="굵기"
            min={TOOL_SIZES[tool].min}
            max={TOOL_SIZES[tool].max}
            value={size}
            onChange={(e) => setSizes({ ...sizes, [tool]: Number(e.target.value) })}
          />
          <button className={styles.clearBtn} onClick={clearCanvas}>전체 지우기</button>
        </div>
        <button className={styles.sendBtn} onClick={handleSendDoodle}>낙서 보내기 💌</button>
        {mode === 'draw' && error && <div className={styles.error}>{error}</div>}
      </div>

      <div style={{ display: mode === 'note' ? undefined : 'none' }}>
        <textarea
          className={styles.noteInput}
          placeholder="오늘의 한마디를 남겨보세요..."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
        />
        <button className={styles.sendBtn} onClick={handleSendNote}>한마디 보내기 💌</button>
        {mode === 'note' && error && <div className={styles.error}>{error}</div>}
      </div>

      <div className={styles.feed}>
        {loadError && <div className={styles.error}>{loadError}</div>}
        {!loadError && items.length === 0 && <div className={styles.empty}>아직 남긴 낙서나 한마디가 없어요 🤍</div>}
        {items.map((item) => {
          const senderName = item.sender === 'A' ? settings.nameA : settings.nameB
          const isMine = item.sender === me
          return (
            <div key={item.id} className={`${styles.feedItem} ${isMine ? styles.mineA : ''}`}>
              <div className={styles.feedMeta}>{senderName} · {fmtTime(item.createdAt)}</div>
              {item.type === 'doodle' ? <img src={item.imageUrl} alt="" /> : <div>{item.text}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
