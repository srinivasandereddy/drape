// Turns typed wardrobe lists ("White Nike Air Force, Black leather loafers")
// into garment drafts: type, color, metal, fabric, pattern and sensible defaults.

import {
  categoryDef,
  defaultFabric,
  defaultFormality,
  defaultWarmth,
  type CategoryId,
  type Fabric,
  type Metal,
  type Pattern,
} from './catalog'
import { PALETTE } from './color'
import { emptyDraft, NAME_MAX, sanitizeDraft, type GarmentDraft } from './model'

type TypeRule = { words: string[]; category: CategoryId; subtype: string }

// Most specific phrases first; the first match wins.
const TYPES: TypeRule[] = [
  { words: ['sports bra', 'sport bra'], category: 'top', subtype: 'Sports bra' },
  { words: ['sports tee', 'gym tee', 'running tee', 'dri-fit', 'dri fit', 'jersey', 'training tee', 'sports t-shirt', 'gym t-shirt'], category: 'top', subtype: 'Sports tee' },
  { words: ['track jacket', 'zip-up', 'zip up', 'tracksuit top'], category: 'outerwear', subtype: 'Track jacket' },
  { words: ['running shoes', 'runners', 'sports shoes', 'training shoes', 'gym shoes', 'spikes'], category: 'footwear', subtype: 'Running shoes' },
  { words: ['crop top', 'cropped top', 'crop tee'], category: 'top', subtype: 'Crop top' },
  { words: ['tank top', 'tank', 'camisole', 'cami', 'vest top', 'singlet'], category: 'top', subtype: 'Tank top' },
  { words: ['t-shirt', 'tshirt', 't shirt', 'tee', 'graphic tee'], category: 'top', subtype: 'T-shirt' },
  { words: ['polo'], category: 'top', subtype: 'Polo' },
  { words: ['hoodie', 'sweatshirt', 'hoody'], category: 'top', subtype: 'Hoodie' },
  { words: ['sweater', 'jumper', 'pullover', 'turtleneck'], category: 'top', subtype: 'Sweater' },
  { words: ['blouse'], category: 'top', subtype: 'Blouse' },
  { words: ['nehru jacket', 'bandhgala', 'modi jacket'], category: 'ethnic', subtype: 'Nehru jacket' },
  { words: ['overshirt', 'shacket', 'flannel'], category: 'outerwear', subtype: 'Overshirt' },
  { words: ['shirt', 'button-down', 'button down', 'oxford'], category: 'top', subtype: 'Shirt' },
  { words: ['kurti'], category: 'ethnic', subtype: 'Kurti' },
  { words: ['kurta'], category: 'ethnic', subtype: 'Kurta' },
  { words: ['saree', 'sari'], category: 'ethnic', subtype: 'Saree' },
  { words: ['lehenga', 'lehnga', 'ghagra'], category: 'ethnic', subtype: 'Lehenga' },
  { words: ['salwar', 'churidar', 'anarkali', 'suit set'], category: 'ethnic', subtype: 'Salwar suit' },
  { words: ['sherwani'], category: 'ethnic', subtype: 'Sherwani' },
  { words: ['dhoti', 'veshti', 'mundu'], category: 'ethnic', subtype: 'Dhoti' },
  { words: ['dupatta', 'stole'], category: 'ethnic', subtype: 'Dupatta' },
  { words: ['jeans', 'denims'], category: 'bottom', subtype: 'Jeans' },
  { words: ['chinos', 'khakis'], category: 'bottom', subtype: 'Chinos' },
  { words: ['joggers', 'sweatpants', 'track pants', 'trackpants'], category: 'bottom', subtype: 'Joggers' },
  { words: ['leggings', 'tights', 'yoga pants'], category: 'bottom', subtype: 'Leggings' },
  { words: ['shorts', 'bermudas'], category: 'bottom', subtype: 'Shorts' },
  { words: ['skirt', 'skort'], category: 'bottom', subtype: 'Skirt' },
  { words: ['trousers', 'pants', 'slacks', 'palazzo', 'culottes', 'cargo'], category: 'bottom', subtype: 'Trousers' },
  { words: ['raincoat', 'rain jacket', 'windbreaker'], category: 'outerwear', subtype: 'Raincoat' },
  { words: ['blazer', 'suit jacket', 'sport coat'], category: 'outerwear', subtype: 'Blazer' },
  { words: ['trench', 'overcoat', 'coat', 'parka', 'puffer'], category: 'outerwear', subtype: 'Coat' },
  { words: ['cardigan', 'shrug'], category: 'outerwear', subtype: 'Cardigan' },
  { words: ['jacket', 'bomber', 'denim jacket', 'leather jacket'], category: 'outerwear', subtype: 'Jacket' },
  { words: ['jumpsuit', 'romper', 'playsuit', 'dungarees'], category: 'dress', subtype: 'Jumpsuit' },
  { words: ['co-ord', 'coord', 'co ord', 'matching set'], category: 'dress', subtype: 'Co-ord set' },
  { words: ['gown', 'evening dress', 'cocktail dress', 'formal dress'], category: 'dress', subtype: 'Formal dress' },
  { words: ['dress', 'sundress', 'maxi', 'midi'], category: 'dress', subtype: 'Casual dress' },
  { words: ['air force', 'air max', 'jordans', 'converse', 'vans', 'sneakers', 'sneaker', 'trainers', 'running shoes', 'kicks'], category: 'footwear', subtype: 'Sneakers' },
  { words: ['loafers', 'loafer', 'moccasins', 'boat shoes'], category: 'footwear', subtype: 'Loafers' },
  { words: ['oxfords', 'brogues', 'derby', 'formal shoes', 'dress shoes'], category: 'footwear', subtype: 'Formal shoes' },
  { words: ['boots', 'boot', 'chelsea', 'docs', 'doc martens', 'dr martens'], category: 'footwear', subtype: 'Boots' },
  { words: ['heels', 'stilettos', 'pumps', 'wedges', 'block heels'], category: 'footwear', subtype: 'Heels' },
  { words: ['kolhapuri', 'kolhapuris', 'juttis', 'jutti', 'mojari'], category: 'footwear', subtype: 'Kolhapuris' },
  { words: ['flip flops', 'flip-flops', 'slippers', 'slides', 'chappals'], category: 'footwear', subtype: 'Slippers' },
  { words: ['sandals', 'sandal', 'strappy'], category: 'footwear', subtype: 'Sandals' },
  { words: ['flats', 'ballet flats', 'ballerinas', 'mules'], category: 'footwear', subtype: 'Flats' },
  { words: ['watch', 'smartwatch'], category: 'jewellery', subtype: 'Watch' },
  { words: ['necklace', 'pendant', 'chain', 'choker', 'mangalsutra'], category: 'jewellery', subtype: 'Necklace' },
  { words: ['earrings', 'earring', 'hoops', 'studs', 'jhumkas', 'jhumka'], category: 'jewellery', subtype: 'Earrings' },
  { words: ['ring', 'rings', 'band'], category: 'jewellery', subtype: 'Ring' },
  { words: ['bangles', 'bangle', 'kada', 'kadas'], category: 'jewellery', subtype: 'Bangles' },
  { words: ['bracelet', 'cuff'], category: 'jewellery', subtype: 'Bracelet' },
  { words: ['anklet', 'payal'], category: 'jewellery', subtype: 'Anklet' },
  { words: ['laptop bag', 'briefcase', 'messenger'], category: 'bag', subtype: 'Laptop bag' },
  { words: ['backpack', 'rucksack'], category: 'bag', subtype: 'Backpack' },
  { words: ['crossbody', 'sling', 'fanny pack', 'belt bag'], category: 'bag', subtype: 'Sling bag' },
  { words: ['clutch', 'potli'], category: 'bag', subtype: 'Clutch' },
  { words: ['tote'], category: 'bag', subtype: 'Tote' },
  { words: ['handbag', 'purse', 'bag', 'shoulder bag'], category: 'bag', subtype: 'Handbag' },
  { words: ['sunglasses', 'shades', 'sunnies', 'aviators'], category: 'accessory', subtype: 'Sunglasses' },
  { words: ['headphones', 'earbuds', 'airpods', 'wh-1000xm4', 'wh-1000xm5'], category: 'accessory', subtype: 'Headphones' },
  { words: ['belt'], category: 'accessory', subtype: 'Belt' },
  { words: ['cap', 'hat', 'beanie', 'beret', 'bucket hat'], category: 'accessory', subtype: 'Cap / hat' },
  { words: ['scarf', 'muffler', 'shawl'], category: 'accessory', subtype: 'Scarf' },
  { words: ['tie', 'bow tie'], category: 'accessory', subtype: 'Tie' },
]

