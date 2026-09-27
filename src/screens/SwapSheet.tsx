import { Minus } from 'lucide-react'
import { PieceImage } from '../components/PieceImage'
import { Sheet } from '../components/Sheet'
import type { Garment } from '../lib/model'
import { alternatives, pieceLabel, scoreOutfit, slotOf, type Outfit, type OutfitContext } from '../lib/outfit'

const OPTIONAL = new Set(['layer', 'bag', 'jewellery', 'accessory'])

type Props = {
  outfit: Outfit
  piece: Garment
  garments: Garment[]
  ctx: OutfitContext
  onPick: (outfit: Outfit) => void
  onClose: () => void
}

/** Replace one piece of today's outfit with another from the closet. */
export function SwapSheet({ outfit, piece, garments, ctx, onPick, onClose }: Props) {
  const options = alternatives(outfit, piece, garments, ctx)
  const optional = OPTIONAL.has(slotOf(piece))
  const without = optional ? scoreOutfit(outfit.pieces.filter((p) => p.id !== piece.id), ctx) : null
  const delta = (o: Outfit) => o.score - outfit.score

  return (
    <Sheet title={`Swap the ${pieceLabel(piece).toLowerCase()}`} onClose={onClose}>
      <div className="stack">
        <p className="muted small">Scores show how the whole outfit changes with each option.</p>
        {options.length === 0 && !without && <p className="muted">Nothing else in your closet can take its place yet.</p>}
        <ul className="swap-list">
          {options.map((o) => {
            const replacement = o.pieces.find((p) => !outfit.pieces.some((q) => q.id === p.id))!
            const d = delta(o)
            return (
              <li key={replacement.id}>
                <button type="button" className="swap-row" onClick={() => onPick(o)}>
                  <PieceImage garment={replacement} kind="thumb" className="swap-img" />
                  <span className="swap-name">{pieceLabel(replacement)}</span>
                  <span className={`mono ${d > 0 ? 'good-text' : d < 0 ? 'muted' : ''}`}>
                    {o.score}
                    {d !== 0 && ` (${d > 0 ? '+' : ''}${d})`}
                  </span>
                </button>
              </li>
            )
          })}
          {without && (
            <li>
              <button type="button" className="swap-row" onClick={() => onPick(without)}>
                <span className="swap-img swap-none" aria-hidden="true">
                  <Minus size={20} />
                </span>
                <span className="swap-name">Leave it out</span>
                <span className="mono muted">{without.score}</span>
              </button>
            </li>
          )}
        </ul>
      </div>
    </Sheet>
  )
}
