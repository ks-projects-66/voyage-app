# Source map

## Purpose

This document records how the standalone `voyage-app` repository maps back to the original proof-of-concept repository.

## Source repository

`ks-projects-66/le-grande-tour`

## Product source files

| Old path | New path | Status |
|---|---|---|
| `voyage/index.html` | `index.html` | Marketing page recreated in the new repo |
| `app/index.html` | `app/index.html` | Temporary bridge to current working app |
| `supabase/functions/assistant/index.ts` | `supabase/functions/assistant/index.ts` | To be imported |
| Supabase tables prefixed `wl_` | `supabase/migrations/` | To be codified as migrations |

## Target architecture

```text
voyage-app/
  index.html                    # Marketing page
  app/                          # Web app path while PWA/static remains live
  src/                          # Future React source
  public/                       # Static assets and icons
  supabase/
    migrations/                 # Database schema and RLS
    functions/
      assistant/                # Edge Function source
  ios/                          # Future Capacitor iOS project
  docs/                         # Product, QA and App Store controls
```

## Migration principle

Do not keep Le Grand Tour and Voyage coupled. Le Grand Tour remains the personal trip proof-of-concept. Voyage becomes the production product.

## Next source task

Import the full working `app/index.html` source into this repo, then split it into a Vite React structure.
