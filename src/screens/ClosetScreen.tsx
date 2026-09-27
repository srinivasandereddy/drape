import { Keyboard, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PieceImage } from '../components/PieceImage'
import { CLOSET_FILTERS } from '../lib/catalog'
import { useToast } from '../components/toastContext'
import { reload, setStatusMany, useCloset } from '../lib/closet'
import { displayName, inCloset, STATUS_LABELS, type Garment } from '../lib/model'
import { prefs } from '../lib/platform'
import { useProfile } from '../lib/profile'
import { loadSampleWardrobe } from '../lib/sampleLoader'

type Where = 'closet' | 'laundry' | 'away' | 'wishlist' | 'retired'
const WHERE: readonly Where[] = ['closet', 'laundry', 'away', 'wishlist', 'retired']
const WHERE_LABELS: Record<Where, string> = { closet: 'My closet', laundry: 'In the wash', away: 'Lent / tailor', wishlist: 'Wishlist', retired: 'Donated / sold' }
const WHERE_TEST: Record<Where, (g: Garment) => boolean> = {
  closet: inCloset,
  laundry: (g) => g.status === 'laundry',
  away: (g) => g.status === 'lent' || g.status === 'tailor',
  wishlist: (g) => g.status === 'wishlist',
  retired: (g) => g.status === 'retired',
}

type Props = { onOpen: (id: string) => void; onAdd: () => void; onQuickAdd: () => void }

export function ClosetScreen({ onOpen, onAdd, onQuickAdd }: Props) {
  const closet = useCloset()
  const toast = useToast()
  const { profile } = useProfile()
  const [busy, setBusy] = useState(false)
  const samples = closet.garments.filter((g) => g.source === 'sample').length

  async function trySample() {
    setBusy(true)
    try {
      const n = await loadSampleWardrobe(profile.gender.kind)
      toast(`Added ${n} sample pieces`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add the samples.', 'error')
    } finally {
      setBusy(false)
    }
  }
  const [filterId, setFilterId] = useState(() => {
    const saved = prefs.get('closetFilter')
    return CLOSET_FILTERS.some((f) => f.id === saved) ? saved! : 'all'
  })
  const filter = CLOSET_FILTERS.find((f) => f.id === filterId) ?? CLOSET_FILTERS[0]!

  const [where, setWhere] = useState<Where>('closet')
  const counts = useMemo(() => {
    const c: Record<Where, number> = { closet: 0, laundry: 0, away: 0, wishlist: 0, retired: 0 }
    for (const g of closet.garments) for (const w of WHERE) if (WHERE_TEST[w](g)) c[w]++
    return c
  }, [closet.garments])
  const visible = useMemo(
    () => closet.garments.filter((g) => WHERE_TEST[where](g) && (!filter.categories || filter.categories.includes(g.category))),
    [closet.garments, filter, where],
  )
  const owned = counts.closet

  const choose = (id: string) => {
    setFilterId(id)
    prefs.set('closetFilter', id)
  }

  return (
    <section className="screen" aria-labelledby="closet-title">
      <div className="screen-head">
        <h1 id="closet-title">Closet</h1>
        <p className="muted">
          {closet.status === 'loading' ? 'Loading…' : `${owned} piece${owned === 1 ? '' : 's'}`}
          {counts.laundry > 0 && ` · ${counts.laundry} in the wash`}
          {samples > 0 && ` · ${samples} sample${samples === 1 ? '' : 's'}`}
        </p>
        {closet.garments.length > 0 && (
          <button type="button" className="link small" onClick={onQuickAdd}>
            <Keyboard size={14} aria-hidden="true" /> Type a list of pieces
          </button>
        )}
      </div>

      {closet.status === 'error' && (
        <div className="notice error" role="alert">
          <p>{closet.message}</p>
          <button type="button" className="btn small" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      )}

      {closet.garments.length > 0 && (counts.laundry + counts.away + counts.wishlist + counts.retired > 0 || where !== 'closet') && (
        <div className="filter-row" role="toolbar" aria-label="Where the pieces are">
          {WHERE.filter((w) => w === 'closet' || counts[w] > 0 || w === where).map((w) => (
            <button key={w} type="button" className={w === where ? 'chip on' : 'chip'} aria-pressed={w === where} onClick={() => setWhere(w)}>
              {WHERE_LABELS[w]}
              {w !== 'closet' && <span className="mono"> {counts[w]}</span>}
            </button>
          ))}
        </div>
      )}

      {where === 'laundry' && counts.laundry > 0 && (
        <button type="button" className="btn" onClick={() => void setStatusMany(closet.garments.filter((g) => g.status === 'laundry').map((g) => g.id), 'available')}>
          Everything is back from the wash
        </button>
      )}

      {closet.garments.length > 0 && (
        <div className="filter-row" role="toolbar" aria-label="Filter closet">
          {CLOSET_FILTERS.map((f) => (
            <button key={f.id} type="button" className={f.id === filterId ? 'chip on' : 'chip'} aria-pressed={f.id === filterId} onClick={() => choose(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {closet.status === 'ready' && closet.garments.length === 0 && (
        <div className="empty">
          <h2>Your closet is empty</h2>
          <p className="muted">Start with what you wear most: a few tops, bottoms and one pair of shoes. Photos give the best colors; typing a list is fastest.</p>
          <div className="row-actions">
            <button type="button" className="btn primary" onClick={onAdd}>
              <Plus size={18} aria-hidden="true" /> Add a photo
            </button>
            <button type="button" className="btn" onClick={onQuickAdd}>
              <Keyboard size={18} aria-hidden="true" /> Type a list
            </button>
          </div>
          <button type="button" className="btn" disabled={busy} onClick={() => void trySample()}>
            Try a sample wardrobe
          </button>
        </div>
      )}

      {closet.garments.length > 0 && visible.length === 0 && (
        <p className="empty muted">Nothing in {filter.label} yet.</p>
      )}

      {visible.length > 0 && (
        <ul className="grid" aria-label={`${filter.label} pieces`}>
          {visible.map((g) => (
            <li key={g.id}>
              <button type="button" className="tile" onClick={() => onOpen(g.id)}>
                <span className="tile-frame">
                  <PieceImage garment={g} kind="thumb" className="tile-img" />
                  {g.status !== 'available' && <span className={`tile-badge ${g.status}`}>{STATUS_LABELS[g.status]}</span>}
                </span>
                <span className="tile-name">{displayName(g)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
