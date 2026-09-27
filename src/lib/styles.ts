// Style aesthetics ("tropes"). Each one is described by the kinds of pieces and
// colors that signal it, so Drape can guess a piece's style even when nobody tagged it.

export type StyleId =
  | 'minimalist'
  | 'old-money'
  | 'clean-girl'
  | 'streetwear'
  | 'athleisure'
  | 'y2k'
  | 'goth'
  | 'grunge'
  | 'dark-academia'
  | 'preppy'
  | 'cutesy'
  | 'coquette'
  | 'tomboy'
  | 'boho'
  | 'traditional'

export interface StyleDef {
  id: StyleId
  label: string
  /** Palette names (see color.ts) that suit the style. */
  colors: readonly string[]
  /** Garment types that signal the style. */
  subtypes: readonly string[]
  /** Words people type for it. */
  words: readonly string[]
}

export const STYLES: readonly StyleDef[] = [
  {
    id: 'minimalist',
    label: 'Minimalist',
    colors: ['Black', 'White', 'Grey', 'Light grey', 'Charcoal', 'Navy', 'Beige', 'Cream'],
    subtypes: ['T-shirt', 'Shirt', 'Trousers', 'Sneakers', 'Tote', 'Watch'],
    words: ['minimal', 'minimalist', 'capsule', 'simple', 'basic', 'scandi', 'understated'],
  },
  {
    id: 'old-money',
    label: 'Old Money',
    colors: ['Navy', 'Cream', 'Camel', 'Beige', 'White', 'Brown', 'Khaki', 'Green'],
    subtypes: ['Blazer', 'Polo', 'Shirt', 'Loafers', 'Chinos', 'Trousers', 'Cardigan', 'Sweater', 'Watch', 'Tote', 'Coat'],
    words: ['old money', 'quiet luxury', 'classy', 'elegant', 'timeless', 'country club', 'ralph lauren'],
  },
  {
    id: 'clean-girl',
    label: 'Clean Girl',
    colors: ['White', 'Cream', 'Beige', 'Camel', 'Light grey', 'Black'],
    subtypes: ['Tank top', 'Trousers', 'Blazer', 'Flats', 'Sandals', 'Earrings', 'Handbag', 'Necklace'],
    words: ['clean girl', 'clean', 'effortless', 'sleek', 'polished'],
  },
  {
    id: 'streetwear',
    label: 'Streetwear',
    colors: ['Black', 'White', 'Grey', 'Red', 'Olive', 'Charcoal'],
    subtypes: ['Hoodie', 'Sneakers', 'Joggers', 'Cap / hat', 'T-shirt', 'Jacket', 'Sling bag', 'Backpack'],
    words: ['streetwear', 'street', 'hypebeast', 'urban', 'skater', 'sneakerhead', 'y2k streetwear'],
  },
  {
    id: 'athleisure',
    label: 'Athleisure',
    colors: ['Black', 'Grey', 'White', 'Navy', 'Charcoal', 'Light grey'],
    subtypes: ['Joggers', 'Leggings', 'Hoodie', 'Tank top', 'Sneakers', 'T-shirt', 'Backpack', 'Headphones'],
    words: ['athleisure', 'sporty', 'gym', 'workout', 'athletic', 'active', 'running', 'yoga'],
  },
  {
    id: 'y2k',
    label: 'Y2K',
    colors: ['Pink', 'Hot pink', 'Sky blue', 'Lavender', 'White', 'Mint', 'Silver'],
    subtypes: ['Crop top', 'Tank top', 'Jeans', 'Skirt', 'Sunglasses', 'Cap / hat'],
    words: ['y2k', '2000s', 'noughties', 'bratz', 'barbie'],
  },
  {
    id: 'goth',
    label: 'Goth',
    colors: ['Black', 'Charcoal', 'Maroon', 'Purple'],
    subtypes: ['Boots', 'Coat', 'Formal dress', 'Necklace', 'Ring'],
    words: ['goth', 'gothic', 'all black', 'emo', 'witchy', 'vampire'],
  },
  {
    id: 'grunge',
    label: 'Grunge',
    colors: ['Black', 'Charcoal', 'Maroon', 'Denim', 'Olive', 'Dark brown', 'Grey'],
    subtypes: ['Boots', 'Jeans', 'Overshirt', 'Jacket', 'Hoodie', 'T-shirt'],
    words: ['grunge', '90s', 'nineties', 'rock', 'punk', 'edgy', 'distressed'],
  },
  {
    id: 'dark-academia',
    label: 'Dark Academia',
    colors: ['Brown', 'Dark brown', 'Olive', 'Maroon', 'Charcoal', 'Camel', 'Cream', 'Khaki'],
    subtypes: ['Blazer', 'Sweater', 'Cardigan', 'Trousers', 'Loafers', 'Boots', 'Coat', 'Shirt'],
    words: ['dark academia', 'academia', 'scholar', 'bookish', 'vintage professor'],
  },
  {
    id: 'preppy',
    label: 'Preppy',
    colors: ['Navy', 'White', 'Red', 'Green', 'Sky blue', 'Khaki', 'Pink'],
    subtypes: ['Polo', 'Shirt', 'Chinos', 'Sweater', 'Cardigan', 'Loafers', 'Skirt'],
    words: ['preppy', 'prep', 'ivy', 'collegiate', 'nautical'],
  },
  {
    id: 'cutesy',
    label: 'Cutesy',
    colors: ['Pink', 'Lavender', 'Mint', 'Sky blue', 'Cream', 'White', 'Yellow'],
    subtypes: ['Skirt', 'Casual dress', 'Crop top', 'Flats', 'Cardigan', 'Blouse'],
    words: ['cute', 'cutesy', 'kawaii', 'sweet', 'pastel', 'soft girl'],
  },
  {
    id: 'coquette',
    label: 'Coquette',
    colors: ['Pink', 'Cream', 'White', 'Lavender', 'Red'],
    subtypes: ['Blouse', 'Skirt', 'Casual dress', 'Flats', 'Heels', 'Necklace', 'Earrings'],
    words: ['coquette', 'balletcore', 'romantic', 'feminine', 'bows', 'lace'],
  },
  {
    id: 'tomboy',
    label: 'Tomboy',
    colors: ['Denim', 'Grey', 'Black', 'Navy', 'Khaki', 'Olive', 'White'],
    subtypes: ['T-shirt', 'Hoodie', 'Jeans', 'Sneakers', 'Cap / hat', 'Joggers', 'Shorts', 'Overshirt'],
    words: ['tomboy', 'boyish', 'oversized', 'relaxed'],
  },
  {
    id: 'boho',
    label: 'Boho',
    colors: ['Rust', 'Mustard', 'Olive', 'Cream', 'Brown', 'Camel', 'Orange'],
    subtypes: ['Kurti', 'Casual dress', 'Sandals', 'Kolhapuris', 'Bangles', 'Scarf', 'Tote', 'Anklet'],
    words: ['boho', 'bohemian', 'hippie', 'earthy', 'festival boho'],
  },
  {
    id: 'traditional',
    label: 'Traditional',
    colors: ['Maroon', 'Red', 'Mustard', 'Green', 'Pink', 'Rust', 'Cream'],
    subtypes: ['Kurta', 'Kurti', 'Saree', 'Salwar suit', 'Lehenga', 'Sherwani', 'Nehru jacket', 'Dhoti', 'Dupatta', 'Bangles', 'Kolhapuris'],
    words: ['traditional', 'ethnic', 'desi', 'indian', 'festive'],
  },
]

