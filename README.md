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
| `src/lib/` | Data rules and storage: garment model, catalog of categories, phone database, photo processing, Google Drive |
| `src/components/` | Shared UI pieces: panels, chips, toasts, error screen |
| `src/screens/` | The screens: Today, Closet, Spectrum, Add, piece details, Settings |

## Milestones

1. Google sign-in test on real phones — done
2. Closet: add photos, categories, grid, edit, delete — done
3. Colors and Spectrum
4. Today's outfit (weather, occasion, profession)
5. Google Drive sync across phones
6. Feedback loop, style tags, modesty, dosha, onboarding quiz
