# App Store roadmap

## 1. Current state

Voyage has been separated into its own product repository.

The product app exists and is materially functional in the original `le-grande-tour/app/index.html` source, including:

- user auth
- trip creation
- trip legs and date-derived itinerary
- today view
- days view
- journal
- explore list
- logistics notes
- photo upload
- recap sharing

The new repository currently contains:

- marketing page at `/`
- temporary app bridge at `/app/`
- documentation baseline for migration and App Store readiness

## 2. Required before iOS packaging

### 2.1 Source migration

- Import the full working `app/index.html` into this repository.
- Split it into a maintainable React structure.
- Remove browser Babel.
- Remove runtime CDN dependency for core app code.
- Install dependencies through npm.

### 2.2 Target web structure

```text
src/
  main.jsx
  App.jsx
  components/
  lib/
  styles.css
public/
  icons/
index.html
```

### 2.3 Backend controls

- Add Supabase schema migrations.
- Verify Row Level Security for every `wl_` table.
- Verify storage policies for `wl-photos`.
- Add a stable demo account and demo trip for App Review.

## 3. Required before App Review

- Privacy policy.
- Terms or acceptable use statement.
- Account deletion path.
- AI data processing disclosure for Gemini-backed features.
- Support URL.
- App Store screenshots.
- TestFlight build.
- Reviewer notes and demo login.

## 4. iOS packaging path

Recommended path: Capacitor.

```bash
npm install
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init Voyage com.greensquare.voyage
npx cap add ios
npx cap sync ios
npx cap open ios
```

## 5. Submission gates

Do not submit to the App Store until all gates are green.

| Gate | Pass condition |
|---|---|
| Build | Production web build completes without browser Babel |
| iOS shell | Runs on physical iPhone through Xcode |
| Auth | Sign up, sign in, sign out and delete account work |
| Data | RLS prevents cross-account access |
| Photos | Upload, display and delete work on iOS |
| Offline | App degrades gracefully under weak network |
| Review | Demo account and privacy policy are ready |
