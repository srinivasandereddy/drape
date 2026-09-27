import { CalendarDays, Palette, Plus, Sparkles, Sun, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Sun,
    title: 'Today',
    body: 'An outfit picked for today’s weather, where you’re going and your own coloring. Tap ⓘ on the score to see why. Love it or say what’s wrong, and Drape learns.',
  },
  {
    icon: Plus,
    title: 'Add your clothes',
    body: 'Snap a piece on a plain background and Drape cuts it out, reads its colors and guesses its type. You can add many photos at once, or paste a shop link.',
  },
  {
    icon: Palette,
    title: 'Insights',
    body: 'What you wear most, what you forget, and cost per wear once you add prices. Mark pieces as in the wash or lent, and suggestions skip them.',
  },
  {
    icon: CalendarDays,
    title: 'Plans',
    body: 'A calendar of what you wore, outfits planned ahead, packing lists for trips, and looks for Diwali, weddings, interviews and other events.',
  },
  {
    icon: Sparkles,
    title: 'Ask Drape',
    body: 'Type things like “something for a beach wedding” or “pack for Goa, 4 days”. Your closet and photos stay on your phone and in your own Google Drive.',
  },
]

/** A short tour shown once, after the profile is set up. */
export function Tour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const next = useRef<HTMLButtonElement>(null)
  useEffect(() => next.current?.focus(), [i])
  const step = STEPS[i]!
  const Icon = step.icon
  const last = i === STEPS.length - 1
  return (
    <div className="tour-backdrop" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-card stack">
        <span className="tour-icon" aria-hidden="true">
          <Icon size={28} />
        </span>
        <p className="muted small mono">
          {i + 1} of {STEPS.length}
        </p>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="row-actions">
          {!last && (
            <button type="button" className="btn" onClick={onDone}>
              Skip
            </button>
          )}
          <button ref={next} type="button" className="btn primary" onClick={() => (last ? onDone() : setI(i + 1))}>
            {last ? 'Start' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
