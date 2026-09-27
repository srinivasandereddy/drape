import { useMemo } from 'react'
import { PieceImage } from '../components/PieceImage'
import { ThumbRow } from '../components/ThumbRow'
import { useToast } from '../components/toastContext'
import { setStatusMany } from '../lib/closet'
import { colorName } from '../lib/color'
import { closetInsights } from '../lib/insights'
import { dominantHex, inCloset, type Garment } from '../lib/model'
import { pieceLabel } from '../lib/outfit'
import { SEASONS } from '../lib/personal'
import { money, personalPrefs, useProfile } from '../lib/profile'

/** Wear statistics, cost per wear, clear-out ideas and the person's own colors. */
export function WearStats({ garments, onOpen }: { garments: Garment[]; onOpen: (id: string) => void }) {
  const toast = useToast()
  const { profile } = useProfile()
  const i = useMemo(() => closetInsights(garments), [garments])
  const season = personalPrefs(profile).season
  const flattering = useMemo(() => {
    if (!season) return []
    const best = SEASONS[season].best
    return garments.filter((g) => inCloset(g) && dominantHex(g) && best.includes(colorName(dominantHex(g)!)))
  }, [garments, season])

  if (i.owned === 0) return null

  return (
    <>
      <div className="card stack">
        <h2>How you use your closet</h2>
        <div className="stat-row">
          <div className="stat">
            <b className="mono">{Math.round(i.usage * 100)}%</b>
            <span className="muted small">of clothes worn in the last 30 days</span>
          </div>
          <div className="stat">
            <b className="mono">{i.neverWorn.length}</b>
            <span className="muted small">never worn yet</span>
          </div>
          {i.totalValue !== null && (
            <div className="stat">
              <b className="mono">{money(profile, i.totalValue)}</b>
              <span className="muted small">
                closet value ({i.priced} priced)
              </span>
            </div>
          )}
        </div>
        {i.mostWorn.length > 0 && (
          <div className="stack-sm">
            <h3>Most worn</h3>
            <ul className="rank-list">
              {i.mostWorn.map((g) => (
                <li key={g.id}>
                  <button type="button" className="rank-row" onClick={() => onOpen(g.id)}>
                    <PieceImage garment={g} kind="thumb" className="rank-img" />
                    <span>{pieceLabel(g)}</span>
                    <span className="mono muted">{g.wornCount}×</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {i.priced > 0 ? (
          <div className="stack-sm">
            <h3>Cost per wear</h3>
            <ul className="rank-list">
              {i.bestValue.map(({ g, cpw }) => (
                <li key={`b${g.id}`}>
                  <button type="button" className="rank-row" onClick={() => onOpen(g.id)}>
                    <PieceImage garment={g} kind="thumb" className="rank-img" />
                    <span>
                      {pieceLabel(g)} <span className="badge good">best value</span>
                    </span>
                    <span className="mono">{money(profile, cpw)}</span>
                  </button>
                </li>
              ))}
              {i.worstValue
                .filter((w) => !i.bestValue.some((b) => b.g.id === w.g.id))
                .map(({ g, cpw }) => (
                  <li key={`w${g.id}`}>
                    <button type="button" className="rank-row" onClick={() => onOpen(g.id)}>
                      <PieceImage garment={g} kind="thumb" className="rank-img" />
                      <span>{pieceLabel(g)}</span>
                      <span className="mono muted">{money(profile, cpw)}</span>
                    </button>
                  </li>
                ))}
            </ul>
            <p className="muted small">Price ÷ times worn. Wear it more and it gets cheaper.</p>
          </div>
        ) : (
          <p className="muted small">Add what you paid on a piece's page to see its cost per wear.</p>
        )}
      </div>

      {i.forgotten.length > 0 && (
        <div className="card stack-sm">
          <h2>Forgotten pieces</h2>
          <p className="muted small">Not worn in 2 months or more. Drape will bring them into suggestions; tap one to see what goes with it.</p>
          <ThumbRow garments={i.forgotten} onOpen={onOpen} />
          {i.clearOut.length > 0 && (
            <>
              <p className="small">
                <b>{i.clearOut.length}</b> of these have hardly been worn in 3+ months. Time to donate or sell?
              </p>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  void setStatusMany(
                    i.clearOut.map((g) => g.id),
                    'retired',
                  ).then(() => toast(`${i.clearOut.length} pieces moved to Donated / sold. You can bring them back from Closet.`))
                }
              >
                Mark them donated or sold
              </button>
            </>
          )}
        </div>
      )}

      {season && (
        <div className="card stack-sm">
          <h2>Your colors: {SEASONS[season].label}</h2>
          <p className="muted small">{SEASONS[season].summary}</p>
          {flattering.length > 0 ? (
            <>
              <p className="small">
                <b>{flattering.length}</b> of your pieces are in your best colors:
              </p>
              <ThumbRow garments={flattering} onOpen={onOpen} />
            </>
          ) : (
            <p className="small">None of your pieces are in your best colors yet: {SEASONS[season].best.slice(0, 5).join(', ').toLowerCase()} would suit you.</p>
          )}
        </div>
      )}
    </>
  )
}
