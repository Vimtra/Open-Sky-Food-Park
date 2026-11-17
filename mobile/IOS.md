# Open Sky iOS app

The iOS app is the same Flutter app as Android (`mobile/`). There is no Mac here, so iOS is built in the cloud on GitHub's macOS machines by `.github/workflows/ios.yml`, the same approach as [ios-builder](https://github.com/MobAI-App/ios-builder).

Who owns what (see `COLLAB.md`): Dart code and Android are Claude B's; `mobile/ios/` and the iOS workflow are Claude A's.

## Build it

- Every push to `main` that touches `mobile/` (except `mobile/android/`) or the shared menu builds it automatically.
- Or run it by hand: GitHub → **Actions → iOS build → Run workflow**.
- Download the result from the run's **Artifacts**:
  - `OpenSky-ios-unsigned.ipa`: the iPhone app, not yet signed.
  - `OpenSky-ios-simulator.zip`: the app for the iOS Simulator (for previews on Appetize or MobAI).

The repository is public, so GitHub's macOS build minutes are free.

## Put it on an iPhone

Apple only lets signed apps run. Pick one:

| Way | Cost | Good for | Limits |
|---|---|---|---|
| **Free Apple ID + re-signing tool** (MobAI, Sideloadly or AltStore on Windows) with the unsigned IPA | free | trying it on your own phone | app stops opening after 7 days until re-installed; max 3 apps per device |
| **Apple Developer Program**, ad-hoc or development build | $99 / year | a few testers' registered iPhones | up to 100 devices a year |
| **TestFlight** | Developer Program | testers by email link | builds expire after 90 days |
| **App Store** | Developer Program | customers | Apple review |

## Signed builds, TestFlight and the App Store (needs the $99 Developer Program)

1. Join the Apple Developer Program with the business's Apple ID.
2. App Store Connect → **Users and Access → Integrations → App Store Connect API**: create a key with **Admin** (or App Manager) access. Download the `.p8` file once.
3. Create the app record in App Store Connect: bundle id **`com.openskyfoodpark.openSky`**, name "Open Sky Food Park".
4. Install the ios-builder CLI (Windows release `builder-windows-amd64.exe`, renamed to `builder.exe`), then from `mobile/`:

   ```bash
   builder auth github
   ```

   ```bash
   builder auth apple
   ```

   ```bash
   builder signing setup
   ```

   ```bash
   builder ios release
   ```

   `builder` keeps the certificate and profile as GitHub secrets and uploads to TestFlight. Keys never go into the repository.

## iOS settings in this project

- Name on the home screen: **Open Sky**. Bundle id `com.openskyfoodpark.openSky`. iOS 15 or later. iPhone portrait only; iPad any orientation.
- App icon: the fork-in-the-O mark from the logo on night navy (`shared/img/brand/open-sky-icon.svg`). Launch screen: the full logo on night navy.
- Sign-in callback: `openskyfoodpark://login-callback` (add it to Supabase → Authentication → URL Configuration → Redirect URLs).
- Declares no non-exempt encryption, so TestFlight uploads skip the export question.

## Before the App Store

- A privacy policy URL and support URL (the website's `/help` and `/contact` can serve as support).
- App Store screenshots (6.9" and 6.5" iPhone, 13" iPad if iPad stays supported).
- Apple guideline 4.8: an app that offers Google sign-in must also offer a privacy-focused option such as **Sign in with Apple**. Add it before submitting (Supabase supports Apple as a provider).
- The app currently runs on demo data; it needs the Supabase connection first (board items A9, B2).

## Screenshots without installing anything

Each iOS build also opens the app on iPhone and iPad Simulators in the cloud and takes screenshots (launch screen and home screen). See them:

- on the build's page: **Actions → iOS build → the run → Summary**, or
- always the latest: https://github.com/Vimtra/Open-Sky-Food-Park/tree/ios-screenshots

They show only the first screens, because the build cannot tap through the app. To click around, upload `OpenSky-ios-simulator.zip` to appetize.io.
