# Assistant Edge Function

The working assistant source currently lives in:

```text
ks-projects-66/le-grande-tour/supabase/functions/assistant/index.ts
```

It supports:

- place extraction from raw notes or links
- grounded trip recap generation
- signed-in user gating before Gemini usage
- server-side Gemini key handling

Run `scripts/import-from-le-grande-tour.sh` from the repository root to copy the current function source into this folder.
