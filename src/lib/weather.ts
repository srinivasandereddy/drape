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

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/**
 * Picks the place someone most likely means by a typed name. Search results are
 * fuzzy ("Goa" also finds "Genoa"), so prefer, in order: an exact city name, a
 * region with that name (Goa → a city in Goa, India), a country with that name,
 * a place in the person's home country, then the first result.
 */
export function bestCityMatch(query: string, results: City[], homeCountry?: string): City | null {
  const known = knownDestination(query)
  if (known) return known
  const q = fold(query)
  const home = homeCountry ? fold(homeCountry) : null
  const inHome = (list: City[]) => (home ? (list.find((c) => fold(c.country) === home) ?? list[0]) : list[0])
  const exact = results.filter((c) => fold(c.name) === q)
  // A same-named place in the person's own country beats one abroad.
  if (home) {
    const local = results.find((c) => fold(c.country) === home && (fold(c.name) === q || fold(c.region) === q))
    if (local) return local
  }
  if (exact.length) return inHome(exact) ?? null
  const region = results.filter((c) => fold(c.region) === q)
  if (region.length) return inHome(region) ?? null
  const country = results.filter((c) => fold(c.country) === q)
  if (country.length) return country[0] ?? null
  const starts = results.filter((c) => fold(c.name).startsWith(q))
  if (starts.length) return inHome(starts) ?? null
  return null
}

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

/**
 * Popular destinations that are regions, states or island groups, not cities, so the
 * city search can't find them (it finds "Genoa" for "Goa"). Each uses its main town's weather.
 */
const DESTINATIONS: Record<string, City> = {
  goa: { name: 'Goa', region: 'Panaji area', country: 'India', latitude: 15.4909, longitude: 73.8278 },
  kerala: { name: 'Kerala', region: 'Kochi area', country: 'India', latitude: 9.9312, longitude: 76.2673 },
  kashmir: { name: 'Kashmir', region: 'Srinagar area', country: 'India', latitude: 34.0837, longitude: 74.7973 },
  ladakh: { name: 'Ladakh', region: 'Leh area', country: 'India', latitude: 34.1526, longitude: 77.5771 },
  coorg: { name: 'Coorg', region: 'Madikeri area', country: 'India', latitude: 12.4244, longitude: 75.7382 },
  andaman: { name: 'Andaman Islands', region: 'Port Blair area', country: 'India', latitude: 11.6234, longitude: 92.7265 },
  himachal: { name: 'Himachal Pradesh', region: 'Shimla area', country: 'India', latitude: 31.1048, longitude: 77.1734 },
  rajasthan: { name: 'Rajasthan', region: 'Jaipur area', country: 'India', latitude: 26.9124, longitude: 75.7873 },
  sikkim: { name: 'Sikkim', region: 'Gangtok area', country: 'India', latitude: 27.3314, longitude: 88.6138 },
  uttarakhand: { name: 'Uttarakhand', region: 'Dehradun area', country: 'India', latitude: 30.3165, longitude: 78.0322 },
  meghalaya: { name: 'Meghalaya', region: 'Shillong area', country: 'India', latitude: 25.5788, longitude: 91.8933 },
  lakshadweep: { name: 'Lakshadweep', region: 'Kavaratti area', country: 'India', latitude: 10.5669, longitude: 72.642 },
  bali: { name: 'Bali', region: 'Denpasar area', country: 'Indonesia', latitude: -8.6705, longitude: 115.2126 },
  maldives: { name: 'Maldives', region: 'Malé area', country: 'Maldives', latitude: 4.1755, longitude: 73.5093 },
  hawaii: { name: 'Hawaii', region: 'Honolulu area', country: 'United States', latitude: 21.3069, longitude: -157.8583 },
  tuscany: { name: 'Tuscany', region: 'Florence area', country: 'Italy', latitude: 43.7696, longitude: 11.2558 },
}
const ALIASES: Record<string, string> = { 'andaman islands': 'andaman', andamans: 'andaman', 'himachal pradesh': 'himachal', 'the maldives': 'maldives', leh: 'ladakh', kodagu: 'coorg' }

export function knownDestination(query: string): City | null {
  const q = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  return DESTINATIONS[ALIASES[q] ?? q] ?? null
}

