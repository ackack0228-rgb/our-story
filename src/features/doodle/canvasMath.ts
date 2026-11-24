export function canvasPointerPosition(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const cx = clientX - rect.left
  const cy = clientY - rect.top
  return { x: (cx * canvasWidth) / rect.width, y: (cy * canvasHeight) / rect.height }
}

export type DoodleTool = 'pen' | 'eraser'

export const PAPER_COLOR = '#fff'
// Widths in canvas pixels (the canvas is 500 wide). Each tool keeps its own size: the eraser runs much
// wider than the pen, up to about a quarter of the canvas, so a big area can be rubbed out in a pass.
export const TOOL_SIZES: Record<DoodleTool, { min: number; max: number; initial: number }> = {
  pen: { min: 2, max: 18, initial: 5 },
  eraser: { min: 10, max: 120, initial: 30 },
}

/** How a stroke is painted. The canvas is opaque white, so erasing is painting the paper colour back. */
export function strokeFor(tool: DoodleTool, color: string, size: number): { color: string; width: number } {
  return { color: tool === 'eraser' ? PAPER_COLOR : color, width: size }
}
