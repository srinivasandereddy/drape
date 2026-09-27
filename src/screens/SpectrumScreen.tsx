import { useMemo, useState } from 'react'
import { ThumbRow } from '../components/ThumbRow'
import { useCloset } from '../lib/closet'
import { dominantHex } from '../lib/model'
import { bucketOf, HUE_BUCKETS, NEUTRAL_BUCKET, spectrumStats } from '../lib/spectrum'
import { ColorMatcher } from './ColorMatcher'

export function SpectrumScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const { garments, scan } = useCloset()
  const stats = useMemo(() => spectrumStats(garments), [garments])
  const [bucket, setBucket] = useState<number | null>(null)
  const max = Math.max(...stats.buckets, 0.0001)
  const inBucket = bucket === null ? [] : garments.filter((g) => dominantHex(g) && bucketOf(dominantHex(g)!) === bucket)

  return (
    <section className="screen" aria-labelledby="spectrum-title">
      <div className="screen-head">
        <h1 id="spectrum-title">Your spectrum</h1>
        <p className="muted">
          {stats.withColors} of {stats.total} pieces read
        </p>
      </div>

      {scan && (
        <div className="notice" role="status">
          <div>
            <b>Reading colors from your photos…</b>
            <p className="small">
              {scan.done} of {scan.total} done
            </p>
          </div>
        </div>
      )}

      {stats.withColors === 0 ? (
        <div className="card stack-sm">
          <h2>No colors yet</h2>
          <p className="muted">Add a few pieces and Drape reads their colors automatically.</p>
        </div>
      ) : (
        <>
          <div className="card stack">
            <div className="strip" aria-hidden="true">
              {stats.strip.map((s) => (
                <i key={s.id} style={{ background: s.hex }} />
              ))}
            </div>

            <div>
              <div className="bars" role="group" aria-label="Pieces by color family. Tap a bar to see its pieces.">
                {[...HUE_BUCKETS, { id: NEUTRAL_BUCKET, label: 'Neutral', hue: -1 }].map((b) => {
                  const v = stats.buckets[b.id] ?? 0
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={bucket === b.id ? 'bar on' : 'bar'}
                      aria-label={`${b.label}: ${v.toFixed(1)}`}
                      aria-pressed={bucket === b.id}
                      onClick={() => setBucket(bucket === b.id ? null : b.id)}
                    >
                      <i style={{ height: `${Math.max(v > 0 ? 6 : 2, (v / max) * 100)}%`, background: b.hue < 0 ? 'var(--neutral-bar)' : `hsl(${b.hue} 60% 50%)` }} />
                    </button>
                  )
                })}
              </div>
              <div className="bar-labels mono muted" aria-hidden="true">
                <span>red</span>
                <span>yellow</span>
                <span>green</span>
                <span>cyan</span>
                <span>blue</span>
                <span>pink</span>
                <span>neutral</span>
              </div>
            </div>

            {bucket !== null && (
              <div className="stack-sm">
                <p className="small">
                  <b>{bucket === NEUTRAL_BUCKET ? 'Neutrals' : HUE_BUCKETS[bucket]!.label}</b>
                  <span className="muted"> · {inBucket.length} piece{inBucket.length === 1 ? '' : 's'} with this as the main color</span>
                </p>
                <ThumbRow garments={inBucket} onOpen={onOpen} />
              </div>
            )}

            <div className="stack-sm">
              <div className="meter" aria-label={`Neutrals ${Math.round(stats.neutralShare * 100)} percent`}>
                <i style={{ width: `${stats.neutralShare * 100}%` }} className="meter-neutral" />
                <i style={{ width: `${stats.warmShare * 100}%` }} className="meter-warm" />
                <i style={{ width: `${stats.coolShare * 100}%` }} className="meter-cool" />
              </div>
              <p className="small muted">
                Neutrals {Math.round(stats.neutralShare * 100)}% · Warm {Math.round(stats.warmShare * 100)}% · Cool {Math.round(stats.coolShare * 100)}%
              </p>
            </div>
          </div>

          {(stats.insights.length > 0 || stats.mostWorn) && (
            <div className="card stack-sm">
              <h2>What we noticed</h2>
              <ul className="insights">
                {stats.mostWorn && (
                  <li>
                    Most worn color: <b>{stats.mostWorn.name}</b>, {stats.mostWorn.wears} wear{stats.mostWorn.wears === 1 ? '' : 's'}.
                  </li>
                )}
                {stats.insights.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}

          <ColorMatcher garments={garments} onOpen={onOpen} />
        </>
      )}
    </section>
  )
}
