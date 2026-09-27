import { AlertCircle } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { PieceImage } from '../components/PieceImage'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import { CATEGORIES, type CategoryId } from '../lib/catalog'
import { addGarments } from '../lib/closet'
import { createGarment, sanitizeDraft } from '../lib/model'
import { parseList, type ParsedItem } from '../lib/parser'

const SECTIONS: { hint: CategoryId; label: string; placeholder: string }[] = [
  { hint: 'top', label: 'Tops', placeholder: 'White cotton tee, Navy linen shirt' },
  { hint: 'bottom', label: 'Bottoms', placeholder: 'Blue jeans, Black midi skirt' },
  { hint: 'outerwear', label: 'Outerwear', placeholder: 'Denim jacket, Camel trench coat' },
  { hint: 'dress', label: 'Dresses and ethnic wear', placeholder: 'Floral sundress, Maroon silk saree' },
  { hint: 'footwear', label: 'Footwear', placeholder: 'White Nike Air Force, Black leather loafers, Strappy sandals' },
  { hint: 'jewellery', label: 'Jewellery', placeholder: 'Gold hoop earrings, Pearl necklace, Vintage watch' },
  { hint: 'accessory', label: 'Bags and accessories', placeholder: 'Leather crossbody bag, Prada sunglasses, Sony headphones' },
]

/** Add pieces by typing lists. Drape works out the type, color, metal and fabric. */
export function QuickAddSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const baseId = useId()
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [fixes, setFixes] = useState<Record<string, CategoryId>>({})
  const [saving, setSaving] = useState(false)

  const items = useMemo(() => {
    const out: { key: string; item: ParsedItem }[] = []
    for (const s of SECTIONS) parseList(texts[s.hint] ?? '', s.hint === 'dress' ? undefined : s.hint).forEach((item, i) => out.push({ key: `${s.hint}-${i}-${item.text}`, item }))
    return out
  }, [texts])

  const resolved = items.map(({ key, item }) => {
    const fix = fixes[key]
    return { key, item, draft: fix ? sanitizeDraft({ ...item.draft, category: fix }) : item.draft }
  })
  const unknown = resolved.filter((r) => !r.draft.category)
  const ready = resolved.filter((r) => r.draft.category)

  async function save() {
    if (saving || ready.length === 0) return
    setSaving(true)
    try {
      await addGarments(
        ready.map((r) => r.draft),
        'text',
      )
      toast(`Added ${ready.length} piece${ready.length === 1 ? '' : 's'} to your closet`)
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save. Try again.', 'error')
      setSaving(false)
    }
  }

  return (
    <Sheet
      title="Type your wardrobe"
      onClose={onClose}
      footer={
        <button type="button" className="btn primary block" disabled={saving || ready.length === 0} onClick={() => void save()}>
          {saving ? 'Saving…' : ready.length ? `Add ${ready.length} piece${ready.length === 1 ? '' : 's'}` : 'Type something to add'}
        </button>
      }
    >
      <div className="stack">
        <p className="muted">Separate pieces with commas or new lines. Mention colors, fabrics and metals ("gold hoops", "linen shirt") and Drape picks them up. You can add photos later.</p>
        {SECTIONS.map((s, i) => (
          <div className="field" key={s.hint}>
            <label className="field-label" htmlFor={`${baseId}-${i}`}>
              {s.label}
            </label>
            <textarea
              id={`${baseId}-${i}`}
              className="text-input textarea"
              rows={2}
              placeholder={s.placeholder}
              value={texts[s.hint] ?? ''}
              onChange={(e) => setTexts((t) => ({ ...t, [s.hint]: e.target.value }))}
            />
          </div>
        ))}

        {unknown.length > 0 && (
          <div className="card stack-sm">
            <h3>
              <AlertCircle size={16} aria-hidden="true" /> What are these?
            </h3>
            {unknown.map((r) => (
              <div key={r.key} className="kv">
                <span>{r.item.text}</span>
                <select
                  className="text-input small-select"
                  aria-label={`Type of ${r.item.text}`}
                  value=""
                  onChange={(e) => setFixes((f) => ({ ...f, [r.key]: e.target.value as CategoryId }))}
                >
                  <option value="">Choose…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {ready.length > 0 && (
          <div className="stack-sm">
            <h3>Preview</h3>
            <ul className="preview-list">
              {ready.map((r) => {
                const preview = createGarment(r.draft, null, new Date(), '00000000000000000000000000', 'text')
                return (
                  <li key={r.key}>
                    <PieceImage garment={preview} kind="thumb" className="preview-img" />
                    <span>
                      <b>{r.item.text}</b>
                      <span className="muted small">
                        {' '}
                        · {CATEGORIES.find((c) => c.id === r.draft.category)?.label}
                        {r.draft.subtype && ` · ${r.draft.subtype}`}
                        {r.draft.metal && ` · ${r.draft.metal.replace('-', ' ')}`}
                        {r.draft.fabric && ` · ${r.draft.fabric}`}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  )
}
