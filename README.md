# Drape

A private, personal stylist on your phone. Each person signs in with their own Google account and sees only their own closet.
Photograph or type your clothes, see their colors, and get a daily outfit that fits your weather, plans, body comfort and style.
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
5. Personal (v0.4): Google accounts with a private closet per person, profile wizard, 10-question dosha quiz, daily feeling and thermal index, free-text occasion and vibe, style tropes, modesty, metal, Love it / Don't like with learning, typed wardrobe lists, sample wardrobe, color wheel modes — done
6. Sync and backup: each person's closet, photos, profile, trips and history in step across their phones through their own Drive (v0.5) — done
7. Trips with per-day weather, outfits and packing checklist; Ask Drape offline assistant; styles by gender plus activities; score breakdown (v0.6) — done

## How outfits are scored

Each idea is built from your own closet (top + bottom, or a one-piece, plus shoes, then a layer, bag, jewellery and accessories when they fit) and scored out of 100:

| Part | Casual, travel | Work, evening, festive |
|---|---|---|
| Color harmony (color wheel rules) | 40 | 30 |
| Weather and thermal index (feels-like + dosha + today's feeling) | 20 | 20 |
| Dress code for the occasion, routine and typed plans | 15 | 25 |
| Style / vibe (tropes, wished-for colors) | 10 | 10 |
| Body (dosha fabrics and colors) | 5 | 5 |
| Freshness (not worn in the last few days) | 10 | 10 |

Style and body points move to harmony when not set. Love it / Don't like feedback adds or removes up to 8 points, and today's "Don't like" answers filter pieces out entirely.

## Accounts

Each Google account gets its own on-phone database (`drape-u-<google id>`) and its own hidden Drive folder, synced in `src/lib/sync.ts` (newest edit wins; deletes are markers). There is no shared server. While the Google Cloud project is in Testing mode, each person's Gmail must be added under Google Auth Platform → Audience → Test users.

The rules live in `src/lib/outfit.ts` and `src/lib/harmony.ts`, with tests in `src/lib/engine.test.ts`.

## Privacy

Photos and closet data stay on the phone (and later your own Google Drive). Weather comes from [Open-Meteo](https://open-meteo.com); only the chosen city's coordinates are sent. No analytics, no accounts, no other servers.
