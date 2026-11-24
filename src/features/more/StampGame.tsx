import { useEffect, useRef, useState } from 'react'
import { useSession } from '../../hooks/useSession'
import { useGameRecords } from '../../hooks/useGameRecords'
import {
  BOARD_W, STAMP_H, START_W, bestOf, colorFor, drop, speedFor, widthAfterPerfect, type Span,
} from '../../lib/stampGame'
import styles from './StampGame.module.css'
import { LOAD_ERROR } from '../../hooks/useCollection'

const BOARD_H = 440
const GROUND = 36 // board units between the canvas bottom and the first stamp
const BG_TOP = '#2B1E3F'
const BG_BOTTOM = '#5A2F4E'

type Phase = 'ready' | 'playing' | 'over'

interface Piece extends Span { floor: number; y: number; vy: number; spin: number; angle: number }

interface World {
  stack: Span[]
  moving: Span & { dir: 1 | -1 }
  debris: Piece[]
  camera: number
  combo: number
  phase: Phase
  flash: { text: string; t: number } | null
}

function freshWorld(): World {
  const base = { x: (BOARD_W - START_W) / 2, w: START_W }
  return { stack: [base], moving: { x: 0, w: START_W, dir: 1 }, debris: [], camera: 0, combo: 0, phase: 'ready', flash: null }
}

// Screen y (board units) of the top edge of a floor.
function floorTop(floor: number, camera: number): number {
  return BOARD_H - GROUND - (floor + 1) * STAMP_H + camera
}

function drawStamp(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(x, y + 1, w, STAMP_H - 2, 3)
  ctx.fill()
  // Perforated top and bottom edges, punched in the night colour like the D-day stamp.
  ctx.fillStyle = BG_TOP
  for (let px = x + 5; px < x + w - 2; px += 9) {
    ctx.beginPath(); ctx.arc(px, y + 1, 2.2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(px, y + STAMP_H - 1, 2.2, 0, Math.PI * 2); ctx.fill()
  }
  if (w > 14) {
    ctx.strokeStyle = 'rgba(74, 46, 53, 0.28)'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 4, y + 6, w - 8, STAMP_H - 12)
  }
  if (w > 28) {
    ctx.fillStyle = 'rgba(74, 46, 53, 0.45)'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('♥', x + w / 2, y + STAMP_H / 2 + 1)
  }
}

function draw(ctx: CanvasRenderingContext2D, g: World) {
  const bg = ctx.createLinearGradient(0, 0, 0, BOARD_H)
  bg.addColorStop(0, BG_TOP)
  bg.addColorStop(1, BG_BOTTOM)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, BOARD_W, BOARD_H)

  const groundY = BOARD_H - GROUND + g.camera
  if (groundY < BOARD_H) {
    ctx.fillStyle = 'rgba(251, 241, 234, 0.08)'
    ctx.fillRect(0, groundY, BOARD_W, BOARD_H - groundY)
  }

  g.stack.forEach((s, i) => {
    const y = floorTop(i, g.camera)
    if (y > BOARD_H || y < -STAMP_H) return
    drawStamp(ctx, s.x, y, s.w, colorFor(i))
  })
  if (g.phase === 'playing') drawStamp(ctx, g.moving.x, floorTop(g.stack.length, g.camera), g.moving.w, colorFor(g.stack.length))

  for (const p of g.debris) {
    ctx.save()
    ctx.translate(p.x + p.w / 2, p.y + STAMP_H / 2 + g.camera)
    ctx.rotate(p.angle)
    drawStamp(ctx, -p.w / 2, -STAMP_H / 2, p.w, colorFor(p.floor))
    ctx.restore()
  }

  if (g.flash) {
    ctx.globalAlpha = Math.max(0, 1 - g.flash.t / 0.8)
    ctx.fillStyle = '#D9A87E'
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(g.flash.text, BOARD_W / 2, floorTop(g.stack.length, g.camera) - 14 - g.flash.t * 20)
    ctx.globalAlpha = 1
  }
}

