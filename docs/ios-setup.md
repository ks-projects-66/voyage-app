# Voyage — iOS build & App Store setup

The web app is already wrapped for native with **Capacitor** (config, plugins and
native bridges are in place). The remaining steps must run on a **Mac with Xcode** —
they generate and build the native iOS project, which cannot be produced on Windows.

## Prerequisites
- macOS with **Xcode** (latest) and the iOS SDK
- **CocoaPods** (`sudo gem install cocoapods`)
- **Node 20+**
- An **Apple Developer Program** membership ($99/yr), signed in to Xcode
- This repo cloned, with `cd app && npm install` run once

## 1. One-time: generate the native iOS project
```bash
cd app
npm install
npm run build                       # produces app/dist (what Capacitor ships)
npx cap add ios                     # creates app/ios/ (the Xcode project)
npx @capacitor/assets generate --ios  # builds icons + splash from app/resources/*
npx cap sync ios                    # copies web build + installs native pods
npx cap open ios                    # opens the project in Xcode
```
`app/resources/icon.png` (1024²) and `app/resources/splash.png` (2732²) are already
in the repo, so the asset generator has what it needs.

## 2. Add the required permission strings
Capacitor's Camera plugin **will crash on launch of the photo picker** without these.
In Xcode, open `ios/App/App/Info.plist` and add:

| Key | Suggested value |
|---|---|
| `NSCameraUsageDescription` | `Voyage uses the camera so you can add a photo to a journal entry.` |
| `NSPhotoLibraryUsageDescription` | `Voyage needs photo access so you can attach photos to your trip journal.` |
| `NSPhotoLibraryAddUsageDescription` | `Voyage saves photos you add to your journal.` |

## 3. Configure signing & identity in Xcode
- Select the **App** target → **Signing & Capabilities** → choose your **Team**; let
  Xcode manage signing.
- Confirm **Bundle Identifier** = `com.greensquare.voyage` (matches `capacitor.config.ts`).
- Set **Display Name** = `Voyage`, a **Version** (e.g. `1.0`) and **Build** (e.g. `1`).
- Deployment target: iOS 14+ is a safe floor.

## 4. Run on a device, then submit
```bash
# after ANY web change, re-sync the native shell:
npm run build && npx cap sync ios
```
- Run on a physical iPhone from Xcode and walk the QA checklist (`docs/qa-checklist.md`).
- **Product → Archive** → **Distribute App** → **App Store Connect** → upload.
- The build appears in **TestFlight**; test it there before submitting for review.

## 5. App Review essentials (App Store Connect)
- **Privacy policy URL:** `https://ks-projects-66.github.io/voyage-app/legal/privacy.html`
- **Support URL:** `https://ks-projects-66.github.io/voyage-app/legal/support.html`
  - ⚠️ Replace the `SUPPORT_EMAIL` placeholder in `legal/*.html` with your real
    support address before submitting (reviewers email it).
- **Account deletion:** implemented in-app (Your trips → Delete account) — point this
  out in the review notes; it satisfies Guideline 5.1.1(v).
- **Demo account:** create a stable reviewer login with a sample trip, and put the
  credentials in **App Review Information → Sign-In required**.
- **Privacy "nutrition label":** declare what's collected — Email + User Content
  (trips, journal, photos), linked to identity, used only for app functionality;
  **no tracking, no ads, no analytics, no precise location** (matches the app).
- **Auth hardening:** enable **leaked-password protection** in the Supabase
  dashboard (Authentication → Policies) before launch.

## Native capabilities wired (helps pass Guideline 4.2)
- Native **share sheet** for recap links (`@capacitor/share`)
- Native **camera / photo library** picker for journal photos (`@capacitor/camera`)
- **Status bar** styling + **splash screen** handling on launch
- **Haptics** on photo capture
- Safe-area insets respected (notch + home indicator)

All native paths fall back to standard web behavior in the browser build, so the
PWA at `/app/` keeps working unchanged.
