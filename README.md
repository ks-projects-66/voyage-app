# Voyage App

Voyage is the standalone product repository for the generic travel companion app separated from `ks-projects-66/le-grande-tour`.

## Architecture

Voyage is a **Vite + React** web app deployed to GitHub Pages, with a Supabase backend.

### Repository structure

```text
/
  index.html                    # Marketing page
  legal/                        # Privacy, terms, etc.
  docs/                         # Product specs and decision notes
  app/
    src/
      main.jsx                  # App entry point
      App.jsx                   # Root component
      components/               # React components (.jsx)
      lib/                      # Shared utilities (.js)
      styles.css                # Global styles
    public/                      # Static assets
    package.json
  supabase/
    functions/
      assistant/                # Gemini-backed Edge Function (place/story/doc modes)
    migrations/                 # Database schema and RLS
```

### Build and run

```bash
cd app
npm install
npm run dev        # Local dev server at http://localhost:5173
npm run build      # Compile to app/dist/
npm run preview    # Preview built app locally
```

### Backend

- **Supabase project:** `bsbuhkzdebqobkpxtivb`
- **Tables:** `wl_*` prefix (places, journal_entries, journal_photos, private_notes, trip_members, inbox)
- **Photos bucket:** `wl-photos`
- **Edge Function:** `assistant` (Gemini 2.5-flash) — generalized for place/story/doc extraction
- **Auth:** Supabase JWT via email/password and OAuth

### Deployment

App + docs + legal pages are assembled into the `gh-pages` branch and deployed via GitHub Pages:
- Marketing: `index.html` → `/`
- Docs: `docs/**` → `/docs/`
- Legal: `legal/**` → `/legal/`
- App: `app/dist/` → `/app/`

## Next steps for App Store

1. Supabase migrations and RLS codification.
2. Privacy policy, account deletion, and app review assets.
3. Capacitor iOS shell integration.
4. TestFlight submission and App Store review.
