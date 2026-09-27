import { Sheet } from '../components/Sheet'
import type { Outfit } from '../lib/outfit'

/** Shows how an outfit's score was put together, part by part. */
export function ScoreSheet({ outfit, onClose }: { outfit: Outfit; onClose: () => void }) {
  return (
    <Sheet title={`Score ${outfit.score} of 100`} onClose={onClose}>
      <div className="stack">
        <p className="muted">
          Drape builds every possible outfit from your closet (a top and bottom, or a one-piece, plus shoes), scores each one, and shows the best. Then it adds a layer, bag, jewellery and
          accessories that fit. Here is how this outfit scored.
        </p>
        <ul className="score-parts">
          {outfit.breakdown.map((p) => (
            <li key={p.label}>
              <div className="score-row">
                <b>{p.label}</b>
                <span className="mono">
                  {p.points > 0 && p.label === 'Your feedback' ? '+' : ''}
                  {p.points} / {p.max}
                </span>
              </div>
              <div className="score-track" aria-hidden="true">
                <i className={p.points < 0 ? 'neg' : ''} style={{ width: `${Math.min(100, (Math.abs(p.points) / p.max) * 100)}%` }} />
              </div>
              <p className="muted small">{p.about}</p>
            </li>
          ))}
        </ul>
        <div className="card stack-sm">
          <h3>What changes the result</h3>
          <ul className="insights small">
            <li>Weather, how you feel today and your dosha set the thermal index, which decides fabric weight and whether you need a layer.</li>
            <li>The occasion, your routine and words like "interview" or "gym" set how dressy to go.</li>
            <li>Your styles and today's vibe favor matching pieces and colors.</li>
            <li>Pieces you wore in the last few days rest for a bit.</li>
            <li>Love it and Don't like teach Drape your taste over time.</li>
          </ul>
        </div>
      </div>
    </Sheet>
  )
}
