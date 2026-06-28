#!/usr/bin/env bash
set -euo pipefail

SOURCE_RAW="https://raw.githubusercontent.com/ks-projects-66/le-grande-tour/main"

mkdir -p app supabase/functions/assistant docs

curl -fsSL "$SOURCE_RAW/voyage/index.html" -o index.html
curl -fsSL "$SOURCE_RAW/app/index.html" -o app/index.html
curl -fsSL "$SOURCE_RAW/supabase/functions/assistant/index.ts" -o supabase/functions/assistant/index.ts

# The original marketing page lived under /voyage/ and linked to ../app/.
# In this repository the marketing page lives at /, so point it to ./app/.
perl -0pi -e 's#\.\./app/#./app/#g' index.html

cat > docs/source-import.md <<'DOC'
# Source import

Imported from `ks-projects-66/le-grande-tour`.

- `voyage/index.html` -> `index.html`
- `app/index.html` -> `app/index.html`
- `supabase/functions/assistant/index.ts` -> `supabase/functions/assistant/index.ts`

The next production step is to convert the app from a single-file browser-runtime prototype into compiled React/Vite/Capacitor source.
DOC

echo "Voyage source imported. Review diff, then commit."
