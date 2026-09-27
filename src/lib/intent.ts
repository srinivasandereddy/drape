// Understands free text like "Dinner date in Paris" or "Office presentation":
// which occasion it is, how dressy, and whether a different place is mentioned.

import type { OccasionId } from './outfit'

export interface Intent {
  occasion: OccasionId | null
  /** Added to the occasion's usual dressiness, e.g. +1 for an interview. */
  formalityShift: number
  /** A place named after "in", "at" or "to", if any, e.g. "Paris". */
  place: string | null
  /** Recognised words, shown back to the person. */
  matched: string[]
  /** Prefer these footwear types, e.g. sneakers for the gym. */
  preferShoes: string[]
}

const RULES: { words: string[]; occasion: OccasionId; shift?: number; shoes?: string[] }[] = [
  { words: ['interview', 'presentation', 'pitch', 'board meeting', 'client meeting', 'court'], occasion: 'work', shift: 1 },
  { words: ['office', 'work', 'meeting', 'conference', 'shift', 'workshop', 'seminar'], occasion: 'work' },
  { words: ['class', 'college', 'school', 'university', 'lecture', 'exam', 'campus'], occasion: 'work' },
  { words: ['wedding', 'reception', 'engagement', 'sangeet', 'mehendi', 'mehndi', 'haldi'], occasion: 'festive', shift: 0.5 },
  { words: ['puja', 'pooja', 'temple', 'diwali', 'eid', 'navratri', 'garba', 'festival', 'holi', 'onam', 'pongal', 'christmas', 'church'], occasion: 'festive' },
  { words: ['gala', 'black tie', 'cocktail', 'award'], occasion: 'evening', shift: 1 },
  { words: ['dinner', 'date', 'party', 'club', 'bar', 'drinks', 'concert', 'night out', 'birthday', 'anniversary'], occasion: 'evening' },
  { words: ['flight', 'airport', 'travel', 'trip', 'train', 'road trip', 'vacation', 'holiday', 'getaway'], occasion: 'travel', shoes: ['Sneakers', 'Loafers'] },
  { words: ['hike', 'trek', 'hiking', 'trekking', 'camping'], occasion: 'active', shift: 0.5, shoes: ['Boots', 'Running shoes', 'Sneakers'] },
  { words: ['gym', 'workout', 'run', 'running', 'jog', 'jogging', 'yoga', 'pilates', 'sports', 'football', 'cricket', 'tennis', 'badminton', 'basketball', 'training', 'swim', 'dance class', 'zumba'], occasion: 'active', shoes: ['Running shoes', 'Sneakers'] },
  { words: ['beach', 'pool', 'picnic', 'park'], occasion: 'casual', shift: -0.5, shoes: ['Sandals', 'Sneakers'] },
  { words: ['brunch', 'coffee', 'cafe', 'shopping', 'mall', 'movie', 'movies', 'errands', 'hangout', 'friends', 'walk', 'market'], occasion: 'casual' },
  { words: ['home', 'lazy', 'chill', 'relax', 'wfh'], occasion: 'casual', shift: -1 },
]

// Words that can follow "in/at/to" but are not places.
const NOT_PLACES = new Set([
  'the', 'a', 'an', 'my', 'our', 'office', 'work', 'college', 'school', 'town', 'city', 'evening', 'morning', 'afternoon',
  'night', 'park', 'mall', 'gym', 'home', 'style', 'person', 'rain', 'sun', 'summer', 'winter', 'monsoon', 'class', 'temple',
])

export function parseIntent(text: string): Intent {
  const raw = text.trim()
  const t = ` ${raw.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').replace(/\s+/g, ' ')} `
  const intent: Intent = { occasion: null, formalityShift: 0, place: null, matched: [], preferShoes: [] }
  for (const rule of RULES) {
    const hit = rule.words.find((w) => t.includes(` ${w} `) || t.includes(` ${w}s `))
    if (!hit) continue
    intent.matched.push(hit)
    if (!intent.occasion) {
      intent.occasion = rule.occasion
      intent.formalityShift = rule.shift ?? 0
      intent.preferShoes = rule.shoes ?? []
    } else if (rule.occasion === intent.occasion && rule.shift && Math.abs(rule.shift) > Math.abs(intent.formalityShift)) {
      intent.formalityShift = rule.shift
    }
  }
  const m = /\b(?:in|at|to)\s+([a-z][a-z\s'.-]{1,40})$/i.exec(raw)
  if (m) {
    const words = m[1]!.trim().split(/\s+/)
    if (words.length <= 3 && !NOT_PLACES.has(words[0]!.toLowerCase())) {
      intent.place = words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ')
    }
  }
  return intent
}
