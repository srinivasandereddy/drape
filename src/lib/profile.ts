// The person's details that shape suggestions. Stored in their own database and
// (from v0.5) synced to their own Drive. Every field is optional except what the
// wizard needs to finish.

import { useEffect, useSyncExternalStore } from 'react'
import { METAL_LABELS, PATTERN_LABELS, type Formality, type Metal, type Pattern } from './catalog'
import { PALETTE } from './color'
import { markChanged } from './changes'
import { getDb } from './db'
import { DOSHA_ORDER, DOSHA_QUESTIONS, scoreDosha, type DoshaId, type DoshaResult } from './dosha'
import { EYE_COLORS, FITS, HAIR_COLORS, SKIN_TONES, bodyShapesFor, seasonFor, type EyeColor, type Fit, type HairColor, type PersonalPrefs, type SkinTone, type Undertone } from './personal'
import { STYLE_IDS, type StyleId } from './styles'
import type { City } from './weather'

export type RoutineId = 'corporate' | 'business-casual' | 'remote' | 'field' | 'student' | 'creative'

export const ROUTINES: readonly { id: RoutineId; label: string; workFormality: Formality }[] = [
  { id: 'corporate', label: 'Corporate office', workFormality: 4 },
  { id: 'business-casual', label: 'Business casual', workFormality: 3 },
  { id: 'remote', label: 'Work from home', workFormality: 2 },
  { id: 'field', label: 'Field / on-site work', workFormality: 2 },
  { id: 'student', label: 'Student', workFormality: 2 },
  { id: 'creative', label: 'Creative work', workFormality: 2 },
]

export const routineDef = (id: RoutineId | null) => ROUTINES.find((r) => r.id === id) ?? null

export type GenderKind = 'female' | 'male' | 'other'
export type ThemeId = 'classic' | 'slate' | 'rose' | 'sage' | 'midnight'

export const THEMES: readonly { id: ThemeId; label: string; swatch: [string, string] }[] = [
  { id: 'classic', label: 'Classic', swatch: ['#F7F7F4', '#2A45F5'] },
  { id: 'slate', label: 'Slate', swatch: ['#F2F3F5', '#3D4A5C'] },
  { id: 'rose', label: 'Rose', swatch: ['#FBF3F4', '#B83B5E'] },
  { id: 'sage', label: 'Sage', swatch: ['#F2F5F1', '#3F7D58'] },
  { id: 'midnight', label: 'Midnight', swatch: ['#101217', '#8C9AFF'] },
]


export interface Profile {
  name: string
  age: number | null
  gender: { kind: GenderKind | null; custom: string }
  heightCm: number | null
  weightKg: number | null
  city: City | null
  routine: RoutineId | null
  styles: StyleId[]
  metal: { kind: Metal | null; custom: string }
  theme: ThemeId
  dosha: DoshaResult | null
  skinTone: SkinTone | null
  undertone: Undertone | null
  hair: HairColor | null
  eyes: EyeColor | null
  bodyShape: string | null
  fit: Fit | null
  /** Palette color names. */
  favoriteColors: string[]
  avoidColors: string[]
  lovePatterns: Pattern[]
  avoidPatterns: Pattern[]
  sizes: { top: string; bottom: string; shoe: string }
  /** Usual spend on one piece, for the shopping advisor. */
  budget: number | null
  currency: Currency
  /** Morning outfit reminder (Android). */
  reminder: { enabled: boolean; hour: number }
  /** True once the setup wizard was finished (or skipped) on this account. */
  onboarded: boolean
  /** True once the welcome tour was seen. */
  tourDone: boolean
}

export type Currency = 'INR' | 'USD' | 'GBP' | 'EUR' | 'AED'
export const CURRENCIES: readonly Currency[] = ['INR', 'USD', 'GBP', 'EUR', 'AED']

export const EMPTY_PROFILE: Profile = {
  name: '',
  age: null,
  gender: { kind: null, custom: '' },
  heightCm: null,
  weightKg: null,
  city: null,
  routine: null,
  styles: [],
  metal: { kind: null, custom: '' },
  theme: 'classic',
  dosha: null,
  skinTone: null,
  undertone: null,
  hair: null,
  eyes: null,
  bodyShape: null,
  fit: null,
  favoriteColors: [],
  avoidColors: [],
  lovePatterns: [],
  avoidPatterns: [],
  sizes: { top: '', bottom: '', shoe: '' },
  budget: null,
  currency: 'INR',
  reminder: { enabled: false, hour: 7 },
  onboarded: false,
  tourDone: false,
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max = 60) => (typeof v === 'string' ? v.slice(0, max) : '')
const numIn = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null)

function normalizeDosha(v: unknown): DoshaResult | null {
  if (!isObj(v) || !Array.isArray(v.answers)) return null
  const answers = v.answers.filter((a): a is DoshaId => DOSHA_ORDER.includes(a as DoshaId))
  if (answers.length !== DOSHA_QUESTIONS.length) return null
  return scoreDosha(answers, new Date(typeof v.takenAt === 'string' ? v.takenAt : Date.now()))
}

