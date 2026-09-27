import { Sheet } from '../components/Sheet'
import { WEIGHTS } from '../lib/outfit'

type Part = keyof typeof WEIGHTS.casual

const PARTS: { key: Part; name: string; what: string }[] = [
  { key: 'harmony', name: 'Color harmony', what: 'Do the colors work together on the color wheel? One color with neutrals, neighbours (analogous) and opposites (complementary) score high; three loud colors score low.' },
  { key: 'weather', name: 'Weather', what: 'Does the fabric weight match the thermal index? Closed shoes when it rains, a layer when it is cold, nothing heavy when it is hot, and pieces tagged for the right season.' },
  { key: 'occasion', name: 'Dress code', what: 'Is it the right level of dressy for the occasion and your routine? The top counts most. Under-dressing costs more than over-dressing. Workouts need real sportswear.' },
  {
    key: 'pairing',
    name: 'Goes together',
    what: 'Would a stylist put these pieces together? The same level of dressiness from top to shoes, one print at a time, no clashes like running shoes with a saree or a blazer with joggers (each clash costs 8 more points), and colors that make sense for heat and rain.',
  },
  { key: 'style', name: 'Your style', what: 'Do the pieces fit your styles or today’s vibe (Old Money, Streetwear, Gym…) and any color you asked for?' },
  { key: 'you', name: 'Made for you', what: 'Colors from your color season near your face, your favourite colors and patterns (never the ones you avoid), and light and dark placed to balance your body shape.' },
  { key: 'body', name: 'Body comfort', what: 'If you took the dosha quiz: fabrics and colors that suit your constitution.' },
  { key: 'freshness', name: 'Freshness', what: 'Pieces worn in the last few days rest, so you rotate your closet.' },
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
                    <td className="mono">{WEIGHTS.casual[p.key]}</td>
                    <td className="mono">{WEIGHTS.dressy[p.key]}</td>
                    <td className="mono">{WEIGHTS.workout[p.key]}</td>
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
          <p className="muted small">If you haven't set a style, added your personal details or taken the dosha quiz, those points move to color harmony.</p>
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
              <b>Wear this</b> marks the pieces as worn, so the next few days rotate to others. Pairings you wear become favourites (up to 2 points), but the same top and bottom lose 4 points for a week, so you don't repeat an outfit.
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
