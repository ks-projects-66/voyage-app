# Voyage feature parity with Le Grand Tour — spec, risk, sequence

**Date:** 2026-06-30
**Goal:** Bring Voyage's three standout-but-missing capabilities up to Le Grand Tour (LGT) parity so the marketing page can make its strongest, *honest* claims:

1. **AI capture** — a photo / pasted link / ticket-PDF becomes structured place(s) or logistics, via the Gemini `assistant` edge function (confidence-scored, auto-add the confident ones, review the rest).
2. **Live two-traveller sync** — collaborators' changes appear without a manual refresh.
3. **Offline-first** — edits apply instantly and queue when offline, draining on reconnect, with a "N changes pending" indicator.

LGT is the reference implementation (single-file PWA at `~/dev/le-grande-tour/.worktrees/foundation/index.html`). Voyage is a Vite+React app (`app/src/`). This is a **port**, not a green-field build.

---

## 1. Current-state ground truth (what's already in place)

Reconnaissance of Voyage's Supabase project (`bsbuhkzdebqobkpxtivb`) and `app/src/` found the backend already provisioned for all three features:

| Dependency | Status | Evidence |
|---|---|---|
| `assistant` edge function | **Deployed, ACTIVE (v10)** | Gemini 2.5-flash, modes `place`/`story`/`doc`. Hardcoded to LGT's Europe cities/taxonomy → must be generalized. Dormant (no client calls it). |
| `gemini_api_key` secret | **Present, has value** | `app_secrets` row exists; function reads it server-side. |
| `wl_inbox` table | **Exists** | `(id, owner, trip_id, raw, kind, city, sorted, created_at)` — unsorted-capture store. |
| `wl_places` schema | matches capture output | `(id text, trip_id, city, cat, tag, name, area, note)` — aligns with assistant `place` items. |
| Realtime publication | **empty** | `pg_publication_tables` returns 0 rows → additive `ALTER PUBLICATION` needed. |
| Write chokepoint | single | All ~22 write sites call `runSave(label, op)` in `TripApp.jsx:52-64`; `db` methods in `helpers.js:265-437` already `throw` on error (so `error.code` is catchable). |

**Implication:** the dependency that would normally be the blocker (a server-side Gemini key + function) is already satisfied. Remaining work is mostly **client-side** plus one **edge-function generalization** and one **publication ALTER**.

### Voyage write sites to route through `mutate()` (from code map)
- Places: `Explore.jsx` addPlace (~:28), upsertStatus (been/rated/plannedDay) (~:53,64,288,356)
- Journal: `Journal.jsx` add (~:30), update (~:169), delete (~:45), deletePhoto (~:162); `Explore.jsx` rate→addJournal (~:111); `ShareRecap.jsx` quick-capture (~:79)
- Private notes: `TripApp.jsx` add (~:171), delete (~:164)
- Collaboration / recap: `ShareRecap.jsx` invite (~:19), remove (~:46), publish (~:28)
- Local-only today (candidates to also persist later): plan done/add, weather override (`TripApp.jsx` `setLocal`)

---

## 2. Feature specs

### Feature A — Offline-first (`mutate` + queue)
**Port from LGT** index.html:539–592 (mutate/queue/replay), 893–899 (online/init flush), 845/1012 (pending indicator).

- New `lib/sync.js`: `enqueue(op)`, `readQueue/writeQueue`, `queueLength`, `replay(op)` (switch over `op.kind` → `db.*`), `flushQueue(onChange)` (FIFO, swallow `23505` as already-applied, stop on other errors). Queue key `voyage:queue`.
- New `mutate({apply, revert, op, dbCall})`: optimistic `apply()`; if offline → `enqueue` + pending++; else `await dbCall()` then `flushQueue`; on error, network-ish → enqueue, logical → `revert()`.
- Wire `pending` state + an indicator in the existing sync row (`TripApp.jsx:114`); flush on `online` event and on mount.
- Convert each write site from `runSave(label, () => db.x())` to `mutate({apply, revert, op:{kind,args}, dbCall})`. Keep `runSave`'s status-flash for online saves (fold into `mutate`).

