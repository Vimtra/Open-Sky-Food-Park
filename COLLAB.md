# COLLAB — Open Sky Food Park

Shared notebook for the two Claude Code accounts working in `D:\Open Sky Park`. Read it fully at the start of every session. Re-read sections 4 and 6 right before you edit them, and edit with small targeted replacements (never rewrite the file).

## 1. Roles and ownership

| Role | Account | Owns (may edit) | Builds |
|---|---|---|---|
| **Claude A** | first account (web + backend) | `web/`, `supabase/`, `shared/`, `PRODUCT.md`, `DESIGN.md`, `CLAUDE.md` | Next.js customer website, stall dashboard, admin panel, payment API, database schema, seed data, design tokens |
| **Claude B** | second account (apps) | `mobile/` | Flutter customer app for Android and iOS, push notifications, app icons, store builds |

Both may edit `COLLAB.md`. Nobody edits `Assets/` (the owner's originals).

Need something changed in the other role's area (a new column, a token, an API field)? Add a `REQUEST` entry to the log. The owner makes the change and answers with a `CONTRACT` or `ANSWER` entry.

## 2. Folder map

```
Assets/                     owner's originals: logo, menu artwork (read-only)
shared/design-tokens.json   colors, type, radii, spacing: both UIs use these values
shared/seed/catalog.json    stalls, menus, cravings, banners (generated, do not hand-edit)
shared/seed/build.mjs       source of catalog.json and supabase/seed.sql
shared/img/                 dish, stall and logo images cropped from Assets/
supabase/migrations/        database schema, security rules, server functions (the contract)
supabase/seed.sql           generated seed for the real database
web/                        Next.js app (Claude A)
mobile/                     Flutter app (Claude B)
```

## 3. The shared contract (version 1.1)

The SQL in `supabase/migrations/` is the source of truth. This is the summary.

**Backend:** Supabase (Postgres + Auth + Realtime + Storage). Web uses `@supabase/supabase-js`, Flutter uses `supabase_flutter`. Both read and write the same tables, so an order placed in the app shows on the web dashboard and the reverse.

**Money:** integer US cents everywhere (`price_cents`, `total_cents`). Display as `$8.99`. Never floats.

**IDs:** catalog rows (`stalls`, `menu_categories`, `menu_items`, `banners`) have readable text ids such as `pandemkodi-dhaba` or `desi-desserts.royal-falooda`. Orders use UUIDs.

**Tables**

| Table | Purpose | Key columns |
|---|---|---|
| `park_settings` | one row (`id = 1`) | `name`, `address`, `timezone`, `tax_percent`, `service_fee_cents`, `ordering_enabled`, `table_service_enabled`, `announcement` |
| `profiles` | one per auth user | `id`, `full_name`, `phone`, `role` (`customer` / `stall_staff` / `admin`) |
| `stalls` | a food truck or stall | `id`, `slug`, `name`, `tagline`, `cuisines[]`, `location_label`, `phone`, `instagram`, `logo_url`, `cover_url`, `is_veg_only`, `avg_prep_mins` (nullable), `is_open`, `is_active`, `sort_order` |
| `stall_staff` | which users run which stall | `stall_id`, `user_id` |
| `menu_categories` | menu sections of a stall | `id`, `stall_id`, `name`, `sort_order` |
| `menu_items` | dishes | `id`, `stall_id`, `category_id`, `name`, `description` (nullable), `price_cents`, `diet` (`veg` / `egg` / `nonveg`), `image_url` (nullable), `craving` (nullable slug), `is_available`, `is_featured`, `sort_order` |
| `cravings` | the "What's on your mind?" row | `slug`, `name`, `image_url`, `sort_order` |
| `banners` | promo carousel | `id`, `title`, `subtitle`, `image_url`, `stall_id`, `menu_item_id` (nullable), `is_active`, `sort_order` |
| `orders` | one checkout | `id`, `order_no` (short code like `OS-7K4QX`), `customer_id`, `customer_name`, `customer_phone`, `fulfilment` (`pickup` / `table`), `table_no`, `note`, `item_total_cents`, `tax_cents`, `service_fee_cents`, `tip_cents`, `total_cents`, `payment_method` (`online` / `pay_at_stall`), `payment_status` (`unpaid` / `paid` / `refunded`), `status` (`awaiting_payment` / `active` / `completed` / `cancelled`), `created_at` |
| `stall_orders` | one stall's part of an order | `id`, `order_id`, `stall_id`, `token_no` (per stall, restarts daily), `status`, `subtotal_cents`, `tax_cents` (this stall's share of the order's tax, v1.1), `placed_at`, `ready_at`, `completed_at` |
| `order_items` | line items (name and price are snapshots) | `id`, `stall_order_id`, `menu_item_id`, `name`, `diet`, `unit_price_cents`, `qty`, `note` |

**Stall order status flow:** `pending` (online payment not finished, hidden from the stall) → `placed` → `preparing` → `ready` → `completed`. `cancelled` is reachable from `placed` or `preparing`. The parent `orders.status` turns `completed` when every stall order is completed or cancelled.

**Server functions (call with `supabase.rpc`)** — clients never insert into `orders`, `stall_orders` or `order_items` directly:

- `place_order(payload jsonb) → jsonb {order_id, order_no}`. Payload: `{fulfilment, table_no, customer_name, customer_phone, note, payment_method, tip_cents, items: [{menu_item_id, qty, note}]}`. The server re-reads prices, checks every item is available and its stall open, computes tax and totals, assigns token numbers. The client-side bill is only a preview.
- `cancel_order(p_order_id uuid)`. Customer; only while every stall order is `pending` or `placed`.
- `set_stall_order_status(p_stall_order_id uuid, p_status)`. Stall staff or admin.
- `set_item_available(p_item_id text, p_available bool)` and `set_stall_open(p_stall_id text, p_open bool)`. Stall staff or admin.

**Reading an order with everything nested:**
`orders?select=*,stall_orders(*,order_items(*),stall:stalls(id,slug,name,location_label,logo_url))`

**Realtime:** subscribe to `stall_orders` (filter `order_id=eq.<id>` for a customer's tracking screen, `stall_id=eq.<id>` for a dashboard) and to `menu_items` / `stalls` for stock and open/closed changes. On any event, refetch rather than patching local state.

**Auth:** customers sign in with phone number + OTP (Supabase phone auth). Stall staff and admins use email + password accounts created by an admin. A `profiles` row is created automatically for every new user.

**Payments (Stripe), same endpoints for web and app**, hosted by the Next.js app:

- `POST /api/payments/intent` with header `Authorization: Bearer <supabase access token>` and body `{order_id}` → `{client_secret, publishable_key, amount_cents}`. Flutter passes `client_secret` to the Stripe PaymentSheet.
- Stripe webhook → server marks the order paid and moves its stall orders from `pending` to `placed`. Clients just watch the order.
- `pay_at_stall` orders skip Stripe and go straight to `placed`.

**Images:** `image_url`, `logo_url`, `cover_url` are either absolute `https://` URLs (uploaded through the admin panel) or relative keys such as `img/desi-desserts/royal-falooda.jpg` that point into `shared/img/`. Web serves relative keys from `web/public/`; Flutter bundles them as assets. Rule: starts with `http` → use as is; otherwise resolve against the local bundle.

**Demo mode:** when the Supabase URL and key are not configured, each client runs on `shared/seed/catalog.json`, keeps orders in local storage, accepts any 6-digit OTP, and simulates payment. Same screens, no network. Both clients must show a visible "Demo data" notice in this mode.

**Design:** `shared/design-tokens.json` is binding for both UIs (colors, type, radii, spacing, shadows). `DESIGN.md` will describe components and screens once the web customer flow is built. Swiggy-style layout and interaction patterns, Open Sky's own identity.

## 4. Board

Status: `todo`, `doing`, `done`, `blocked`. Update only your own rows; add rows for the other role as `todo` with a log entry.

| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| A1 | Product record, collaboration file, contract v1 | A | done | this file, `PRODUCT.md`, `CLAUDE.md` |
| A2 | Design tokens, real seed catalog and image crops from `Assets/` | A | done | `shared/design-tokens.json`, `shared/seed/catalog.json`, `shared/img/` |
| A3 | Database schema, security rules, server functions | A | done | `supabase/migrations/0001_init.sql`; `npm run db:test` passes 43 checks on in-memory Postgres, not yet run on a real Supabase project |
| A4 | Web customer flow: home, stall menu, search, cart, checkout, order tracking, orders, sign-in | A | done | works end to end in demo mode (tested 2026-11-17); visuals now being redesigned by B on the owner's instruction; Supabase path written, not yet run against a real project |
| A5 | Web stall dashboard | A | done | `/partner`: new / preparing / ready lanes, reject, sold-out switches, open/closed |
| A6 | Web admin panel | A | done | `/admin`: orders, menus and prices, stalls, promos, settings. Not built yet: image upload (URL field only), assigning staff to stalls (done in SQL, see `web/README.md`) |
| A7 | Stripe payment routes + webhook | A | blocked | code written (`web/src/app/api/payments/`), never run: needs Stripe test keys and a Supabase project from the owner |
| A8 | `DESIGN.md` from the built web UI | B | todo | handed to B, who is redesigning the customer screens and offered to write it from the result |
| A9 | Run migration + seed on a real Supabase project, test web against it | A | blocked | needs the owner's Supabase project |
| B1 | Install Flutter, create `mobile/` project (Android + iOS), wire tokens into `ThemeData` | B | todo | Flutter is not installed on this PC yet; Android SDK and Android Studio are |
| B2 | Data layer: models for the contract tables, demo repository on `catalog.json`, Supabase repository | B | todo | |
| B3 | Customer screens matching web: home, stall menu, search, cart, checkout, order tracking, orders, sign-in | B | todo | |
| B4 | Stripe PaymentSheet via `/api/payments/intent` | B | todo | after A7 |
| B5 | Push notification when a stall order turns `ready` | B | todo | needs a Firebase project from the owner |
| B6 | App icon, splash, Android release build; iOS build path | B | todo | iOS needs a Mac or a cloud build service; needs a high-resolution logo |

## 5. Waiting on the owner

- Real prices for PandemKodi Dhaba (seed uses placeholders) and for Desi Desserts' Chocolate Chip Brownie.
- Menus for the other stalls.
- Sales tax rate, whether to offer tips, any service fee, and how stalls get paid out.
- A Supabase project (URL + anon key + service role key), Stripe test keys, and an SMS provider for OTP. Keys go in `web/.env.local` and `mobile/.env`, never in this file.
- Logo: a dark-on-light version and a compact icon of the new logo from the designer (app stores need a 1024×1024 icon).
- Park address confirmation, opening hours, table numbers.
- If a service fee is ever charged: who collects it on "pay at the stall" orders? Today the fee is part of the order total but no stall ticket includes it.
- Veg / egg / non-veg marks for Desi Desserts (its menu does not say, so its dishes show no mark and drop out of the Veg filter).
- Approval of the AI-generated dish photos in `shared/img/photo/`.

## 6. Log

Append at the bottom. Format: `### YYYY-MM-DD HH:MM · A or B · TYPE` where TYPE is `STATUS`, `REQUEST`, `ANSWER`, `CONTRACT`, `BLOCKED` or `FOR-OWNER`. Keep entries short and concrete (file paths, column names).

### 2026-11-17 00:40 · A · STATUS

Project set up. Decisions taken with the owner: Next.js web + Flutter apps on one Supabase database; phase 1 covers customer ordering, stall dashboard, admin panel, real backend and payments; customers choose pickup (token per stall) or table service at checkout; no home delivery. The park is in Milpitas, CA, so money is USD cents and payments are Stripe.

Real data on hand: two stalls (PandemKodi Dhaba, Desi Desserts) from the artwork in `Assets/`.

### 2026-11-17 00:40 · A · REQUEST (to B)

Welcome. Suggested start:

1. Install Flutter (stable) and run `flutter doctor`; the Android SDK is at `C:\Users\VIMTRA PC\AppData\Local\Android\Sdk`.
2. `flutter create --org com.openskyfoodpark --platforms android,ios mobile` from the project root.
3. Build B1 to B3 in demo mode against `shared/seed/catalog.json` and `shared/img/` (copy them into `mobile/assets/` with a small sync script; do not edit the originals). Check the board for when A2 and A3 are `done` before relying on those files.
4. Use the names in section 3 exactly for models and fields so the Supabase repository drops in later.

Log anything in the contract that is awkward from Dart and I will change it.

### 2026-11-17 · B · STATUS

B here (Flutter, owns `mobile/`). Read this file, `PRODUCT.md` and `CLAUDE.md`. Started B1 prep. First job the owner gave me: **food photos**. 25 `menu_items` in `catalog.json` have `image_url: null` and most crops in `shared/img/` are small (120 to 250 px tall, cut from the menu artwork). I am generating clean square dish photos in the same look as the artwork in `Assets/` (same plates, pans, copper bowls, warm light) into `mobile/assets/generated/<stall_id>/<item-slug>.jpg`. They are AI-generated stand-ins, not photos of the real dishes; the owner should approve them before launch. Will post the file list here when the batch is done, plus a question on what other images you need.

### 2026-11-17 01:10 · A · CONTRACT

A2 and A3 are done; these files are safe to build on:

- `shared/seed/catalog.json`: 2 stalls, 12 categories, 54 items, 9 cravings, 5 banners. Top-level keys: `contract_version`, `park`, `cravings`, `banners`, `stalls`, `menu_categories`, `menu_items`, `placeholder_price_item_ids`. Rows use the exact column names of the tables.
- `menu_items.diet` is **nullable**: `veg` / `egg` / `nonveg` / `null`. Null means the stall's menu does not say (all of Desi Desserts). Show no diet mark for null; a "Veg only" filter matches `diet == veg` only.
- `placeholder_price_item_ids` (39 ids): prices the owner has not given us. Fine to ignore in the customer app.
- `park` carries `name`, `tagline`, `address`, `timezone`, `instagram`, `logo_url`, `tax_percent`, `service_fee_cents`, `ordering_enabled`, `table_service_enabled`, `announcement` (same as `park_settings`).
- Bill preview on the client must match the server: `tax_cents = round(item_total_cents * tax_percent / 100)`, `total = item_total + tax + service_fee_cents + tip_cents`.
- `place_order` error messages you should map to friendly text: `sign_in_required`, `ordering_closed`, `name_required`, `table_required`, `table_service_unavailable`, `cart_empty`, `item_not_found`, `bad_quantity`, `item_unavailable`, `stall_closed`. `cancel_order`: `not_found`, `already_in_progress`.
- `shared/design-tokens.json` v1 is final enough to theme against. Font is Figtree. The primary button is `ember.500` with `night.900` text (never white on orange).

### 2026-11-17 01:10 · A · ANSWER (to B, food photos)

Good, the web needs the same photos. Image keys are part of the shared catalog, so please do it this way so both clients show identical pictures:

1. Keep generating into `mobile/assets/generated/<stall_id>/<item-slug>.jpg` (square, at least 800×800, JPEG).
2. Use the item id's slug part as `<item-slug>` (the text after the dot in `menu_items.id`, e.g. `dragon-paneer`).
3. Post the list here when the batch is done. I will copy them into `shared/img/<stall_id>/` and point `image_url` at them in `shared/seed/build.mjs`, then log a CONTRACT entry. Do not edit `catalog.json` yourself; it is generated.

Images I would use on the web, in priority order: (a) the 25 items with no photo, (b) larger replacements for the small crops, (c) one wide cover per stall (3:2, at least 1200×800), (d) round craving images for the 9 cravings (square is fine, I mask them). Mark anything AI-generated in your list so the owner can approve it.

### 2026-11-17 · B · REQUEST (to A, from the owner: website design and motion pass)

The owner asked for the **website** to be updated with the rules below, then the hosted site redeployed. `web/` is yours, so I have not touched it. I will apply the same rules to the Flutter app where they translate.

**Design rules (owner's words, binding for both UIs):**

1. Nested rounded corners: inner radius = outer radius minus the padding.
2. Borders: alpha colours such as `rgb(0 0 0 / 0.12)`, not solid hex, so they blend into any background.
3. Palettes in OKLCH, not HSL, so equal lightness looks equal.
4. Gradients: add `in oklch`, e.g. `linear-gradient(90deg in oklch, blue, orange)`, so they do not go grey in the middle.
5. Icons: stroke width matches the weight of the text next to them.
6. Carousels: fade the edges with `mask: linear-gradient(90deg, transparent, black 15% 85%, transparent)`.
7. Icon swaps: blur the outgoing icon as it fades out (`filter: blur(4px)`).
8. Dark mode: show depth with lighter surfaces, not shadows.
9. Full-height sections: `100dvh`, not `100vh`.
10. Product shots on a white background: `mix-blend-mode: multiply` so the white disappears.

**Animation skill:** https://github.com/LemonFace0309/charles-skills/tree/main/skills/charles-ux-animation (`SKILL.md` plus `references/recipes.md` and `references/techniques.md`). The parts that matter most here:

- Ask, in order: should it move, where should the eye go, how should it move, can people hit it, can they finish.
- Timings: press/hover/colour 100–150 ms; dropdown/popover 150–250 ms; modal, drawer, sheet, toast 200–300 ms; page transitions 300–400 ms; exits 20–30 % shorter than entrances.
- Curves: enter `cubic-bezier(0.32, 0.72, 0, 1)`, exit `cubic-bezier(0.55, 0, 1, 0.45)`, move in place `cubic-bezier(0.77, 0, 0.175, 1)`. Never `transition: all`, never ease-in on entrances, never scale from 0 (start at 0.95, 0.97 for small items).
- Press scale 0.96 (never below 0.95); wide surfaces change background instead of scaling. Hover only on fine pointers.
- Stagger only content that arrives on its own: 30–50 ms between list items, first six only.
- Animate only `transform` and `opacity`; honour `prefers-reduced-motion`; targets at least 44 px on touch.
- Async submit (checkout): disable at once, spinner only after 300 ms, held at least 500 ms; skeleton past 1 s. Progress grows with `scaleX` and never goes backward.

Suggest putting the durations and curves in `shared/design-tokens.json` (a `motion` group) so the app uses the same numbers. Please log a CONTRACT entry if you add them.

### 2026-11-17 · B · STATUS (food photos)

Got your ANSWER, thanks. Batch of 49 square dish photos is generating now (34 PandemKodi Dhaba, 15 Desi Desserts; 2048 px, saved at 1024×1024 JPEG, item-id slugs as you asked). Correction to my earlier entry: 26 items have no photo, not 25. After this batch I will make (c) one 3:2 cover per stall and (d) the 9 craving images, then post the full list marked AI-generated.

### 2026-11-17 · B · STATUS (taking the web design pass)

Owner's decision: **B makes the design/motion pass in `web/` itself** (replaces my REQUEST above; nothing for you to do there). To avoid clobbering each other, while this entry is open I am editing only: `web/src/app/globals.css`, `web/src/components/ui.tsx`, `cards.tsx`, `rail.tsx`, `add-button.tsx`, `bottom-nav.tsx`, `site-header.tsx`, and small class-name changes in the screen components. No changes to data, backend, routes, types or `shared/`. Please hold edits to those files until I post DONE, or log here if you need one of them sooner.

### 2026-11-17 · B · DONE (web design pass) — files released

Owner's design rules and the charles-ux-animation timings are applied in `web/`. `tsc --noEmit` and `eslint src` pass; checked on the running dev server at desktop and phone width, no console errors. What changed, so you can keep it consistent:

- `globals.css`: palette rewritten in **OKLCH** (same colours; hex kept in comments). `--color-line` is now **alpha** (`ink-900 / 0.11`), new `--color-line-strong` (`/ 0.28`) replaces `hover:border-ink-300`. Motion tokens `--ease-enter`, `--ease-exit`, `--ease-move` (Tailwind `ease-enter` etc.); `ease-out-expo` is gone. `pop` starts at scale 0.95. New utilities: `rail-fade` (carousel edge mask, 15 %, only on the side that can scroll), `icon-swap` (outgoing icon blurs 4px; nothing uses it yet, use it for any icon swap), `hit-44` (44px tap area via `::after`; element must be positioned), `spinner-delayed` (button spinner shows after 300ms). Icon stroke now follows the text weight next to it (CSS on `.lucide` by parent weight class).
- `ui.tsx`: buttons press to scale 0.96, `w-full` buttons only darken; `Button loading` uses the delayed spinner. `FoodImage` now renders a tinted tile with the photo `mix-blend-mode: multiply` (white menu-crop backgrounds disappear). `Chip` has a 44px hit area.
- `cards.tsx`: stall card no longer scales on press (wide surface). `rail.tsx`: `data-start` / `data-end` drive the fade; arrows get `hit-44`. `add-button.tsx`: ADD and stepper buttons get `hit-44`; ADD presses to 0.96. `bottom-nav.tsx`: cart bar darkens on press instead of scaling; tab icon strokes 2.25 / 2.5 active.
- `order-screen.tsx`: progress segments fill with `scaleX` (staggered 120ms, never go back). Nested radii follow *inner = outer − padding*: token card and pay box are `rounded-xl`, inner boxes `rounded-sm` (`4px` at `md:p-5`). `partner-screen.tsx`: lanes `rounded-xl p-3` → tickets `rounded-md` → token box `4px`. `admin-screen.tsx`, `partner-screen.tsx`: `min-h-dvh`.
- Not changed: there is no dark theme yet (the night header already uses lighter `night-800` surfaces, not shadows); no colour gradients exist (any new one must use `in oklch`).

**Please mirror in `shared/design-tokens.json`** (yours): `motion` → `{ press: 150, popover: 200, sheet: 260, page: 340, easeEnter: "cubic-bezier(0.32,0.72,0,1)", easeExit: "cubic-bezier(0.55,0,1,0.45)", easeMove: "cubic-bezier(0.77,0,0.175,1)" }` and `line` as `rgba(14,19,48,0.11)`. I will use the same values in Flutter.

### 2026-11-17 · B · STATUS (homepage hero, owner request)

Owner finds the homepage hero bland and asked for generated visuals. I am editing `web/src/components/home-screen.tsx` (hero section only) and adding `web/public/img/hero/*.jpg` (AI-generated night photo of a food truck park, string lights, palms, outdoor screen, matching the logo). Please hold edits to `home-screen.tsx` until I post DONE.

### 2026-11-17 · B · STATUS (customer site redesign, owner request)

The owner wants a much bolder customer website, using a reference landing page they shared. Decisions taken with the owner: keep Open Sky's **night sky + glowing ember** identity; this pass covers **home, header, footer**, then the **stall menu, search, cart and order tracking** pages; **no invented content** (no reviews, rewards, app-store links or opening hours until they are real).

Files I will be editing during this work: `web/src/app/globals.css`, `web/src/app/layout.tsx`, `web/src/app/(customer)/layout.tsx`, `web/src/components/{home-screen,site-header,site-footer,cards,rail,ui,bottom-nav,stall-screen,search-screen,cart-screen,order-screen}.tsx`, new files under `web/src/components/home/` and `web/public/hero/`. I will not touch data, backend, API routes, types, `partner`/`admin`/`staff` screens, or `shared/`. Please avoid those files until I post DONE; if you need one, log it here and I will hand it over. I will also write `DESIGN.md` from the built result at the end (your A8): tell me if you would rather own it.

### 2026-11-17 · B · CONTRACT (photos in the catalog, done by B on the owner's instruction)

The owner asked me to swap the low-resolution menu-art crops for photoshoot-style photos myself. Changes in your area, kept small:

- New folder `shared/img/photo/<stall_id>/<item-slug>.jpg` (1024×1024 JPEG, AI-generated stand-ins, owner to approve). `crop_images.py` does not write there, so re-running it is safe.
- `shared/seed/build.mjs`: new `photo(stallId, slug)` helper. `menu_items.image_url`, `stalls.cover_url` (`photo/<stall>/cover.jpg`), `banners.image_url` (photo of the banner's item) and `cravings.image_url` (photo of one named dish per craving) now prefer the photo when the file exists and fall back to the old crop otherwise. Delete a photo to restore the crop.
- Ran `node shared/seed/build.mjs` (catalog.json + supabase/seed.sql regenerated, only `image_url`/`cover_url` values changed) and `web/scripts/sync-shared.mjs`.
- Now: 30 of 54 items on photos. Coming as Flow finishes: the other 19 dishes, 5 curry+pulka combo shots, a 16:9 cover per stall. I will drop them into the same folder and re-run the build; no further script changes needed.

### 2026-11-17 · B · STATUS (new park logo on the website)

The owner added a redesigned logo, `Assets/Open Sky Food Park Logo-01.svg`, and asked me to use it now. Done in `web/`:

- `web/src/components/brand/open-sky-logo.tsx`: inline `<OpenSkyLogo variant="compact" | "full" animate? />` built from the SVG's paths (unique gradient ids per instance). The chef hat is the PNG the SVG embeds, extracted to `web/public/brand/chef-hat.png`. "FOOD PARK" and the tagline are live text in Montserrat 400 (`--font-logo`, added in `app/layout.tsx`); the original names an uninstalled "Gontserrat" font.
- Header: compact wordmark replaces the round badge and park name; the address moved beside it (desktop ≥1024px only). Footer: full logo. Home hero: full logo with a one-time ~1.7s intro (`.logo-intro` keyframes in `globals.css`; reduced motion shows the end state).
- `ParkLogo` (old badge) still exists and is still used by `staff-shell.tsx`; I did not touch staff screens. Favicon is still the old badge: the new logo is too detailed for 16–32px.
- The wordmark is white, so it only works on night surfaces. Owner has been told the designer should outline the text, vectorise the hat, and supply a dark-on-light and a compact icon version. **Flutter (B6):** I will build the app icon and splash from the same file once those exist.

### 2026-11-17 · B · CONTRACT (new logo everywhere, owner's standing rule)

The owner said `Assets/Open Sky Food Park Logo-01.svg` is **the** logo from now on. The old round badge is retired. Changes:

- `shared/img/brand/`: `open-sky-logo.svg` (copy of the original), `open-sky-logo-on-night.png` (1600×820 render on night navy), `open-sky-icon.svg` (the fork-in-the-O mark on a navy rounded square, for favicons and app icons).
- `shared/seed/build.mjs`: `park.logo_url` → `img/brand/open-sky-logo-on-night.png`; catalog and seed rebuilt.
- `web/src/app/layout.tsx`: favicon and apple icon → `/brand/icon.svg`.
- `web/src/components/staff-shell.tsx` (yours, small change on the owner's instruction): `StaffHeader` shows `<OpenSkyLogo variant="compact">` + the page title. `ParkLogo` is deleted from `site-header.tsx`; nothing references the old badge any more.
- `PRODUCT.md` (yours): the Brand Commitments still describe the old 150px badge. Please update it to the new logo.
- Flutter (mine): app icon and splash will use `open-sky-icon.svg` and `open-sky-logo-on-night.png`.

### 2026-11-17 05:40 · A · STATUS

Back after a gap; read everything above. Thanks for logging each change. Where the web stands:

- **Tested end to end in demo mode on `localhost:3001`** (your redesigned screens, my data layer): add from two stalls → sign in → checkout → demo payment → order page with one token per stall → `/partner` accept / ready / handed over, with the customer page following live across tabs → sold-out switch → `/admin` price edit and tax setting showing up on the customer side → table-service, pay-at-stall order. All working.
- `tsc`, `eslint src`, `next build` and `npm run db:test` (45 checks) pass.
- Dev server config (`.claude/launch.json`) now starts on port 3001, the port the owner uses.
- `web/README.md` rewritten: how to run, demo mode, connecting Supabase and Stripe, creating staff and admin accounts.
- `PRODUCT.md` brand section updated to the new logo and the owner's UI rules, as you asked.

### 2026-11-17 05:40 · A · CONTRACT (v1.1: tax per stall; tokens v2)

1. **`stall_orders.tax_cents`** (new, int, default 0): that stall's share of `orders.tax_cents`. `place_order` splits the order's tax across its stall orders; every stall but the last gets `round(subtotal × tax_percent / 100)` and the last takes the remainder, so the shares always add up. **Nothing changes for the customer bill**: still `tax = round(item_total × tax_percent / 100)`. Why: on a "pay at the stall" order the stall must collect `subtotal_cents + tax_cents`; before this the ticket showed the pre-tax amount. Flutter: add the field to the `StallOrder` model (default 0 when absent). Changed: `supabase/migrations/0001_init.sql` (no real database exists yet, so the first migration was amended rather than adding a second), `supabase/tests/smoke.mjs`, `web/src/lib/types.ts`, `web/src/lib/backend/demo.ts`, `web/src/components/partner-screen.tsx`.
2. **`shared/design-tokens.json` is now version 2**: `color.line` is `rgba(14,19,48,0.11)`, new `color.lineStrong` `rgba(14,19,48,0.28)`, and the `motion` group you asked for (`press 150`, `popover 200`, `sheet 260`, `page 340`, `easeEnter`, `easeExit`, `easeMove`, `pressScale 0.96`). Colours stay hex in the JSON for Flutter; the web writes the same colours in OKLCH.

### 2026-11-17 05:40 · A · ANSWER + REQUEST (to B)

- **`DESIGN.md` is yours** (board A8 moved to you). You are shaping the customer screens, so write it from the finished result. Please cover the staff screens too, or tell me and I will add that section.
- I am **not touching** the files in your redesign lock. Small things I found while testing that sit in them, for you to fold in:
  1. `order-screen.tsx` `headline()`: "Token 1 is ready" is ambiguous when two stalls both issued token 1. Suggest "Token 1 is ready at PandemKodi Dhaba".
  2. `stall-screen.tsx`: the browser tab title stays the site default on a stall page; set it to the stall name once the catalog loads.
  3. `cart-screen.tsx`: nothing to change. Line order inside a stall group is now fixed in `lib/cart.ts` (menu section first, then position).
- Small fixes I made in files you had edited but released (staff screens): `staff-shell.tsx` sign-out button has an `aria-label`; `admin-screen.tsx` shows a confirmation after saving settings (it was being wiped by the form refresh); `partner-screen.tsx` shows the amount with tax.
- Testing tip: the app's built-in browser pane is often hidden, and React only reveals streamed content on an animation frame. A page opened by **direct URL** to `/stall/…`, `/orders/…`, `/search` or `/account` then sits on its skeleton forever. Open `/` and click through instead (client-side navigation is fine), or bring the pane to the front.
- Next for me once the owner supplies a Supabase project and Stripe test keys: A9 and A7. Until then I am free for anything you want moved to my side.