// Color words → hex. Multi-word names are checked first.
const COLOR_WORDS: [string, string][] = [
  ...PALETTE.map((p) => [p.name.toLowerCase(), p.hex] as [string, string]),
  ['off white', '#EFE6D0'],
  ['off-white', '#EFE6D0'],
  ['ivory', '#EFE6D0'],
  ['nude', '#D8C4A2'],
  ['tan', '#BE9464'],
  ['burgundy', '#74202C'],
  ['wine', '#74202C'],
  ['gray', '#8A8D91'],
  ['light gray', '#CDCFD1'],
  ['dark grey', '#3A3F45'],
  ['dark gray', '#3A3F45'],
  ['baby blue', '#8DB9E2'],
  ['light blue', '#8DB9E2'],
  ['royal blue', '#2F5DAA'],
  ['cobalt', '#2F5DAA'],
  ['emerald', '#3A8A4E'],
  ['forest green', '#2F5E3A'],
  ['bottle green', '#2F5E3A'],
  ['sage', '#9CAF88'],
  ['lilac', '#B8A6DA'],
  ['violet', '#6D3B8E'],
  ['magenta', '#D6336C'],
  ['fuchsia', '#D6336C'],
  ['peach', '#F2B38F'],
  ['coral', '#E8735F'],
  ['blush', '#EBA3B6'],
  ['chocolate', '#3F2A1E'],
  ['coffee', '#6B4A33'],
  ['golden', '#C69C22'],
  ['indigo', '#2E3A7A'],
  ['blue jeans', '#3E5C82'],
  // Only reached for non-jewellery; jewellery treats these words as metals.
  ['gold', '#C69C22'],
  ['silver', '#BFC1C4'],
]
const COLOR_SORTED = [...COLOR_WORDS].sort((a, b) => b[0].length - a[0].length)

