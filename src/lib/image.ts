// Turns a photo from the camera or gallery into two small JPEGs:
// a 1600px "full" image and a 480px thumbnail for the closet grid.
// Shrinking early keeps storage small and later Drive uploads fast.

export const FULL_MAX_PX = 1600
export const THUMB_MAX_PX = 480
export const MAX_INPUT_BYTES = 40 * 1024 * 1024

export interface ProcessedPhoto {
  full: Blob
  thumb: Blob
  width: number
  height: number
}

/** An error whose message is safe and helpful to show to the person. */
export class PhotoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhotoError'
  }
}

/** Scales (w, h) down to fit within `max` on the long edge. Never scales up. */
export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (!(w > 0 && h > 0)) throw new RangeError('Image has no size')
  const scale = Math.min(1, max / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

export function checkFile(file: Pick<File, 'type' | 'size' | 'name'>): void {
  const looksLikeImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name)
  if (!looksLikeImage) throw new PhotoError('That file is not a photo. Choose a JPEG or PNG image.')
  if (file.size === 0) throw new PhotoError('That photo is empty. Try taking it again.')
  if (file.size > MAX_INPUT_BYTES) throw new PhotoError('That photo is over 40 MB. Choose a smaller one.')
}

/**
 * Loads an image from a blob. Uses `onload` rather than `img.decode()`, which
 * stalls while the app is in the background.
 */
export function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  // Browsers rotate the image according to its camera orientation (EXIF) when drawing it.
  img.decoding = 'async'
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => resolve(img)
    img.onerror = () => reject(new PhotoError("This phone can't read that photo format. Try a JPEG or PNG, or use Take photo."))
  })
  img.src = url
  return loaded.finally(() => URL.revokeObjectURL(url))
}

async function render(img: HTMLImageElement, max: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, max)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new PhotoError('This phone ran out of memory for photos. Close other apps and try again.')
    // White behind transparent PNGs, otherwise they turn black as JPEG.
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) throw new PhotoError('Could not save that photo. Try again.')
    return { blob, width, height }
  } finally {
    // iPhones limit total canvas memory; release it straight away.
    canvas.width = 0
    canvas.height = 0
  }
}

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  checkFile(file)
  const img = await loadImage(file)
  if (!img.naturalWidth || !img.naturalHeight) throw new PhotoError('That photo has no picture in it. Try another one.')
  const full = await render(img, FULL_MAX_PX, 0.85)
  const thumb = await render(img, THUMB_MAX_PX, 0.8)
  return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height }
}
