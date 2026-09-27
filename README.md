# Drape

A private wardrobe app for our own phones. Photograph your clothes, see their colors, get daily outfit ideas.
Installs from the browser (no App Store), stores everything on the phone and in a hidden folder in your own Google Drive.

Live: https://srinivasandereddy.github.io/drape/

## Run it on the laptop

```bash
npm install
npm run dev
```

Then open http://localhost:5173. Google sign-in needs `VITE_GOOGLE_CLIENT_ID` in `.env.local` (see `.env.example`).

## Checks

`npm run check` runs the type checker, the linter and the tests. GitHub runs the same checks before every deploy.

## Where things live

| Folder | What it holds |
|---|---|
| `src/lib/` | Data rules and storage: garment model, catalog, phone database, photos, colors, harmony, weather, outfit engine, Google Drive |
| `src/components/` | Shared UI pieces: panels, chips, toasts, error screen |
| `src/screens/` | The screens: Today, Closet, Spectrum, Add, piece details, Settings |

## Milestones

1. Google sign-in test on real phones — done
2. Closet: add photos, categories, grid, edit, delete — done
3. Colors and Spectrum: color reading, hue chart, insights, color wheel matcher — done
4. Today's outfit: live weather, occasion, work routine, scoring, swap, wear log — done
5. Google Drive sync across phones
6. Feedback loop, style tags, modesty, dosha, onboarding quiz

## How outfits are scored

Each idea is built from your own closet (top + bottom, or a one-piece, plus shoes, then a layer, bag, jewellery and accessories when they fit) and scored out of 100:

| Part | Casual, travel | Work, evening, festive |
|---|---|---|
| Color harmony (color wheel rules) | 50 | 40 |
| Weather (feels-like temperature, rain, season) | 25 | 25 |
| Dress code for the occasion and your routine | 15 | 25 |
| Freshness (not worn in the last few days) | 10 | 10 |

The rules live in `src/lib/outfit.ts` and `src/lib/harmony.ts`, with tests in `src/lib/engine.test.ts`.

## Privacy

Photos and closet data stay on the phone (and later your own Google Drive). Weather comes from [Open-Meteo](https://open-meteo.com); only the chosen city's coordinates are sent. No analytics, no accounts, no other servers.
