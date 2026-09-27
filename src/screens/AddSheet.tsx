import { Camera, Images, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { GarmentForm } from '../components/GarmentForm'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import { addGarment } from '../lib/closet'
import { extractColorsFromBlob } from '../lib/color'
import { PhotoError, processPhoto, type ProcessedPhoto } from '../lib/image'
import { emptyDraft, validateDraft, type GarmentDraft } from '../lib/model'

export function AddSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)

  const [photo, setPhoto] = useState<{ data: ProcessedPhoto; url: string } | null>(null)
  const [processing, setProcessing] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [draft, setDraft] = useState<GarmentDraft>(emptyDraft)
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [colorStatus, setColorStatus] = useState<string | null>(null)
  const photoToken = useRef(0)

  // Free the preview image when it is replaced or the sheet closes.
  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url)
  }, [photo])

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // lets the same photo be picked again after an error
    if (!file) return
    setProcessing(true)
    setPhotoError(null)
    try {
      const data = await processPhoto(file)
      setPhoto({ data, url: URL.createObjectURL(data.full) })
      void readColors(data.thumb)
    } catch (err) {
      setPhotoError(err instanceof PhotoError ? err.message : 'Could not read that photo. Try another one.')
    } finally {
      setProcessing(false)
    }
  }

  async function readColors(thumb: Blob) {
    const token = ++photoToken.current
    setColorStatus('Reading colors…')
    try {
      const colors = await extractColorsFromBlob(thumb)
      if (token !== photoToken.current) return // a newer photo was chosen meanwhile
      // Never overwrite colors the person already fixed by hand.
      setDraft((d) => (d.colorsEdited ? d : { ...d, colors, colorsEdited: false }))
      setColorStatus(colors.length ? null : "Couldn't read colors from this photo. Add them by hand.")
    } catch {
      if (token === photoToken.current) setColorStatus("Couldn't read colors from this photo. Add them by hand.")
    }
  }

  const errors = validateDraft(draft)

  async function save() {
    if (!photo || saving) return
    if (errors.length) return setShowErrors(true)
    setSaving(true)
    try {
      await addGarment(draft, photo.data)
      toast('Added to your closet')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save. Try again.', 'error')
      setSaving(false)
    }
  }

  const pickers = (
    <>
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={galleryInput} type="file" accept="image/*" hidden onChange={onFile} />
    </>
  )

  return (
    <Sheet
      title="Add a piece"
      onClose={onClose}
      footer={
        photo && (
          <button type="button" className="btn primary block" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save to closet'}
          </button>
        )
      }
    >
      {pickers}
      {!photo ? (
        <div className="stack">
          <p className="muted">Lay the piece flat or hang it against a plain wall, in good light. One piece per photo.</p>
          <button type="button" className="big-pick" onClick={() => cameraInput.current?.click()} disabled={processing}>
            <Camera size={28} aria-hidden="true" />
            <span>Take photo</span>
          </button>
          <button type="button" className="big-pick" onClick={() => galleryInput.current?.click()} disabled={processing}>
            <Images size={28} aria-hidden="true" />
            <span>Choose from gallery</span>
          </button>
          {processing && <p className="muted" role="status">Preparing photo…</p>}
          {photoError && (
            <p className="error-text" role="alert">
              {photoError}
            </p>
          )}
        </div>
      ) : (
        <div className="stack">
          <div className="preview">
            <img src={photo.url} alt="The piece you are adding" />
            <button type="button" className="btn small preview-change" onClick={() => galleryInput.current?.click()} disabled={processing}>
              <RefreshCw size={16} aria-hidden="true" /> Change photo
            </button>
          </div>
          {photoError && (
            <p className="error-text" role="alert">
              {photoError}
            </p>
          )}
          <GarmentForm draft={draft} onChange={setDraft} colorStatus={colorStatus} />
          {showErrors && errors.length > 0 && (
            <ul className="error-text" role="alert">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  )
}
