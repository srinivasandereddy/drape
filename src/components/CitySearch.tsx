import { MapPin } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { cityLabel, searchCities, type City } from '../lib/weather'

type Props = { onSelect: (city: City) => void; autoFocus?: boolean }

/** Type a city, pick it from the list. Only the typed text is sent to the weather service. */
export function CitySearch({ onSelect, autoFocus }: Props) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<City[]>([])
  const [status, setStatus] = useState<'idle' | 'searching' | 'error' | 'none'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    let cancelled = false
    // Wait until typing pauses, so we don't send a request per letter.
    const t = setTimeout(() => {
      setStatus('searching')
      searchCities(q)
        .then((r) => {
          if (cancelled) return
          setResults(r)
          setStatus(r.length ? 'idle' : 'none')
        })
        .catch((e: unknown) => {
          if (cancelled) return
          setError(e instanceof Error ? e.message : 'Search failed.')
          setStatus('error')
        })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        Your city <span className="field-hint">· for the weather</span>
      </label>
      <input
        id={id}
        className="text-input"
        type="search"
        placeholder="e.g. Hyderabad"
        value={query}
        autoComplete="address-level2"
        enterKeyHint="search"
        autoFocus={autoFocus}
        onChange={(e) => setQuery(e.target.value)}
      />
      {/* Results only count for a real query; shorter text just hides them. */}
      {query.trim().length >= 2 && status === 'searching' && <p className="muted small">Searching…</p>}
      {query.trim().length >= 2 && status === 'none' && <p className="muted small">No place called "{query.trim()}". Check the spelling.</p>}
      {query.trim().length >= 2 && status === 'error' && <p className="error-text">{error}</p>}
      {query.trim().length >= 2 && results.length > 0 && (
        <ul className="city-results">
          {results.map((c) => (
            <li key={`${c.latitude},${c.longitude}`}>
              <button
                type="button"
                className="city-result"
                onClick={() => {
                  onSelect(c)
                  setQuery('')
                  setResults([])
                }}
              >
                <MapPin size={16} aria-hidden="true" />
                <span>{cityLabel(c)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
