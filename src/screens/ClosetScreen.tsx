import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GarmentPhoto } from '../components/GarmentPhoto'
import { CLOSET_FILTERS } from '../lib/catalog'
import { reload, useCloset } from '../lib/closet'
import { displayName } from '../lib/model'
import { prefs } from '../lib/platform'

type Props = { onOpen: (id: string) => void; onAdd: () => void }

export function ClosetScreen({ onOpen, onAdd }: Props) {
  const closet = useCloset()
  const [filterId, setFilterId] = useState(() => {
    const saved = prefs.get('closetFilter')
    return CLOSET_FILTERS.some((f) => f.id === saved) ? saved! : 'all'
  })
  const filter = CLOSET_FILTERS.find((f) => f.id === filterId) ?? CLOSET_FILTERS[0]!

  const visible = useMemo(
    () => (filter.categories ? closet.garments.filter((g) => filter.categories!.includes(g.category)) : closet.garments),
    [closet.garments, filter],
  )

  const choose = (id: string) => {
    setFilterId(id)
    prefs.set('closetFilter', id)
  }

  return (
    <section className="screen" aria-labelledby="closet-title">
      <div className="screen-head">
        <h1 id="closet-title">Closet</h1>
        <p className="muted">
          {closet.status === 'loading' ? 'Loading…' : `${closet.garments.length} piece${closet.garments.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {closet.status === 'error' && (
        <div className="notice error" role="alert">
          <p>{closet.message}</p>
          <button type="button" className="btn small" onClick={() => void reload()}>
            Try again
          </button>
        </div>
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
          <p className="muted">Start with what you wear most: a few tops, bottoms and one pair of shoes.</p>
          <button type="button" className="btn primary" onClick={onAdd}>
            <Plus size={18} aria-hidden="true" /> Add your first piece
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
                <GarmentPhoto id={g.id} kind="thumb" alt="" className="tile-img" />
                <span className="tile-name">{displayName(g)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
