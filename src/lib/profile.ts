// The person's details that shape suggestions. Stored in their own database and
// (from v0.5) synced to their own Drive. Every field is optional except what the
// wizard needs to finish.

import { useEffect, useSyncExternalStore } from 'react'
import { METAL_LABELS, type Formality, type Metal } from './catalog'
import { getDb } from './db'
import { DOSHA_ORDER, DOSHA_QUESTIONS, scoreDosha, type DoshaId, type DoshaResult } from './dosha'
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
  /** True once the setup wizard was finished (or skipped) on this account. */
  onboarded: boolean
}

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
  onboarded: false,
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
    onboarded: raw.onboarded === true,
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