const METALS: [string, Metal][] = [
  ['rose gold', 'rose-gold'],
  ['gold', 'gold'],
  ['golden', 'gold'],
  ['silver', 'silver'],
  ['sterling', 'silver'],
  ['platinum', 'silver'],
  ['white gold', 'silver'],
  ['gunmetal', 'other'],
  ['oxidised', 'other'],
  ['oxidized', 'other'],
  ['brass', 'other'],
  ['copper', 'other'],
  ['pearl', 'other'],
]

const FABRICS: [string, Fabric][] = [
  ['linen', 'linen'],
  ['cotton', 'cotton'],
  ['silk', 'silk'],
  ['satin', 'silk'],
  ['chiffon', 'silk'],
  ['georgette', 'silk'],
  ['wool', 'wool'],
  ['woollen', 'wool'],
  ['cashmere', 'wool'],
  ['tweed', 'wool'],
  ['knit', 'knit'],
  ['knitted', 'knit'],
  ['cable-knit', 'knit'],
  ['fleece', 'knit'],
  ['denim', 'denim'],
  ['leather', 'leather'],
  ['suede', 'leather'],
  ['polyester', 'synthetic'],
  ['nylon', 'synthetic'],
  ['rayon', 'synthetic'],
  ['velvet', 'other'],
]

