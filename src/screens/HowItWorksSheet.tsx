import { Sheet } from '../components/Sheet'

const PARTS: { name: string; casual: number; dressy: number; workout: number; what: string }[] = [
  { name: 'Color harmony', casual: 40, dressy: 30, workout: 15, what: 'Do the colors work together on the color wheel? One color with neutrals, neighbours (analogous) and opposites (complementary) score high; three loud colors or two patterns at once score low.' },
  { name: 'Weather', casual: 20, dressy: 20, workout: 20, what: 'Does the fabric weight match the thermal index? Closed shoes when it rains, a layer when it is cold, nothing heavy when it is hot, and pieces tagged for the right season.' },
  { name: 'Dress code', casual: 15, dressy: 25, workout: 35, what: 'Is it the right level of dressy for the occasion and your routine? Under-dressing costs more than over-dressing. Workouts need real sportswear.' },
  { name: 'Your style', casual: 10, dressy: 10, workout: 15, what: 'Do the pieces fit your styles or today’s vibe (Old Money, Streetwear, Gym…) and any color you asked for?' },
  { name: 'Body comfort', casual: 5, dressy: 5, workout: 5, what: 'If you took the dosha quiz: fabrics and colors that suit your constitution.' },
  { name: 'Freshness', casual: 10, dressy: 10, workout: 10, what: 'Pieces worn in the last few days rest, so you rotate your closet.' },
]

/** Plain-language guide to how Drape chooses outfits. */
export function HowItWorksSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="How Drape picks outfits" onClose={onClose}>
      <div className="stack how">
        <section className="stack-sm">
          <h3>1. It reads your day</h3>
          <ul className="insights">
            <li>
              <b>Weather</b> for your city, or the place you typed ("dinner in Paris").
            </li>
            <li>
              <b>Thermal index 1–5</b>: how it feels outside, adjusted by your dosha (Pitta runs warm, Vata cool) and how you say you feel today. It decides light versus warm pieces and whether you need a layer.
            </li>
            <li>
              <b>Occasion and dress code</b>: the chip you pick or words you type ("interview" dresses up, "gym" means sportswear), plus your weekday routine.
            </li>
            <li>
              <b>Style</b>: your saved styles and activities, or today's vibe.
            </li>
          </ul>
        </section>

        <section className="stack-sm">
          <h3>2. It tries every combination</h3>
          <p>
            Every top with every bottom (or each dress, saree or suit), each with your best pair of shoes. Pieces ruled out by today's "Don't like" answers are skipped.
          </p>
        </section>

        <section className="stack-sm">
          <h3>3. It scores each one out of 100</h3>
          <div className="scroll">
            <table className="how-table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Casual, travel</th>
                  <th>Work, evening, festive</th>
                  <th>Workout</th>
                </tr>
              </thead>
              <tbody>
                {PARTS.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td className="mono">{p.casual}</td>
                    <td className="mono">{p.dressy}</td>
                    <td className="mono">{p.workout}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="insights small">
            {PARTS.map((p) => (
              <li key={p.name}>
                <b>{p.name}:</b> {p.what}
              </li>
            ))}
          </ul>
          <p className="muted small">If you haven't set a style or taken the dosha quiz, those points move to color harmony.</p>
        </section>

        <section className="stack-sm">
          <h3>4. It learns from you</h3>
          <ul className="insights">
            <li>
              <b>Love it</b> adds up to 8 points next time for the same pieces and pairings.
            </li>
            <li>
              <b>Don't like</b> asks why. "Too formal" dresses you down for the rest of the day, "Too cold" adds warmth, "No heels" removes heels, "Not my style" rests those pieces today, and "Colors" pushes that pairing down for good.
            </li>
            <li>
              <b>Wear this</b> marks the pieces as worn, so the next few days rotate to others.
            </li>
          </ul>
        </section>

        <section className="stack-sm">
          <h3>5. It finishes the look</h3>
          <p>
            It adds a layer when the thermal index or rain calls for one (a blazer for a formal office), a bag that suits the occasion, jewellery in your favourite metal (more for festive days, only a watch for workouts), and extras like sunglasses on sunny days or a belt with trousers.
          </p>
        </section>

        <p className="muted small">Everything runs on your phone. Tap the score on any outfit to see its own breakdown.</p>
      </div>
    </Sheet>
  )
}
