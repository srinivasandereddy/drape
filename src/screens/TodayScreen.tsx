import { Check, Circle } from 'lucide-react'
import type { CategoryId } from '../lib/catalog'
import { useCloset } from '../lib/closet'

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

// What the outfit engine (milestone 4) needs before it can suggest anything.
const NEEDS: { label: string; categories: CategoryId[]; min: number }[] = [
  { label: 'At least 3 tops, dresses or ethnic pieces', categories: ['top', 'dress', 'ethnic'], min: 3 },
  { label: 'At least 2 bottoms', categories: ['bottom'], min: 2 },
  { label: 'At least 1 pair of footwear', categories: ['footwear'], min: 1 },
]

export function TodayScreen({ onAdd }: { onAdd: () => void }) {
  const { garments } = useCloset()
  const progress = NEEDS.map((n) => ({ ...n, have: garments.filter((g) => n.categories.includes(g.category)).length }))
  const ready = progress.every((p) => p.have >= p.min)

  return (
    <section className="screen" aria-labelledby="today-title">
      <div className="screen-head">
        <p className="muted">{dayFmt.format(new Date())}</p>
        <h1 id="today-title">What to wear today</h1>
      </div>

      <div className="card stack">
        <h2>{ready ? 'Your closet is ready for outfits' : 'Get your closet ready'}</h2>
        <p className="muted">
          Daily outfit suggestions, matched to the weather and your plans, arrive in the next update. Meanwhile, add the basics
          below so Drape has something to work with.
        </p>
        <ul className="checklist">
          {progress.map((p) => {
            const done = p.have >= p.min
            return (
              <li key={p.label} className={done ? 'done' : ''}>
                {done ? <Check size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
                <span>{p.label}</span>
                <span className="mono muted">
                  {Math.min(p.have, p.min)}/{p.min}
                </span>
              </li>
            )
          })}
        </ul>
        {!ready && (
          <button type="button" className="btn primary" onClick={onAdd}>
            Add a piece
          </button>
        )}
      </div>
    </section>
  )
}
