// Weather from Open-Meteo (https://open-meteo.com): free, no account, no key.
// Only the city's coordinates are sent. Results are cached for 30 minutes so
// the app stays fast and still shows the last forecast when offline.

import { prefs } from './platform'

export interface City {
  name: string
  region: string
  country: string
  latitude: number
  longitude: number
}

export interface Weather {
  /** °C now */
  temp: number
  /** °C, how it actually feels with humidity and wind */
  feelsLike: number
  humidity: number
  /** mm in the last hour */
  precipitation: number
  windKmh: number
  code: number
  todayMax: number
  todayMin: number
  /** 0..100 */
  rainChance: number
  uvMax: number
  fetchedAt: string
}

export const cityLabel = (c: City) => [c.name, c.region, c.country].filter(Boolean).join(', ')

const TIMEOUT_MS = 8000
const CACHE_MS = 30 * 60 * 1000

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`The weather service replied ${res.status}. Try again later.`)
    return await res.json()
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('The weather service is not responding. Check your connection.')
    if (e instanceof TypeError) throw new Error('No internet connection, so no fresh weather.')
    throw e
  } finally {
    clearTimeout(t)
  }
}

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const rec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {})
const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : undefined)

export async function searchCities(query: string): Promise<City[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const params = new URLSearchParams({ name: q, count: '6', language: 'en', format: 'json' })
  const data = rec(await getJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`))
  const results = Array.isArray(data.results) ? data.results : []
  return results.map(rec).flatMap((r) =>
    typeof r.name === 'string' && typeof r.latitude === 'number' && typeof r.longitude === 'number'
      ? [{ name: r.name, region: typeof r.admin1 === 'string' ? r.admin1 : '', country: typeof r.country === 'string' ? r.country : '', latitude: r.latitude, longitude: r.longitude }]
      : [],
  )
}

/** Turns an Open-Meteo forecast response into our Weather shape. Exported for tests. */
export function parseForecast(raw: unknown, now: Date = new Date()): Weather {
  const data = rec(raw)
  const cur = rec(data.current)
  const daily = rec(data.daily)
  if (typeof cur.temperature_2m !== 'number') throw new Error('The weather service sent an unexpected reply.')
  const temp = num(cur.temperature_2m)
  return {
    temp,
    feelsLike: num(cur.apparent_temperature, temp),
    humidity: num(cur.relative_humidity_2m),
    precipitation: num(cur.precipitation),
    windKmh: num(cur.wind_speed_10m),
    code: num(cur.weather_code),
    todayMax: num(first(daily.temperature_2m_max), temp),
    todayMin: num(first(daily.temperature_2m_min), temp),
    rainChance: num(first(daily.precipitation_probability_max)),
    uvMax: num(first(daily.uv_index_max)),
    fetchedAt: now.toISOString(),
  }
}

type Cached = { key: string; weather: Weather }
const cacheKey = (c: City) => `${c.latitude.toFixed(2)},${c.longitude.toFixed(2)}`

export function cachedWeather(city: City): Weather | null {
  try {
    const raw = prefs.get('weather')
    if (!raw) return null
    const c = JSON.parse(raw) as Cached
    return c.key === cacheKey(city) ? c.weather : null
  } catch {
    return null
  }
}

export async function getWeather(city: City, force = false): Promise<Weather> {
  const cached = cachedWeather(city)
  if (!force && cached && Date.now() - Date.parse(cached.fetchedAt) < CACHE_MS) return cached
  const params = new URLSearchParams({
    latitude: String(city.latitude),
    longitude: String(city.longitude),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max',
    timezone: 'auto',
    forecast_days: '1',
  })
  const weather = parseForecast(await getJson(`https://api.open-meteo.com/v1/forecast?${params}`))
  prefs.set('weather', JSON.stringify({ key: cacheKey(city), weather } satisfies Cached))
  return weather
}

// ---------- plain-language helpers ----------

/** WMO weather codes, as used by Open-Meteo. */
export function describeCode(code: number): string {
  if (code === 0) return 'Clear'
  if (code <= 2) return 'Partly cloudy'
  if (code === 3) return 'Cloudy'
  if (code === 45 || code === 48) return 'Foggy'
  if (code >= 51 && code <= 57) return 'Drizzle'
  if (code >= 61 && code <= 67) return 'Rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) return 'Showers'
  if (code >= 85 && code <= 86) return 'Snow showers'
  if (code >= 95) return 'Thunderstorm'
  return 'Mixed'
}

export function isRainy(w: Weather): boolean {
  return w.precipitation > 0.2 || w.rainChance >= 50 || (w.code >= 51 && w.code <= 67) || (w.code >= 80 && w.code <= 82) || w.code >= 95
}

export function isSunny(w: Weather): boolean {
  return w.code <= 2 && w.uvMax >= 5
}

/** The warmth level clothes should have (1 light … 3 warm), from how it feels outside. */
export function idealWarmth(feelsLike: number): number {
  if (feelsLike >= 30) return 1
  if (feelsLike >= 24) return 1.5
  if (feelsLike >= 18) return 2
  if (feelsLike >= 10) return 2.5
  return 3
}

export function needsLayer(w: Weather): boolean {
  return w.feelsLike < 20 || w.todayMin < 15
}

export type WeatherSeason = 'summer' | 'monsoon' | 'winter' | null

/** The season the weather *feels* like today, used to match garment season tags. */
export function seasonFromWeather(w: Weather): WeatherSeason {
  if (isRainy(w)) return 'monsoon'
  if (w.feelsLike >= 26) return 'summer'
  if (w.feelsLike < 18) return 'winter'
  return null
}
