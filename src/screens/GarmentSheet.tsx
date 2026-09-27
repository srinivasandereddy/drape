import { Camera, CalendarCheck, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { ColorSwatches } from '../components/ColorSwatches'
import { GarmentForm } from '../components/GarmentForm'
import { PieceImage } from '../components/PieceImage'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import { FABRIC_LABELS, FORMALITY_LABELS, METAL_LABELS, PATTERN_LABELS, SEASON_LABELS, WARMTH_LABELS, categoryDef } from '../lib/catalog'
import { deleteGarment, editGarment, setGarmentPhoto, useCloset, wearGarment } from '../lib/closet'
import { extractColorsFromBlob } from '../lib/color'
import { PhotoError, processPhoto } from '../lib/image'
import { styleDef } from '../lib/styles'
import { displayName, draftFromGarment, validateDraft, type Garment, type GarmentDraft } from '../lib/model'
import { pieceLabel } from '../lib/outfit'
import { matchesFor } from '../lib/spectrum'

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const isToday = (iso: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString()

function details(g: Garment): [string, ReactNode][] {
  const rows: [string, ReactNode][] = [
    ['Kind', [categoryDef(g.category).label, g.subtype].filter(Boolean).join(' · ')],
    ['Colors', <ColorSwatches key="c" colors={g.colors} />],
    ['Dressiness', FORMALITY_LABELS[g.formality]],
  ]
  if (g.warmth) rows.push(['Warmth', WARMTH_LABELS[g.warmth]])
  if (g.pattern) rows.push(['Pattern', PATTERN_LABELS[g.pattern]])
  if (g.metal) rows.push(['Metal', METAL_LABELS[g.metal]])
  if (g.fabric) rows.push(['Fabric', FABRIC_LABELS[g.fabric]])
  if (g.styleTags.length) rows.push(['Style', g.styleTags.map((s) => styleDef(s).label).join(', ')])
  if (g.source === 'sample') rows.push(['Added as', 'Sample piece'])
  rows.push(['Seasons', g.seasons.length ? g.seasons.map((s) => SEASON_LABELS[s]).join(', ') : 'All year'])
  rows.push(['Worn', g.wornCount === 0 ? 'Not yet' : `${g.wornCount} time${g.wornCount === 1 ? '' : 's'}, last ${dateFmt.format(new Date(g.lastWornAt!))}`])
  rows.push(['Added', dateFmt.format(new Date(g.createdAt))])
  return rows
}

export function GarmentSheet({ id, onClose, onOpen }: { id: string; onClose: () => void; onOpen: (id: string) => void }) {
  const toast = useToast()
  const { garments, status } = useCloset()
  const garment = garments.find((g) => g.id === id)
  const matches = useMemo(() => (garment ? matchesFor(garment, garments).slice(0, 8) : []), [garment, garments])

  const [editing, setEditing] = useState<GarmentDraft | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

  // If the piece disappears (deleted, or wiped from Settings), close this panel.
  useEffect(() => {
    if (status === 'ready' && !garment) onClose()
  }, [status, garment, onClose])

  if (!garment) return null
  const name = displayName(garment)

  async function run(action: () => Promise<unknown>, done: string) {
    if (busy) return
    setBusy(true)
    try {
      await action()
      toast(done)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work. Try again.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    const errors = validateDraft(editing)
    return (
      <Sheet
        key="edit"
        title={`Edit ${name}`}
        onClose={() => setEditing(null)}
        footer={
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={busy || errors.length > 0}
              onClick={() => run(() => editGarment(garment.id, editing).then(() => setEditing(null)), 'Changes saved')}
            >
              Save changes
            </button>
          </div>
        }
      >
        <GarmentForm draft={editing} onChange={setEditing} />
      </Sheet>
    )
  }

  const woreToday = isToday(garment.lastWornAt)

  async function addPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !garment) return
    await run(async () => {
      try {
        const photo = await processPhoto(file)
        const colors = await extractColorsFromBlob(photo.thumb).catch(() => [])
        await setGarmentPhoto(garment.id, photo, colors)
      } catch (err) {
        throw err instanceof PhotoError ? err : new Error('Could not read that photo. Try another one.')
      }
    }, 'Photo added')
  }

  return (
    // Separate keys so each mode registers its own Back-gesture entry.
    <Sheet key="view" title={name} onClose={onClose}>
      <div className="stack">
        <div className="detail-photo">
          <PieceImage garment={garment} kind="full" alt={name} />
        </div>
        <input ref={photoInput} type="file" accept="image/*" hidden onChange={(e) => void addPhoto(e)} />
        {!garment.photo && (
          <button type="button" className="btn" disabled={busy} onClick={() => photoInput.current?.click()}>
            <Camera size={18} aria-hidden="true" /> Add a photo of this piece
          </button>
        )}

        <div className="row-actions">
          <button
            type="button"
            className="btn primary"
            disabled={busy || woreToday}
            onClick={() => run(() => wearGarment(garment.id), 'Logged as worn today')}
          >
            <CalendarCheck size={18} aria-hidden="true" /> {woreToday ? 'Worn today' : 'I wore this today'}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => setEditing(draftFromGarment(garment))}>
            <Pencil size={18} aria-hidden="true" /> Edit
          </button>
        </div>

        <dl className="details">
          {details(garment).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        {matches.length > 0 && (
          <div className="stack-sm">
            <h3>Goes well with</h3>
            <ul className="thumb-row">
              {matches.map((m) => (
                <li key={m.garment.id}>
                  <button type="button" className="thumb" onClick={() => onOpen(m.garment.id)} aria-label={pieceLabel(m.garment)}>
                    <PieceImage garment={m.garment} kind="thumb" className="thumb-img" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!confirmDelete ? (
          <button type="button" className="btn danger-ghost" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={18} aria-hidden="true" /> Delete from closet
          </button>
        ) : (
          <div className="confirm" role="alert">
            <p>Delete {name}? This removes it and its photo from this phone.</p>
            <div className="row-actions">
              <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
              <button type="button" className="btn danger" disabled={busy} onClick={() => run(() => deleteGarment(garment.id), 'Deleted')}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
