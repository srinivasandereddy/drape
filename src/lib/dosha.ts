// A 10-question Ayurveda constitution quiz (Vata, Pitta, Kapha), and what each
// result means for clothes. This is traditional guidance for comfort and color,
// not medical advice.

export type DoshaId = 'vata' | 'pitta' | 'kapha'

export interface DoshaQuestion {
  topic: string
  options: readonly [string, string, string] // Vata, Pitta, Kapha
}

/** Options are always ordered Vata, Pitta, Kapha. */
export const DOSHA_QUESTIONS: readonly DoshaQuestion[] = [
  { topic: 'Body frame and weight', options: ['Lean or slender, hard to gain weight', 'Medium build, athletic or muscular', 'Broad or heavier build, gain weight easily'] },
  { topic: 'Natural body temperature', options: ['Hands and feet often cold; dislike wind and cold', 'Naturally warm; sweat easily; dislike heat', 'Adaptable, but dislike cold, damp weather'] },
  { topic: 'Skin', options: ['Dry, thin, cracks easily', 'Warm, reddish, burns or freckles easily', 'Thick, oily, soft and smooth'] },
  { topic: 'Appetite', options: ['Irregular; often skip meals', 'Strong; irritable when hungry', 'Steady and modest; enjoy grazing'] },
  { topic: 'Sleep', options: ['Light, easily disturbed', 'Sound, moderate length', 'Heavy, deep and long'] },
  { topic: 'Under stress you get', options: ['Anxious, worried, restless', 'Irritable, impatient, sharp', 'Calm, slow to react, steady'] },
  { topic: 'Joints and movement', options: ['Stiff joints that crack; quick movements', 'Flexible; precise, medium pace', 'Large, sturdy joints; slow, steady movement'] },
  { topic: 'Drinks you reach for', options: ['Warm or hot drinks', 'Cold or iced drinks; often thirsty', 'Rarely thirsty; enjoy warm tea'] },
  { topic: 'Mind and memory', options: ['Learn fast, forget fast', 'Sharp and focused; strong memory', 'Learn slowly, never forget'] },
  { topic: 'Sweat', options: ['Barely sweat', 'Sweat a lot with little effort', 'Sweat moderately during hard exercise'] },
]

export const DOSHA_ORDER: readonly DoshaId[] = ['vata', 'pitta', 'kapha']

export interface DoshaResult {
  /** Answers as dosha ids, one per question. */
  answers: DoshaId[]
  scores: Record<DoshaId, number>
  primary: DoshaId
  /** Set when the second dosha is within one answer of the first, e.g. Vata-Pitta. */
  secondary: DoshaId | null
  takenAt: string
}

export function scoreDosha(answers: DoshaId[], now: Date = new Date()): DoshaResult {
  if (answers.length !== DOSHA_QUESTIONS.length) throw new Error(`Answer all ${DOSHA_QUESTIONS.length} questions first.`)
  const scores: Record<DoshaId, number> = { vata: 0, pitta: 0, kapha: 0 }
  for (const a of answers) scores[a]++
  const ranked = [...DOSHA_ORDER].sort((a, b) => scores[b] - scores[a] || DOSHA_ORDER.indexOf(a) - DOSHA_ORDER.indexOf(b))
  const [first, second] = ranked as [DoshaId, DoshaId, DoshaId]
  return { answers: [...answers], scores, primary: first, secondary: scores[first] - scores[second] <= 1 && scores[second] > 0 ? second : null, takenAt: now.toISOString() }
}

export interface DoshaGuide {
  label: string
  element: string
  /** How this body tends to feel; shifts the thermal index. */
  tendency: string
  /** +: dress warmer, −: dress cooler. */
  thermalShift: number
  fabrics: readonly string[]
  /** Fabric ids from the catalog that suit it. */
  fabricIds: readonly string[]
  colors: string
  /** Palette names that suit it. */
  colorNames: readonly string[]
  silhouettes: string
  avoid: string
}

export const DOSHA_GUIDE: Record<DoshaId, DoshaGuide> = {
  vata: {
    label: 'Vata',
    element: 'Air and space: cool, dry, light',
    tendency: 'You tend to run cool, so Drape dresses you a little warmer.',
    thermalShift: 0.5,
    fabrics: ['Soft wool and knits', 'Brushed cotton', 'Silk', 'Layers you can add'],
    fabricIds: ['wool', 'knit', 'silk', 'cotton'],
    colors: 'Warm, earthy and grounding: rust, mustard, camel, olive, cream, maroon.',
    colorNames: ['Rust', 'Mustard', 'Camel', 'Olive', 'Cream', 'Maroon', 'Orange', 'Brown', 'Beige'],
    silhouettes: 'Soft, cozy layers; covered neck and wrists on windy days; scarves.',
    avoid: 'Thin, stiff or scratchy fabrics in wind and cold.',
  },
  pitta: {
    label: 'Pitta',
    element: 'Fire and water: warm, sharp, intense',
    tendency: 'You tend to run warm, so Drape dresses you a little lighter.',
    thermalShift: -0.5,
    fabrics: ['Linen', 'Breathable cotton', 'Silk', 'Loose weaves'],
    fabricIds: ['linen', 'cotton', 'silk'],
    colors: 'Cool and soothing: white, sky blue, mint, lavender, navy, soft grey, green.',
    colorNames: ['White', 'Sky blue', 'Mint', 'Lavender', 'Navy', 'Blue', 'Teal', 'Green', 'Light grey', 'Grey'],
    silhouettes: 'Loose, airy cuts that let air move; lighter layers.',
    avoid: 'Heavy synthetics and hot reds or oranges on hot days.',
  },
  kapha: {
    label: 'Kapha',
    element: 'Earth and water: steady, cool, moist',
    tendency: 'You feel damp cold, so Drape adds a little warmth on wet days.',
    thermalShift: 0.25,
    fabrics: ['Linen and light cotton', 'Light wool', 'Structured weaves'],
    fabricIds: ['linen', 'cotton', 'wool'],
    colors: 'Bright and energising: red, orange, yellow, hot pink, teal.',
    colorNames: ['Red', 'Orange', 'Yellow', 'Hot pink', 'Mustard', 'Teal', 'Rust'],
    silhouettes: 'Structured, tailored shapes; light layers rather than heavy ones.',
    avoid: 'Heavy, clingy fabrics and very dull colors.',
  },
}

export function doshaLabel(r: Pick<DoshaResult, 'primary' | 'secondary'>): string {
  return r.secondary ? `${DOSHA_GUIDE[r.primary].label}-${DOSHA_GUIDE[r.secondary].label}` : DOSHA_GUIDE[r.primary].label
}