export function StampGame() {
  const { me, settings } = useSession()
  const { records, error: loadError, submit } = useGameRecords()
  const canvas = useRef<HTMLCanvasElement>(null)
  const world = useRef<World>(freshWorld())
  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [newRecord, setNewRecord] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Size the canvas to the screen (sharp on retina) and run the animation while the tab is open.
  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const fit = () => {
      const cssW = el.clientWidth || BOARD_W
      const dpr = window.devicePixelRatio || 1
      el.width = Math.round(cssW * dpr)
      el.height = Math.round(cssW * (BOARD_H / BOARD_W) * dpr)
      ctx.setTransform((cssW * dpr) / BOARD_W, 0, 0, (cssW * dpr) / BOARD_W, 0, 0)
    }
    fit()
    window.addEventListener('resize', fit)

    let last = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const g = world.current
      if (g.phase === 'playing') {
        const m = g.moving
        m.x += m.dir * speedFor(g.stack.length - 1) * dt
        if (m.x + m.w > BOARD_W) { m.x = BOARD_W - m.w; m.dir = -1 }
        if (m.x < 0) { m.x = 0; m.dir = 1 }
      }
      for (const p of g.debris) { p.vy += 900 * dt; p.y += p.vy * dt; p.angle += p.spin * dt }
      g.debris = g.debris.filter((p) => p.y + g.camera < BOARD_H + 80)
      const target = Math.max(0, (g.stack.length + 2) * STAMP_H - BOARD_H * 0.6)
      g.camera += (target - g.camera) * Math.min(1, dt * 6)
      if (g.flash) { g.flash.t += dt; if (g.flash.t > 0.8) g.flash = null }
      draw(ctx, g)
      frame = requestAnimationFrame(tick)
    })
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', fit) }
  }, [])

  function start() {
    const g = freshWorld()
    g.phase = 'playing'
    g.moving = { x: 0, w: START_W, dir: 1 }
    world.current = g
    setScore(0)
    setNewRecord(false)
    setSaveError(null)
    setPhase('playing')
  }

  function fall(span: Span, floor: number, spin: number): Piece {
    return { ...span, floor, y: floorTop(floor, 0), vy: 0, spin, angle: 0 }
  }

  async function finish(floors: number) {
    try {
      setNewRecord(await submit(floors))
    } catch {
      setSaveError('기록을 저장하지 못했어요.')
    }
  }

  function tap() {
    const g = world.current
    if (g.phase === 'ready') return start()
    if (g.phase !== 'playing') return
    const floor = g.stack.length
    const result = drop(g.stack[floor - 1], g.moving)
    if (result.kind === 'miss') {
      g.debris.push(fall(g.moving, floor, g.moving.dir * 2))
      g.phase = 'over'
      setPhase('over')
      void finish(floor - 1)
      return
    }
    let nextW = result.placed.w
    if (result.kind === 'perfect') {
      g.combo += 1
      nextW = widthAfterPerfect(result.placed.w, g.combo)
      g.flash = { text: g.combo > 1 ? `완벽! ×${g.combo}` : '완벽!', t: 0 }
    } else {
      g.combo = 0
      g.debris.push(fall(result.debris, floor, result.debris.x < result.placed.x ? -3 : 3))
    }
    g.stack.push(result.placed)
    // The next stamp comes in from the side opposite the one this one ended on.
    const fromRight = g.moving.dir === 1
    g.moving = { x: fromRight ? BOARD_W - nextW : 0, w: nextW, dir: fromRight ? -1 : 1 }
    setScore(g.stack.length - 1)
  }

  const myName = me === 'A' ? settings.nameA : settings.nameB
  const theirName = me === 'A' ? settings.nameB : settings.nameA
  const myBest = bestOf(records, me)
  const theirBest = bestOf(records, me === 'A' ? 'B' : 'A')

  return (
    <div className={styles.wrap}>
      <div className={styles.board}>
        <div className={styles.scores}>
          <div className={styles.best}><span>{myName}</span><b>{myBest}층</b></div>
          <div className={styles.title}>우표 쌓기</div>
          <div className={`${styles.best} ${styles.right}`}><span>{theirName}</span><b>{theirBest}층</b></div>
        </div>
        <div className={styles.stage} onPointerDown={tap}>
          <canvas ref={canvas} className={styles.canvas} />
          {phase === 'playing' && <div className={styles.score} aria-live="polite">{score}</div>}
          {phase === 'ready' && (
            <div className={styles.overlay}>
              <div className={styles.overlayTitle}>우표를 높이 쌓아 보세요</div>
              <div className={styles.overlayText}>화면을 누르면 우표가 떨어져요.<br />삐져나온 만큼 잘려 나가요.</div>
              <div className={styles.tapHint}>눌러서 시작</div>
            </div>
          )}
          {phase === 'over' && (
            <div className={styles.overlay} onPointerDown={(e) => e.stopPropagation()}>
              <div className={styles.overlayTitle}>{score}층!</div>
              {newRecord && <div className={styles.record}>🎉 새 기록이에요</div>}
              {!newRecord && score > 0 && theirBest > 0 && score > theirBest && <div className={styles.record}>{theirName}보다 높아요!</div>}
              {saveError && <div className={styles.error}>{saveError}</div>}
              <button className={styles.again} onClick={start}>다시 하기</button>
            </div>
          )}
        </div>
      </div>
      {loadError && <div className={styles.error}>{LOAD_ERROR}</div>}
    </div>
  )
}
