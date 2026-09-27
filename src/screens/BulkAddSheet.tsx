import { Images, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import { CATEGORIES, categoryDef, defaultFormality, type CategoryId } from '../lib/catalog'
import { addGarment } from '../lib/closet'
import { extractColorsFromBlob } from '../lib/color'
import { cutOut } from '../lib/cutout'
import { processPhoto, type ProcessedPhoto } from '../lib/image'
import { emptyDraft, sanitizeDraft, type GarmentDraft } from '../lib/model'

const MAX = 30

type Item = {
  key: string
  name: string
  status: 'waiting' | 'working' | 'ready' | 'failed'
  photo?: ProcessedPhoto
  url?: string
  bgRemoved: boolean
  draft: GarmentDraft
  guessed: boolean
  error?: string
}

/** Add many pieces at once: each photo is shrunk, cut out, color-read and its type guessed. */
export function BulkAddSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [saving, setSaving] = useState(false)
  const files = useRef(new Map<string, File>())
  const working = useRef(false)

  // Free preview images when the sheet closes.
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  })
  useEffect(() => () => itemsRef.current.forEach((i) => i.url && URL.revokeObjectURL(i.url)), [])

  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  // Process one photo at a time: phones have limited memory for images.
  const queue = useRef<string[]>([])
  const open = useRef(true)
  useEffect(() => {
    open.current = true
    return () => {
      open.current = false
    }
  }, [])
  async function runQueue() {
    if (working.current) return
    working.current = true
    while (open.current && queue.current.length) {
      const key = queue.current.shift()!
      const file = files.current.get(key)
      if (!file) continue // removed before its turn
      update(key, { status: 'working' })
      try {
        const original = await processPhoto(file)
        const cut = await cutOut(original.full).catch(() => null)
        const photo = cut ? { full: cut.full, thumb: cut.thumb, width: cut.width, height: cut.height } : original
        const colors = await extractColorsFromBlob(photo.thumb).catch(() => [])
        const g = cut?.guess
        const draft = sanitizeDraft({
          ...emptyDraft(),
          category: g ? g.category : null,
          subtype: g?.subtype ?? '',
          formality: defaultFormality(g?.subtype ?? ''),
          colors,
        })
        if (open.current) update(key, { status: 'ready', photo, url: URL.createObjectURL(photo.thumb), bgRemoved: !!cut, draft, guessed: !!g })
      } catch (e) {
        update(key, { status: 'failed', error: e instanceof Error ? e.message : 'Could not read this photo.' })
      } finally {
        files.current.delete(key)
      }
    }
    working.current = false
  }

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const picked = [...(e.target.files ?? [])].slice(0, MAX - items.length)
    e.target.value = ''
    const added: Item[] = picked.map((f, i) => {
      const key = `${Date.now()}-${i}-${f.name}`
      files.current.set(key, f)
      return { key, name: f.name, status: 'waiting', bgRemoved: false, draft: emptyDraft(), guessed: false }
    })
    setItems((l) => [...l, ...added])
    queue.current.push(...added.map((a) => a.key))
    void runQueue()
    if (picked.length < (e.target.files?.length ?? 0)) toast(`Up to ${MAX} photos at a time.`)
  }

  const ready = items.filter((i) => i.status === 'ready' && i.draft.category)
  const busy = items.some((i) => i.status === 'waiting' || i.status === 'working')
  const needsType = items.filter((i) => i.status === 'ready' && !i.draft.category).length

  async function saveAll() {
    setSaving(true)
    let n = 0
    try {
      for (const i of ready) {
        await addGarment(i.draft, i.photo!, { bgRemoved: i.bgRemoved })
        n++
      }
      toast(`Added ${n} piece${n === 1 ? '' : 's'} to your closet`)
      onClose()
    } catch (e) {
      toast(`${n} saved; then: ${e instanceof Error ? e.message : 'something went wrong'}`, 'error')
      setSaving(false)
    }
  }

  return (
    <Sheet
      title="Add many photos"
      onClose={onClose}
      footer={
        items.length > 0 && (
          <button type="button" className="btn primary block" disabled={saving || busy || ready.length === 0} onClick={() => void saveAll()}>
            {saving ? 'Saving…' : busy ? `Preparing ${items.filter((i) => i.status === 'ready' || i.status === 'failed').length + 1} of ${items.length}…` : `Add ${ready.length} piece${ready.length === 1 ? '' : 's'}`}
          </button>
        )
      }
    >
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      <div className="stack">
        <p className="muted">Pick photos of single pieces on a plain background. Drape removes each background, reads the colors and guesses the type. Check the types, then add them all.</p>
        {items.length < MAX && (
          <button type="button" className="big-pick" onClick={() => input.current?.click()} disabled={saving}>
            <Images size={28} aria-hidden="true" />
            <span>{items.length ? 'Add more photos' : 'Choose photos'}</span>
          </button>
        )}
        {needsType > 0 && !busy && <p className="small">Choose a type for the {needsType} piece{needsType === 1 ? '' : 's'} Drape couldn't guess.</p>}
        <ul className="bulk-list">
          {items.map((i) => (
            <li key={i.key} className={`bulk-row ${i.status}`}>
              <span className="bulk-img checker">{i.url ? <img src={i.url} alt="" /> : <span className="muted small">{i.status === 'failed' ? '!' : '…'}</span>}</span>
              <div className="bulk-body">
                {i.status === 'failed' ? (
                  <p className="error-text">{i.error}</p>
                ) : i.status !== 'ready' ? (
                  <p className="muted small">{i.status === 'working' ? 'Removing background…' : 'Waiting…'}</p>
                ) : (
                  <>
                    <select
                      className="text-input small-select"
                      aria-label="Type"
                      value={i.draft.category ?? ''}
                      onChange={(e) =>
                        update(i.key, { draft: sanitizeDraft({ ...i.draft, category: (e.target.value || null) as CategoryId | null }), guessed: false })
                      }
                    >
                      <option value="">Choose type…</option>
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    {i.draft.category && (
                      <select
                        className="text-input small-select"
                        aria-label="Kind"
                        value={i.draft.subtype}
                        onChange={(e) => update(i.key, { draft: sanitizeDraft({ ...i.draft, subtype: e.target.value, formality: defaultFormality(e.target.value) }) })}
                      >
                        <option value="">Any</option>
                        {categoryDef(i.draft.category).subtypes.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    )}
                    <span className="bulk-colors">
                      {i.draft.colors.map((c) => (
                        <i key={c.hex} className="swatch" style={{ background: c.hex }} />
                      ))}
                      {i.guessed && <span className="muted small">guessed</span>}
                      {!i.bgRemoved && <span className="muted small">background kept</span>}
                    </span>
                  </>
                )}
              </div>
              <button type="button" className="icon-btn" aria-label="Remove" onClick={() => {
                  files.current.delete(i.key)
                  setItems((l) => l.filter((x) => x.key !== i.key))
                }} disabled={i.status === 'working'}>
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  )
}
