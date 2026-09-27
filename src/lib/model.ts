// The Garment record and every rule for creating, editing and reading one.
// All data entering the app from storage (and, later, from Drive sync) passes
// through `normalizeGarment`, so a damaged or outdated record can never crash a screen.

import {
  CATEGORY_IDS,
  METAL_LABELS,
  PATTERN_LABELS,
  SEASON_LABELS,
  categoryDef,
  type CategoryId,
  type Formality,
  type Metal,
  type Pattern,
  type Season,
  type Warmth,
} from './catalog'
import { ID_PATTERN, newId } from './id'

export const SCHEMA_VERSION = 2
export const MAX_COLORS = 3
export const NAME_MAX = 60

/** A dominant color read from the photo. Filled in by milestone 3. */
export interface GarmentColor {
  hex: string
  /** Fraction of the garment covered by this color, 0..1. */
  share: number
}

export interface Garment {
  schemaVersion: number
  id: string
  category: CategoryId
  subtype: string
  name: string
  colors: GarmentColor[]
  /** True once the person corrected the colors by hand; automatic reading then leaves them alone. */
  colorsEdited: boolean
  pattern: Pattern | null
  formality: Formality
  warmth: Warmth | null
  /** Empty means "all year". */
  seasons: Season[]
  metal: Metal | null
  /** Style aesthetics such as "old-money" or "streetwear". Used from milestone 6. */
  styleTags: string[]
  wornCount: number
  lastWornAt: string | null
  photo: { width: number; height: number } | null
  createdAt: string
  updatedAt: string
  /** Set instead of removing the record, so other phones learn about the delete. */
  deletedAt: string | null
}

/** The fields a person fills in on the Add / Edit form. */
export interface GarmentDraft {
  category: CategoryId | null
  subtype: string
  name: string
  colors: GarmentColor[]
  colorsEdited: boolean
  pattern: Pattern | null
  formality: Formality
  warmth: Warmth | null
  seasons: Season[]
  metal: Metal | null
}

export function emptyDraft(): GarmentDraft {
  return { category: null, subtype: '', name: '', colors: [], colorsEdited: false, pattern: null, formality: 2, warmth: null, seasons: [], metal: null }
}

export function draftFromGarment(g: Garment): GarmentDraft {
  return {
    category: g.category,
    subtype: g.subtype,
    name: g.name,
    colors: g.colors.map((c) => ({ ...c })),
    colorsEdited: g.colorsEdited,
    pattern: g.pattern,
    formality: g.formality,
    warmth: g.warmth,
    seasons: [...g.seasons],
    metal: g.metal,
  }
}

/** Clears attributes that do not apply to the chosen category (e.g. metal on a shirt). */
export function sanitizeDraft(draft: GarmentDraft): GarmentDraft {
  const d = { ...draft, colors: cleanColors(draft.colors) }
  if (!d.category) return { ...d, name: d.name.slice(0, NAME_MAX) }
  const def = categoryDef(d.category)
  return {
    ...d,
    subtype: def.subtypes.includes(d.subtype) ? d.subtype : '',
    name: d.name.slice(0, NAME_MAX),
    pattern: def.has.pattern ? d.pattern : null,
    warmth: def.has.warmth ? d.warmth : null,
    metal: def.has.metal ? d.metal : null,
    seasons: uniqueSeasons(d.seasons),
  }
}

/** Returns a list of problems, empty when the draft can be saved. */
export function validateDraft(d: GarmentDraft): string[] {
  const errors: string[] = []
  if (!d.category) errors.push('Choose what kind of piece this is.')
  if (d.name.trim().length > NAME_MAX) errors.push(`Keep the name under ${NAME_MAX} characters.`)
  return errors
}

export function createGarment(
  draft: GarmentDraft,
  photo: { width: number; height: number } | null,
  now: Date = new Date(),
  id: string = newId(now.getTime()),
): Garment {
  const d = sanitizeDraft(draft)
  if (!d.category) throw new Error('A garment needs a category')
  const at = now.toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    category: d.category,
    subtype: d.subtype,
    name: d.name.trim(),
    colors: d.colors,
    colorsEdited: d.colorsEdited,
    pattern: d.pattern,
    formality: d.formality,
    warmth: d.warmth,
    seasons: d.seasons,
    metal: d.metal,
    styleTags: [],
    wornCount: 0,
    lastWornAt: null,
    photo,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  }
}

