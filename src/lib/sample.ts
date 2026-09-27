// Sample wardrobes so a new person can try Drape at once. Every sample piece is
// marked `source: 'sample'` and can be removed in one tap from Settings.

import type { CategoryId } from './catalog'

type Section = { hint: CategoryId; items: string }

const SHARED: Section[] = [
  { hint: 'top', items: 'White cotton t-shirt, Navy linen shirt, Black t-shirt, Grey hoodie' },
  { hint: 'bottom', items: 'Blue jeans, Beige chinos, Black trousers' },
  { hint: 'outerwear', items: 'Navy blazer, Denim jacket' },
  { hint: 'footwear', items: 'White sneakers, Brown leather loafers' },
  { hint: 'accessory', items: 'Black sunglasses, Brown leather belt' },
  { hint: 'bag', items: 'Black backpack' },
]

const FEMININE: Section[] = [
  { hint: 'top', items: 'Pink blouse, Cream knit sweater' },
  { hint: 'bottom', items: 'Black midi skirt' },
  { hint: 'dress', items: 'Floral sundress, Black cocktail dress' },
  { hint: 'ethnic', items: 'Mustard cotton kurti, Maroon silk saree' },
  { hint: 'footwear', items: 'Nude block heels, Gold kolhapuris' },
  { hint: 'jewellery', items: 'Gold hoop earrings, Pearl necklace, Gold bangles, Silver watch' },
  { hint: 'bag', items: 'Tan leather tote, Gold clutch' },
]

const MASCULINE: Section[] = [
  { hint: 'top', items: 'Olive polo, Light blue oxford shirt' },
  { hint: 'bottom', items: 'Grey joggers' },
  { hint: 'ethnic', items: 'White cotton kurta, Maroon nehru jacket' },
  { hint: 'footwear', items: 'Black formal shoes, Brown sandals' },
  { hint: 'jewellery', items: 'Silver watch, Silver ring' },
  { hint: 'accessory', items: 'Navy tie' },
  { hint: 'bag', items: 'Brown leather laptop bag' },
]

/** Picks a sample set; "other" or unknown gets a mix of both. */
export function sampleSections(gender: 'female' | 'male' | 'other' | null): Section[] {
  if (gender === 'female') return [...SHARED, ...FEMININE]
  if (gender === 'male') return [...SHARED, ...MASCULINE]
  return [...SHARED, ...FEMININE.slice(0, 4), ...MASCULINE.slice(0, 3)]
}
