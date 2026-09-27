import type { Garment } from '../lib/model'
import { pieceLabel } from '../lib/outfit'
import { PieceImage } from './PieceImage'

/** A horizontal row of small piece images; tapping one opens it. */
export function ThumbRow({ garments, onOpen }: { garments: Garment[]; onOpen: (id: string) => void }) {
  return (
    <ul className="thumb-row">
      {garments.map((g) => (
        <li key={g.id}>
          <button type="button" className="thumb" onClick={() => onOpen(g.id)} aria-label={pieceLabel(g)}>
            <PieceImage garment={g} kind="thumb" className="thumb-img" />
          </button>
        </li>
      ))}
    </ul>
  )
}
