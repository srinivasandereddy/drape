import { Scissors } from 'lucide-react'
import type { PreparedPhoto } from '../lib/usePreparedPhoto'

/** The prepared photo, with the background-removal result and a way to switch versions. */
export function PhotoPreview({ p, onChange }: { p: PreparedPhoto; onChange?: () => void }) {
  if (!p.chosenUrl) return null
  const showingCut = p.useCut && !!p.cut
  return (
    <div className="stack-sm">
      <div className={showingCut ? 'preview checker' : 'preview'}>
        <img src={p.chosenUrl} alt={showingCut ? 'The piece, with the background removed' : 'The piece you are adding'} />
        {onChange && (
          <button type="button" className="btn small preview-change" onClick={onChange} disabled={p.processing}>
            Change photo
          </button>
        )}
      </div>
      {p.cutting && (
        <p className="muted small" role="status">
          <Scissors size={14} aria-hidden="true" /> Removing the background…
        </p>
      )}
      {p.cut && (
        <div className="seg" role="tablist" aria-label="Photo version">
          <button type="button" role="tab" aria-selected={p.useCut} className={p.useCut ? 'on' : ''} onClick={() => p.setUseCut(true)}>
            Background removed
          </button>
          <button type="button" role="tab" aria-selected={!p.useCut} className={!p.useCut ? 'on' : ''} onClick={() => p.setUseCut(false)}>
            Original
          </button>
        </div>
      )}
      {p.cutFailed && <p className="muted small">Couldn't separate the piece from its background, so the original photo is kept. A plain bed, floor or wall behind it works best.</p>}
    </div>
  )
}
