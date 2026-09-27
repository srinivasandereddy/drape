import { useCallback, useEffect, useRef, useState } from 'react'
import { cutOut } from './cutout'
import { PhotoError, processPhoto, type ProcessedPhoto } from './image'

type Version = { data: ProcessedPhoto; url: string }

export interface PreparedPhoto {
  original: Version | null
  cut: Version | null
  /** Background removal is running. */
  cutting: boolean
  /** Background removal was tried and could not separate the piece. */
  cutFailed: boolean
  useCut: boolean
  processing: boolean
  error: string | null
  /** The version that will be saved. */
  chosen: ProcessedPhoto | null
  chosenUrl: string | null
  prepare: (file: File) => Promise<void>
  setUseCut: (v: boolean) => void
}

/**
 * Takes a photo file, shrinks it, then tries to cut the piece out of its
 * background. The cut-out is used when it works; the person can switch back.
 * `onChosen` fires whenever the version to save changes (to re-read colors).
 */
export function usePreparedPhoto(onChosen: (photo: ProcessedPhoto) => void): PreparedPhoto {
  const [original, setOriginal] = useState<Version | null>(null)
  const [cut, setCut] = useState<Version | null>(null)
  const [cutting, setCutting] = useState(false)
  const [cutFailed, setCutFailed] = useState(false)
  const [useCut, setUseCutState] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const token = useRef(0)
  const chosenCb = useRef(onChosen)
  useEffect(() => {
    chosenCb.current = onChosen
  })

  // Free object URLs when replaced or unmounted.
  useEffect(() => () => {
    if (original) URL.revokeObjectURL(original.url)
  }, [original])
  useEffect(() => () => {
    if (cut) URL.revokeObjectURL(cut.url)
  }, [cut])

  const prepare = useCallback(async (file: File) => {
    const t = ++token.current
    setProcessing(true)
    setError(null)
    setCut(null)
    setCutFailed(false)
    try {
      const data = await processPhoto(file)
      if (t !== token.current) return
      setOriginal({ data, url: URL.createObjectURL(data.full) })
      chosenCb.current(data)
      setProcessing(false)
      setCutting(true)
      const c = await cutOut(data.full).catch(() => null)
      if (t !== token.current) return
      if (c) {
        const version = { data: { full: c.full, thumb: c.thumb, width: c.width, height: c.height }, url: URL.createObjectURL(c.full) }
        setCut(version)
        setUseCutState(true)
        chosenCb.current(version.data)
      } else setCutFailed(true)
    } catch (e) {
      if (t === token.current) setError(e instanceof PhotoError ? e.message : 'Could not read that photo. Try another one.')
    } finally {
      if (t === token.current) {
        setProcessing(false)
        setCutting(false)
      }
    }
  }, [])

  const setUseCut = useCallback(
    (v: boolean) => {
      setUseCutState(v)
      const chosen = v && cut ? cut.data : original?.data
      if (chosen) chosenCb.current(chosen)
    },
    [cut, original],
  )

  const active = useCut && cut ? cut : original
  return { original, cut, cutting, cutFailed, useCut, processing, error, chosen: active?.data ?? null, chosenUrl: active?.url ?? null, prepare, setUseCut }
}
