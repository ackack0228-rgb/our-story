export function calcResizeDimensions(width: number, height: number, maxWidth: number): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('blob read failed'))
    reader.readAsDataURL(blob)
  })
}

// Ordered attempts, each tried in turn until one fits the byte budget. Width and quality are
// paired (not a full cross-product) so a typical photo only loses a little quality before the
// resolution itself drops — trying every quality level at full width first would mean falling
// back to heavily-blocked full-resolution JPEGs before ever trying a smaller, crisper image.
export const RESIZE_STEPS: ReadonlyArray<{ width: number; quality: number }> = [
  { width: 1080, quality: 0.8 },
  { width: 1080, quality: 0.6 },
  { width: 800, quality: 0.75 },
  { width: 800, quality: 0.55 },
  { width: 600, quality: 0.7 },
  { width: 600, quality: 0.5 },
  { width: 480, quality: 0.6 },
  { width: 480, quality: 0.35 },
  { width: 320, quality: 0.3 },
]

export async function compressWithinBudget(
  encode: (width: number, quality: number) => Promise<Blob>,
  maxBytes = 600_000
): Promise<Blob> {
  let last: Blob | null = null
  for (const { width, quality } of RESIZE_STEPS) {
    const blob = await encode(width, quality)
    last = blob
    if (blob.size <= maxBytes) return blob
  }
  return last as Blob
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('image decode failed'))
      img.src = ev.target?.result as string
    }
    reader.onerror = () => reject(new Error('file read failed'))
    reader.readAsDataURL(file)
  })
}

function encodeAtSize(img: HTMLImageElement, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const { width, height } = calcResizeDimensions(img.width, img.height, maxWidth)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) { reject(new Error('no 2d context')); return }
    // JPEG has no alpha channel — without an opaque backing, a transparent source image (e.g. a
    // cropped screenshot) would composite onto canvas's default transparent-black and encode with
    // a solid black background where the transparency was.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('resize failed'))), 'image/jpeg', quality)
  })
}

export async function resizeImageFileToBlob(file: File, maxBytes = 600_000): Promise<Blob> {
  const img = await loadImageFromFile(file)
  return compressWithinBudget((width, quality) => encodeAtSize(img, width, quality), maxBytes)
}
