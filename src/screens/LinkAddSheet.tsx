import { Heart, Images, Link2, ShoppingBag } from 'lucide-react'
import { useId, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { GarmentForm } from '../components/GarmentForm'
import { PhotoPreview } from '../components/PhotoPreview'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import { adviseOnPurchase } from '../lib/advisor'
import { addGarment, addGarments, useCloset } from '../lib/closet'
import { ThumbRow } from '../components/ThumbRow'
import { extractColorsFromBlob } from '../lib/color'
import { createGarment, emptyDraft, validateDraft, type GarmentDraft } from '../lib/model'
import { money, personalPrefs, useProfile } from '../lib/profile'
import { readProductLink } from '../lib/productLink'
import { usePreparedPhoto } from '../lib/usePreparedPhoto'

export type SharedLink = { url?: string; text?: string; title?: string }

/** Add a piece you bought online by pasting (or sharing) its product link. */
export function LinkAddSheet({ onClose, shared }: { onClose: () => void; shared?: SharedLink }) {
  const toast = useToast()
  const inputId = useId()
  const gallery = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(() => [shared?.text, shared?.url].filter(Boolean).join(' ').trim())
  const title = shared?.title ?? ''
  const parsed = useMemo(() => readProductLink(text, title), [text, title])
  const [draft, setDraft] = useState<GarmentDraft | null>(() => (parsed ? parsed.item.draft : null))
  const [forUrl, setForUrl] = useState<string | null>(parsed?.url ?? null)
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [price, setPrice] = useState('')
  const { garments } = useCloset()
  const { profile } = useProfile()

  // A new link replaces the guess (the person's own edits are kept only for the same link).
  if (parsed && parsed.url !== forUrl) {
    setForUrl(parsed.url)
    setDraft(parsed.item.draft)
  }

  const photo = usePreparedPhoto((chosen) => {
    void extractColorsFromBlob(chosen.thumb).then((colors) => {
      if (colors.length) setDraft((d) => (d && !d.colorsEdited ? { ...d, colors } : d))
    })
  })

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void photo.prepare(file)
  }

  const current = draft ?? emptyDraft()
  const errors = validateDraft(current)
  const priceNum = price.trim() === '' || !Number.isFinite(Number(price)) ? null : Math.max(0, Math.round(Number(price)))
  const advice = useMemo(() => {
    if (!current.category) return null
    const candidate = createGarment(current, null, new Date(), '00000000000000000000000000', 'text')
    return adviseOnPurchase(candidate, garments, { season: personalPrefs(profile).season, budget: profile.budget, price: priceNum })
  }, [current, garments, profile, priceNum])

  async function save(status: 'available' | 'wishlist') {
    if (!parsed || saving) return
    if (errors.length) return setShowErrors(true)
    setSaving(true)
    try {
      const extra = { link: parsed.url, status, price: priceNum }
      if (photo.chosen) await addGarment(current, photo.chosen, { ...extra, bgRemoved: photo.useCut && !!photo.cut })
      else await addGarments([current], 'text', extra)
      toast(status === 'wishlist' ? 'Saved to your wishlist' : 'Added to your closet')
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save. Try again.', 'error')
      setSaving(false)
    }
  }

  return (
    <Sheet
      title="Add from a shop link"
      onClose={onClose}
      footer={
        parsed && (
          <div className="row-actions">
            <button type="button" className="btn" disabled={saving || photo.cutting} onClick={() => void save('wishlist')}>
              <Heart size={18} aria-hidden="true" /> Save to wishlist
            </button>
            <button type="button" className="btn primary" disabled={saving || photo.cutting} onClick={() => void save('available')}>
              <ShoppingBag size={18} aria-hidden="true" /> I bought it
            </button>
          </div>
        )
      }
    >
      <input ref={gallery} type="file" accept="image/*" hidden onChange={onFile} />
      <div className="stack">
        <div className="field">
          <label className="field-label" htmlFor={inputId}>
            Product link
          </label>
          <textarea
            id={inputId}
            className="text-input textarea"
            rows={3}
            placeholder="Paste the link from Myntra, Amazon, AJIO, Flipkart, Zara, H&M…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="muted small">
            In the shop's app, tap Share → Copy link, then paste it here. On Android you can also share straight to Drape. Drape reads the product name from the link itself; it doesn't visit the shop or tell it anything.
          </p>
        </div>

        {text.trim() && !parsed && <p className="error-text">That doesn't look like a web link. It should start with https://</p>}

        {parsed && (
          <>
            <div className="card stack-sm">
              <p className="small">
                <Link2 size={14} aria-hidden="true" /> {parsed.store ?? new URL(parsed.url).hostname}
                {parsed.brand && ` · ${parsed.brand}`}
              </p>
              <p>
                <b>{parsed.title || 'No product name in this link'}</b>
              </p>
              {!parsed.item.recognised && <p className="muted small">Drape couldn't tell what kind of piece this is. Choose it below.</p>}
            </div>

            {photo.chosen ? (
              <PhotoPreview p={photo} onChange={() => gallery.current?.click()} />
            ) : (
              <button type="button" className="big-pick" onClick={() => gallery.current?.click()} disabled={photo.processing}>
                <Images size={24} aria-hidden="true" />
                <span>
                  Add the product photo (optional)
                  <span className="big-pick-hint">A screenshot from the shop works. Drape removes the background and reads the colors.</span>
                </span>
              </button>
            )}
            {photo.error && <p className="error-text">{photo.error}</p>}

            <div className="field">
              <label className="field-label" htmlFor="link-price">
                Price <span className="field-hint">· optional</span>
              </label>
              <input id="link-price" className="text-input" type="number" inputMode="numeric" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>

            {advice && (
              <div className={`card stack-sm advice ${advice.verdict}`}>
                <h3>{advice.verdict === 'great' ? 'Great buy for your closet' : advice.verdict === 'good' ? 'A reasonable buy' : 'Think it over'}</h3>
                <ul className="why-mini">
                  {advice.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                  {priceNum !== null && advice.newOutfits > 0 && <li>About {money(profile, priceNum / Math.max(1, advice.newOutfits * 3))} per wear if you wear each new outfit three times.</li>}
                </ul>
                {advice.similar.length > 0 && (
                  <>
                    <p className="small">Similar pieces you own:</p>
                    <ThumbRow garments={advice.similar} onOpen={() => {}} />
                  </>
                )}
                {advice.pairsWith.length > 0 && (
                  <>
                    <p className="small">It goes with:</p>
                    <ThumbRow garments={advice.pairsWith.slice(0, 8)} onOpen={() => {}} />
                  </>
                )}
              </div>
            )}

            <GarmentForm draft={current} onChange={setDraft} />
            {showErrors && errors.length > 0 && (
              <ul className="error-text" role="alert">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}
