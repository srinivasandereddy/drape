import { useMemo, useState } from 'react'
import { ColorWheel } from '../components/ColorWheel'
import { GarmentPhoto } from '../components/GarmentPhoto'
import { colorName } from '../lib/color'
import { useCloset } from '../lib/closet'
import { dominantHex } from '../lib/model'
import { pieceLabel, slotOf } from '../lib/outfit'
import { bucketOf, HUE_BUCKETS, MATCH_GROUPS, matchesFor, NEUTRAL_BUCKET, spectrumStats } from '../lib/spectrum'

const WHEEL_SLOTS = new Set(['top', 'bottom', 'onepiece', 'layer', 'footwear', 'bag'])

export function SpectrumScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const { garments, scan } = useCloset()
  const stats = useMemo(() => spectrumStats(garments), [garments])
  const [bucket, setBucket] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const wheelPieces = useMemo(() => garments.filter((g) => dominantHex(g) && WHEEL_SLOTS.has(slotOf(g))), [garments])
  const selected = wheelPieces.find((g) => g.id === selectedId) ?? null
  const matches = useMemo(() => {
    const piece = wheelPieces.find((g) => g.id === selectedId)
    return piece ? matchesFor(piece, garments) : []
  }, [wheelPieces, selectedId, garments])
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
                <ThumbRow ids={inBucket.map((g) => g.id)} labels={inBucket.map(pieceLabel)} onOpen={onOpen} />
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

          <div className="card stack">
            <div className="stack-sm">
              <h2>Color matcher</h2>
              <p className="muted small">Pick a piece to see which of your clothes go with it.</p>
            </div>
            <div className="picker-row" role="listbox" aria-label="Choose a piece">
              {wheelPieces.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="option"
                  aria-selected={g.id === selectedId}
                  className={g.id === selectedId ? 'picker on' : 'picker'}
                  onClick={() => setSelectedId(g.id)}
                  aria-label={pieceLabel(g)}
                >
                  <GarmentPhoto id={g.id} kind="thumb" alt="" className="picker-img" />
                </button>
              ))}
            </div>
            <div className="wheel-wrap">
              <ColorWheel garments={wheelPieces} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
            {selected ? (
              <div className="stack">
                <p>
                  <b>{pieceLabel(selected)}</b>
                  <span className="muted"> · {colorName(dominantHex(selected)!)}</span>
                </p>
                {matches.length === 0 && <p className="muted small">Nothing in your closet pairs clearly with this yet.</p>}
                {MATCH_GROUPS.map((grp) => {
                  const list = matches.filter((m) => m.kind === grp.kind)
                  if (list.length === 0) return null
                  return (
                    <div key={grp.kind} className="stack-sm">
                      <p className="small">
                        <b>{grp.label}</b> <span className="muted">· {grp.hint}</span>
                      </p>
                      <ThumbRow ids={list.map((m) => m.garment.id)} labels={list.map((m) => pieceLabel(m.garment))} onOpen={onOpen} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="muted small">Dots are your pieces: placed by hue around the wheel, darker ones nearer the middle, neutrals in the center.</p>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function ThumbRow({ ids, labels, onOpen }: { ids: string[]; labels: string[]; onOpen: (id: string) => void }) {
  return (
    <ul className="thumb-row">
      {ids.map((id, i) => (
        <li key={id}>
          <button type="button" className="thumb" onClick={() => onOpen(id)} aria-label={labels[i]}>
            <GarmentPhoto id={id} kind="thumb" alt="" className="thumb-img" />
          </button>
        </li>
      ))}
    </ul>
  )
}