/** Reads a stored profile safely; anything missing or damaged falls back to defaults. */
export function normalizeProfile(raw: unknown): Profile {
  if (!isObj(raw)) return EMPTY_PROFILE
  const c = isObj(raw.city) ? raw.city : null
  const city =
    c && typeof c.name === 'string' && typeof c.latitude === 'number' && typeof c.longitude === 'number'
      ? { name: c.name, region: str(c.region), country: str(c.country), latitude: c.latitude, longitude: c.longitude }
      : null
  const g = isObj(raw.gender) ? raw.gender : {}
  const m = isObj(raw.metal) ? raw.metal : {}
  return {
    name: str(raw.name),
    age: numIn(raw.age, 1, 120),
    gender: { kind: g.kind === 'female' || g.kind === 'male' || g.kind === 'other' ? g.kind : null, custom: str(g.custom, 40) },
    heightCm: numIn(raw.heightCm, 50, 250),
    weightKg: numIn(raw.weightKg, 10, 300),
    city,
    routine: ROUTINES.some((x) => x.id === raw.routine) ? (raw.routine as RoutineId) : null,
    styles: Array.isArray(raw.styles) ? [...new Set(raw.styles.filter((s): s is StyleId => STYLE_IDS.includes(s as StyleId)))] : [],
    metal: { kind: typeof m.kind === 'string' && Object.hasOwn(METAL_LABELS, m.kind) ? (m.kind as Metal) : null, custom: str(m.custom, 40) },
    theme: THEMES.some((t) => t.id === raw.theme) ? (raw.theme as ThemeId) : 'classic',
    dosha: normalizeDosha(raw.dosha),
    skinTone: oneOf(raw.skinTone, SKIN_TONES.map((x) => x.id)),
    undertone: oneOf(raw.undertone, ['warm', 'cool', 'neutral'] as const),
    hair: oneOf(raw.hair, HAIR_COLORS.map((x) => x.id)),
    eyes: oneOf(raw.eyes, EYE_COLORS.map((x) => x.id)),
    bodyShape: typeof raw.bodyShape === 'string' && bodyShapesFor(null).some((b) => b.id === raw.bodyShape) ? raw.bodyShape : null,
    fit: oneOf(raw.fit, FITS.map((x) => x.id)),
    favoriteColors: colorNames(raw.favoriteColors),
    avoidColors: colorNames(raw.avoidColors),
    lovePatterns: patterns(raw.lovePatterns),
    avoidPatterns: patterns(raw.avoidPatterns),
    sizes: { top: str(isObj(raw.sizes) ? raw.sizes.top : '', 12), bottom: str(isObj(raw.sizes) ? raw.sizes.bottom : '', 12), shoe: str(isObj(raw.sizes) ? raw.sizes.shoe : '', 12) },
    budget: numIn(raw.budget, 0, 10_000_000),
    currency: CURRENCIES.includes(raw.currency as Currency) ? (raw.currency as Currency) : 'INR',
    reminder: {
      enabled: isObj(raw.reminder) && raw.reminder.enabled === true,
      hour: (isObj(raw.reminder) ? numIn(raw.reminder.hour, 4, 12) : null) ?? 7,
    },
    onboarded: raw.onboarded === true,
    tourDone: raw.tourDone === true,
  }
}

function oneOf<T extends string>(v: unknown, options: readonly T[]): T | null {
  return typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : null
}
const PALETTE_NAMES = PALETTE.map((p) => p.name)
function colorNames(v: unknown): string[] {
  return Array.isArray(v) ? [...new Set(v.filter((c): c is string => typeof c === 'string' && PALETTE_NAMES.includes(c)))].slice(0, 12) : []
}
function patterns(v: unknown): Pattern[] {
  return Array.isArray(v) ? [...new Set(v.filter((p): p is Pattern => typeof p === 'string' && Object.hasOwn(PATTERN_LABELS, p)))] : []
}

/** The personal color and shape preferences the outfit engine uses. */
export function personalPrefs(p: Profile): PersonalPrefs {
  return {
    season: seasonFor(p.skinTone, p.undertone, p.hair, p.eyes),
    favoriteColors: p.favoriteColors,
    avoidColors: p.avoidColors,
    lovePatterns: p.lovePatterns,
    avoidPatterns: p.avoidPatterns,
    bodyShape: p.bodyShape,
  }
}

/** Jewellery metal to use: the person's choice, or the one their color season suits. */
export function preferredMetal(p: Profile): Metal | null {
  if (p.metal.kind) return p.metal.kind
  const season = seasonFor(p.skinTone, p.undertone, p.hair, p.eyes)
  return season ? (season === 'spring' || season === 'autumn' ? 'gold' : 'silver') : null
}

/** Formats money in the person's currency, e.g. ₹1,299. */
export function money(p: Pick<Profile, 'currency'>, amount: number): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${p.currency} ${Math.round(amount)}`
  }
}

type State = { loaded: boolean; profile: Profile }
let state: State = { loaded: false, profile: EMPTY_PROFILE }
let loadStarted = false
const listeners = new Set<() => void>()

function setState(next: State) {
  state = next
  for (const l of listeners) l()
}

/** Re-reads the profile from the phone database (after sync brought a newer one). */
export function reloadProfile(): Promise<void> {
  return load()
}

async function load() {
  try {
    const db = await getDb()
    const rec = await db.get('meta', 'profile')
    setState({ loaded: true, profile: normalizeProfile(rec?.value) })
  } catch {
    setState({ loaded: true, profile: EMPTY_PROFILE })
  }
}

export function useProfile(): State {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
  useEffect(() => {
    if (!loadStarted) {
      loadStarted = true
      void load()
    }
  }, [])
  return snap
}

export async function saveProfile(patch: Partial<Profile>): Promise<Profile> {
  const profile = normalizeProfile({ ...state.profile, ...patch })
  const db = await getDb()
  await db.put('meta', { key: 'profile', value: profile, updatedAt: new Date().toISOString() })
  setState({ loaded: true, profile })
  markChanged()
  return profile
}

/** Forget the loaded profile (used when the signed-in account changes). */
export function resetProfileStore() {
  loadStarted = false
  setState({ loaded: false, profile: EMPTY_PROFILE })
}

export function metalLabel(p: Profile): string | null {
  if (!p.metal.kind) return null
  return p.metal.kind === 'other' ? p.metal.custom || 'Other' : METAL_LABELS[p.metal.kind]
}
