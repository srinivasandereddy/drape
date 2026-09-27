// Small helpers about the device and browser Drape is running in.

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  const ua = navigator.userAgent
  // iPads report themselves as Macs, but Macs have no touch screen.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** localStorage that never throws (private windows and some browsers block it). */
export const prefs = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(`drape.${key}`)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(`drape.${key}`, value)
    } catch {
      /* ignore: a preference is not worth an error */
    }
  },
}

export const APP_VERSION: string = __APP_VERSION__