**Acceptance:** toggle a status / add a place while offline → UI updates, "1 change pending" shows; reconnect → queue drains, indicator clears, row persists after reload. Replaying twice is a no-op (idempotent upserts; `23505` swallowed).

### Feature B — Live sync (realtime)
**Port from LGT** index.html:57 (`REALTIME_TABLES`), 946–955 (channel + 300ms-debounced `refresh`, cleanup), 907–933 (`isFetching` guard).

- Migration (additive): `alter publication supabase_realtime add table wl_places, wl_place_status, wl_journal_entries, wl_journal_photos, wl_private_notes, wl_inbox, wl_trip_members;`
- `TripApp.jsx`: a `useEffect([trip.id])` that opens `supabase.channel('trip:'+trip.id)`, subscribes `postgres_changes *` per table filtered `trip_id=eq.<id>`, debounced 300ms → `refresh()`; `removeChannel` on cleanup. Add an `isFetching` ref guard to `refresh()`.

**Acceptance:** two browsers signed into the same trip; a write in one appears in the other within ~1s without manual refresh; no refetch storms (debounce + guard).

### Feature C — AI capture
**Port from LGT** index.html:597–660 (`aiCapture`/`aiStory`/`aiExtractDoc` clients), 1737–1754 (`MultiReview`), 1862–1893 (dedupe + confidence auto-add + 6s undo), 169 (`AUTOADD_MIN=0.7`). **Generalize** the deployed edge function for arbitrary trips.

