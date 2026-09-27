import { useCallback, useEffect, useRef, useState } from 'react'
import { cachedWeather, getWeather, type City, type Weather } from './weather'

export interface WeatherState {
  weather: Weather | null
  loading: boolean
  /** Set when the latest refresh failed; `weather` may still hold an older forecast. */
  error: string | null
  refresh: () => void
}

type Result = { for: string; weather: Weather | null; error: string | null }

/** Today's weather for a city: shows the saved forecast at once, then refreshes it. */
export function useWeather(city: City | null): WeatherState {
  const place = city ? `${city.latitude},${city.longitude}` : null
  const [tick, setTick] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const forceNext = useRef(false)
  const cityRef = useRef(city)
  useEffect(() => {
    cityRef.current = city
  })

  // Each (place, tick) pair is one request; `result.for` says which one answered.
  const request = place ? `${place}#${tick}` : null

  useEffect(() => {
    const c = cityRef.current
    if (!c || !request) return
    let cancelled = false
    const force = forceNext.current
    forceNext.current = false
    getWeather(c, force)
      .then((weather) => {
        if (!cancelled) setResult({ for: request, weather, error: null })
      })
      .catch((e: unknown) => {
        if (!cancelled) setResult({ for: request, weather: cachedWeather(c), error: e instanceof Error ? e.message : 'Could not get the weather.' })
      })
    return () => {
      cancelled = true
    }
  }, [request])

  // Coming back to the app: ask again (the 30-minute cache prevents needless requests).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setTick((t) => t + 1)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const refresh = useCallback(() => {
    forceNext.current = true
    setTick((t) => t + 1)
  }, [])

  if (!city || !place) return { weather: null, loading: false, error: null, refresh }
  const samePlace = result?.for.startsWith(`${place}#`) === true
  return {
    weather: (samePlace ? result!.weather : null) ?? cachedWeather(city),
    loading: result?.for !== request,
    error: result?.for === request ? result.error : null,
    refresh,
  }
}
