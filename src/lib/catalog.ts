// The fixed vocabulary Drape uses to describe clothes. Stored values (ids) must
// never be renamed once released, because saved garments and synced files use
// them. Labels can change freely.

export type CategoryId =
  | 'top'
  | 'bottom'
  | 'outerwear'
  | 'dress'
  | 'ethnic'
  | 'footwear'
  | 'jewellery'
  | 'bag'
  | 'accessory'

export type Formality = 1 | 2 | 3 | 4
export type Warmth = 1 | 2 | 3
export type Pattern = 'solid' | 'striped' | 'checked' | 'printed' | 'floral' | 'embroidered' | 'other'
export type Season = 'summer' | 'monsoon' | 'winter'
export type Metal = 'gold' | 'silver' | 'rose-gold' | 'other'

export interface CategoryDef {
  id: CategoryId
  label: string
  subtypes: readonly string[]
  /** Which optional attributes make sense for this category. */
  has: { pattern: boolean; warmth: boolean; metal: boolean }
}

const CLOTHING = { pattern: true, warmth: true, metal: false } as const

export const CATEGORIES: readonly CategoryDef[] = [
  { id: 'top', label: 'Top', has: CLOTHING, subtypes: ['T-shirt', 'Shirt', 'Polo', 'Blouse', 'Sweater', 'Hoodie', 'Tank top', 'Crop top'] },
  { id: 'bottom', label: 'Bottom', has: CLOTHING, subtypes: ['Jeans', 'Trousers', 'Chinos', 'Shorts', 'Skirt', 'Joggers', 'Leggings'] },
  { id: 'outerwear', label: 'Layer', has: CLOTHING, subtypes: ['Jacket', 'Blazer', 'Coat', 'Cardigan', 'Overshirt', 'Raincoat'] },
  { id: 'dress', label: 'Dress', has: CLOTHING, subtypes: ['Casual dress', 'Formal dress', 'Jumpsuit', 'Co-ord set'] },
  {
    id: 'ethnic',
    label: 'Ethnic',
    has: CLOTHING,
    subtypes: ['Kurta', 'Kurti', 'Saree', 'Salwar suit', 'Lehenga', 'Sherwani', 'Nehru jacket', 'Dhoti', 'Dupatta'],
  },
  {
    id: 'footwear',
    label: 'Footwear',
    has: { pattern: false, warmth: true, metal: false },
    subtypes: ['Sneakers', 'Formal shoes', 'Loafers', 'Boots', 'Heels', 'Flats', 'Sandals', 'Kolhapuris', 'Slippers'],
  },
  {
    id: 'jewellery',
    label: 'Jewellery',
    has: { pattern: false, warmth: false, metal: true },
    subtypes: ['Necklace', 'Earrings', 'Ring', 'Bracelet', 'Bangles', 'Watch', 'Anklet'],
  },
  {
    id: 'bag',
    label: 'Bag',
    has: { pattern: true, warmth: false, metal: false },
    subtypes: ['Handbag', 'Tote', 'Backpack', 'Sling bag', 'Clutch', 'Laptop bag'],
  },
  {
    id: 'accessory',
    label: 'Accessory',
    has: { pattern: true, warmth: false, metal: false },
    subtypes: ['Belt', 'Sunglasses', 'Cap / hat', 'Scarf', 'Tie', 'Headphones'],
  },
]

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id)

export function categoryDef(id: CategoryId): CategoryDef {
  const def = CATEGORIES.find((c) => c.id === id)
  if (!def) throw new Error(`Unknown category: ${id}`)
  return def
}

export const FORMALITY_LABELS: Record<Formality, string> = { 1: 'Lounge', 2: 'Casual', 3: 'Smart', 4: 'Formal' }
export const WARMTH_LABELS: Record<Warmth, string> = { 1: 'Light', 2: 'Medium', 3: 'Warm' }
export const PATTERN_LABELS: Record<Pattern, string> = {
  solid: 'Solid',
  striped: 'Striped',
  checked: 'Checked',
  printed: 'Printed',
  floral: 'Floral',
  embroidered: 'Embroidered',
  other: 'Other',
}
export const SEASON_LABELS: Record<Season, string> = { summer: 'Summer', monsoon: 'Monsoon', winter: 'Winter' }
export const METAL_LABELS: Record<Metal, string> = { gold: 'Gold', silver: 'Silver', 'rose-gold': 'Rose gold', other: 'Other' }

/** Filter chips on the Closet screen. */
export const CLOSET_FILTERS: readonly { id: string; label: string; categories: readonly CategoryId[] | null }[] = [
  { id: 'all', label: 'All', categories: null },
  { id: 'tops', label: 'Tops', categories: ['top'] },
  { id: 'bottoms', label: 'Bottoms', categories: ['bottom'] },
  { id: 'layers', label: 'Layers', categories: ['outerwear'] },
  { id: 'dresses', label: 'Dresses', categories: ['dress'] },
  { id: 'ethnic', label: 'Ethnic', categories: ['ethnic'] },
  { id: 'footwear', label: 'Footwear', categories: ['footwear'] },
  { id: 'jewellery', label: 'Jewellery', categories: ['jewellery'] },
  { id: 'bags', label: 'Bags & more', categories: ['bag', 'accessory'] },
]
