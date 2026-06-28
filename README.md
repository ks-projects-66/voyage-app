# Voyage App

Voyage is the standalone product repository for the generic travel companion app separated from `ks-projects-66/le-grande-tour`.

## Current repo shape

```text
/
  index.html                  # Voyage marketing page
  app/index.html              # Temporary product app bridge
  scripts/import-from-le-grande-tour.sh
  docs/
    app-store-roadmap.md
    source-map.md
    qa-checklist.md
```

## Source relationship

The source product currently lives in the old proof-of-concept repo:

- `le-grande-tour/voyage/index.html` → Voyage marketing page
- `le-grande-tour/app/index.html` → generic Voyage product app
- `le-grande-tour/supabase/functions/assistant/index.ts` → Gemini-backed Supabase Edge Function

This repo is now the clean product home. The immediate next production step is to import the full working app source, then convert it from a browser-runtime single HTML file into a compiled React/Vite/Capacitor iOS-ready app.

## App Store path

1. Import working app and marketing source.
2. Convert app from single-file browser Babel to Vite React.
3. Add Supabase migrations and RLS verification.
4. Add privacy policy, account deletion and app review assets.
5. Add Capacitor iOS shell.
6. Test through Xcode and TestFlight.
7. Submit to App Store Connect.

## Important note

The current `app/index.html` is a temporary bridge to the proven working app while the source is migrated. It is not the final App Store architecture.
