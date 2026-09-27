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
export type Fabric = 'cotton' | 'linen' | 'silk' | 'wool' | 'knit' | 'denim' | 'leather' | 'synthetic' | 'other'
/** 1 = revealing … 5 = full coverage */
export type Coverage = 1 | 2 | 3 | 4 | 5

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
export const FABRIC_LABELS: Record<Fabric, string> = {
  cotton: 'Cotton',
  linen: 'Linen',
  silk: 'Silk / satin',
  wool: 'Wool',
  knit: 'Knit',
  denim: 'Denim',
  leather: 'Leather',
  synthetic: 'Synthetic',
  other: 'Other',
}
export const COVERAGE_LABELS: Record<Coverage, string> = { 1: 'Revealing', 2: 'Some skin', 3: 'Balanced', 4: 'Covered', 5: 'Full' }

const LOW_COVERAGE: Record<string, Coverage> = {
  'Crop top': 2,
  'Tank top': 2,
  Shorts: 2,
  Skirt: 3,
  'Casual dress': 3,
  'Formal dress': 3,
  Blouse: 4,
  'Co-ord set': 3,
}
const FULL_COVERAGE = new Set(['Saree', 'Salwar suit', 'Lehenga', 'Sherwani', 'Kurta', 'Kurti', 'Jumpsuit', 'Trousers', 'Jeans', 'Chinos', 'Joggers', 'Leggings', 'Coat', 'Raincoat'])

/** How much a piece covers, guessed from its type. Only clothes matter for the modesty setting. */
export function defaultCoverage(category: CategoryId, subtype: string): Coverage {
  if (!categoryDef(category).has.warmth || category === 'footwear') return 5 // shoes, jewellery, bags: not counted
  if (LOW_COVERAGE[subtype]) return LOW_COVERAGE[subtype]
  if (FULL_COVERAGE.has(subtype)) return 5
  return 4
}

const FABRIC_BY_SUBTYPE: Record<string, Fabric> = {
  Jeans: 'denim',
  Sweater: 'knit',
  Cardigan: 'knit',
  Hoodie: 'knit',
  'T-shirt': 'cotton',
  Polo: 'cotton',
  Kurta: 'cotton',
  Kurti: 'cotton',
  Chinos: 'cotton',
  Loafers: 'leather',
  'Formal shoes': 'leather',
  Boots: 'leather',
  Raincoat: 'synthetic',
}
export const defaultFabric = (subtype: string): Fabric | null => FABRIC_BY_SUBTYPE[subtype] ?? null

const FORMALITY_BY_SUBTYPE: Record<string, Formality> = {
  Hoodie: 1,
  Joggers: 1,
  Leggings: 1,
  Slippers: 1,
  'Tank top': 2,
  'Crop top': 2,
  'T-shirt': 2,
  Shorts: 2,
  Jeans: 2,
  Sneakers: 2,
  Sandals: 2,
  Backpack: 2,
  'Cap / hat': 2,
  Headphones: 2,
  Polo: 3,
  Shirt: 3,
  Blouse: 3,
  Chinos: 3,
  Trousers: 3,
  Loafers: 3,
  Kurta: 3,
  Kurti: 3,
  Cardigan: 3,
  Watch: 3,
  Blazer: 4,
  'Formal shoes': 4,
  'Formal dress': 4,
  Heels: 4,
  Clutch: 4,
  Tie: 4,
  Saree: 4,
  Lehenga: 4,
  Sherwani: 4,
  'Laptop bag': 3,
  Coat: 3,
}
export const defaultFormality = (subtype: string): Formality => FORMALITY_BY_SUBTYPE[subtype] ?? 2

const WARM_SUBTYPES = new Set(['Sweater', 'Hoodie', 'Coat', 'Cardigan', 'Boots', 'Jacket'])
const LIGHT_SUBTYPES = new Set(['Tank top', 'Crop top', 'Shorts', 'Sandals', 'Slippers', 'Kolhapuris', 'Flats'])
/** 1 light … 3 warm, guessed from type and fabric. */
export function defaultWarmth(subtype: string, fabric: Fabric | null): Warmth {
  if (fabric === 'wool' || fabric === 'knit' || WARM_SUBTYPES.has(subtype)) return 3
  if (fabric === 'linen' || LIGHT_SUBTYPES.has(subtype)) return 1
  return 2
}

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
