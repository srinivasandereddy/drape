import { useCloset } from '../lib/closet'

const PREVIEW_HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]

export function SpectrumScreen() {
  const { garments } = useCloset()
  return (
    <section className="screen" aria-labelledby="spectrum-title">
      <div className="screen-head">
        <h1 id="spectrum-title">Your spectrum</h1>
        <p className="muted">{garments.length} pieces</p>
      </div>
      <div className="card stack">
        <div className="hue-strip" aria-hidden="true">
          {PREVIEW_HUES.map((h) => (
            <i key={h} style={{ background: `hsl(${h} 60% 50%)` }} />
          ))}
        </div>
        <h2>Coming in the next update</h2>
        <p className="muted">
          Drape will read the main colors of every photo you add, then show your whole wardrobe by hue, how much of it is
          neutral, and which colors are missing. Photos you add now will be included automatically.
        </p>
      </div>
    </section>
  )
}