export const STYLE_IDS: readonly StyleId[] = STYLES.map((s) => s.id)
export const styleDef = (id: StyleId): StyleDef => STYLES.find((s) => s.id === id)!

/**
 * How well a piece fits a style, 0..1. A tag the person chose counts fully;
 * otherwise the piece's type and main color are compared with the style.
 */
export function styleFit(g: { styleTags: readonly StyleId[]; subtype: string }, colorName: string | null, id: StyleId): number {
  if (g.styleTags.includes(id)) return 1
  const s = styleDef(id)
  const typeMatch = s.subtypes.includes(g.subtype)
  const colorMatch = colorName !== null && s.colors.includes(colorName)
  if (typeMatch && colorMatch) return 1
  if (typeMatch) return 0.7
  if (colorMatch) return 0.4
  return 0
}

/** Styles Drape would guess for a piece, strongest first. */
export function guessStyles(g: { styleTags: readonly StyleId[]; subtype: string }, colorName: string | null): StyleId[] {
  return STYLE_IDS.map((id) => ({ id, fit: styleFit({ ...g, styleTags: [] }, colorName, id) }))
    .filter((x) => x.fit >= 0.7)
    .sort((a, b) => b.fit - a.fit)
    .map((x) => x.id)
}

/** Finds style names in free text like "90s grunge but comfy". */
export function parseStyles(text: string): StyleId[] {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')} `
  const found: StyleId[] = []
  // Longer phrases first, so "y2k streetwear" or "dark academia" win over single words.
  const phrases = STYLES.flatMap((s) => [s.label.toLowerCase(), ...s.words].map((w) => ({ id: s.id, w }))).sort((a, b) => b.w.length - a.w.length)
  let rest = t
  for (const { id, w } of phrases) {
    const needle = ` ${w} `
    if (rest.includes(needle)) {
      if (!found.includes(id)) found.push(id)
      rest = rest.replace(needle, ' ')
    }
  }
  return found
}