export function applyDraft(g: Garment, draft: GarmentDraft, now: Date = new Date()): Garment {
  const d = sanitizeDraft(draft)
  if (!d.category) throw new Error('A garment needs a category')
  return {
    ...g,
    category: d.category,
    subtype: d.subtype,
    name: d.name.trim(),
    colors: d.colors,
    colorsEdited: d.colorsEdited,
    pattern: d.pattern,
    formality: d.formality,
    warmth: d.warmth,
    seasons: d.seasons,
    metal: d.metal,
    updatedAt: now.toISOString(),
  }
}

export function markWorn(g: Garment, now: Date = new Date()): Garment {
  const at = now.toISOString()
  return { ...g, wornCount: g.wornCount + 1, lastWornAt: at, updatedAt: at }
}

export function markDeleted(g: Garment, now: Date = new Date()): Garment {
  const at = now.toISOString()
  return { ...g, deletedAt: at, updatedAt: at }
}

/** Short label for a garment, e.g. "Linen shirt" or "Shirt". */
export function displayName(g: Pick<Garment, 'name' | 'subtype' | 'category'>): string {
  return g.name || g.subtype || categoryDef(g.category).label
}

// ---------- reading untrusted data ----------

const HEX = /^#[0-9a-f]{6}$/i

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const isoOrNull = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)
const inSet = <T extends string>(v: unknown, labels: Record<T, string>): T | null =>
  typeof v === 'string' && Object.hasOwn(labels, v) ? (v as T) : null
const intIn = <T extends number>(v: unknown, min: number, max: number): T | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? (v as T) : null

/** Valid hex colors only, shares 0..1, at most MAX_COLORS, biggest first. */
export function cleanColors(v: unknown): GarmentColor[] {
  if (!Array.isArray(v)) return []
  return v
    .filter(isObj)
    .map((c) => ({ hex: str(c.hex).toUpperCase(), share: typeof c.share === 'number' && Number.isFinite(c.share) ? c.share : 0 }))
    .filter((c) => HEX.test(c.hex) && c.share >= 0 && c.share <= 1)
    .filter((c, i, all) => all.findIndex((o) => o.hex === c.hex) === i)
    .sort((a, b) => b.share - a.share)
    .slice(0, MAX_COLORS)
}

/** The main color of a garment, if known. */
export const dominantHex = (g: Pick<Garment, 'colors'>): string | null => g.colors[0]?.hex ?? null

function uniqueSeasons(v: unknown): Season[] {
  if (!Array.isArray(v)) return []
  const out: Season[] = []
  for (const s of v) {
    const season = inSet<Season>(s, SEASON_LABELS)
    if (season && !out.includes(season)) out.push(season)
  }
  return out
}

/**
 * Turns anything read from storage into a valid Garment, or null if it is too
 * damaged to use. Unknown extra fields are dropped; missing optional fields get defaults.
 */
export function normalizeGarment(raw: unknown): Garment | null {
  if (!isObj(raw)) return null
  const id = str(raw.id)
  if (!ID_PATTERN.test(id)) return null
  const category = CATEGORY_IDS.includes(raw.category as CategoryId) ? (raw.category as CategoryId) : null
  if (!category) return null
  const createdAt = isoOrNull(raw.createdAt)
  if (!createdAt) return null

  const colors = cleanColors(raw.colors)

  const photo =
    isObj(raw.photo) && typeof raw.photo.width === 'number' && typeof raw.photo.height === 'number'
      ? { width: raw.photo.width, height: raw.photo.height }
      : null

  const base: Garment = {
    schemaVersion: SCHEMA_VERSION,
    id,
    category,
    subtype: str(raw.subtype),
    name: str(raw.name).slice(0, NAME_MAX),
    colors,
    colorsEdited: raw.colorsEdited === true,
    pattern: inSet<Pattern>(raw.pattern, PATTERN_LABELS),
    formality: intIn<Formality>(raw.formality, 1, 4) ?? 2,
    warmth: intIn<Warmth>(raw.warmth, 1, 3),
    seasons: uniqueSeasons(raw.seasons),
    metal: inSet<Metal>(raw.metal, METAL_LABELS),
    styleTags: Array.isArray(raw.styleTags) ? raw.styleTags.filter((t): t is string => typeof t === 'string').slice(0, 20) : [],
    wornCount: intIn<number>(raw.wornCount, 0, 1_000_000) ?? 0,
    lastWornAt: isoOrNull(raw.lastWornAt),
    photo,
    createdAt,
    updatedAt: isoOrNull(raw.updatedAt) ?? createdAt,
    deletedAt: isoOrNull(raw.deletedAt),
  }
  // Keep a custom subtype typed by hand, but clear attributes that don't fit the category.
  const def = categoryDef(category)
  return {
    ...base,
    pattern: def.has.pattern ? base.pattern : null,
    warmth: def.has.warmth ? base.warmth : null,
    metal: def.has.metal ? base.metal : null,
  }
}