const PATTERNS: [string, Pattern][] = [
  ['striped', 'striped'],
  ['stripes', 'striped'],
  ['stripe', 'striped'],
  ['checked', 'checked'],
  ['checks', 'checked'],
  ['check', 'checked'],
  ['plaid', 'checked'],
  ['tartan', 'checked'],
  ['gingham', 'checked'],
  ['floral', 'floral'],
  ['flowery', 'floral'],
  ['printed', 'printed'],
  ['print', 'printed'],
  ['graphic', 'printed'],
  ['polka', 'printed'],
  ['embroidered', 'embroidered'],
  ['chikankari', 'embroidered'],
  ['zari', 'embroidered'],
]

const has = (t: string, w: string) => t.includes(` ${w} `)

/** Finds color names in free text ("something in pink or sage"), as palette hex values. */
export function colorsInText(text: string): string[] {
  let rest = ` ${text.toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ')} `
  const out: string[] = []
  for (const [w, hex] of COLOR_SORTED) {
    if (has(rest, w)) {
      if (!out.includes(hex)) out.push(hex)
      rest = rest.replace(` ${w} `, ' ')
    }
  }
  return out
}

export interface ParsedItem {
  text: string
  draft: GarmentDraft
  /** False when the type could not be recognised; the person should pick one. */
  recognised: boolean
}

/** Parses one item. `hint` is the list section it was typed in, used when the type isn't recognised. */
export function parseItem(text: string, hint?: CategoryId): ParsedItem {
  const clean = text.trim().replace(/\s+/g, ' ')
  const t = ` ${clean.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ')} `
  let rest = t

  // The longest matching phrase wins, so "dress shoes" beats "dress" and "crossbody bag" beats "bag".
  let typeRule: TypeRule | undefined
  let best = 0
  for (const r of TYPES) {
    for (const w of r.words) {
      if (w.length > best && has(t, w)) {
        best = w.length
        typeRule = r
      }
    }
  }
  const category = typeRule?.category ?? hint ?? null

  const metal = category === 'jewellery' ? (METALS.find(([w]) => has(rest, w))?.[1] ?? null) : null
  if (metal) for (const [w] of METALS) rest = rest.replace(` ${w} `, ' ')

  const colors = []
  for (const [w, hex] of COLOR_SORTED) {
    if (colors.length >= 2) break
    if (has(rest, w)) {
      colors.push({ hex, share: 0 })
      rest = rest.replace(` ${w} `, ' ')
    }
  }
  // "Blue jeans" style items with no color word get a typical color.
  if (colors.length === 0 && typeRule?.subtype === 'Jeans') colors.push({ hex: '#3E5C82', share: 0 })
  const shares = colors.length === 1 ? [1] : [0.7, 0.3]
  const withShares = colors.map((c, i) => ({ hex: c.hex, share: shares[i]! }))

  const fabric = FABRICS.find(([w]) => has(t, w))?.[1] ?? (typeRule ? defaultFabric(typeRule.subtype) : null)
  const pattern = PATTERNS.find(([w]) => has(t, w))?.[1] ?? null
  const subtype = typeRule && category === typeRule.category ? typeRule.subtype : ''
  const def = category ? categoryDef(category) : null

  const draft = sanitizeDraft({
    ...emptyDraft(),
    category,
    subtype,
    name: (clean[0]?.toUpperCase() ?? '') + clean.slice(1, NAME_MAX),
    colors: withShares,
    colorsEdited: false,
    pattern: def?.has.pattern ? (pattern ?? 'solid') : null,
    formality: defaultFormality(subtype),
    warmth: def?.has.warmth ? defaultWarmth(subtype, fabric) : null,
    metal,
    fabric,
  })
  return { text: clean, draft, recognised: category !== null }
}

/** Splits a list on new lines, commas and semicolons, then parses each item. */
export function parseList(text: string, hint?: CategoryId): ParsedItem[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.replace(/^\s*[-•*\d.)]+\s*/, '').trim())
    .filter((s) => s.length >= 2)
    .slice(0, 100)
    .map((s) => parseItem(s, hint))
}