export async function searchCities(query: string): Promise<City[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const known = knownDestination(q)
  const params = new URLSearchParams({ name: q, count: '10', language: 'en', format: 'json' })
  const data = rec(await getJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`))
  const results = Array.isArray(data.results) ? data.results : []
  const found = results.map(rec).flatMap((r) =>
    typeof r.name === 'string' && typeof r.latitude === 'number' && typeof r.longitude === 'number'
      ? [{ name: r.name, region: typeof r.admin1 === 'string' ? r.admin1 : '', country: typeof r.country === 'string' ? r.country : '', latitude: r.latitude, longitude: r.longitude }]
      : [],
  )
  return known ? [known, ...found.filter((c) => !(c.latitude === known.latitude && c.longitude === known.longitude))] : found
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

// ---------- weather for trip dates ----------

export interface DayWeather {
  date: string
  weather: Weather
  /** 'forecast' for the next ~2 weeks; 'typical' = the same dates last year, for trips further ahead. */
  source: 'forecast' | 'typical'
}

const FORECAST_DAYS = 15

/** Turns an Open-Meteo "daily" reply into one Weather per day. Exported for tests. */
export function parseDaily(raw: unknown, source: DayWeather['source'], dates: string[]): DayWeather[] {
  const daily = rec(rec(raw).daily)
  const times = Array.isArray(daily.time) ? (daily.time as unknown[]) : []
  const at = (key: string, i: number) => (Array.isArray(daily[key]) ? (daily[key] as unknown[])[i] : undefined)
  const out: DayWeather[] = []
  times.forEach((t, i) => {
    if (typeof t !== 'string') return
    const max = num(at('temperature_2m_max', i), NaN)
    const min = num(at('temperature_2m_min', i), NaN)
    if (!Number.isFinite(max) || !Number.isFinite(min)) return
    const fMax = num(at('apparent_temperature_max', i), max)
    const fMin = num(at('apparent_temperature_min', i), min)
    const sum = num(at('precipitation_sum', i), 0)
    const prob = at('precipitation_probability_max', i)
    const daytime = (hi: number, lo: number) => hi * 0.7 + lo * 0.3
    out.push({
      date: t,
      source,
      weather: {
        temp: daytime(max, min),
        feelsLike: daytime(fMax, fMin),
        humidity: 60,
        precipitation: sum > 2 ? 1 : 0,
        windKmh: num(at('wind_speed_10m_max', i), 10),
        code: num(at('weather_code', i), 1),
        todayMax: max,
        todayMin: min,
        rainChance: typeof prob === 'number' ? prob : sum > 2 ? 70 : 10,
        uvMax: num(at('uv_index_max', i), 5),
        fetchedAt: new Date().toISOString(),
      },
    })
  })
  // Keep the requested dates only, in order (typical-weather rows are re-dated to this year).
  return dates.map((d, i) => out.find((o) => o.date === d) ?? (source === 'typical' && out[i] ? { ...out[i]!, date: d } : null)).filter((x): x is DayWeather => x !== null)
}

const tripCache = new Map<string, DayWeather[]>()
const shiftYear = (d: string, by: number) => `${Number(d.slice(0, 4)) + by}${d.slice(4)}`

/** Weather for each trip date: the forecast where available, otherwise last year's weather on those dates. */
export async function getTripWeather(city: City, dates: string[], today: Date = new Date()): Promise<DayWeather[]> {
  if (dates.length === 0) return []
  const key = `${cacheKey(city)}|${dates[0]}|${dates[dates.length - 1]}`
  const hit = tripCache.get(key)
  if (hit) return hit
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + FORECAST_DAYS)
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const cutoff = iso(horizon)
  const soon = dates.filter((d) => d <= cutoff)
  const later = dates.filter((d) => d > cutoff)
  const base = { latitude: String(city.latitude), longitude: String(city.longitude), timezone: 'auto' }
  const parts: DayWeather[] = []
  if (soon.length) {
    const p = new URLSearchParams({
      ...base,
      daily: 'temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,weather_code,uv_index_max,wind_speed_10m_max',
      start_date: soon[0]!,
      end_date: soon[soon.length - 1]!,
    })
    parts.push(...parseDaily(await getJson(`https://api.open-meteo.com/v1/forecast?${p}`), 'forecast', soon))
  }
  if (later.length) {
    const p = new URLSearchParams({
      ...base,
      daily: 'temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,weather_code,wind_speed_10m_max',
      start_date: shiftYear(later[0]!, -1),
      end_date: shiftYear(later[later.length - 1]!, -1),
    })
    parts.push(...parseDaily(await getJson(`https://archive-api.open-meteo.com/v1/archive?${p}`), 'typical', later))
  }
  tripCache.set(key, parts)
  return parts
}