- **Edge function** (`assistant`): accept `cities[]`, `cats[]`, `tags[]` from the request and build prompts/schema from them; drop the hardcoded Paris/Bordeaux/… and "a couple"/Sydney assumptions; default leniently when omitted (don't constrain city/tag). Redeploy. *Reversible: current is v10 — note its sha for rollback.*
- **Client** `lib/ai.js`: `aiCapture({input, files})`, `aiExtractDoc(file)`, `aiStory(entries, trip)` — POST to `/functions/v1/assistant` with bearer token, ≤4 images, base64 (strip data: prefix), 8MB guard. Pass the trip's real cities + Voyage's `CATS`/`TAGS` from `constants.js`.
- **UI** in `Explore.jsx`: a "capture" entry (paste link / pick photos) → spinner → dedupe vs existing places → `confidence ≥ 0.7` auto-add via `mutate` + 6s Undo toast; the rest into a `MultiReview` sheet (checkbox multi-select, "check this one" on low-confidence, edit-before-add). Optionally land raw captures in `wl_inbox` first (table exists) with an Inbox review affordance.
- **Doc mode** wires into private-notes add (ticket/PDF → logistics items).

**Acceptance:** paste a restaurant URL → a place appears with sensible city/cat/tag; a photo of a menu/sign → place(s) extracted; low-confidence items wait in review; a ticket PDF → logistics items. Requires a signed-in user (function enforces JWT).

---

## 3. Build-risk assessment

| Risk | Sev | Likelihood | Mitigation |
|---|---|---|---|
| Live app used by real friends; prior data-loss incident on a sibling project | High | — | Branch-only dev; **additive** schema/publication (no drops); client queue is idempotent; deploy per-stage after verification; keep marketing & app deploys separate. |
| `mutate` refactor touches 22 sites → regressions in save paths | Med | Med | Single shared `mutate`; convert site-by-site; headless smoke each tab; keep `runSave` semantics for online flash. |
| Realtime refetch storms / echo of own writes | Med | Med | 300ms debounce + `isFetching` guard; optimistic apply means self-echo is a no-op refresh. |
| Edge-function generalization breaks the (dormant) function | Low | Low | Function is Voyage-only now (LGT moved off); reversible via version history; validate on deploy; test with a real token before client ships. |
| Gemini cost/quota abuse | Low | Low | Function already gates on `verify_jwt` + authenticated user; ≤4 images + 8MB client guard. |
| HEIC/oversized photos on iOS | Med | Med | Client `compressImage` + 8MB guard with clear error (port from LGT). |
| Cannot fully verify AI auth path or two-browser/offline drain without a running app + logged-in user(s) | **Med** | High | **Human verification gate** (see §5). Even LGT has not had its two-browser/offline-drain manual pass yet. |

**Overall:** Medium. The backend being pre-provisioned removes the biggest unknown. The residual risk is (a) breadth of the client refactor and (b) **verifiability** — the most important paths need the running app + a human, which is the explicit gate below.

---

## 4. Plan QA (self-review)

- **Idempotency:** queue replay must be safe to run twice. `upsert`-based writes + swallowing `23505` cover inserts; **deletes** of an already-deleted row are no-ops (fine). `addJournal`/`addPlace` use client-generated ids → re-insert hits `23505` → swallowed. ✓
- **Optimistic id stability:** apply() must use the **same id** the dbCall persists (client-generate ids up front), else realtime refresh creates duplicates. ✓ (LGT pattern)
- **Photos are online-only in LGT** (never queued) — replicate: don't enqueue blob uploads; queue only the row writes. ✓
- **Realtime + optimistic interplay:** my own write echoes back via realtime → `refresh()` returns the same row I already applied → no visual change (guard prevents overlap). ✓
- **Edge-function taxonomy:** Voyage's `CATS` match LGT's; **`TAGS` may differ** — must pull Voyage's own `constants.js` tags and pass them, or tag output will be wrong. ⚠ Confirm in build.
- **Story mode** still references a couple/Sydney — generalize or it mis-narrates multi-traveller trips. ⚠
- **Open questions:** (1) Do we want raw captures to pass through `wl_inbox` (review tray) or go straight to places? LGT supports both via an auto-sort toggle. (2) Multi-device same-user (not just two users) also benefits from realtime — confirm desired. (3) Plan/weather are localStorage-only today; out of scope for parity but worth noting they won't sync.

---

## 5. Staged sequence & gates

Each stage is independently shippable and verified before the next. App-feature code reaches `main` **only after its stage is verified** (the user's "once you've done that, push" ordering).

- **Stage 0 — Branch + scaffold.** `feat/parity` branch; add `lib/sync.js`, `lib/ai.js` stubs; no behavior change. *Verify: build passes, app mounts (headless).*
- **Stage 1 — Offline-first (Feature A).** Lowest external dependency, highest value/risk ratio. *Verify: headless smoke of offline enqueue→reconnect drain; manual: edit offline in one tab, reload.*
- **Stage 2 — Live sync (Feature B).** Additive publication ALTER + channel. *Verify (human gate): two browsers, one trip, change propagates < ~1s.*
- **Stage 3 — AI capture (Feature C).** Generalize+redeploy edge function; client + UI. *Verify (human gate): signed-in, link/photo/PDF capture produces sensible items; low-confidence review works.*
- **Stage 4 — Marketing truth-up.** Once A–C are live and verified, update the marketing page to claim AI capture / live sync / offline-first.

**Human-verification gates (cannot be done by the agent alone):**
- A signed-in Voyage account + JWT to exercise the `assistant` function end-to-end.
- Two concurrent browsers for realtime.
- Offline toggle + reload for queue drain.
These are the same manual passes LGT still owes itself; flag, don't fake.

---

## 6. Rollback notes
- Edge function: redeploy keeps version history; record pre-change sha `8da0ddd727ab32f7dde73d4f002c313f34bca79872dfc6699e95750aabab075b` (v10) for rollback.
- Publication: `alter publication supabase_realtime drop table <t>;` reverses Stage 2.
- Client: all on `feat/parity`; revert by not merging.
