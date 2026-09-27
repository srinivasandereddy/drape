import { ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getPhoto } from '../lib/closet'

/** Loads a stored photo as an object URL and frees it when no longer shown. */
function usePhotoUrl(id: string, kind: 'thumb' | 'full'): { url: string | null; failed: boolean } {
  const [state, setState] = useState<{ url: string | null; failed: boolean }>({ url: null, failed: false })
  useEffect(() => {
    let cancelled = false
    let url: string | null = null
    getPhoto(id)
      .then((p) => {
        if (cancelled) return
        const blob = p?.[kind]
        if (!blob) return setState({ url: null, failed: true })
        url = URL.createObjectURL(blob)
        setState({ url, failed: false })
      })
      .catch(() => {
        if (!cancelled) setState({ url: null, failed: true })
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [id, kind])
  return state
}

type Props = { id: string; kind: 'thumb' | 'full'; alt: string; className?: string }

export function GarmentPhoto({ id, kind, alt, className }: Props) {
  const { url, failed } = usePhotoUrl(id, kind)
  if (failed) {
    return (
      <div className={`photo-missing ${className ?? ''}`} role="img" aria-label={`${alt}, photo missing`}>
        <ImageOff size={24} aria-hidden="true" />
      </div>
    )
  }
  if (!url) return <div className={`photo-loading ${className ?? ''}`} aria-hidden="true" />
  return <img className={className} src={url} alt={alt} draggable={false} />
}
