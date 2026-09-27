// Festivals and occasions people dress up for, with the colors, dress code and tips
// that usually suit them. Used by the event planner; dates are the person's own.

import type { OccasionId } from './outfit'
import type { StyleId } from './styles'

export interface EventTemplate {
  id: string
  label: string
  occasion: OccasionId
  /** Added to the occasion's usual dressiness. */
  formalityShift: number
  /** Palette color names that fit the occasion. */
  colors: string[]
  styles: StyleId[]
  tip: string
}

export const EVENT_TEMPLATES: readonly EventTemplate[] = [
  { id: 'diwali', label: 'Diwali', occasion: 'festive', formalityShift: 0.5, colors: ['Maroon', 'Red', 'Mustard', 'Pink', 'Cream'], styles: ['traditional'], tip: 'Rich jewel tones and gold jewellery. Keep flowing dupattas and sleeves clear of the diyas.' },
  { id: 'navratri', label: 'Navratri / Garba', occasion: 'festive', formalityShift: 0, colors: ['Red', 'Orange', 'Yellow', 'Green', 'Pink'], styles: ['traditional'], tip: 'Bright, twirl-friendly outfits and comfortable flat footwear for dancing.' },
  { id: 'eid', label: 'Eid', occasion: 'festive', formalityShift: 0.5, colors: ['White', 'Cream', 'Mint', 'Sky blue', 'Lavender'], styles: ['traditional'], tip: 'Fresh whites and soft pastels; a kurta or a graceful long silhouette.' },
  { id: 'holi', label: 'Holi', occasion: 'casual', formalityShift: -1, colors: ['White'], styles: [], tip: 'Old white clothes you don’t mind staining, and closed shoes.' },
  { id: 'puja', label: 'Puja / temple', occasion: 'festive', formalityShift: 0, colors: ['Cream', 'Yellow', 'Orange', 'Red', 'White'], styles: ['traditional'], tip: 'Covered, comfortable traditional wear; easy footwear to slip off.' },
  { id: 'onam', label: 'Onam', occasion: 'festive', formalityShift: 0, colors: ['Cream', 'Mustard', 'White'], styles: ['traditional'], tip: 'Cream with a gold (kasavu) border is classic.' },
  { id: 'christmas', label: 'Christmas', occasion: 'evening', formalityShift: 0, colors: ['Red', 'Green', 'White', 'Maroon'], styles: [], tip: 'Festive reds and greens; a cosy layer for the evening.' },
  { id: 'new-year', label: 'New Year’s Eve', occasion: 'evening', formalityShift: 0.5, colors: ['Black', 'White', 'Charcoal', 'Navy'], styles: [], tip: 'Go dark and polished; one statement piece or some shine.' },
  { id: 'wedding', label: 'Wedding (guest)', occasion: 'festive', formalityShift: 0.75, colors: ['Maroon', 'Teal', 'Mustard', 'Pink', 'Purple'], styles: ['traditional'], tip: 'Jewel tones work well; avoid the colors the couple is wearing.' },
  { id: 'sangeet', label: 'Sangeet', occasion: 'festive', formalityShift: 0.5, colors: ['Hot pink', 'Purple', 'Teal', 'Orange'], styles: ['traditional'], tip: 'Bright and dance-ready; comfortable footwear.' },
  { id: 'mehendi', label: 'Mehendi', occasion: 'festive', formalityShift: 0, colors: ['Green', 'Yellow', 'Mint', 'Orange'], styles: ['traditional', 'boho'], tip: 'Greens and yellows; short or rolled sleeves keep the henna safe.' },
  { id: 'haldi', label: 'Haldi', occasion: 'festive', formalityShift: -0.5, colors: ['Yellow', 'Mustard', 'White'], styles: ['traditional'], tip: 'Yellow, and clothes you don’t mind getting stained.' },
  { id: 'office-party', label: 'Office party', occasion: 'evening', formalityShift: 0, colors: [], styles: ['smart-casual'], tip: 'Smart but relaxed; one step up from your usual work wear.' },
  { id: 'interview', label: 'Job interview', occasion: 'work', formalityShift: 1, colors: ['Navy', 'White', 'Grey', 'Charcoal', 'Sky blue'], styles: ['minimalist'], tip: 'Clean, well-fitted neutrals; nothing that distracts from you.' },
  { id: 'date', label: 'Date night', occasion: 'evening', formalityShift: 0, colors: [], styles: [], tip: 'Something you feel great in; one favourite color near your face.' },
  { id: 'birthday', label: 'Birthday party', occasion: 'evening', formalityShift: 0, colors: [], styles: [], tip: 'Fun and comfortable; follow any theme the host set.' },
  { id: 'other', label: 'Something else', occasion: 'casual', formalityShift: 0, colors: [], styles: [], tip: '' },
]

export const eventTemplate = (id: string | null) => EVENT_TEMPLATES.find((t) => t.id === id) ?? null
