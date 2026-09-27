import { Camera, Images, Keyboard, Link2 } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { GarmentForm } from '../components/GarmentForm'
import { PhotoPreview } from '../components/PhotoPreview'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import { addGarment } from '../lib/closet'
import { extractColorsFromBlob } from '../lib/color'
import { defaultFormality } from '../lib/catalog'
import { emptyDraft, sanitizeDraft, validateDraft, type GarmentDraft } from '../lib/model'
import { usePreparedPhoto } from '../lib/usePreparedPhoto'

type Props = { onClose: () => void; onTypeList: () => void; onLink: () => void; onBulk: () => void }

export function AddSheet({ onClose, onTypeList, onLink, onBulk }: Props) {
  const toast = useToast()
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<GarmentDraft>(emptyDraft)
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [colorStatus, setColorStatus] = useState<string | null>(null)
  const colorToken = useRef(0)

  // Re-read colors whenever the version to save changes; the cut-out gives cleaner colors.
  const photo = usePreparedPhoto((chosen) => {
    const token = ++colorToken.current
    setColorStatus('Reading colors…')
    extractColorsFromBlob(chosen.thumb)
      .then((colors) => {
        if (token !== colorToken.current) return
        // Never overwrite colors the person already fixed by hand.
        setDraft((d) => (d.colorsEdited ? d : { ...d, colors, colorsEdited: false }))
        setColorStatus(colors.length ? null : "Couldn't read colors from this photo. Add them by hand.")
      })
      .catch(() => {
        if (token === colorToken.current) setColorStatus("Couldn't read colors from this photo. Add them by hand.")
      })
  })

  // Pre-select the type Drape guessed from the outline, unless the person already chose one.
  // (Adjusted during render when a new guess arrives, as React recommends, not in an effect.)
  const guess = photo.guess
  const [seenGuess, setSeenGuess] = useState<typeof guess>(null)
  if (guess !== seenGuess) {
    setSeenGuess(guess)
    if (guess && guess.confidence >= 0.5) {
      setDraft((d) => (d.category ? d : sanitizeDraft({ ...d, category: guess.category, subtype: guess.subtype, formality: defaultFormality(guess.subtype) })))
    }
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // lets the same photo be picked again after an error
    if (file) void photo.prepare(file)
  }

  const errors = validateDraft(draft)

  async function save() {
    if (!photo.chosen || saving) return
    if (errors.length) return setShowErrors(true)
    setSaving(true)
    try {
      await addGarment(draft, photo.chosen, { bgRemoved: photo.useCut && !!photo.cut })
      toast('Added to your closet')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save. Try again.', 'error')
      setSaving(false)
    }
  }

  return (
    <Sheet
      title="Add a piece"
      onClose={onClose}
      footer={
        photo.chosen && (
          <button type="button" className="btn primary block" onClick={() => void save()} disabled={saving || photo.cutting}>
            {saving ? 'Saving…' : photo.cutting ? 'Removing background…' : 'Save to closet'}
          </button>
        )
      }
    >
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={galleryInput} type="file" accept="image/*" hidden onChange={onFile} />
      {!photo.chosen ? (
        <div className="stack">
          <p className="muted">Lay the piece flat on a bed or floor, or hang it against a plain wall, in good light. One piece per photo. Drape removes the background for you.</p>
          <button type="button" className="big-pick" onClick={() => cameraInput.current?.click()} disabled={photo.processing}>
            <Camera size={28} aria-hidden="true" />
            <span>Take photo</span>
          </button>
          <button type="button" className="big-pick" onClick={() => galleryInput.current?.click()} disabled={photo.processing}>
            <Images size={28} aria-hidden="true" />
            <span>Choose from gallery</span>
          </button>
          <button type="button" className="big-pick" onClick={onBulk} disabled={photo.processing}>
            <Images size={28} aria-hidden="true" />
            <span>
              Add many photos at once
              <span className="big-pick-hint">Up to 30: backgrounds removed and types guessed for you</span>
            </span>
          </button>
          <button type="button" className="big-pick" onClick={onLink} disabled={photo.processing}>
            <Link2 size={28} aria-hidden="true" />
            <span>
              Add from a shop link
              <span className="big-pick-hint">Paste a Myntra, Amazon, AJIO… product link</span>
            </span>
          </button>
          <button type="button" className="big-pick" onClick={onTypeList} disabled={photo.processing}>
            <Keyboard size={28} aria-hidden="true" />
            <span>
              Type a list instead
              <span className="big-pick-hint">"White Nike Air Force, Gold hoops…"</span>
            </span>
          </button>
          {photo.processing && <p className="muted" role="status">Preparing photo…</p>}
          {photo.error && (
            <p className="error-text" role="alert">
              {photo.error}
            </p>
          )}
        </div>
      ) : (
        <div className="stack">
          <PhotoPreview p={photo} onChange={() => galleryInput.current?.click()} />
          {photo.error && (
            <p className="error-text" role="alert">
              {photo.error}
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
