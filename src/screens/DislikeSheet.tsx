import { useId, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { DISLIKE_REASONS, type DislikeReason } from '../lib/feedback'

type Props = { onPick: (reason: DislikeReason, note: string) => void; onClose: () => void; hasHeels: boolean }

/** "Don't like" asks why, then Drape adjusts today's ideas and remembers the answer. */
export function DislikeSheet({ onPick, onClose, hasHeels }: Props) {
  const noteId = useId()
  const [other, setOther] = useState(false)
  const [note, setNote] = useState('')
  const reasons = DISLIKE_REASONS.filter((r) => r.id !== 'no-heels' || hasHeels)
  return (
    <Sheet title="What's not working?" onClose={onClose}>
      <div className="stack">
        <p className="muted small">Drape will show a new idea straight away and remember this for next time.</p>
        <div className="reason-list">
          {reasons.map((r) =>
            r.id === 'other' ? (
              <button key={r.id} type="button" className="reason" aria-expanded={other} onClick={() => setOther(true)}>
                {r.label}
              </button>
            ) : (
              <button key={r.id} type="button" className="reason" onClick={() => onPick(r.id, '')}>
                {r.label}
              </button>
            ),
          )}
        </div>
        {other && (
          <div className="stack-sm">
            <label className="field-label" htmlFor={noteId}>
              Tell Drape more <span className="field-hint">· optional</span>
            </label>
            <input id={noteId} className="text-input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            <button type="button" className="btn primary" onClick={() => onPick('other', note)}>
              Show something else
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
