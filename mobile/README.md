# Open Sky Food Park: Flutter app

The customer app for Android (iOS later). It matches the website: same catalog, same design
tokens, same light theme and the same ordering flow (one cart for every truck, one token per truck).

## Run it

```bash
node tool/sync-shared.mjs        # copy shared/seed/catalog.json and the photos it uses into assets/
flutter pub get
flutter run                      # with an emulator or phone connected
```

Or open `mobile/` in Android Studio and press Run.

## Demo mode (now)

There is no backend connection yet. The app reads the bundled catalog, keeps the cart and orders
on the phone (`shared_preferences`), and, because no truck dashboard receives demo orders, moves
each token along by itself (sent → preparing after ~12 s → ready after ~40 s → collected) so the
tracking screen can be tried. The app says so on Home and on the order page. Supabase and Stripe
come once the owner's projects exist (board rows B2 and B4).

## Layout

```
lib/
  main.dart            app, bottom tabs (Home, Search, Cart, Orders)
  theme/tokens.dart    colours, radii, motion, type scale from shared/design-tokens.json
  theme/theme.dart     Material theme (light only)
  data/models.dart     contract models (v1.3: menu_items.serves, description)
  data/catalog.dart    loads and indexes the catalog; money and bill helpers
  state/app_state.dart cart, checkout fields, demo orders, persistence
  ui/widgets.dart      FoodImage, DietMark, AddButton, TruckCard, DishCard, Rail, CartBar
  ui/reveal.dart       entrance animation (8px rise from a 2px blur; off with reduced motion)
  screens/             home, stall menu, dish, search, cart + checkout, order tracking, orders
tool/sync-shared.mjs   copies shared assets in (only images the catalog references)
```

Flutter 3.50 moved Material into its own package: import `package:material_ui/material_ui.dart`,
not `package:flutter/material.dart`.

## Notes for this PC

- Flutter is at `D:\dev\flutter` (on the user PATH). The Android SDK is in the user folder, whose
  name has a space, so Flutter and `ANDROID_HOME` use its 8.3 short path. Get it in cmd with
  `for %I in ("%LOCALAPPDATA%\Android\Sdk") do @echo %~sI`. Set it once with `flutter config --android-sdk <short path>`.
- `android/gradle.properties` sets `kotlin.incremental=false`: plugins sit in the pub cache on C:
  and this project on D:, and Kotlin's incremental cache cannot span drives on Windows.
- The PC has 16 GB of RAM. The emulator needs about 4 GB free; close heavy apps (or stop Gradle with
  `android\gradlew --stop`) if it refuses to start.
