import { Camera, CalendarCheck, ExternalLink, Pencil, Scissors, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { ColorSwatches } from '../components/ColorSwatches'
import { GarmentForm } from '../components/GarmentForm'
import { PieceImage } from '../components/PieceImage'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import { FABRIC_LABELS, FORMALITY_LABELS, METAL_LABELS, PATTERN_LABELS, SEASON_LABELS, WARMTH_LABELS, categoryDef } from '../lib/catalog'
import { deleteGarment, editGarment, getPhoto, setGarmentPhoto, setPrice, setStatus, useCloset, wearGarment } from '../lib/closet'
import { cutOut } from '../lib/cutout'
import { extractColorsFromBlob } from '../lib/color'
import { PhotoError, processPhoto } from '../lib/image'
import { styleDef } from '../lib/styles'
import { displayName, draftFromGarment, STATUS_LABELS, validateDraft, type Garment, type GarmentDraft, type GarmentStatus } from '../lib/model'
import { money, useProfile } from '../lib/profile'
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
  if (g.link) rows.push(['Bought from', new URL(g.link).hostname.replace(/^www\d?\./, '')])
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

  async function removeBackground() {
    if (!garment) return
    await run(async () => {
      const stored = await getPhoto(garment.id)
      if (!stored) throw new Error('This photo is not on this phone yet. Try again after syncing.')
      const cut = await cutOut(stored.full)
      if (!cut) throw new Error("Couldn't separate the piece from its background. A photo on a plain bed, floor or wall works best.")
      const photo = { full: cut.full, thumb: cut.thumb, width: cut.width, height: cut.height }
      const colors = await extractColorsFromBlob(cut.thumb).catch(() => [])
      await setGarmentPhoto(garment.id, photo, colors, true)
    }, 'Background removed')
  }

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
        {garment.photo && !garment.bgRemoved && (
          <button type="button" className="btn" disabled={busy} onClick={() => void removeBackground()}>
            <Scissors size={18} aria-hidden="true" /> {busy ? 'Working…' : 'Remove background'}
          </button>
        )}
        {garment.link && (
          <a className="btn" href={garment.link} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={18} aria-hidden="true" /> View in the shop
          </a>
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

        <div className="field" role="group" aria-label="Where is it?">
          <div className="field-label">Where is it?</div>
          <div className="chips">
            {(garment.status === 'wishlist' ? (['wishlist', 'available'] as GarmentStatus[]) : (['available', 'laundry', 'lent', 'tailor', 'retired'] as GarmentStatus[])).map((st) => (
              <button
                key={st}
                type="button"
                className={garment.status === st ? 'chip on' : 'chip'}
                aria-pressed={garment.status === st}
                disabled={busy}
                onClick={() => void run(() => setStatus(garment.id, st), st === 'available' ? (garment.status === 'wishlist' ? 'Added to your closet' : 'Back in your closet') : STATUS_LABELS[st])}
              >
                {st === 'available' && garment.status === 'wishlist' ? 'I bought it' : STATUS_LABELS[st]}
              </button>
            ))}
          </div>
          {garment.status !== 'available' && garment.status !== 'wishlist' && <p className="muted small">Drape won't suggest it until it's back in your closet.</p>}
        </div>

        <PriceField garment={garment} onSave={(price) => void run(() => setPrice(garment.id, price), 'Price saved')} />

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

/** Price paid, and what each wear has cost so far. */
function PriceField({ garment, onSave }: { garment: Garment; onSave: (price: number | null) => void }) {
  const { profile } = useProfile()
  const [value, setValue] = useState(garment.price === null ? '' : String(garment.price))
  const cpw = garment.price !== null ? garment.price / Math.max(1, garment.wornCount) : null
  const commit = () => {
    const n = value.trim() === '' ? null : Number(value)
    if (n !== null && (!Number.isFinite(n) || n < 0)) return
    if (n !== garment.price) onSave(n)
  }
  return (
    <div className="field">
      <label className="field-label" htmlFor={`price-${garment.id}`}>
        Price paid <span className="field-hint">· optional, for cost per wear</span>
      </label>
      <input id={`price-${garment.id}`} className="text-input" type="number" inputMode="numeric" min={0} value={value} onChange={(e) => setValue(e.target.value)} onBlur={commit} />
      {cpw !== null && (
        <p className="muted small">
          Cost per wear: <b>{money(profile, cpw)}</b>
          {garment.wornCount === 0 ? ' (not worn yet)' : ` over ${garment.wornCount} wear${garment.wornCount === 1 ? '' : 's'}`}
        </p>
      )}
    </div>
  )
}
